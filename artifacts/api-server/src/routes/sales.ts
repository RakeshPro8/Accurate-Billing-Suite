import { Router } from "express";
import { and, asc, desc, eq, exists, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { z } from "zod";
import { db, customersTable, productsTable, saleEventsTable, saleLineItemsTable, salePaymentsTable, salesTable, settingsTable } from "@workspace/db";
import {
  CreateSaleBody, DeleteSaleParams, GetSaleParams, GetSalesQueryParams,
  SendSaleEmailParams, UpdateSaleBody, UpdateSaleParams,
} from "@workspace/api-zod";
import { calculateTotals, getTaxConfig, assertMoney } from "../lib/tax";
import { requireCurrentStoreId } from "../lib/stores";
import { escapeHtml, HttpError, validateRequest } from "../lib/http";
import { logAudit } from "../lib/audit";

const router = Router();
const saleIdParams = GetSaleParams;
const emailBody = z.object({ to: z.string().email().optional(), subject: z.string().max(200).optional(), message: z.string().max(5_000).optional() });
type SaleItemInput = { type: string; productId?: number; serviceId?: number; name: string; description?: string; quantity: number; unitPrice: number; discount?: number };
type SaleBody = { customerId?: number; customerName?: string; customerEmail?: string; status?: string; discount?: number; notes?: string; paymentMethod?: string; dueDate?: string; idempotencyKey?: string; items: SaleItemInput[] };
type SalesQuery = { search?: string; status?: string; customerId?: number; employeeId?: number; storeId?: number; dateFrom?: string; dateTo?: string; paymentMethod?: string; outstanding?: boolean; page?: number; limit?: number; sort?: string; direction?: string };
type NormalizedSaleItem = SaleItemInput & { quantity: number; unitPrice: number; discount: number; total: number };
const paymentInput = z.object({ amount: z.number().positive(), method: z.string().min(1).max(80), reference: z.string().max(160).optional(), note: z.string().max(500).optional() });
const refundInput = paymentInput;
const statusNoteInput = z.object({ note: z.string().max(500).optional() }).optional();

function parseSale(s: typeof salesTable.$inferSelect, balance = Number(s.total)) {
  return { ...s, subtotal: Number(s.subtotal), taxRate: Number(s.taxRate), tax: Number(s.tax), discount: Number(s.discount), total: Number(s.total), balance: Math.max(0, Math.round((balance + Number.EPSILON) * 100) / 100), createdAt: s.createdAt.toISOString() };
}
function parseItem(i: typeof saleLineItemsTable.$inferSelect) {
  return { ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discount: Number(i.discount), total: Number(i.total) };
}
function parsePayment(p: typeof salePaymentsTable.$inferSelect) {
  return { ...p, amount: Number(p.amount), createdAt: p.createdAt.toISOString() };
}
function parseEvent(e: typeof saleEventsTable.$inferSelect) {
  return { ...e, createdAt: e.createdAt.toISOString() };
}
function employee(req: Parameters<typeof requireCurrentStoreId>[0]) {
  if (!req.employee) throw new HttpError(401, "Authentication is required.", "AUTH_REQUIRED");
  return req.employee;
}
function manager(req: Parameters<typeof requireCurrentStoreId>[0]) {
  const current = employee(req);
  if (!["admin", "manager"].includes(current.role)) throw new HttpError(403, "A manager or admin is required for this action.", "FORBIDDEN");
  return current;
}
function money(value: unknown, label: string) {
  try { return assertMoney(value, label); } catch { throw new HttpError(400, `${label} must be a finite non-negative amount.`, "INVALID_REQUEST"); }
}
function normalizeItems(items: SaleItemInput[]): NormalizedSaleItem[] {
  if (!items.length || items.length > 100) throw new HttpError(400, "A sale needs between one and one hundred line items.", "INVALID_REQUEST");
  return items.map((item) => {
    const quantity = money(item.quantity, "Quantity");
    const unitPrice = money(item.unitPrice, "Unit price");
    const discount = money(item.discount ?? 0, "Line item discount");
    if (quantity <= 0 || discount > quantity * unitPrice) throw new HttpError(400, "Line item values are invalid.", "INVALID_REQUEST");
    return { ...item, quantity, unitPrice, discount, total: Math.round((quantity * unitPrice - discount + Number.EPSILON) * 100) / 100 };
  });
}
function assertDiscountAuthority(items: Array<{ quantity: number; unitPrice: number; discount?: number }>, discount: number, maxDiscountPct: number) {
  const gross = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const concessions = discount + items.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  if (gross > 0 && concessions / gross * 100 > maxDiscountPct) throw new HttpError(403, `Discount exceeds your authorization. Max allowed: ${maxDiscountPct.toFixed(1)}% for your role.`, "DISCOUNT_NOT_AUTHORIZED");
}
function validateDates(dateFrom?: string, dateTo?: string) {
  const from = dateFrom ? new Date(dateFrom) : undefined;
  const to = dateTo ? new Date(dateTo) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) throw new HttpError(400, "Invalid date range.", "INVALID_REQUEST");
  return { from, to };
}
async function insertLineItems(tx: any, saleId: number, items: Array<{ type: string; productId?: number | null; serviceId?: number | null; name: string; description?: string | null; quantity: number; unitPrice: number; discount?: number; total?: number }>) {
  return Promise.all(items.map((item) => tx.insert(saleLineItemsTable).values({
    saleId, type: item.type || "product", productId: item.productId || null, serviceId: item.serviceId || null,
    name: item.name, description: item.description || null, quantity: String(item.quantity), unitPrice: String(item.unitPrice),
    discount: String(item.discount ?? 0), total: String(item.total ?? (item.quantity * item.unitPrice - (item.discount ?? 0))),
  }).returning().then((rows: any[]) => rows[0])));
}
async function addEvent(tx: any, saleId: number, action: string, fromStatus: string | null, toStatus: string | null, req: any, note?: string) {
  await tx.insert(saleEventsTable).values({ saleId, action, fromStatus, toStatus, note: note || null, employeeId: req.employee?.id ?? null, employeeName: req.employee?.name ?? null });
}
async function adjustInventory(tx: any, items: Array<{ productId?: number | null; quantity: number; name: string }>, storeId: number, direction: "decrement" | "restore") {
  for (const item of items) {
    if (!item.productId) continue;
    const quantity = direction === "restore" ? item.quantity : -item.quantity;
    const condition = direction === "restore"
      ? and(eq(productsTable.id, item.productId), eq(productsTable.storeId, storeId))
      : and(eq(productsTable.id, item.productId), eq(productsTable.storeId, storeId), sql`${productsTable.stock} >= ${item.quantity}`);
    const [product] = await tx.update(productsTable).set({ stock: sql`${productsTable.stock} + ${quantity}` }).where(condition).returning({ id: productsTable.id });
    if (!product) throw new HttpError(409, `Insufficient stock for ${item.name}.`, "INSUFFICIENT_STOCK");
  }
}
async function paymentTotals(tx: any, saleId: number) {
  const [row] = await tx.select({
    paid: sql<number>`coalesce(sum(case when ${salePaymentsTable.kind} = 'refund' then 0 else ${salePaymentsTable.amount}::numeric end), 0)`,
    refunded: sql<number>`coalesce(sum(case when ${salePaymentsTable.kind} = 'refund' then ${salePaymentsTable.amount}::numeric else 0 end), 0)`,
  }).from(salePaymentsTable).where(eq(salePaymentsTable.saleId, saleId));
  return { paid: Number(row?.paid ?? 0), refunded: Number(row?.refunded ?? 0) };
}
async function hydrateSale(source: any, sale: typeof salesTable.$inferSelect, id: number) {
  const [items, payments, events] = await Promise.all([
    source.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id)),
    source.select().from(salePaymentsTable).where(eq(salePaymentsTable.saleId, id)).orderBy(desc(salePaymentsTable.createdAt)),
    source.select().from(saleEventsTable).where(eq(saleEventsTable.saleId, id)).orderBy(desc(saleEventsTable.createdAt)),
  ]);
  const totals = payments.reduce((sum: number, p: any) => sum + (p.kind === "refund" ? -Number(p.amount) : Number(p.amount)), 0);
  return { ...parseSale(sale, Number(sale.total) - totals), items: items.map(parseItem), payments: payments.map(parsePayment), events: events.map(parseEvent) };
}
function idempotencyKey(req: any, body?: { idempotencyKey?: string }) {
  const key = req.get("Idempotency-Key") || body?.idempotencyKey;
  if (key && !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new HttpError(400, "Invalid idempotency key.", "INVALID_REQUEST");
  return key as string | undefined;
}

router.get("/", validateRequest({ query: GetSalesQueryParams }), async (req, res, next) => {
  try {
    const query = req.query as SalesQuery;
    const storeId = await requireCurrentStoreId(req);
    if (query.storeId !== undefined && query.storeId !== storeId) return res.json({ items: [], pagination: { page: 1, limit: query.limit ?? 25, total: 0, totalPages: 0 }, summary: { count: 0, total: 0, outstanding: 0 } });
    const { from, to } = validateDates(query.dateFrom, query.dateTo);
    const conds: any[] = [eq(salesTable.storeId, storeId)];
    if (query.status) conds.push(eq(salesTable.status, query.status));
    if (query.customerId) conds.push(eq(salesTable.customerId, query.customerId));
    if (query.employeeId) conds.push(eq(salesTable.employeeId, query.employeeId));
    if (query.paymentMethod) conds.push(eq(salesTable.paymentMethod, query.paymentMethod));
    if (from) conds.push(gte(salesTable.createdAt, from));
  if (to) {
    to.setHours(23, 59, 59, 999);
    conds.push(lte(salesTable.createdAt, to));
  }
    if (query.search) {
      const term = `%${query.search}%`;
      conds.push(or(ilike(salesTable.invoiceNumber, term), ilike(salesTable.customerName, term), ilike(salesTable.customerEmail, term), exists(sql`select 1 from ${customersTable} c where c.id = ${salesTable.customerId} and (c.phone ilike ${term} or c.name ilike ${term} or c.email ilike ${term})`), exists(sql`select 1 from ${saleLineItemsTable} sli left join ${productsTable} p on p.id = sli.product_id where sli.sale_id = ${salesTable.id} and (sli.name ilike ${term} or p.sku ilike ${term})`)));
    }
    const outstandingSql = sql`(${salesTable.total}::numeric - coalesce((select sum(case when sp.kind = 'refund' then -sp.amount::numeric else sp.amount::numeric end) from sale_payments sp where sp.sale_id = ${salesTable.id}), 0))`;
    if (query.outstanding === true) conds.push(sql`${outstandingSql} > 0`);
    if (query.outstanding === false) conds.push(sql`${outstandingSql} <= 0`);
    const where = and(...conds);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(salesTable).where(where);
    const [summary] = await db.select({
      total: sql<number>`coalesce(sum(${salesTable.total}::numeric), 0)`,
      outstanding: sql<number>`coalesce(sum(case when ${outstandingSql} > 0 then ${outstandingSql} else 0 end), 0)`,
    }).from(salesTable).where(where);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));
    const sortMap: Record<string, any> = { createdAt: salesTable.createdAt, invoiceNumber: salesTable.invoiceNumber, customerName: salesTable.customerName, total: salesTable.total, status: salesTable.status };
    const sortColumn = sortMap[query.sort ?? "createdAt"] ?? salesTable.createdAt;
    const rows = await db.select().from(salesTable).where(where).orderBy((query.direction ?? "desc") === "asc" ? asc(sortColumn) : desc(sortColumn)).limit(limit).offset((page - 1) * limit);
    const items = await Promise.all(rows.map(async (sale) => {
      const totals = await paymentTotals(db, sale.id);
      const balance = ["voided", "refunded"].includes(sale.status) ? 0 : Number(sale.total) - totals.paid + totals.refunded;
      return parseSale(sale, balance);
    }));
    return res.json({ items, pagination: { page, limit, total: Number(count), totalPages: Math.ceil(Number(count) / limit) }, summary: { count: Number(count), total: Number(summary?.total ?? 0), outstanding: Number(summary?.outstanding ?? 0) } });
  } catch (error) { return next(error); }
});

