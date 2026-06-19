import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleLineItemsTable, settingsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

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

async function getNextInvoiceNumber() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  const prefix = settings?.invoicePrefix ?? "INV-";
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(salesTable);
  return `${prefix}${String(Number(count) + 1).padStart(4, "0")}`;
}

function calcTotals(items: Array<{ quantity: number; unitPrice: number; discount: number }>, taxRate: number, discount: number) {
  const subtotal = items.reduce((sum, i) => {
    const lineTotal = i.quantity * i.unitPrice - (i.discount || 0);
    return sum + lineTotal;
  }, 0);
  const totalDiscount = discount || 0;
  const taxable = subtotal - totalDiscount;
  const tax = taxable * (taxRate / 100);
  const total = taxable + tax;
  return { subtotal, tax, total };
}

router.get("/", async (req, res) => {
  try {
    const { status, customerId, dateFrom, dateTo } = req.query as Record<string, string>;
    let q = db.select().from(salesTable).$dynamic();
    const conds: ReturnType<typeof eq>[] = [];
    if (status) conds.push(eq(salesTable.status, status));
    if (customerId) conds.push(eq(salesTable.customerId, Number(customerId)));
    if (dateFrom) conds.push(gte(salesTable.createdAt, new Date(dateFrom)));
    if (dateTo) conds.push(lte(salesTable.createdAt, new Date(dateTo)));
    if (conds.length) q = q.where(and(...conds));
    const sales = await q.orderBy(sql`${salesTable.createdAt} desc`);
    const items = await db.select().from(saleLineItemsTable);
    res.json(sales.map(s => ({
      ...parseSale(s),
      items: items.filter(i => i.saleId === s.id).map(parseItem),
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
    const invoiceNumber = await getNextInvoiceNumber();
    const [sale] = await db.insert(salesTable).values({
      invoiceNumber,
      customerId: body.customerId || null,
      customerName: body.customerName || null,
      customerEmail: body.customerEmail || null,
      status: body.status || "invoice",
      subtotal: String(subtotal),
      taxRate: String(taxRate),
      tax: String(tax),
      discount: String(discount),
      total: String(total),
      notes: body.notes || null,
      paymentMethod: body.paymentMethod || null,
      dueDate: body.dueDate || null,
      paidAt: body.paidAt || null,
    }).returning();
    const lineItems = await Promise.all(items.map(async (item: any) => {
      const lineTotal = item.quantity * item.unitPrice - (item.discount || 0);
      const [li] = await db.insert(saleLineItemsTable).values({
        saleId: sale.id,
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
    res.status(201).json({ ...parseSale(sale), items: lineItems.map(parseItem) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id));
    if (!sale) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
    res.json({ ...parseSale(sale), items: items.map(parseItem) });
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
    if (body.paymentMethod !== undefined) updates.paymentMethod = body.paymentMethod;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.paidAt !== undefined) updates.paidAt = body.paidAt;

    if (body.items !== undefined) {
      const taxRate = body.taxRate ?? 0;
      const discount = body.discount ?? 0;
      const { subtotal, tax, total } = calcTotals(body.items, taxRate, discount);
      updates.subtotal = String(subtotal);
      updates.taxRate = String(taxRate);
      updates.tax = String(tax);
      updates.discount = String(discount);
      updates.total = String(total);
      await db.delete(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
      await Promise.all(body.items.map(async (item: any) => {
        const lineTotal = item.quantity * item.unitPrice - (item.discount || 0);
        await db.insert(saleLineItemsTable).values({
          saleId: id,
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
    const [sale] = await db.update(salesTable).set(updates).where(eq(salesTable.id, id)).returning();
    if (!sale) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
    res.json({ ...parseSale(sale), items: items.map(parseItem) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
    await db.delete(salesTable).where(eq(salesTable.id, id));
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/:id/send-email", async (req, res) => {
  res.json({ message: "Email sending requires SMTP configuration in Settings. This endpoint is ready for integration." });
});

export default router;
