import { Router } from "express";
import { db } from "@workspace/db";
import { quotationsTable, quotationLineItemsTable, salesTable, saleLineItemsTable, settingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { calculateTotals, getTaxConfig, assertMoney } from "../lib/tax";
import { requireCurrentStoreId } from "../lib/stores";
import { HttpError, validateRequest } from "../lib/http";
import { logAudit } from "../lib/audit";
import { z } from "zod/v4";

const router = Router();
const idParams = z.object({ id: z.coerce.number().int().positive() });
const quoteStatus = z.enum(["draft", "sent", "accepted", "rejected", "converted"]);
const money = z.coerce.number().finite().min(0).max(1_000_000_000);
const lineItem = z.object({
  type: z.string().trim().min(1).max(40),
  productId: z.coerce.number().int().positive().optional(),
  serviceId: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(250),
  description: z.string().trim().max(1000).optional(),
  quantity: z.coerce.number().finite().positive().max(100_000),
  unitPrice: money,
  discount: money.optional(),
}).strict();
const quoteInput = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  customerName: z.string().trim().max(200).optional(),
  customerEmail: z.string().trim().email().max(254).optional(),
  status: quoteStatus.optional(),
  taxRate: z.coerce.number().finite().min(0).max(100).optional(),
  discount: money.optional(),
  notes: z.string().trim().max(4_000).optional(),
  validUntil: z.string().date().optional(),
  expiresAt: z.string().date().optional(),
  items: z.array(lineItem).max(100),
}).strict();
const quoteUpdate = quoteInput.partial().extend({ status: quoteStatus.optional() }).strict();
const quoteQuery = z.object({ status: quoteStatus.optional() }).strict();

function parseQuote(q: typeof quotationsTable.$inferSelect) {
  return {
    ...q,
    subtotal: parseFloat(q.subtotal),
    taxRate: parseFloat(q.taxRate),
    tax: parseFloat(q.tax),
    discount: parseFloat(q.discount),
    total: parseFloat(q.total),
    createdAt: q.createdAt.toISOString(),
  };
}

function parseItem(i: typeof quotationLineItemsTable.$inferSelect) {
  return {
    ...i,
    quantity: parseFloat(i.quantity),
    unitPrice: parseFloat(i.unitPrice),
    discount: parseFloat(i.discount),
    total: parseFloat(i.total),
  };
}

router.get("/", validateRequest({ query: quoteQuery }), async (req, res) => {
  try {
    const { status } = req.query as z.infer<typeof quoteQuery>;
    let q = db.select().from(quotationsTable).$dynamic();
    const currentStoreId = await requireCurrentStoreId(req);
    const conditions = [];
    if (status) conditions.push(eq(quotationsTable.status, status));
    conditions.push(eq(quotationsTable.storeId, currentStoreId));
    if (conditions.length) q = q.where(and(...conditions));
    const quotes = await q.orderBy(sql`${quotationsTable.createdAt} desc`);
    const items = await db.select().from(quotationLineItemsTable);
    return res.json(quotes.map(quo => ({
      ...parseQuote(quo),
      items: items.filter(i => i.quotationId === quo.id).map(parseItem),
    })));
  } catch (e) {
    throw e;
  }
});

