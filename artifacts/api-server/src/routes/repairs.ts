import { Router } from "express";
import { db, repairsTable, repairPhotosTable, repairPartsTable, productsTable, employeesTable, settingsTable, customersTable, inventoryMovementsTable, repairStatusHistoryTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import nodemailer from "nodemailer";
import { requireCurrentStoreId } from "../lib/stores";
import { HttpError, escapeHtml, validateRequest } from "../lib/http";
import { encryptDeviceCredential, decryptDeviceCredential } from "../lib/device-credentials";
import { logAudit } from "../lib/audit";
import { requireRole } from "../lib/auth";
import { validateImageDataUrl } from "../lib/image-upload";
import { calculateTotals, getTaxConfig, taxConfigFromSnapshot } from "../lib/tax";

const router = Router();
const statuses = ["intake", "diagnostic", "waiting_parts", "in_progress", "ready_qa", "completed", "picked_up", "cancelled"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;
const labels: Record<string, string> = { intake: "Intake", diagnostic: "Diagnostic", waiting_parts: "Waiting Parts", in_progress: "In Progress", ready_qa: "Ready for QA", completed: "Ready for Pickup", picked_up: "Picked Up", cancelled: "Cancelled" };
const transitions: Record<string, readonly string[]> = {
  intake: ["diagnostic", "cancelled"], diagnostic: ["waiting_parts", "in_progress", "cancelled"],
  waiting_parts: ["in_progress", "cancelled"], in_progress: ["waiting_parts", "ready_qa", "cancelled"],
  ready_qa: ["in_progress", "completed", "cancelled"], completed: ["picked_up"], picked_up: [], cancelled: [],
};
const id = z.object({ id: z.coerce.number().int().positive() });
const partId = id.extend({ partId: z.coerce.number().int().positive() });
const photoId = id.extend({ photoId: z.coerce.number().int().positive() });
const money = z.coerce.number().finite().min(0).max(10_000_000);
const nullableId = z.union([z.coerce.number().int().positive(), z.null()]);
const text = (max: number) => z.string().trim().max(max);
const repairBody = z.object({
  customerId: nullableId.optional(), customerName: text(200).nullable().optional(), customerPhone: text(50).nullable().optional(), customerEmail: z.string().trim().email().max(320).nullable().optional(),
  deviceType: text(100), deviceBrand: text(100).nullable().optional(), deviceModel: text(150).nullable().optional(), serialNumber: text(150).nullable().optional(), imei: text(50).nullable().optional(),
  devicePassword: text(1000).nullable().optional(), problemDescription: text(5000), diagnosticNotes: text(5000).nullable().optional(),
  status: z.enum(statuses).optional(), priority: z.enum(priorities).optional(), technicianId: nullableId.optional(), estimatedCost: money.nullable().optional(), deposit: money.optional(), transactionDate: z.string().date().optional(),
}).strict();
const patchBody = repairBody.partial().omit({ deviceType: true, problemDescription: true }).extend({ deviceType: text(100).optional(), problemDescription: text(5000).optional() }).strict();

function parsedRepair(r: typeof repairsTable.$inferSelect) {
  const { devicePassword: _devicePassword, ...safe } = r;
  return { ...safe, estimatedCost: r.estimatedCost ? Number(r.estimatedCost) : null, subtotal: Number(r.subtotal), taxRate: Number(r.taxRate), tax: Number(r.tax), deposit: Number(r.deposit), total: Number(r.total), balance: Number(r.balance), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), notifiedAt: r.notifiedAt?.toISOString() ?? null, pickedUpAt: r.pickedUpAt?.toISOString() ?? null, completedAt: r.completedAt?.toISOString() ?? null };
}
function parsedPart(p: typeof repairPartsTable.$inferSelect) { return { ...p, quantity: Number(p.quantity), unitPrice: Number(p.unitPrice), cost: p.cost ? Number(p.cost) : null, total: Number(p.total), createdAt: p.createdAt.toISOString() }; }
async function repairForStore(repairId: number, storeId: number) {
  const [repair] = await db.select().from(repairsTable).where(and(eq(repairsTable.id, repairId), eq(repairsTable.storeId, storeId)));
  return repair;
}
async function enrich(repair: typeof repairsTable.$inferSelect, storeId: number) {
  const [photos, parts] = await Promise.all([
    db.select().from(repairPhotosTable).where(eq(repairPhotosTable.repairId, repair.id)),
    db.select().from(repairPartsTable).where(eq(repairPartsTable.repairId, repair.id)),
  ]);
  return { ...parsedRepair(repair), photos: photos.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })), parts: parts.map(parsedPart) };
}
function fail(req: any, res: any, error: unknown) { req.log?.error?.({ err: error }, "Repair request failed"); const status = error instanceof HttpError ? error.status : 500; return res.status(status).json({ error: error instanceof HttpError ? error.message : "The request could not be completed.", code: error instanceof HttpError ? error.code : "INTERNAL_ERROR" }); }
function repairTotals(parts: Array<{ quantity: string | number; unitPrice: string | number; total?: string | number }>, estimatedCost: number | null, tax: Parameters<typeof calculateTotals>[1]) {
  const items = [
    ...(estimatedCost && estimatedCost > 0 ? [{ type: "labour", quantity: 1, unitPrice: estimatedCost }] : []),
    ...parts.map((part) => ({ type: "part", quantity: Number(part.quantity), unitPrice: Number(part.unitPrice), discount: 0 })),
  ];
  return calculateTotals(items, tax, 0);
}

