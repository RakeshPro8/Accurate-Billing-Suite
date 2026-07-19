import { Router } from "express";
import { db } from "@workspace/db";
import {
  repairsTable, repairPhotosTable, repairPartsTable,
  productsTable, employeesTable, settingsTable, customersTable,
} from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import nodemailer from "nodemailer";

const router = Router();

const VALID_STATUSES = ["intake", "diagnostic", "waiting_parts", "in_progress", "ready_qa", "completed", "picked_up", "cancelled"];
const STATUS_LABELS: Record<string, string> = {
  intake: "Intake",
  diagnostic: "Diagnostic",
  waiting_parts: "Waiting Parts",
  in_progress: "In Progress",
  ready_qa: "Ready for QA",
  completed: "Ready for Pickup",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
};

function parseRepair(r: typeof repairsTable.$inferSelect) {
  return {
    ...r,
    estimatedCost: r.estimatedCost ? parseFloat(r.estimatedCost) : null,
    deposit: parseFloat(r.deposit),
    total: parseFloat(r.total),
    balance: parseFloat(r.balance),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    notifiedAt: r.notifiedAt?.toISOString() ?? null,
    pickedUpAt: r.pickedUpAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
  };
}

function parsePart(p: typeof repairPartsTable.$inferSelect) {
  return {
    ...p,
    quantity: parseFloat(p.quantity),
    unitPrice: parseFloat(p.unitPrice),
    cost: p.cost ? parseFloat(p.cost) : null,
    total: parseFloat(p.total),
    createdAt: p.createdAt.toISOString(),
  };
}

async function getNextTicketNumber() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  const prefix = settings?.invoicePrefix ?? "REP-";
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(repairsTable);
  return `${prefix}${String(Number(count) + 1).padStart(4, "0")}`;
}

async function enrichRepair(repair: typeof repairsTable.$inferSelect) {
  const photos = await db.select().from(repairPhotosTable).where(eq(repairPhotosTable.repairId, repair.id));
  const parts = await db.select().from(repairPartsTable).where(eq(repairPartsTable.repairId, repair.id));
  return {
    ...parseRepair(repair),
    photos: photos.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })),
    parts: parts.map(parsePart),
  };
}

async function recalculateTotals(repairId: number) {
  const parts = await db.select().from(repairPartsTable).where(eq(repairPartsTable.repairId, repairId));
  const total = parts.reduce((sum, p) => sum + parseFloat(p.total), 0);
  const [repair] = await db.select().from(repairsTable).where(eq(repairsTable.id, repairId));
  const deposit = parseFloat(repair.deposit);
  await db.update(repairsTable).set({ total: String(total), balance: String(total - deposit) }).where(eq(repairsTable.id, repairId));
}