router.post("/", validateRequest({ body: quoteInput }), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof quoteInput>;
    const storeId = await requireCurrentStoreId(req);
    const items = body.items;
    const discount = assertMoney(body.discount ?? 0, "Discount");
    const { subtotal, taxRate, tax, total } = calculateTotals(items, await getTaxConfig(), discount);
    const { quote, lineItems } = await db.transaction(async (tx) => {
      // A transaction-scoped PostgreSQL advisory lock serializes numbering only
      // within this store, without blocking other stores' quote creation.
      await tx.execute(sql`select pg_advisory_xact_lock(${storeId})`);
      const [settings] = await tx.select().from(settingsTable).limit(1);
      const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(quotationsTable).where(eq(quotationsTable.storeId, storeId));
      const quoteNumber = `${settings?.quotePrefix ?? "QUO-"}${String(Number(count) + 1).padStart(4, "0")}`;
      const [created] = await tx.insert(quotationsTable).values({
        quoteNumber, customerId: body.customerId || null, customerName: body.customerName || null,
        customerEmail: body.customerEmail || null, status: body.status ?? "draft", subtotal: String(subtotal),
        taxRate: String(taxRate), tax: String(tax), discount: String(discount), total: String(total),
        notes: body.notes || null, validUntil: body.validUntil ?? body.expiresAt ?? null, storeId,
      }).returning();
      const createdItems = [];
      for (const item of items) {
        const lineTotal = item.quantity * item.unitPrice - (item.discount || 0);
        const [lineItem] = await tx.insert(quotationLineItemsTable).values({ quotationId: created.id, type: item.type || "product", productId: item.productId || null, serviceId: item.serviceId || null, name: item.name, description: item.description || null, quantity: String(item.quantity), unitPrice: String(item.unitPrice), discount: String(item.discount || 0), total: String(lineTotal) }).returning();
        createdItems.push(lineItem);
      }
      return { quote: created, lineItems: createdItems };
    });
    await logAudit(req, "create", "quotation", quote.id, { quoteNumber: quote.quoteNumber, total });
    return res.status(201).json({ ...parseQuote(quote), items: lineItems.map(parseItem) });
  } catch (e) {
    throw e;
  }
});

router.get("/:id", validateRequest({ params: idParams }), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const storeId = await requireCurrentStoreId(req);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid quotation id.");
    const [quote] = await db.select().from(quotationsTable).where(and(eq(quotationsTable.id, id), eq(quotationsTable.storeId, storeId)));
    if (!quote) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, id));
    return res.json({ ...parseQuote(quote), items: items.map(parseItem) });
  } catch (e) {
    throw e;
  }
});

router.patch("/:id", validateRequest({ params: idParams, body: quoteUpdate }), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const storeId = await requireCurrentStoreId(req);
    const body = req.body as z.infer<typeof quoteUpdate>;
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid quotation id.");
    const [existingQuote] = await db.select({ id: quotationsTable.id }).from(quotationsTable).where(and(eq(quotationsTable.id, id), eq(quotationsTable.storeId, storeId)));
    if (!existingQuote) return res.status(404).json({ error: "Not found" });
    const updates: Record<string, unknown> = {};
    if (body.customerId !== undefined) updates.customerId = body.customerId;
    if (body.customerName !== undefined) updates.customerName = body.customerName;
    if (body.customerEmail !== undefined) updates.customerEmail = body.customerEmail;
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
      if (body.validUntil !== undefined) updates.validUntil = body.validUntil;
      if (body.expiresAt !== undefined) updates.validUntil = body.expiresAt;
    if (body.items !== undefined) {
      const discount = assertMoney(body.discount ?? 0, "Discount");
      const { subtotal, taxRate, tax, total } = calculateTotals(body.items, await getTaxConfig(), discount);
      updates.subtotal = String(subtotal);
      updates.taxRate = String(taxRate);
      updates.tax = String(tax);
      updates.discount = String(discount);
      updates.total = String(total);
    }
    const result = await db.transaction(async (tx) => {
      const [quote] = await tx.update(quotationsTable).set(updates).where(and(eq(quotationsTable.id, id), eq(quotationsTable.storeId, storeId))).returning();
      if (!quote) throw new HttpError(404, "Not found");
      if (body.items !== undefined) {
        await tx.delete(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, id));
        for (const item of body.items) {
          const lineTotal = item.quantity * item.unitPrice - (item.discount || 0);
          await tx.insert(quotationLineItemsTable).values({ quotationId: id, type: item.type || "product", productId: item.productId || null, serviceId: item.serviceId || null, name: item.name, description: item.description || null, quantity: String(item.quantity), unitPrice: String(item.unitPrice), discount: String(item.discount || 0), total: String(lineTotal) });
        }
      }
      const lineItems = await tx.select().from(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, id));
      return { quote, items: lineItems };
    });
    const { quote, items } = result;
    await logAudit(req, "update", "quotation", quote.id, { fields: Object.keys(updates) });
    return res.json({ ...parseQuote(quote), items: items.map(parseItem) });
  } catch (e) {
    throw e;
  }
});