router.get("/", validateRequest({ query: z.object({ status: z.enum(statuses).optional(), customerId: z.coerce.number().int().positive().optional(), technicianId: z.coerce.number().int().positive().optional(), dateFrom: z.coerce.date().optional(), dateTo: z.coerce.date().optional() }).strict() }), async (req, res) => { try {
  const storeId = await requireCurrentStoreId(req), q = req.query as any;
  const conditions = [eq(repairsTable.storeId, storeId), q.status && eq(repairsTable.status, q.status), q.customerId && eq(repairsTable.customerId, q.customerId), q.technicianId && eq(repairsTable.technicianId, q.technicianId), q.dateFrom && gte(repairsTable.createdAt, q.dateFrom), q.dateTo && lte(repairsTable.createdAt, q.dateTo)].filter(Boolean) as any[];
  const rows = await db.select().from(repairsTable).where(and(...conditions)).orderBy(sql`${repairsTable.createdAt} desc`);
  res.json(await Promise.all(rows.map(r => enrich(r, storeId))));
} catch (e) { return fail(req, res, e); } });

router.post("/", validateRequest({ body: repairBody }), async (req, res) => { try {
  const storeId = await requireCurrentStoreId(req), body = req.body as z.infer<typeof repairBody>;
  let customer = null; if (body.customerId) [customer] = await db.select().from(customersTable).where(and(eq(customersTable.id, body.customerId), eq(customersTable.storeId, storeId)));
  if (body.customerId && !customer) throw new HttpError(404, "Customer not found.");
  let technicianName: string | null = null; if (body.technicianId) { const [employee] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, body.technicianId)); if (!employee) throw new HttpError(404, "Technician not found."); technicianName = employee.name; }
  const deposit = body.deposit ?? 0;
  const { transactionDate: _transactionDate, ...repairFields } = body;
  const transactionDate = body.transactionDate ? new Date(`${body.transactionDate}T00:00:00Z`) : new Date();
  if (Number.isNaN(transactionDate.getTime())) throw new HttpError(400, "Invalid transaction date.");
  const totals = repairTotals([], body.estimatedCost ?? null, await getTaxConfig(storeId, transactionDate));
  const repair = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(${storeId})`);
    const [settings] = await tx.select().from(settingsTable).limit(1);
    const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(repairsTable).where(eq(repairsTable.storeId, storeId));
    const ticketNumber = `${settings?.invoicePrefix ?? "REP-"}${String(Number(count) + 1).padStart(4, "0")}`;
      const [created] = await tx.insert(repairsTable).values({ ...repairFields, ticketNumber, storeId, status: "intake", customerName: body.customerName ?? customer?.name ?? null, customerPhone: body.customerPhone ?? customer?.phone ?? null, customerEmail: body.customerEmail ?? customer?.email ?? null, devicePassword: body.devicePassword ? encryptDeviceCredential(body.devicePassword) : null, technicianName, estimatedCost: body.estimatedCost == null ? null : String(body.estimatedCost), deposit: String(deposit), subtotal: String(totals.subtotal), taxRate: String(totals.taxRate), tax: String(totals.tax), total: String(totals.total), balance: String(totals.total - deposit), taxProfileId: totals.taxProfileId, taxProvinceCode: totals.taxProfileSnapshot.provinceCode, taxProfileSnapshot: totals.taxProfileSnapshot }).returning();
     await tx.insert(repairStatusHistoryTable).values({ repairId: created.id, fromStatus: null, toStatus: "intake", notes: "Repair created", employeeId: req.employee?.id ?? null });
    return created;
  });
  res.status(201).json(await enrich(repair, storeId));
} catch (e) { return fail(req, res, e); } });

router.get("/:id", validateRequest({ params: id }), async (req, res) => { try { const storeId = await requireCurrentStoreId(req), repair = await repairForStore(Number(req.params.id), storeId); if (!repair) throw new HttpError(404, "Not found."); res.json(await enrich(repair, storeId)); } catch (e) { return fail(req, res, e); } });

router.get("/:id/device-password", requireRole("manager"), validateRequest({ params: id }), async (req, res) => { try { const storeId = await requireCurrentStoreId(req), repair = await repairForStore(Number(req.params.id), storeId); if (!repair) throw new HttpError(404, "Not found."); if (!repair.devicePassword) throw new HttpError(404, "No device credential is stored."); const devicePassword = decryptDeviceCredential(repair.devicePassword); await logAudit(req, "update", "repair", repair.id, { event: "device_credential_revealed" }); res.json({ devicePassword }); } catch (e) { return fail(req, res, e); } });

router.patch("/:id", validateRequest({ params: id, body: patchBody }), async (req, res) => { try {
  const storeId = await requireCurrentStoreId(req), body = req.body as any, repairId = Number(req.params.id);
  const repair = await db.transaction(async tx => {
    await tx.execute(sql`select id from repairs where id = ${repairId} and store_id = ${storeId} for update`);
    const [existing] = await tx.select().from(repairsTable).where(and(eq(repairsTable.id, repairId), eq(repairsTable.storeId, storeId)));
    if (!existing) throw new HttpError(404, "Not found.");
    if (body.status && body.status !== existing.status && !transitions[existing.status].includes(body.status)) throw new HttpError(400, "Invalid status transition.", "INVALID_STATUS_TRANSITION");
    const updates: any = { ...body, updatedAt: new Date() }; delete updates.total; delete updates.balance; delete updates.transactionDate;
    if (body.customerId) {
      const [customer] = await tx.select({ id: customersTable.id }).from(customersTable).where(and(eq(customersTable.id, body.customerId), eq(customersTable.storeId, storeId)));
      if (!customer) throw new HttpError(404, "Customer not found.");
    }
    if ("devicePassword" in body) updates.devicePassword = body.devicePassword ? encryptDeviceCredential(body.devicePassword) : null;
    if ("estimatedCost" in body) updates.estimatedCost = body.estimatedCost == null ? null : String(body.estimatedCost);
    if ("deposit" in body) updates.deposit = String(body.deposit);
    if ("estimatedCost" in body) {
      const tax = taxConfigFromSnapshot(existing.taxProfileSnapshot) ?? await getTaxConfig(storeId);
      const parts = await tx.select().from(repairPartsTable).where(eq(repairPartsTable.repairId, existing.id));
      const totals = repairTotals(parts, body.estimatedCost ?? null, tax);
      updates.subtotal = String(totals.subtotal); updates.taxRate = String(totals.taxRate); updates.tax = String(totals.tax); updates.total = String(totals.total);
      updates.taxProfileId = totals.taxProfileId; updates.taxProvinceCode = totals.taxProfileSnapshot.provinceCode; updates.taxProfileSnapshot = totals.taxProfileSnapshot;
    }
    if (body.technicianId) {
      const [employee] = await tx.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, body.technicianId));
      if (!employee) throw new HttpError(404, "Technician not found.");
      updates.technicianName = employee.name;
    } else if (body.technicianId === null) updates.technicianName = null;
    if (body.status === "completed") updates.completedAt = new Date();
    if (body.status === "picked_up") updates.pickedUpAt = new Date();
    const total = Number(existing.total);
    const deposit = body.deposit === undefined ? Number(existing.deposit) : body.deposit;
    updates.balance = String(total - deposit);
     const [updated] = await tx.update(repairsTable).set(updates)
      .where(and(eq(repairsTable.id, existing.id), eq(repairsTable.storeId, storeId))).returning();
     if (body.status && body.status !== existing.status) {
       await tx.insert(repairStatusHistoryTable).values({ repairId: existing.id, fromStatus: existing.status, toStatus: body.status, notes: null, employeeId: req.employee?.id ?? null });
     }
    return updated;
  });
  res.json(await enrich(repair, storeId));
} catch (e) { return fail(req, res, e); } });

router.delete("/:id", validateRequest({ params: id }), async (req, res) => { try { const storeId = await requireCurrentStoreId(req), repair = await repairForStore(Number(req.params.id), storeId); if (!repair) throw new HttpError(404, "Not found."); await db.transaction(async tx => { await tx.delete(repairPhotosTable).where(eq(repairPhotosTable.repairId, repair.id)); await tx.delete(repairPartsTable).where(eq(repairPartsTable.repairId, repair.id)); await tx.delete(repairsTable).where(and(eq(repairsTable.id, repair.id), eq(repairsTable.storeId, storeId))); }); res.status(204).send(); } catch (e) { return fail(req, res, e); } });

router.post("/:id/status", validateRequest({ params: id, body: z.object({ status: z.enum(statuses), notes: text(2000).optional(), notify: z.boolean().optional() }).strict() }), async (req, res) => { try {
  const storeId = await requireCurrentStoreId(req), body = req.body as any;
  const { repair, updated } = await db.transaction(async tx => {
    await tx.execute(sql`select id from repairs where id = ${Number(req.params.id)} and store_id = ${storeId} for update`);
    const [repair] = await tx.select().from(repairsTable).where(and(eq(repairsTable.id, Number(req.params.id)), eq(repairsTable.storeId, storeId)));
    if (!repair) throw new HttpError(404, "Not found.");
    if (body.status !== repair.status && !transitions[repair.status].includes(body.status)) throw new HttpError(400, "Invalid status transition.", "INVALID_STATUS_TRANSITION");
    const updates: any = { status: body.status, updatedAt: new Date() }; if (body.status === "completed") updates.completedAt = new Date(); if (body.status === "picked_up") updates.pickedUpAt = new Date();
     const [updated] = await tx.update(repairsTable).set(updates).where(and(eq(repairsTable.id, repair.id), eq(repairsTable.storeId, storeId))).returning();
     if (body.status !== repair.status) {
       await tx.insert(repairStatusHistoryTable).values({ repairId: repair.id, fromStatus: repair.status, toStatus: body.status, notes: body.notes ?? null, employeeId: req.employee?.id ?? null });
     }
    return { repair, updated };
  });
  if (body.notify && repair.customerEmail) { const [settings] = await db.select().from(settingsTable).limit(1); if (settings?.smtpHost && settings.smtpUser && settings.smtpPass) try { await nodemailer.createTransport({ host: settings.smtpHost, port: Number(settings.smtpPort ?? 587), secure: Number(settings.smtpPort) === 465, auth: { user: settings.smtpUser, pass: settings.smtpPass } }).sendMail({ from: `"${escapeHtml(settings.businessName ?? "BillPro")}" <${settings.smtpUser}>`, to: repair.customerEmail, subject: `Repair ${repair.ticketNumber} - ${labels[body.status]}`, html: `<p>Hi ${escapeHtml(repair.customerName ?? "Customer")},</p><p>Your repair ticket <strong>${escapeHtml(repair.ticketNumber)}</strong> is <strong>${escapeHtml(labels[body.status])}</strong>.</p>${body.notes ? `<p>${escapeHtml(body.notes)}</p>` : ""}` }); await db.update(repairsTable).set({ notifiedAt: new Date() }).where(and(eq(repairsTable.id, repair.id), eq(repairsTable.storeId, storeId))); } catch (emailError) { req.log?.warn?.({ err: emailError }, "Repair status email failed"); } }
  res.json(await enrich(updated, storeId));
} catch (e) { return fail(req, res, e); } });

router.post("/:id/photos", validateRequest({ params: id, body: z.object({ dataUrl: z.string().max(2_800_000), caption: text(500).nullable().optional() }).strict() }), async (req, res) => { try { const storeId = await requireCurrentStoreId(req), repair = await repairForStore(Number(req.params.id), storeId); if (!repair) throw new HttpError(404, "Not found."); const body = req.body as any; validateImageDataUrl(body.dataUrl); const [photo] = await db.insert(repairPhotosTable).values({ repairId: repair.id, dataUrl: body.dataUrl, caption: body.caption ?? null }).returning(); res.status(201).json({ ...photo, createdAt: photo.createdAt.toISOString() }); } catch (e) { return fail(req, res, e); } });
router.delete("/:id/photos/:photoId", validateRequest({ params: photoId }), async (req, res) => { try { const storeId = await requireCurrentStoreId(req), repair = await repairForStore(Number(req.params.id), storeId); if (!repair) throw new HttpError(404, "Not found."); const result = await db.delete(repairPhotosTable).where(and(eq(repairPhotosTable.id, Number(req.params.photoId)), eq(repairPhotosTable.repairId, repair.id))).returning(); if (!result[0]) throw new HttpError(404, "Photo not found."); res.status(204).send(); } catch (e) { return fail(req, res, e); } });

const partBody = z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().finite().positive().max(100000), unitPrice: money.optional(), name: text(300).optional(), serialNumber: text(150).nullable().optional(), cost: money.nullable().optional() }).strict();
  router.post("/:id/parts", validateRequest({ params: id, body: partBody }), async (req, res) => { try { const storeId = await requireCurrentStoreId(req), repair = await repairForStore(Number(req.params.id), storeId), body = req.body as z.infer<typeof partBody>; if (!repair) throw new HttpError(404, "Not found."); const part = await db.transaction(async tx => { await tx.execute(sql`select id from repairs where id = ${repair.id} and store_id = ${storeId} for update`); const [lockedRepair] = await tx.select().from(repairsTable).where(and(eq(repairsTable.id, repair.id), eq(repairsTable.storeId, storeId))); if (!lockedRepair) throw new HttpError(404, "Not found."); const [product] = await tx.update(productsTable).set({ stock: sql`${productsTable.stock} - ${body.quantity}` }).where(and(eq(productsTable.id, body.productId), eq(productsTable.storeId, storeId), gte(productsTable.stock, body.quantity))).returning(); if (!product) throw new HttpError(400, "Not enough stock."); const unitPrice = body.unitPrice ?? Number(product.price), total = body.quantity * unitPrice; const [newPart] = await tx.insert(repairPartsTable).values({ repairId: lockedRepair.id, productId: product.id, name: body.name ?? product.name, serialNumber: body.serialNumber ?? null, quantity: String(body.quantity), unitPrice: String(unitPrice), cost: body.cost == null ? null : String(body.cost), total: String(total) }).returning(); await tx.insert(inventoryMovementsTable).values({ productId: product.id, storeId, quantity: String(-body.quantity), reason: "repair_part", employeeId: req.employee?.id ?? null, employeeName: req.employee?.name ?? null, referenceType: "repair", referenceId: String(lockedRepair.id), idempotencyKey: `repair-${lockedRepair.id}-part-${newPart.id}` }); const parts = await tx.select().from(repairPartsTable).where(eq(repairPartsTable.repairId, lockedRepair.id)); const totals = repairTotals(parts, lockedRepair.estimatedCost ? Number(lockedRepair.estimatedCost) : null, taxConfigFromSnapshot(lockedRepair.taxProfileSnapshot) ?? await getTaxConfig(storeId)); await tx.update(repairsTable).set({ subtotal: String(totals.subtotal), taxRate: String(totals.taxRate), tax: String(totals.tax), total: String(totals.total), balance: String(totals.total - Number(lockedRepair.deposit)), taxProfileId: totals.taxProfileId, taxProvinceCode: totals.taxProfileSnapshot.provinceCode, taxProfileSnapshot: totals.taxProfileSnapshot, updatedAt: new Date() }).where(and(eq(repairsTable.id, lockedRepair.id), eq(repairsTable.storeId, storeId))); return newPart; }); res.status(201).json(parsedPart(part)); } catch (e) { return fail(req, res, e); } });
  router.delete("/:id/parts/:partId", validateRequest({ params: partId }), async (req, res) => { try { const storeId = await requireCurrentStoreId(req), repair = await repairForStore(Number(req.params.id), storeId); if (!repair) throw new HttpError(404, "Not found."); await db.transaction(async tx => { await tx.execute(sql`select id from repairs where id = ${repair.id} and store_id = ${storeId} for update`); const [lockedRepair] = await tx.select().from(repairsTable).where(and(eq(repairsTable.id, repair.id), eq(repairsTable.storeId, storeId))); if (!lockedRepair) throw new HttpError(404, "Not found."); const [part] = await tx.delete(repairPartsTable).where(and(eq(repairPartsTable.id, Number(req.params.partId)), eq(repairPartsTable.repairId, lockedRepair.id))).returning(); if (!part) throw new HttpError(404, "Part not found."); const [product] = await tx.update(productsTable).set({ stock: sql`${productsTable.stock} + ${Number(part.quantity)}` }).where(and(eq(productsTable.id, part.productId), eq(productsTable.storeId, storeId))).returning(); if (!product) throw new HttpError(409, "Part product is outside the active store."); await tx.insert(inventoryMovementsTable).values({ productId: part.productId, storeId, quantity: String(part.quantity), reason: "repair_part_return", employeeId: req.employee?.id ?? null, employeeName: req.employee?.name ?? null, referenceType: "repair", referenceId: String(lockedRepair.id), idempotencyKey: `repair-${lockedRepair.id}-part-return-${part.id}` }); const parts = await tx.select().from(repairPartsTable).where(eq(repairPartsTable.repairId, lockedRepair.id)); const totals = repairTotals(parts, lockedRepair.estimatedCost ? Number(lockedRepair.estimatedCost) : null, taxConfigFromSnapshot(lockedRepair.taxProfileSnapshot) ?? await getTaxConfig(storeId)); await tx.update(repairsTable).set({ subtotal: String(totals.subtotal), taxRate: String(totals.taxRate), tax: String(totals.tax), total: String(totals.total), balance: String(totals.total - Number(lockedRepair.deposit)), taxProfileId: totals.taxProfileId, taxProvinceCode: totals.taxProfileSnapshot.provinceCode, taxProfileSnapshot: totals.taxProfileSnapshot, updatedAt: new Date() }).where(and(eq(repairsTable.id, lockedRepair.id), eq(repairsTable.storeId, storeId))); }); res.status(204).send(); } catch (e) { return fail(req, res, e); } });
export default router;