router.get("/", async (req, res) => {
  try {
    const { status, customerId, technicianId, dateFrom, dateTo } = req.query as Record<string, string>;
    let q = db.select().from(repairsTable).$dynamic();
    const conds: ReturnType<typeof eq>[] = [];
    if (status) conds.push(eq(repairsTable.status, status));
    if (customerId) conds.push(eq(repairsTable.customerId, Number(customerId)));
    if (technicianId) conds.push(eq(repairsTable.technicianId, Number(technicianId)));
    if (dateFrom) conds.push(gte(repairsTable.createdAt, new Date(dateFrom)));
    if (dateTo) conds.push(lte(repairsTable.createdAt, new Date(dateTo)));
    if (conds.length) q = q.where(and(...conds));
    const repairs = await q.orderBy(sql`${repairsTable.createdAt} desc`);
    const result = await Promise.all(repairs.map(enrichRepair));
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const ticketNumber = await getNextTicketNumber();

    let technicianName: string | null = null;
    if (body.technicianId) {
      const [emp] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, Number(body.technicianId)));
      technicianName = emp?.name ?? null;
    }

    if (body.customerId) {
      const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, Number(body.customerId)));
      if (customer) {
        body.customerName = body.customerName || customer.name;
        body.customerPhone = body.customerPhone || customer.phone || null;
        body.customerEmail = body.customerEmail || customer.email || null;
      }
    }

    const deposit = body.deposit ?? 0;
    const total = body.total ?? 0;

    const [repair] = await db.insert(repairsTable).values({
      ticketNumber,
      customerId: body.customerId || null,
      customerName: body.customerName || null,
      customerPhone: body.customerPhone || null,
      customerEmail: body.customerEmail || null,
      deviceType: body.deviceType,
      deviceBrand: body.deviceBrand || null,
      deviceModel: body.deviceModel || null,
      serialNumber: body.serialNumber || null,
      imei: body.imei || null,
      devicePassword: body.devicePassword || null,
      problemDescription: body.problemDescription,
      diagnosticNotes: body.diagnosticNotes || null,
      status: body.status || "intake",
      priority: body.priority || "normal",
      technicianId: body.technicianId || null,
      technicianName,
      estimatedCost: body.estimatedCost !== undefined ? String(body.estimatedCost) : null,
      deposit: String(deposit),
      total: String(total),
      balance: String(total - deposit),
    }).returning();

    return res.status(201).json(await enrichRepair(repair));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [repair] = await db.select().from(repairsTable).where(eq(repairsTable.id, id));
    if (!repair) return res.status(404).json({ error: "Not found" });
    return res.json(await enrichRepair(repair));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const updates: Record<string, unknown> = {};

    const stringFields = ["customerName", "customerPhone", "customerEmail", "deviceType", "deviceBrand", "deviceModel", "serialNumber", "imei", "devicePassword", "problemDescription", "diagnosticNotes", "status", "priority"];
    for (const f of stringFields) if (body[f] !== undefined) updates[f] = body[f];

    if (body.customerId !== undefined) updates.customerId = body.customerId;
    if (body.technicianId !== undefined) {
      updates.technicianId = body.technicianId;
      if (body.technicianId) {
        const [emp] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, Number(body.technicianId)));
        updates.technicianName = emp?.name ?? null;
      } else {
        updates.technicianName = null;
      }
    }
    if (body.estimatedCost !== undefined) updates.estimatedCost = String(body.estimatedCost);
    if (body.deposit !== undefined) {
      updates.deposit = String(body.deposit);
      const [repair] = await db.select().from(repairsTable).where(eq(repairsTable.id, id));
      const total = parseFloat(repair.total);
      updates.balance = String(total - body.deposit);
    }
    if (body.total !== undefined) {
      updates.total = String(body.total);
      const [repair] = await db.select().from(repairsTable).where(eq(repairsTable.id, id));
      const deposit = parseFloat(repair.deposit);
      updates.balance = String(body.total - deposit);
    }
    if (body.pickedUpAt !== undefined) updates.pickedUpAt = body.pickedUpAt ? new Date(body.pickedUpAt) : null;
    if (body.completedAt !== undefined) updates.completedAt = body.completedAt ? new Date(body.completedAt) : null;
    updates.updatedAt = new Date();

    const [repair] = await db.update(repairsTable).set(updates).where(eq(repairsTable.id, id)).returning();
    if (!repair) return res.status(404).json({ error: "Not found" });
    return res.json(await enrichRepair(repair));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(repairPhotosTable).where(eq(repairPhotosTable.repairId, id));
    await db.delete(repairPartsTable).where(eq(repairPartsTable.repairId, id));
    await db.delete(repairsTable).where(eq(repairsTable.id, id));
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.post("/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, notes, notify } = req.body;
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const [repair] = await db.select().from(repairsTable).where(eq(repairsTable.id, id));
    if (!repair) return res.status(404).json({ error: "Not found" });

    const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
    if (status === "completed") updateData.completedAt = new Date();
    if (status === "picked_up") updateData.pickedUpAt = new Date();

    await db.update(repairsTable).set(updateData).where(eq(repairsTable.id, id));
    const updated = await db.select().from(repairsTable).where(eq(repairsTable.id, id));

    if (notify && repair.customerEmail) {
      const [settings] = await db.select().from(settingsTable).limit(1);
      if (settings?.smtpHost && settings?.smtpUser && settings?.smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: settings.smtpHost,
            port: Number(settings.smtpPort ?? 587),
            secure: Number(settings.smtpPort) === 465,
            auth: { user: settings.smtpUser, pass: settings.smtpPass },
          });
          await transporter.sendMail({
            from: `"${settings.businessName ?? "BillPro"}" <${settings.smtpUser}>`,
            to: repair.customerEmail,
            subject: `Repair ${repair.ticketNumber} - ${STATUS_LABELS[status]}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#0d9488">${settings.businessName ?? "BillPro"}</h2>
              <p>Hi ${repair.customerName ?? "Customer"},</p>
              <p>Your repair ticket <strong>${repair.ticketNumber}</strong> has been updated to: <strong>${STATUS_LABELS[status]}</strong>.</p>
              ${notes ? `<p style="color:#64748b">${notes}</p>` : ""}
              <p style="color:#64748b;font-size:12px">This is an automated update from ${settings.businessName ?? "BillPro"}.</p>
            </div>`,
          });
          await db.update(repairsTable).set({ notifiedAt: new Date() }).where(eq(repairsTable.id, id));
        } catch (emailErr) {
          req.log?.warn?.({ err: emailErr, repairId: id }, "Repair status email failed");
        }
      }
    }

    return res.json(await enrichRepair(updated[0]));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.post("/:id/photos", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [repair] = await db.select().from(repairsTable).where(eq(repairsTable.id, id));
    if (!repair) return res.status(404).json({ error: "Not found" });

    const body = req.body;
    if (!body.dataUrl || !body.dataUrl.startsWith("data:")) {
      return res.status(400).json({ error: "Photo must be a data URL" });
    }

    const [photo] = await db.insert(repairPhotosTable).values({
      repairId: id,
      caption: body.caption || null,
      dataUrl: body.dataUrl,
    }).returning();

    return res.status(201).json({ ...photo, createdAt: photo.createdAt.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.delete("/:id/photos/:photoId", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const photoId = Number(req.params.photoId);
    await db.delete(repairPhotosTable).where(and(eq(repairPhotosTable.id, photoId), eq(repairPhotosTable.repairId, id)));
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.post("/:id/parts", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [repair] = await db.select().from(repairsTable).where(eq(repairsTable.id, id));
    if (!repair) return res.status(404).json({ error: "Not found" });

    const body = req.body;
    const qty = Number(body.quantity) || 1;
    const unitPrice = Number(body.unitPrice) || 0;
    const total = qty * unitPrice;

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, Number(body.productId)));
    if (!product) return res.status(404).json({ error: "Product not found" });

    const newStock = product.stock - qty;
    if (newStock < 0) return res.status(400).json({ error: "Not enough stock" });

    await db.update(productsTable).set({ stock: newStock }).where(eq(productsTable.id, product.id));

    const [part] = await db.insert(repairPartsTable).values({
      repairId: id,
      productId: product.id,
      name: body.name || product.name,
      serialNumber: body.serialNumber || null,
      quantity: String(qty),
      unitPrice: String(unitPrice),
      cost: body.cost !== undefined ? String(body.cost) : null,
      total: String(total),
    }).returning();

    await recalculateTotals(id);

    return res.status(201).json(parsePart(part));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.delete("/:id/parts/:partId", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const partId = Number(req.params.partId);
    const [part] = await db.select().from(repairPartsTable).where(and(eq(repairPartsTable.id, partId), eq(repairPartsTable.repairId, id)));
    if (!part) return res.status(404).json({ error: "Part not found" });

    await db.update(productsTable).set({ stock: sql`${productsTable.stock} + ${parseFloat(part.quantity)}` }).where(eq(productsTable.id, part.productId));
    await db.delete(repairPartsTable).where(eq(repairPartsTable.id, partId));
    await recalculateTotals(id);

    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
