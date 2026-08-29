import { Router } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db, productsTable, suppliersTable, purchaseOrdersTable, purchaseOrderLinesTable,
  receiptsTable, receiptLinesTable, inventoryMovementsTable, inventoryReservationsTable,
  serialRecordsTable, repairsTable, repairStatusHistoryTable, repairConditionChecksTable,
  repairApprovalsTable, productAliasesTable,
} from "@workspace/db";
import { requireCurrentStoreId } from "../lib/stores";
import { requireRole } from "../lib/auth";
import { HttpError, validateRequest } from "../lib/http";
import { logAudit } from "../lib/audit";
import { z } from "zod";

const router = Router();
const id = z.coerce.number().int().positive();
const text = (max: number) => z.string().trim().min(1).max(max);
const movementBody = z.object({ productId: id, quantity: z.number().finite(), reason: text(200), idempotencyKey: text(100) }).strict();
const employee = (req: any) => req.employee;

router.get("/products/search", async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const q = typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "";
  const rows = await db.select().from(productsTable).where(and(eq(productsTable.storeId, storeId), eq(productsTable.active, true), q ? or(ilike(productsTable.name, `%${q}%`), ilike(productsTable.sku, `%${q}%`), sql`exists (select 1 from ${productAliasesTable} pa where pa.product_id = ${productsTable.id} and pa.alias ilike ${`%${q}%`})`) : undefined)).limit(100);
  res.json(rows);
});
router.get("/inventory/summary", async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const rows = await db.select().from(productsTable).where(eq(productsTable.storeId, storeId));
  res.json({ items: rows.map(p => ({ ...p, stock: Number(p.stock), lowStock: p.stock <= p.reorderPoint })) });
});
router.patch("/products/:id/archive", requireRole("manager"), validateRequest({ params: z.object({ id }) }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const [p] = await db.update(productsTable).set({ active: false, archivedAt: new Date() }).where(and(eq(productsTable.id, Number(req.params.id)), eq(productsTable.storeId, storeId))).returning();
  if (!p) throw new HttpError(404, "Product not found.");
  await logAudit(req, "update", "product", p.id, { archived: true });
  res.json(p);
});

router.get("/suppliers", async (req, res) => res.json(await db.select().from(suppliersTable).where(eq(suppliersTable.storeId, await requireCurrentStoreId(req))).orderBy(suppliersTable.name)));
router.post("/suppliers", validateRequest({ body: z.object({ name: text(200), contactName: text(200).nullable().optional(), email: z.string().email().nullable().optional(), phone: text(50).nullable().optional(), address: text(500).nullable().optional(), notes: text(2000).nullable().optional() }).strict() }), async (req, res) => {
  const [s] = await db.insert(suppliersTable).values({ ...req.body, storeId: await requireCurrentStoreId(req) }).returning(); res.status(201).json(s);
});
router.patch("/suppliers/:id", validateRequest({ params: z.object({ id }), body: z.object({ name: text(200).optional(), contactName: text(200).nullable().optional(), email: z.string().email().nullable().optional(), phone: text(50).nullable().optional(), address: text(500).nullable().optional(), notes: text(2000).nullable().optional(), active: z.boolean().optional() }).strict() }), async (req, res) => {
  const [s] = await db.update(suppliersTable).set({ ...req.body, updatedAt: new Date() }).where(and(eq(suppliersTable.id, Number(req.params.id)), eq(suppliersTable.storeId, await requireCurrentStoreId(req)))).returning(); if (!s) throw new HttpError(404, "Supplier not found."); res.json(s);
});
router.delete("/suppliers/:id", requireRole("manager"), validateRequest({ params: z.object({ id }) }), async (req, res) => { const r = await db.delete(suppliersTable).where(and(eq(suppliersTable.id, Number(req.params.id)), eq(suppliersTable.storeId, await requireCurrentStoreId(req)))).returning(); if (!r.length) throw new HttpError(404, "Supplier not found."); res.status(204).send(); });