router.post("/", validateRequest({ body: CreateSaleBody }), async (req, res, next) => {
  try {
    const body = req.body as SaleBody;
    const current = employee(req);
    const storeId = await requireCurrentStoreId(req);
    const key = idempotencyKey(req, body);
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${storeId})`);
      if (key) {
        const [existing] = await tx.select().from(salesTable).where(and(eq(salesTable.idempotencyKey, key), eq(salesTable.storeId, storeId))).limit(1);
        if (existing) return hydrateSale(tx, existing, existing.id);
      }
      const items = normalizeItems(body.items);
      const discount = money(body.discount ?? 0, "Discount");
      assertDiscountAuthority(items, discount, current.maxDiscountPct ?? 0);
      const totals = calculateTotals(items, await getTaxConfig(), discount);
      if (body.customerId) {
        const [customer] = await tx.select({ id: customersTable.id }).from(customersTable).where(and(eq(customersTable.id, body.customerId), eq(customersTable.storeId, storeId)));
        if (!customer) throw new HttpError(400, "Customer is unavailable.", "INVALID_REQUEST");
      }
      if (body.status && !["draft", "invoice", "paid"].includes(body.status)) throw new HttpError(400, "Invalid sale status.", "INVALID_REQUEST");
      const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(salesTable).where(eq(salesTable.storeId, storeId));
      const [settings] = await tx.select({ invoicePrefix: settingsTable.invoicePrefix }).from(settingsTable).limit(1);
      const status = body.status ?? "invoice";
      const invoiceNumber = `${settings?.invoicePrefix ?? "INV-"}${String(Number(count) + 1).padStart(4, "0")}`;
      const [sale] = await tx.insert(salesTable).values({
        invoiceNumber, idempotencyKey: key ?? null, customerId: body.customerId ?? null, customerName: body.customerName ?? null, customerEmail: body.customerEmail ?? null,
        employeeId: current.id, employeeName: current.name, storeId, status, subtotal: String(totals.subtotal), taxRate: String(totals.taxRate), tax: String(totals.tax), discount: String(discount), total: String(totals.total),
        notes: body.notes ?? null, paymentMethod: status === "paid" ? body.paymentMethod ?? "Cash" : body.paymentMethod ?? null, dueDate: body.dueDate ?? null, paidAt: status === "paid" ? new Date().toISOString() : null,
      }).returning();
      await insertLineItems(tx, sale.id, items);
      if (status !== "draft") await adjustInventory(tx, items, storeId, "decrement");
      if (status === "paid") await tx.insert(salePaymentsTable).values({ saleId: sale.id, amount: String(totals.total), method: body.paymentMethod ?? "Cash", kind: "payment", employeeId: current.id, employeeName: current.name, idempotencyKey: key ? `${key}-payment` : null });
      await addEvent(tx, sale.id, "created", null, status, req);
      return hydrateSale(tx, sale, sale.id);
    });
    await logAudit(req, "create", "sale", result.id, { invoiceNumber: result.invoiceNumber, total: result.total });
    return res.status(201).json(result);
  } catch (error) { return next(error); }
});

router.get("/:id", validateRequest({ params: saleIdParams }), async (req, res, next) => {
  try {
    const storeId = await requireCurrentStoreId(req);
    const [sale] = await db.select().from(salesTable).where(and(eq(salesTable.id, Number(req.params.id)), eq(salesTable.storeId, storeId)));
    if (!sale) throw new HttpError(404, "Invoice not found.", "NOT_FOUND");
    return res.json(await hydrateSale(db, sale, sale.id));
  } catch (error) { return next(error); }
});

router.patch("/:id", validateRequest({ params: UpdateSaleParams, body: UpdateSaleBody }), async (req, res, next) => {
  try {
    const body = req.body as any;
    const current = employee(req);
    const storeId = await requireCurrentStoreId(req);
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(salesTable).where(and(eq(salesTable.id, Number(req.params.id)), eq(salesTable.storeId, storeId))).for("update");
      if (!existing) throw new HttpError(404, "Invoice not found.", "NOT_FOUND");
      if (body.items !== undefined || body.discount !== undefined || body.customerName !== undefined || body.customerEmail !== undefined) {
        if (existing.status !== "draft") throw new HttpError(409, "Only drafts can be edited. Use a payment, void, or refund action for posted sales.", "SALE_LOCKED");
        const items = normalizeItems(body.items ?? (await tx.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, existing.id))).map(parseItem));
        const discount = money(body.discount ?? Number(existing.discount), "Discount");
        assertDiscountAuthority(items, discount, current.maxDiscountPct ?? 0);
        const totals = calculateTotals(items, await getTaxConfig(), discount);
        await tx.delete(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, existing.id));
        await insertLineItems(tx, existing.id, items);
        const [updated] = await tx.update(salesTable).set({ customerId: body.customerId ?? existing.customerId, customerName: body.customerName ?? existing.customerName, customerEmail: body.customerEmail ?? existing.customerEmail, notes: body.notes ?? existing.notes, paymentMethod: body.paymentMethod ?? existing.paymentMethod, dueDate: body.dueDate ?? existing.dueDate, subtotal: String(totals.subtotal), taxRate: String(totals.taxRate), tax: String(totals.tax), discount: String(discount), total: String(totals.total) }).where(eq(salesTable.id, existing.id)).returning();
        return hydrateSale(tx, updated, updated.id);
      }
      if (body.status === "paid") {
        if (existing.status === "paid") return hydrateSale(tx, existing, existing.id);
        const totals = await paymentTotals(tx, existing.id);
        if (totals.paid - totals.refunded + 0.005 < Number(existing.total)) throw new HttpError(409, "Record the full payment before marking this sale paid.", "PAYMENT_REQUIRED");
        const [updated] = await tx.update(salesTable).set({ status: "paid", paidAt: existing.paidAt ?? new Date().toISOString() }).where(eq(salesTable.id, existing.id)).returning();
        await addEvent(tx, existing.id, "status_change", existing.status, "paid", req);
        return hydrateSale(tx, updated, updated.id);
      }
      throw new HttpError(400, "Use a payment, void, refund, or draft edit action.", "INVALID_REQUEST");
    });
    await logAudit(req, "update", "sale", result.id, { lifecycle: true });
    return res.json(result);
  } catch (error) { return next(error); }
});

router.delete("/:id", validateRequest({ params: DeleteSaleParams }), async (req, res, next) => {
  try {
    const current = employee(req);
    const storeId = await requireCurrentStoreId(req);
    await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(salesTable).where(and(eq(salesTable.id, Number(req.params.id)), eq(salesTable.storeId, storeId))).for("update");
      if (!sale) throw new HttpError(404, "Invoice not found.", "NOT_FOUND");
      if (["voided", "refunded"].includes(sale.status)) throw new HttpError(409, "A voided or refunded sale cannot receive a payment.", "SALE_CONFLICT");
      if (sale.status !== "draft" || (current.role !== "admin" && current.role !== "manager")) throw new HttpError(409, "Posted sales are never deleted. Void or refund the invoice instead.", "SALE_NOT_DELETABLE");
      await tx.delete(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, sale.id));
      await tx.delete(saleEventsTable).where(eq(saleEventsTable.saleId, sale.id));
      await tx.delete(salesTable).where(eq(salesTable.id, sale.id));
    });
    await logAudit(req, "delete", "sale", String(req.params.id), { draftOnly: true });
    return res.status(204).send();
  } catch (error) { return next(error); }
});

router.post("/:id/payments", validateRequest({ params: saleIdParams, body: paymentInput }), async (req, res, next) => {
  try {
    const current = employee(req);
    const storeId = await requireCurrentStoreId(req);
    const key = req.get("Idempotency-Key");
    if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new HttpError(400, "An Idempotency-Key header is required.", "INVALID_REQUEST");
    const body = req.body as any;
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(salesTable).where(and(eq(salesTable.id, Number(req.params.id)), eq(salesTable.storeId, storeId))).for("update");
      if (!sale) throw new HttpError(404, "Invoice not found.", "NOT_FOUND");
      if (sale.status === "voided") throw new HttpError(409, "A voided sale cannot be refunded.", "SALE_CONFLICT");
      const [existingPayment] = await tx.select().from(salePaymentsTable).where(and(eq(salePaymentsTable.saleId, sale.id), eq(salePaymentsTable.idempotencyKey, key))).limit(1);
      if (existingPayment) return hydrateSale(tx, sale, sale.id);
      const amount = money(body.amount, "Payment amount");
      const totals = await paymentTotals(tx, sale.id);
      if (amount <= 0 || amount > Number(sale.total) - totals.paid + totals.refunded + 0.005) throw new HttpError(409, "Payment exceeds the outstanding balance.", "PAYMENT_CONFLICT");
      await tx.insert(salePaymentsTable).values({ saleId: sale.id, amount: String(amount), method: body.method, reference: body.reference ?? null, note: body.note ?? null, kind: "payment", employeeId: current.id, employeeName: current.name, idempotencyKey: key });
      const newBalance = Number(sale.total) - (totals.paid + amount - totals.refunded);
      const nextStatus = newBalance <= 0.005 ? "paid" : sale.status === "draft" ? "invoice" : sale.status;
      const [updated] = await tx.update(salesTable).set({ status: nextStatus, paymentMethod: body.method, paidAt: nextStatus === "paid" ? new Date().toISOString() : sale.paidAt }).where(eq(salesTable.id, sale.id)).returning();
      await addEvent(tx, sale.id, "payment", sale.status, nextStatus, req, body.note);
      return hydrateSale(tx, updated, updated.id);
    });
    await logAudit(req, "payment", "sale", result.id, { amount: body.amount, method: body.method });
    return res.status(201).json(result);
  } catch (error) { return next(error); }
});

router.post("/:id/void", validateRequest({ params: saleIdParams, body: statusNoteInput }), async (req, res, next) => {
  try {
    const current = manager(req);
    const storeId = await requireCurrentStoreId(req);
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(salesTable).where(and(eq(salesTable.id, Number(req.params.id)), eq(salesTable.storeId, storeId))).for("update");
      if (!sale) throw new HttpError(404, "Invoice not found.", "NOT_FOUND");
      if (sale.status === "voided") return hydrateSale(tx, sale, sale.id);
      if (["refunded"].includes(sale.status)) throw new HttpError(409, "A refunded sale cannot be voided.", "SALE_CONFLICT");
      const items = (await tx.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, sale.id))).map(parseItem);
      if (sale.status !== "draft") await adjustInventory(tx, items, storeId, "restore");
      const [updated] = await tx.update(salesTable).set({ status: "voided" }).where(eq(salesTable.id, sale.id)).returning();
      await addEvent(tx, sale.id, "void", sale.status, "voided", req, req.body?.note);
      return hydrateSale(tx, updated, updated.id);
    });
    await logAudit(req, "status_change", "sale", result.id, { from: "posted", to: "voided", employeeId: current.id });
    return res.json(result);
  } catch (error) { return next(error); }
});

router.post("/:id/refund", validateRequest({ params: saleIdParams, body: refundInput }), async (req, res, next) => {
  try {
    const current = manager(req);
    const storeId = await requireCurrentStoreId(req);
    const key = req.get("Idempotency-Key");
    if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new HttpError(400, "An Idempotency-Key header is required.", "INVALID_REQUEST");
    const body = req.body as any;
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(salesTable).where(and(eq(salesTable.id, Number(req.params.id)), eq(salesTable.storeId, storeId))).for("update");
      if (!sale) throw new HttpError(404, "Invoice not found.", "NOT_FOUND");
      const [existingPayment] = await tx.select().from(salePaymentsTable).where(and(eq(salePaymentsTable.saleId, sale.id), eq(salePaymentsTable.idempotencyKey, key))).limit(1);
      if (existingPayment) return hydrateSale(tx, sale, sale.id);
      const amount = money(body.amount, "Refund amount");
      const totals = await paymentTotals(tx, sale.id);
      if (amount <= 0 || amount > totals.paid - totals.refunded + 0.005) throw new HttpError(409, "Refund exceeds captured payments.", "REFUND_CONFLICT");
      await tx.insert(salePaymentsTable).values({ saleId: sale.id, amount: String(amount), method: body.method, reference: body.reference ?? null, note: body.note ?? null, kind: "refund", employeeId: current.id, employeeName: current.name, idempotencyKey: key });
      const fullRefund = totals.paid - totals.refunded - amount <= 0.005;
      if (fullRefund && sale.status !== "refunded") {
        const items = (await tx.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, sale.id))).map(parseItem);
        await adjustInventory(tx, items, storeId, "restore");
      }
      const [updated] = await tx.update(salesTable).set({ status: fullRefund ? "refunded" : sale.status }).where(eq(salesTable.id, sale.id)).returning();
      await addEvent(tx, sale.id, "refund", sale.status, updated.status, req, body.note);
      return hydrateSale(tx, updated, updated.id);
    });
    await logAudit(req, "payment", "sale", result.id, { refund: body.amount, method: body.method });
    return res.json(result);
  } catch (error) { return next(error); }
});

router.post("/:id/duplicate", validateRequest({ params: saleIdParams }), async (req, res, next) => {
  try {
    const current = employee(req);
    const storeId = await requireCurrentStoreId(req);
    const key = idempotencyKey(req);
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${storeId})`);
      if (key) {
        const [existing] = await tx.select().from(salesTable).where(and(eq(salesTable.idempotencyKey, key), eq(salesTable.storeId, storeId))).limit(1);
        if (existing) return hydrateSale(tx, existing, existing.id);
      }
      const [source] = await tx.select().from(salesTable).where(and(eq(salesTable.id, Number(req.params.id)), eq(salesTable.storeId, storeId)));
      if (!source) throw new HttpError(404, "Invoice not found.", "NOT_FOUND");
      const items = (await tx.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, source.id))).map(parseItem);
      const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(salesTable).where(eq(salesTable.storeId, storeId));
      const [settings] = await tx.select({ invoicePrefix: settingsTable.invoicePrefix }).from(settingsTable).limit(1);
      const [sale] = await tx.insert(salesTable).values({ invoiceNumber: `${settings?.invoicePrefix ?? "INV-"}${String(Number(count) + 1).padStart(4, "0")}`, idempotencyKey: key ?? null, customerId: source.customerId, customerName: source.customerName, customerEmail: source.customerEmail, employeeId: current.id, employeeName: current.name, storeId, status: "draft", subtotal: source.subtotal, taxRate: source.taxRate, tax: source.tax, discount: source.discount, total: source.total, notes: source.notes, paymentMethod: source.paymentMethod, dueDate: source.dueDate }).returning();
      await insertLineItems(tx, sale.id, items);
      await addEvent(tx, sale.id, "duplicated", null, "draft", req, `Copied from ${source.invoiceNumber}`);
      return hydrateSale(tx, sale, sale.id);
    });
    await logAudit(req, "create", "sale", result.id, { duplicatedFrom: req.params.id, invoiceNumber: result.invoiceNumber });
    return res.status(201).json(result);
  } catch (error) { return next(error); }
});