router.delete("/:id", validateRequest({ params: idParams }), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const storeId = await requireCurrentStoreId(req);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid quotation id.");
    const [quote] = await db.select({ id: quotationsTable.id }).from(quotationsTable).where(and(eq(quotationsTable.id, id), eq(quotationsTable.storeId, storeId)));
    if (!quote) return res.status(404).json({ error: "Not found" });
    await db.transaction(async (tx) => { await tx.delete(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, id)); await tx.delete(quotationsTable).where(and(eq(quotationsTable.id, id), eq(quotationsTable.storeId, storeId))); });
    return res.status(204).send();
  } catch (e) {
    throw e;
  }
});

router.post("/:id/convert", validateRequest({ params: idParams, body: z.object({}).strict() }), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const storeId = await requireCurrentStoreId(req);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid quotation id.");
    const { quote, sale, lineItems } = await db.transaction(async (tx) => {
      // Claiming via a conditional update makes a second concurrent conversion
      // observe no row once the first transaction commits.
      const [claimed] = await tx.update(quotationsTable).set({ status: "converted" })
        .where(and(eq(quotationsTable.id, id), eq(quotationsTable.storeId, storeId), sql`${quotationsTable.status} <> 'converted'`))
        .returning();
      if (!claimed) throw new HttpError(409, "This quotation has already been converted.", "QUOTATION_ALREADY_CONVERTED");
      const quoteItems = await tx.select().from(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, id));
      // Use a distinct advisory-lock namespace for invoice counters.
      await tx.execute(sql`select pg_advisory_xact_lock(${storeId + 1000000000})`);
      const [settings] = await tx.select().from(settingsTable).limit(1);
      const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(salesTable).where(eq(salesTable.storeId, storeId));
      const invoiceNumber = `${settings?.invoicePrefix ?? "INV-"}${String(Number(count) + 1).padStart(4, "0")}`;
      const [createdSale] = await tx.insert(salesTable).values({
        invoiceNumber, customerId: claimed.customerId, customerName: claimed.customerName,
        customerEmail: claimed.customerEmail, status: "invoice", subtotal: claimed.subtotal,
        taxRate: claimed.taxRate, tax: claimed.tax, discount: claimed.discount, total: claimed.total,
        notes: claimed.notes, storeId,
      }).returning();
      const createdItems = [];
      for (const item of quoteItems) {
        const [lineItem] = await tx.insert(saleLineItemsTable).values({ saleId: createdSale.id, type: item.type, productId: item.productId, serviceId: item.serviceId, name: item.name, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, total: item.total }).returning();
        createdItems.push(lineItem);
      }
      return { quote: claimed, sale: createdSale, lineItems: createdItems };
    });
    await logAudit(req, "convert", "quotation", quote.id, { saleId: sale.id });
    return res.status(201).json({
      ...sale,
      subtotal: parseFloat(sale.subtotal),
      taxRate: parseFloat(sale.taxRate),
      tax: parseFloat(sale.tax),
      discount: parseFloat(sale.discount),
      total: parseFloat(sale.total),
      createdAt: sale.createdAt.toISOString(),
      items: lineItems.map(i => ({
        ...i,
        quantity: parseFloat(i.quantity),
        unitPrice: parseFloat(i.unitPrice),
        discount: parseFloat(i.discount),
        total: parseFloat(i.total),
      })),
    });
  } catch (e) {
    throw e;
  }
});

export default router;