router.post("/purchase-orders", requireRole("manager"), validateRequest({ body: z.object({ supplierId: id, notes: z.string().max(2000).nullable().optional(), expectedAt: z.coerce.date().nullable().optional(), lines: z.array(z.object({ productId: id, quantity: z.number().positive(), unitCost: z.number().nonnegative() })).min(1).max(500) }).strict() }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req); const body = req.body;
  const order = await db.transaction(async tx => {
    const [supplier] = await tx.select().from(suppliersTable).where(and(eq(suppliersTable.id, body.supplierId), eq(suppliersTable.storeId, storeId)));
    if (!supplier) throw new HttpError(404, "Supplier not found.");
    const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(purchaseOrdersTable).where(eq(purchaseOrdersTable.storeId, storeId));
    const [po] = await tx.insert(purchaseOrdersTable).values({ orderNumber: `PO-${String(Number(count) + 1).padStart(5, "0")}`, supplierId: supplier.id, storeId, notes: body.notes ?? null, expectedAt: body.expectedAt ?? null, createdBy: employee(req).id }).returning();
    await tx.insert(purchaseOrderLinesTable).values(body.lines.map((l: any) => ({ purchaseOrderId: po.id, productId: l.productId, quantity: String(l.quantity), unitCost: String(l.unitCost) })));
    return po;
  }); res.status(201).json(order);
});
router.get("/purchase-orders", async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const orders = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.storeId, storeId)).orderBy(desc(purchaseOrdersTable.createdAt));
  const lines = await db.select().from(purchaseOrderLinesTable).where(sql`${purchaseOrderLinesTable.purchaseOrderId} in (select id from ${purchaseOrdersTable} where ${purchaseOrdersTable.storeId} = ${storeId})`);
  return res.json(orders.map((order) => ({ ...order, lines: lines.filter((line) => line.purchaseOrderId === order.id) })));
});
router.get("/purchase-orders/:id", validateRequest({ params: z.object({ id }) }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req); const [order] = await db.select().from(purchaseOrdersTable).where(and(eq(purchaseOrdersTable.id, Number(req.params.id)), eq(purchaseOrdersTable.storeId, storeId))); if (!order) throw new HttpError(404, "Purchase order not found.");
  res.json({ ...order, lines: await db.select().from(purchaseOrderLinesTable).where(eq(purchaseOrderLinesTable.purchaseOrderId, order.id)) });
});
router.post("/purchase-orders/:id/receive", validateRequest({ params: z.object({ id }), body: z.object({ idempotencyKey: text(8), lines: z.array(z.object({ purchaseOrderLineId: id, quantity: z.number().positive(), unitCost: z.number().nonnegative().optional() })).min(1) }).strict() }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req), body = req.body, current = employee(req);
  const result = await db.transaction(async tx => {
    const [existing] = await tx.select().from(receiptsTable).where(and(eq(receiptsTable.storeId, storeId), eq(receiptsTable.idempotencyKey, body.idempotencyKey))); if (existing) return existing;
    const [po] = await tx.select().from(purchaseOrdersTable).where(and(eq(purchaseOrdersTable.id, Number(req.params.id)), eq(purchaseOrdersTable.storeId, storeId))); if (!po) throw new HttpError(404, "Purchase order not found.");
    const [receipt] = await tx.insert(receiptsTable).values({ purchaseOrderId: po.id, storeId, receivedBy: current.id, idempotencyKey: body.idempotencyKey }).returning();
    for (const line of body.lines) {
      const [ol] = await tx.select().from(purchaseOrderLinesTable).where(and(eq(purchaseOrderLinesTable.id, line.purchaseOrderLineId), eq(purchaseOrderLinesTable.purchaseOrderId, po.id)));
      if (!ol || line.quantity > Number(ol.quantity) - Number(ol.receivedQuantity)) throw new HttpError(409, "Receipt exceeds outstanding quantity.");
      const cost = line.unitCost ?? Number(ol.unitCost);
      await tx.insert(receiptLinesTable).values({ receiptId: receipt.id, purchaseOrderLineId: ol.id, productId: ol.productId, quantity: String(line.quantity), unitCost: String(cost) });
      const [product] = await tx.update(productsTable).set({ stock: sql`${productsTable.stock} + ${line.quantity}`, cost: String(cost) }).where(and(eq(productsTable.id, ol.productId), eq(productsTable.storeId, storeId))).returning();
      if (!product) throw new HttpError(404, "Product not found.");
      await tx.insert(inventoryMovementsTable).values({ productId: ol.productId, storeId, quantity: String(line.quantity), reason: "purchase_receipt", employeeId: current.id, employeeName: current.name, idempotencyKey: `${body.idempotencyKey}-${ol.id}`, referenceType: "receipt", referenceId: String(receipt.id) });
      await tx.update(purchaseOrderLinesTable).set({ receivedQuantity: sql`${purchaseOrderLinesTable.receivedQuantity} + ${line.quantity}` }).where(eq(purchaseOrderLinesTable.id, ol.id));
    }
    return receipt;
  }); await logAudit(req, "create", "product", undefined, { purchaseReceipt: result.id }); res.status(201).json(result);
});

