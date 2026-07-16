import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleLineItemsTable, settingsTable, employeesTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import nodemailer from "nodemailer";

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
    const { status, customerId, dateFrom, dateTo, employeeId } = req.query as Record<string, string>;
    let q = db.select().from(salesTable).$dynamic();
    const conds: ReturnType<typeof eq>[] = [];
    if (status) conds.push(eq(salesTable.status, status));
    if (customerId) conds.push(eq(salesTable.customerId, Number(customerId)));
    if (employeeId) conds.push(eq(salesTable.employeeId, Number(employeeId)));
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

    if (body.employeeId && discount > 0) {
      const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(body.employeeId)));
      if (emp) {
        const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0);
        if (subtotal > 0) {
          const discountPct = (discount / subtotal) * 100;
          const maxAllowed = parseFloat(emp.maxDiscountPct);
          if (discountPct > maxAllowed) {
            return res.status(403).json({
              error: `Discount exceeds your authorization. Max allowed: ${maxAllowed.toFixed(1)}% for your role.`
            });
          }
        }
      }
    }

    const { subtotal, tax, total } = calcTotals(items, taxRate, discount);
    const invoiceNumber = await getNextInvoiceNumber();

    let employeeName: string | null = null;
    if (body.employeeId) {
      const [emp] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, Number(body.employeeId)));
      employeeName = emp?.name ?? null;
    }

    const [sale] = await db.insert(salesTable).values({
      invoiceNumber,
      customerId: body.customerId || null,
      customerName: body.customerName || null,
      customerEmail: body.customerEmail || null,
      employeeId: body.employeeId || null,
      employeeName,
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
    if (body.employeeId !== undefined) {
      updates.employeeId = body.employeeId;
      if (body.employeeId) {
        const [emp] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, Number(body.employeeId)));
        updates.employeeName = emp?.name ?? null;
      } else {
        updates.employeeName = null;
      }
    }

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
  try {
    const id = Number(req.params.id);
    const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id));
    if (!sale) return res.status(404).json({ error: "Invoice not found." });

    const [settings] = await db.select().from(settingsTable).limit(1);
    if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
      return res.status(400).json({ error: "SMTP not configured. Go to Settings → Email to set it up." });
    }

    const toEmail = req.body.to || sale.customerEmail;
    if (!toEmail) return res.status(400).json({ error: "No recipient email address." });

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: Number(settings.smtpPort ?? 587),
      secure: Number(settings.smtpPort) === 465,
      auth: { user: settings.smtpUser, pass: settings.smtpPass },
    });

    const businessName = settings.businessName ?? "BillPro";
    const items = await db.select().from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, id));
    const itemRows = items.map(i =>
      `<tr><td style="padding:4px 8px">${i.name}</td><td style="padding:4px 8px;text-align:right">${i.quantity} × $${parseFloat(i.unitPrice).toFixed(2)}</td><td style="padding:4px 8px;text-align:right">$${parseFloat(i.total).toFixed(2)}</td></tr>`
    ).join("");

    await transporter.sendMail({
      from: `"${businessName}" <${settings.smtpUser}>`,
      to: toEmail,
      subject: `Invoice ${sale.invoiceNumber} from ${businessName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#0d9488">${businessName}</h2>
          <p>Dear ${sale.customerName ?? "Customer"},</p>
          <p>Please find your invoice <strong>${sale.invoiceNumber}</strong> below.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead><tr style="background:#f1f5f9">
              <th style="padding:8px;text-align:left">Item</th>
              <th style="padding:8px;text-align:right">Qty × Price</th>
              <th style="padding:8px;text-align:right">Total</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
            <tfoot>
              <tr><td colspan="2" style="padding:8px;text-align:right;font-weight:bold">Discount</td><td style="padding:8px;text-align:right">-$${parseFloat(sale.discount).toFixed(2)}</td></tr>
              <tr><td colspan="2" style="padding:8px;text-align:right;font-weight:bold">Tax (${parseFloat(sale.taxRate).toFixed(1)}%)</td><td style="padding:8px;text-align:right">$${parseFloat(sale.tax).toFixed(2)}</td></tr>
              <tr style="background:#f1f5f9"><td colspan="2" style="padding:8px;text-align:right;font-weight:bold">TOTAL</td><td style="padding:8px;text-align:right;font-weight:bold">$${parseFloat(sale.total).toFixed(2)}</td></tr>
            </tfoot>
          </table>
          <p style="color:#64748b;font-size:12px">This email was sent by ${businessName} via BillPro.</p>
        </div>
      `,
    });

    res.json({ message: `Invoice emailed to ${toEmail}` });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
