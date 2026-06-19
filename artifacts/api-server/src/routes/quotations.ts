import { Router } from "express";
import { db } from "@workspace/db";
import { quotationsTable, quotationLineItemsTable, salesTable, saleLineItemsTable, settingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

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

function calcTotals(items: Array<{ quantity: number; unitPrice: number; discount: number }>, taxRate: number, discount: number) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice - (i.discount || 0), 0);
  const taxable = subtotal - (discount || 0);
  const tax = taxable * (taxRate / 100);
  return { subtotal, tax, total: taxable + tax };
}

async function getNextQuoteNumber() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  const prefix = settings?.quotePrefix ?? "QUO-";
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(quotationsTable);
  return `${prefix}${String(Number(count) + 1).padStart(4, "0")}`;
}

router.get("/", async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    let q = db.select().from(quotationsTable).$dynamic();
    if (status) q = q.where(eq(quotationsTable.status, status));
    const quotes = await q.orderBy(sql`${quotationsTable.createdAt} desc`);
    const items = await db.select().from(quotationLineItemsTable);
    res.json(quotes.map(quo => ({
      ...parseQuote(quo),
      items: items.filter(i => i.quotationId === quo.id).map(parseItem),
    })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const items = body.items || [];
    const taxRate = body.taxRate ?? 0;
    const discount = body.discount ?? 0;
    const { subtotal, tax, total } = calcTotals(items, taxRate, discount);
    const quoteNumber = await getNextQuoteNumber();
    const [quote] = await db.insert(quotationsTable).values({
      quoteNumber,
      customerId: body.customerId || null,
      customerName: body.customerName || null,
      customerEmail: body.customerEmail || null,
      status: "draft",
      subtotal: String(subtotal),
      taxRate: String(taxRate),
      tax: String(tax),
      discount: String(discount),
      total: String(total),
      notes: body.notes || null,
      validUntil: body.validUntil || null,
    }).returning();
    const lineItems = await Promise.all(items.map(async (item: any) => {
      const lineTotal = item.quantity * item.unitPrice - (item.discount || 0);
      const [li] = await db.insert(quotationLineItemsTable).values({
        quotationId: quote.id,
        type: item.type || "product",
        productId: item.productId || null,
        serviceId: item.serviceId || null,
        name: item.name,
        description: item.description || null,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        discount: String(item.discount || 0),
        total: String(lineTotal),
      }).returning();
      return li;
    }));
    res.status(201).json({ ...parseQuote(quote), items: lineItems.map(parseItem) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [quote] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
    if (!quote) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, id));
    res.json({ ...parseQuote(quote), items: items.map(parseItem) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const updates: Record<string, unknown> = {};
    if (body.customerId !== undefined) updates.customerId = body.customerId;
    if (body.customerName !== undefined) updates.customerName = body.customerName;
    if (body.customerEmail !== undefined) updates.customerEmail = body.customerEmail;
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.validUntil !== undefined) updates.validUntil = body.validUntil;
    if (body.items !== undefined) {
      const taxRate = body.taxRate ?? 0;
      const discount = body.discount ?? 0;
      const { subtotal, tax, total } = calcTotals(body.items, taxRate, discount);
      updates.subtotal = String(subtotal);
      updates.taxRate = String(taxRate);
      updates.tax = String(tax);
      updates.discount = String(discount);
      updates.total = String(total);
      await db.delete(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, id));
      await Promise.all(body.items.map(async (item: any) => {
        const lineTotal = item.quantity * item.unitPrice - (item.discount || 0);
        await db.insert(quotationLineItemsTable).values({
          quotationId: id,
          type: item.type || "product",
          productId: item.productId || null,
          serviceId: item.serviceId || null,
          name: item.name,
          description: item.description || null,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          discount: String(item.discount || 0),
          total: String(lineTotal),
        });
      }));
    }
    const [quote] = await db.update(quotationsTable).set(updates).where(eq(quotationsTable.id, id)).returning();
    if (!quote) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, id));
    res.json({ ...parseQuote(quote), items: items.map(parseItem) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, id));
    await db.delete(quotationsTable).where(eq(quotationsTable.id, id));
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/:id/convert", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [quote] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
    if (!quote) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(quotationLineItemsTable).where(eq(quotationLineItemsTable.quotationId, id));
    const [settings] = await db.select().from(settingsTable).limit(1);
    const prefix = settings?.invoicePrefix ?? "INV-";
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(salesTable);
    const invoiceNumber = `${prefix}${String(Number(count) + 1).padStart(4, "0")}`;
    const [sale] = await db.insert(salesTable).values({
      invoiceNumber,
      customerId: quote.customerId,
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      status: "invoice",
      subtotal: quote.subtotal,
      taxRate: quote.taxRate,
      tax: quote.tax,
      discount: quote.discount,
      total: quote.total,
      notes: quote.notes,
    }).returning();
    const lineItems = await Promise.all(items.map(async (item) => {
      const [li] = await db.insert(saleLineItemsTable).values({
        saleId: sale.id,
        type: item.type,
        productId: item.productId,
        serviceId: item.serviceId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: item.total,
      }).returning();
      return li;
    }));
    await db.update(quotationsTable).set({ status: "converted" }).where(eq(quotationsTable.id, id));
    res.status(201).json({
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
    res.status(500).json({ error: String(e) });
  }
});

export default router;