router.get("/inventory/movements", async (req, res) => res.json(await db.select().from(inventoryMovementsTable).where(eq(inventoryMovementsTable.storeId, await requireCurrentStoreId(req))).orderBy(desc(inventoryMovementsTable.createdAt)).limit(500)));
router.post("/inventory/adjust", requireRole("manager"), validateRequest({ body: movementBody }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req), body = req.body, current = employee(req);
  const result = await db.transaction(async tx => {
    const [duplicate] = await tx.select().from(inventoryMovementsTable).where(and(eq(inventoryMovementsTable.storeId, storeId), eq(inventoryMovementsTable.idempotencyKey, body.idempotencyKey))); if (duplicate) return duplicate;
    const [p] = await tx.update(productsTable).set({ stock: sql`${productsTable.stock} + ${body.quantity}` }).where(and(eq(productsTable.id, body.productId), eq(productsTable.storeId, storeId), body.quantity < 0 ? sql`${productsTable.stock} >= ${-body.quantity}` : undefined)).returning(); if (!p) throw new HttpError(409, "Product not found or insufficient stock.");
    const [m] = await tx.insert(inventoryMovementsTable).values({ ...body, quantity: String(body.quantity), storeId, employeeId: current.id, employeeName: current.name }).returning(); return m;
  }); await logAudit(req, "update", "product", body.productId, { movementId: result.id, reason: body.reason }); res.status(201).json(result);
});
router.post("/inventory/transfer", requireRole("manager"), validateRequest({ body: z.object({ productId: id, quantity: z.number().positive(), toStoreId: id, reason: text(200), idempotencyKey: text(8) }).strict() }), async (req, res) => {
  const fromStoreId = await requireCurrentStoreId(req), b = req.body, current = employee(req);
  if (b.toStoreId === fromStoreId) throw new HttpError(400, "Source and destination stores must differ.");
  const result = await db.transaction(async tx => {
    const [source] = await tx.update(productsTable).set({ stock: sql`${productsTable.stock} - ${b.quantity}` }).where(and(eq(productsTable.id, b.productId), eq(productsTable.storeId, fromStoreId), sql`${productsTable.stock} >= ${b.quantity}`)).returning();
    if (!source) throw new HttpError(409, "Insufficient source stock.");
    const [destination] = await tx.select().from(productsTable).where(and(eq(productsTable.id, b.productId), eq(productsTable.storeId, b.toStoreId))).for("update");
    if (!destination) throw new HttpError(404, "Destination product not found.");
    await tx.update(productsTable).set({ stock: sql`${productsTable.stock} + ${b.quantity}` }).where(eq(productsTable.id, destination.id));
    await tx.insert(inventoryMovementsTable).values([
      { productId: b.productId, storeId: fromStoreId, quantity: String(-b.quantity), reason: b.reason, employeeId: current.id, employeeName: current.name, idempotencyKey: `${b.idempotencyKey}-out`, referenceType: "transfer", referenceId: String(b.toStoreId) },
      { productId: b.productId, storeId: b.toStoreId, quantity: String(b.quantity), reason: b.reason, employeeId: current.id, employeeName: current.name, idempotencyKey: `${b.idempotencyKey}-in`, referenceType: "transfer", referenceId: String(fromStoreId) },
    ]);
    return { productId: b.productId, fromStoreId, toStoreId: b.toStoreId, quantity: b.quantity };
  });
  await logAudit(req, "update", "product", b.productId, { transfer: result }); res.status(201).json(result);
});

