import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleLineItemsTable, settingsTable } from "@workspace/db";
import { eq, and, gte, inArray, lte, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { z } from "zod/v4";
import {
  CreateSaleBody,
  DeleteSaleParams,
  GetSaleParams,
  GetSalesQueryParams,
  SendSaleEmailParams,
  UpdateSaleBody,
  UpdateSaleParams,
} from "@workspace/api-zod";
import { calculateTotals, getTaxConfig, assertMoney } from "../lib/tax";
import { requireCurrentStoreId } from "../lib/stores";
import { escapeHtml, HttpError, validateRequest } from "../lib/http";
import { logAudit } from "../lib/audit";

const router = Router();
const saleIdParams = GetSaleParams;
const emailBody = z.object({
  to: z.string().email().optional(),
  subject: z.string().max(200).optional(),
  message: z.string().max(5_000).optional(),
});
type SaleItemInput = {
  type: string;
  productId?: number;
  serviceId?: number;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
};
type SaleBody = {
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  status?: string;
  discount?: number;
  notes?: string;
  paymentMethod?: string;
  dueDate?: string;
  paidAt?: string;
  items: SaleItemInput[];
};
type SaleUpdateBody = Partial<Omit<SaleBody, "items">> & { items?: SaleItemInput[] };
type SalesQuery = { status?: string; customerId?: number; dateFrom?: string; dateTo?: string };
type NormalizedSaleItem = SaleItemInput & { quantity: number; unitPrice: number; discount: number; total: number };

function parseSale(s: typeof salesTable.$inferSelect) {
  return {
    ...s,
    subtotal: parseFloat(s.subtotal),
    taxRate: parseFloat(s.taxRate),
    tax: parseFloat(s.tax),
    discount: parseFloat(s.discount),
    total: parseFloat(s.total),
    createdAt: s.createdAt.toISOString(),
  };
}

function parseItem(i: typeof saleLineItemsTable.$inferSelect) {
  return {
    ...i,
    quantity: parseFloat(i.quantity),
    unitPrice: parseFloat(i.unitPrice),
    discount: parseFloat(i.discount),
    total: parseFloat(i.total),
  };
}

function requestEmployee(req: Parameters<typeof requireCurrentStoreId>[0]) {
  if (!req.employee) throw new HttpError(401, "Authentication is required.", "AUTH_REQUIRED");
  return req.employee;
}

function money(value: unknown, label: string) {
  try {
    return assertMoney(value, label);
  } catch {
    throw new HttpError(400, `${label} must be a finite non-negative amount.`, "INVALID_REQUEST");
  }
}

function normalizeItems(items: SaleItemInput[]): NormalizedSaleItem[] {
  if (!items.length) throw new HttpError(400, "At least one line item is required.", "INVALID_REQUEST");
  return items.map((item) => {
    const quantity = money(item.quantity, "Quantity");
    const unitPrice = money(item.unitPrice, "Unit price");
    const discount = money(item.discount ?? 0, "Line item discount");
    const gross = quantity * unitPrice;
    if (discount > gross) {
      throw new HttpError(400, "Line item discount cannot exceed its amount.", "INVALID_REQUEST");
    }
    return { ...item, quantity, unitPrice, discount, total: Math.round((gross - discount + Number.EPSILON) * 100) / 100 };
  });
}

function assertDiscountAuthority(
  items: Array<{ quantity: number; unitPrice: number; discount?: number }>,
  discount: number,
  maxDiscountPct: number,
) {
  const gross = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const concessions = discount + items.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  if (gross > 0 && (concessions / gross) * 100 > maxDiscountPct) {
    throw new HttpError(
      403,
      `Discount exceeds your authorization. Max allowed: ${maxDiscountPct.toFixed(1)}% for your role.`,
      "DISCOUNT_NOT_AUTHORIZED",
    );
  }
}

function validateDates(dateFrom?: string, dateTo?: string) {
  const from = dateFrom ? new Date(dateFrom) : undefined;
  const to = dateTo ? new Date(dateTo) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) {
    throw new HttpError(400, "Invalid date range.", "INVALID_REQUEST");
  }
  return { from, to };
}

async function insertLineItems(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  saleId: number,
  items: NormalizedSaleItem[],
) {
  return Promise.all(items.map(async (item) => {
    const [lineItem] = await tx.insert(saleLineItemsTable).values({
      saleId,
      type: item.type || "product",
      productId: item.productId || null,
      serviceId: item.serviceId || null,
      name: item.name,
      description: item.description || null,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      discount: String(item.discount),
      total: String(item.total),
    }).returning();
    return lineItem;
  }));
}