router.post("/:id/send-email", validateRequest({ params: SendSaleEmailParams, body: emailBody }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof emailBody>;
    const storeId = await requireCurrentStoreId(req);
    const [sale] = await db.select().from(salesTable).where(and(eq(salesTable.id, Number(req.params.id)), eq(salesTable.storeId, storeId)));
    if (!sale) throw new HttpError(404, "Invoice not found.", "NOT_FOUND");
    if (!sale.customerEmail) throw new HttpError(400, "No recipient email address.", "INVALID_REQUEST");
    if (body.to && body.to.trim().toLowerCase() !== sale.customerEmail.trim().toLowerCase()) throw new HttpError(400, "Invoices may only be sent to the sale customer's email address.", "INVALID_RECIPIENT");
    const [settings] = await db.select().from(settingsTable).limit(1);
    if (!settings?.smtpHost || !settings.smtpUser || !settings.smtpPass) throw new HttpError(400, "SMTP not configured. Go to Settings → Email to set it up.", "SMTP_NOT_CONFIGURED");
    const items = await db.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, sale.id));
    const businessName = settings.businessName ?? "Mobilinq";
    const itemRows = items.map((item) => `<tr><td style="padding:4px 8px">${escapeHtml(item.name)}</td><td style="padding:4px 8px;text-align:right">${escapeHtml(item.quantity)} × $${Number(item.unitPrice).toFixed(2)}</td><td style="padding:4px 8px;text-align:right">$${Number(item.total).toFixed(2)}</td></tr>`).join("");
    const transporter = nodemailer.createTransport({ host: settings.smtpHost, port: Number(settings.smtpPort ?? 587), secure: Number(settings.smtpPort) === 465, auth: { user: settings.smtpUser, pass: settings.smtpPass } });
    await transporter.sendMail({ from: `"${businessName}" <${settings.smtpUser}>`, to: sale.customerEmail, subject: body.subject ?? `Invoice ${sale.invoiceNumber} from ${businessName}`, text: body.message, html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#0d9488">${escapeHtml(businessName)}</h2><p>Dear ${escapeHtml(sale.customerName ?? "Customer")},</p><p>${escapeHtml(body.message ?? `Please find your invoice ${sale.invoiceNumber} below.`)}</p><table style="width:100%;border-collapse:collapse"><tbody>${itemRows}</tbody><tfoot><tr><td colspan="2" style="text-align:right;font-weight:bold">TOTAL</td><td style="text-align:right;font-weight:bold">$${Number(sale.total).toFixed(2)}</td></tr></tfoot></table></div>` });
    await logAudit(req, "update", "sale", sale.id, { action: "email", recipient: sale.customerEmail });
    return res.json({ message: `Invoice emailed to ${sale.customerEmail}` });
  } catch (error) { return next(error); }
});

export default router;