router.post("/reservations", validateRequest({ body: z.object({ productId: id, quantity: z.number().positive(), referenceType: text(80).optional(), referenceId: text(100).optional(), idempotencyKey: text(8).optional() }).strict() }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req), b = req.body;
  const reservation = await db.transaction(async tx => {
    if (b.idempotencyKey) {
      const [existing] = await tx.select().from(inventoryMovementsTable).where(and(eq(inventoryMovementsTable.storeId, storeId), eq(inventoryMovementsTable.idempotencyKey, b.idempotencyKey))).limit(1);
      if (existing) {
        const [existingReservation] = await tx.select().from(inventoryReservationsTable).where(and(eq(inventoryReservationsTable.storeId, storeId), eq(inventoryReservationsTable.productId, existing.productId), eq(inventoryReservationsTable.referenceId, b.referenceId ?? null))).orderBy(desc(inventoryReservationsTable.createdAt)).limit(1);
        if (existingReservation) return existingReservation;
      }
    }
    const [p] = await tx.update(productsTable).set({ stock: sql`${productsTable.stock} - ${b.quantity}` }).where(and(eq(productsTable.id, b.productId), eq(productsTable.storeId, storeId), sql`${productsTable.stock} >= ${b.quantity}`)).returning();
    if (!p) throw new HttpError(409, "Insufficient stock.");
    const [r] = await tx.insert(inventoryReservationsTable).values({ productId: b.productId, quantity: String(b.quantity), referenceType: b.referenceType ?? null, referenceId: b.referenceId ?? null, storeId, employeeId: employee(req).id }).returning();
    await tx.insert(inventoryMovementsTable).values({ productId: b.productId, storeId, quantity: String(-b.quantity), reason: "reservation", employeeId: employee(req).id, employeeName: employee(req).name, idempotencyKey: b.idempotencyKey ?? `reservation-${r.id}`, referenceType: b.referenceType ?? "reservation", referenceId: b.referenceId ?? String(r.id) });
    return r;
  });
  res.status(201).json(reservation);
});
router.post("/reservations/:id/release", validateRequest({ params: z.object({ id }) }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req); const result = await db.transaction(async tx => { const [r] = await tx.select().from(inventoryReservationsTable).where(and(eq(inventoryReservationsTable.id, Number(req.params.id)), eq(inventoryReservationsTable.storeId, storeId))).for("update"); if (!r || r.status !== "reserved") throw new HttpError(404, "Active reservation not found."); await tx.update(inventoryReservationsTable).set({ status: "released", releasedAt: new Date() }).where(eq(inventoryReservationsTable.id, r.id)); await tx.update(productsTable).set({ stock: sql`${productsTable.stock} + ${r.quantity}` }).where(and(eq(productsTable.id, r.productId), eq(productsTable.storeId, storeId))); await tx.insert(inventoryMovementsTable).values({ productId: r.productId, storeId, quantity: String(r.quantity), reason: "reservation_release", employeeId: employee(req).id, employeeName: employee(req).name, idempotencyKey: `reservation-${r.id}-release`, referenceType: r.referenceType ?? "reservation", referenceId: r.referenceId ?? String(r.id) }); return r; }); res.json({ ...result, status: "released" });
});
router.get("/serials", async (req, res) => res.json(await db.select().from(serialRecordsTable).where(eq(serialRecordsTable.storeId, await requireCurrentStoreId(req)))));
router.post("/serials", validateRequest({ body: z.object({ productId: id, serialNumber: text(150), imei: text(50).optional(), warrantyUntil: z.coerce.date().nullable().optional() }).strict() }), async (req, res) => { const [r] = await db.insert(serialRecordsTable).values({ ...req.body, storeId: await requireCurrentStoreId(req) }).returning(); res.status(201).json(r); });

async function scopedRepair(req: any) {
  const storeId = await requireCurrentStoreId(req);
  const [repair] = await db.select().from(repairsTable).where(and(eq(repairsTable.id, Number(req.params.id)), eq(repairsTable.storeId, storeId)));
  if (!repair) throw new HttpError(404, "Repair not found.");
  return { storeId, repair };
}
router.get("/repairs/:id/status-history", async (req, res) => {
  await scopedRepair(req);
  return res.json(await db.select().from(repairStatusHistoryTable).where(eq(repairStatusHistoryTable.repairId, Number(req.params.id))).orderBy(desc(repairStatusHistoryTable.createdAt)));
});
router.post("/repairs/:id/condition-checks", validateRequest({ body: z.object({ checkName: text(100), result: text(50), notes: z.string().max(1000).optional() }).strict() }), async (req, res) => {
  await scopedRepair(req);
  const [r] = await db.insert(repairConditionChecksTable).values({ repairId: Number(req.params.id), ...req.body, employeeId: employee(req).id }).returning();
  return res.status(201).json(r);
});
router.post("/repairs/:id/estimate-approval", validateRequest({ body: z.object({ approved: z.boolean(), estimate: z.number().nonnegative().optional(), notes: z.string().max(1000).optional() }).strict() }), async (req, res) => {
  const { storeId } = await scopedRepair(req);
  const [a] = await db.insert(repairApprovalsTable).values({ repairId: Number(req.params.id), ...req.body, employeeId: employee(req).id, estimate: req.body.estimate == null ? null : String(req.body.estimate) }).returning();
  await db.update(repairsTable).set({ approvalState: req.body.approved ? "approved" : "rejected", estimatedCost: req.body.estimate == null ? undefined : String(req.body.estimate) }).where(and(eq(repairsTable.id, Number(req.params.id)), eq(repairsTable.storeId, storeId)));
  return res.status(201).json(a);
});

export default router;