router.get("/", validateRequest({ query: GetSalesQueryParams }), async (req, res, next) => {
  try {
    const { status, customerId, dateFrom, dateTo } = req.query as SalesQuery;
    const { from, to } = validateDates(dateFrom, dateTo);
    const storeId = await requireCurrentStoreId(req);
    const conds = [eq(salesTable.storeId, storeId)];
    if (status) conds.push(eq(salesTable.status, status));
    if (customerId) conds.push(eq(salesTable.customerId, customerId));
    if (from) conds.push(gte(salesTable.createdAt, from));
    if (to) conds.push(lte(salesTable.createdAt, to));
    const sales = await db.select().from(salesTable).where(and(...conds)).orderBy(sql`${salesTable.createdAt} desc`);
    const ids = sales.map((sale) => sale.id);
    const items = ids.length
      ? await db.select().from(saleLineItemsTable).where(inArray(saleLineItemsTable.saleId, ids))
      : [];
    return res.json(sales.map((sale) => ({ ...parseSale(sale), items: items.filter((item) => item.saleId === sale.id).map(parseItem) })));
  } catch (error) {
    return next(error);
  }
});

router.post("/", validateRequest({ body: CreateSaleBody }), async (req, res, next) => {
  try {
    const body = req.body as SaleBody;
    const employee = requestEmployee(req);
    const storeId = await requireCurrentStoreId(req);
    const items = normalizeItems(body.items);
    const discount = money(body.discount ?? 0, "Discount");
    assertDiscountAuthority(items, discount, employee.maxDiscountPct ?? 0);
    const totals = calculateTotals(items, await getTaxConfig(), discount);

    const result = await db.transaction(async (tx) => {
      // Serialize per-store numbering while allowing other stores to invoice concurrently.
      await tx.execute(sql`select pg_advisory_xact_lock(${storeId})`);
      const [settings] = await tx.select({ invoicePrefix: settingsTable.invoicePrefix }).from(settingsTable).limit(1);
      const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(salesTable)
        .where(eq(salesTable.storeId, storeId));
      const invoiceNumber = `${settings?.invoicePrefix ?? "INV-"}${String(Number(count) + 1).padStart(4, "0")}`;
      const [sale] = await tx.insert(salesTable).values({
        invoiceNumber, customerId: body.customerId ?? null, customerName: body.customerName ?? null,
        customerEmail: body.customerEmail ?? null, employeeId: employee.id, employeeName: employee.name,
        storeId, status: body.status ?? "invoice", subtotal: String(totals.subtotal), taxRate: String(totals.taxRate),
        tax: String(totals.tax), discount: String(discount), total: String(totals.total),
        notes: body.notes ?? null, paymentMethod: body.paymentMethod ?? null, dueDate: body.dueDate ?? null,
      }).returning();
      const lineItems = await insertLineItems(tx, sale.id, items);
      return { sale, lineItems };
    });
    await logAudit(req, "create", "sale", result.sale.id, { invoiceNumber: result.sale.invoiceNumber, total: totals.total });
    return res.status(201).json({ ...parseSale(result.sale), items: result.lineItems.map(parseItem) });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", validateRequest({ params: saleIdParams }), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const storeId = await requireCurrentStoreId(req);
    const [sale] = await db.select().from(salesTable).where(and(eq(salesTable.id, id), eq(salesTable.storeId, storeId)));
    if (!sale) throw new HttpError(404, "Not found", "NOT_FOUND");
    const items = await db.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
    return res.json({ ...parseSale(sale), items: items.map(parseItem) });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", validateRequest({ params: UpdateSaleParams, body: UpdateSaleBody }), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body as SaleUpdateBody;
    const employee = requestEmployee(req);
    const storeId = await requireCurrentStoreId(req);
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(salesTable)
        .where(and(eq(salesTable.id, id), eq(salesTable.storeId, storeId)));
      if (!existing) throw new HttpError(404, "Not found", "NOT_FOUND");
      const existingItems = await tx.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
      const itemInputs = body.items ?? existingItems.map((item) => ({
        ...item, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), discount: Number(item.discount),
      }));
      const normalizedItems = normalizeItems(itemInputs as SaleItemInput[]);
      const discount = money(body.discount ?? Number(existing.discount), "Discount");
      assertDiscountAuthority(normalizedItems, discount, employee.maxDiscountPct ?? 0);
      const updates: Record<string, unknown> = {};
      for (const key of ["customerId", "customerName", "customerEmail", "status", "notes", "paymentMethod", "dueDate", "paidAt"] as const) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      if (body.items !== undefined || body.discount !== undefined) {
        const totals = calculateTotals(normalizedItems, await getTaxConfig(), discount);
        Object.assign(updates, {
          subtotal: String(totals.subtotal), taxRate: String(totals.taxRate), tax: String(totals.tax),
          discount: String(discount), total: String(totals.total),
        });
      }
      if (body.items !== undefined) {
        await tx.delete(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
        await insertLineItems(tx, id, normalizedItems);
      }
      const [sale] = await tx.update(salesTable).set(updates).where(and(eq(salesTable.id, id), eq(salesTable.storeId, storeId))).returning();
      const lineItems = body.items !== undefined
        ? await tx.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id))
        : existingItems;
      return { sale, lineItems, fields: Object.keys(updates) };
    });
    await logAudit(req, "update", "sale", result.sale.id, { fields: result.fields });
    return res.json({ ...parseSale(result.sale), items: result.lineItems.map(parseItem) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", validateRequest({ params: DeleteSaleParams }), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const storeId = await requireCurrentStoreId(req);
    await db.transaction(async (tx) => {
      const [sale] = await tx.select({ id: salesTable.id }).from(salesTable)
        .where(and(eq(salesTable.id, id), eq(salesTable.storeId, storeId)));
      if (!sale) throw new HttpError(404, "Not found", "NOT_FOUND");
      await tx.delete(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
      await tx.delete(salesTable).where(and(eq(salesTable.id, id), eq(salesTable.storeId, storeId)));
    });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/send-email", validateRequest({ params: SendSaleEmailParams, body: emailBody }), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body as z.infer<typeof emailBody>;
    const storeId = await requireCurrentStoreId(req);
    const [sale] = await db.select().from(salesTable).where(and(eq(salesTable.id, id), eq(salesTable.storeId, storeId)));
    if (!sale) throw new HttpError(404, "Invoice not found.", "NOT_FOUND");
    if (!sale.customerEmail) throw new HttpError(400, "No recipient email address.", "INVALID_REQUEST");
    if (body.to && body.to.trim().toLowerCase() !== sale.customerEmail.trim().toLowerCase()) {
      throw new HttpError(400, "Invoices may only be sent to the sale customer's email address.", "INVALID_RECIPIENT");
    }
    const [settings] = await db.select().from(settingsTable).limit(1);
    if (!settings?.smtpHost || !settings.smtpUser || !settings.smtpPass) {
      throw new HttpError(400, "SMTP not configured. Go to Settings → Email to set it up.", "SMTP_NOT_CONFIGURED");
    }
    const items = await db.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
    const businessName = settings.businessName ?? "BillPro";
    const itemRows = items.map((item) =>
      `<tr><td style="padding:4px 8px">${escapeHtml(item.name)}</td><td style="padding:4px 8px;text-align:right">${escapeHtml(item.quantity)} × $${parseFloat(item.unitPrice).toFixed(2)}</td><td style="padding:4px 8px;text-align:right">$${parseFloat(item.total).toFixed(2)}</td></tr>`,
    ).join("");
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost, port: Number(settings.smtpPort ?? 587), secure: Number(settings.smtpPort) === 465,
      auth: { user: settings.smtpUser, pass: settings.smtpPass },
    });
    await transporter.sendMail({
      from: `"${businessName}" <${settings.smtpUser}>`, to: sale.customerEmail,
      subject: `Invoice ${sale.invoiceNumber} from ${businessName}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#0d9488">${escapeHtml(businessName)}</h2><p>Dear ${escapeHtml(sale.customerName ?? "Customer")},</p><p>Please find your invoice <strong>${escapeHtml(sale.invoiceNumber)}</strong> below.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px;text-align:right">Qty × Price</th><th style="padding:8px;text-align:right">Total</th></tr></thead><tbody>${itemRows}</tbody><tfoot><tr><td colspan="2" style="padding:8px;text-align:right;font-weight:bold">Discount</td><td style="padding:8px;text-align:right">-$${parseFloat(sale.discount).toFixed(2)}</td></tr><tr><td colspan="2" style="padding:8px;text-align:right;font-weight:bold">Tax (${parseFloat(sale.taxRate).toFixed(1)}%)</td><td style="padding:8px;text-align:right">$${parseFloat(sale.tax).toFixed(2)}</td></tr><tr style="background:#f1f5f9"><td colspan="2" style="padding:8px;text-align:right;font-weight:bold">TOTAL</td><td style="padding:8px;text-align:right;font-weight:bold">$${parseFloat(sale.total).toFixed(2)}</td></tr></tfoot></table><p style="color:#64748b;font-size:12px">This email was sent by ${escapeHtml(businessName)} via BillPro.</p></div>`,
    });
    return res.json({ message: `Invoice emailed to ${sale.customerEmail}` });
  } catch (error) {
    return next(error);
  }
});

export default router;