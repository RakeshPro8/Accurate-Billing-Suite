import { Router } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, customersTable, recyclingReceiptsTable, salesTable, settingsTable } from "@workspace/db";
import { HttpError, validateRequest } from "../lib/http";
import { requireCurrentStoreId } from "../lib/stores";
import { logAudit } from "../lib/audit";
import { recyclingReceiptInput, recyclingReceiptUpdate } from "../lib/recycling";

const router = Router();
const idParams = z.object({ id: z.coerce.number().int().positive() });
const listQuery = z.object({ saleId: z.coerce.number().int().positive().optional() }).strict();

function employee(req: any) {
  if (!req.employee) throw new HttpError(401, "Authentication is required.", "AUTH_REQUIRED");
  return req.employee as { id: number; name: string };
}

function bindResolvedStore(req: any, storeId: number) {
  req.session.storeId = storeId;
  req.session.storeScopeAll = false;
}

function parseReceipt(receipt: typeof recyclingReceiptsTable.$inferSelect) {
  return {
    ...receipt,
    createdAt: receipt.createdAt.toISOString(),
    finalizedAt: receipt.finalizedAt?.toISOString() ?? null,
  };
}

async function receiptForStore(id: number, storeId: number, source: any = db) {
  const [receipt] = await source.select().from(recyclingReceiptsTable).where(and(
    eq(recyclingReceiptsTable.id, id),
    eq(recyclingReceiptsTable.storeId, storeId),
  ));
  return receipt;
}

async function assertReferences(tx: any, body: { saleId?: number; customerId?: number | null }, storeId: number) {
  if (body.saleId !== undefined) {
    const [sale] = await tx.select({ id: salesTable.id }).from(salesTable).where(and(
      eq(salesTable.id, body.saleId),
      eq(salesTable.storeId, storeId),
    ));
    if (!sale) throw new HttpError(400, "The related invoice is unavailable.", "INVALID_REQUEST");
  }
  if (body.customerId !== undefined && body.customerId !== null) {
    const [customer] = await tx.select({ id: customersTable.id }).from(customersTable).where(and(
      eq(customersTable.id, body.customerId),
      eq(customersTable.storeId, storeId),
    ));
    if (!customer) throw new HttpError(400, "The customer is unavailable.", "INVALID_REQUEST");
  }
}

router.get("/", validateRequest({ query: listQuery }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const query = req.query as z.infer<typeof listQuery>;
  const receipts = await db.select().from(recyclingReceiptsTable).where(and(
    eq(recyclingReceiptsTable.storeId, storeId),
    query.saleId ? eq(recyclingReceiptsTable.saleId, query.saleId) : undefined,
  )).orderBy(asc(recyclingReceiptsTable.createdAt));
  return res.json(receipts.map(parseReceipt));
});

router.post("/", validateRequest({ body: recyclingReceiptInput }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  bindResolvedStore(req, storeId);
  const body = req.body as z.infer<typeof recyclingReceiptInput>;
  const created = await db.transaction(async (tx) => {
    await assertReferences(tx, body, storeId);
    const [receipt] = await tx.insert(recyclingReceiptsTable).values({
      storeId,
      saleId: body.saleId ?? null,
      customerId: body.customerId ?? null,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail ?? null,
      deviceType: body.deviceType,
      deviceBrand: body.deviceBrand,
      deviceModel: body.deviceModel,
      deviceColour: body.deviceColour,
      declaredCondition: body.declaredCondition,
      accessories: body.accessories,
      serialOrImei: body.serialOrImei || null,
      handoffDate: body.handoffDate,
      status: "draft",
    }).onConflictDoNothing({
      target: [recyclingReceiptsTable.storeId, recyclingReceiptsTable.saleId],
    }).returning();
    if (!receipt) throw new HttpError(409, "A recycling receipt is already linked to this invoice.", "RECYCLING_RECEIPT_EXISTS");
    return receipt;
  });
  await logAudit(req, "create", "recycling_receipt", created.id);
  return res.status(201).json(parseReceipt(created));
});

router.get("/:id", validateRequest({ params: idParams }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const receipt = await receiptForStore(Number(req.params.id), storeId);
  if (!receipt) throw new HttpError(404, "Recycling receipt not found.", "NOT_FOUND");
  return res.json(parseReceipt(receipt));
});

router.patch("/:id", validateRequest({ params: idParams, body: recyclingReceiptUpdate }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  bindResolvedStore(req, storeId);
  const body = req.body as z.infer<typeof recyclingReceiptUpdate>;
  const id = Number(req.params.id);
  const updated = await db.transaction(async (tx) => {
    const existing = await receiptForStore(id, storeId, tx);
    if (!existing) throw new HttpError(404, "Recycling receipt not found.", "NOT_FOUND");
    if (existing.status !== "draft") throw new HttpError(409, "Finalized recycling receipts cannot be edited.", "RECEIPT_FINALIZED");
    await assertReferences(tx, body, storeId);
    const values: Record<string, unknown> = {};
    for (const key of ["customerId", "customerName", "customerPhone", "customerEmail", "deviceType", "deviceBrand", "deviceModel", "deviceColour", "declaredCondition", "accessories", "serialOrImei", "handoffDate"] as const) {
      if (body[key] !== undefined) values[key] = body[key] === "" ? null : body[key];
    }
    const [result] = await tx.update(recyclingReceiptsTable).set(values).where(and(
      eq(recyclingReceiptsTable.id, id),
      eq(recyclingReceiptsTable.storeId, storeId),
      eq(recyclingReceiptsTable.status, "draft"),
    )).returning();
    if (!result) throw new HttpError(409, "The recycling receipt changed while it was being saved.", "RECEIPT_CONFLICT");
    return result;
  });
  await logAudit(req, "update", "recycling_receipt", updated.id);
  return res.json(parseReceipt(updated));
});

router.post("/:id/finalize", validateRequest({ params: idParams }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  bindResolvedStore(req, storeId);
  const current = employee(req);
  const id = Number(req.params.id);
  const { receipt: finalized, transitioned } = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(19003, ${storeId})`);
    const existing = await receiptForStore(id, storeId, tx);
    if (!existing) throw new HttpError(404, "Recycling receipt not found.", "NOT_FOUND");
    if (existing.status === "finalized") return { receipt: existing, transitioned: false };
    if (!existing.customerName || !existing.customerPhone || !existing.deviceType || !existing.deviceBrand || !existing.deviceModel || !existing.deviceColour || !existing.accessories || !existing.handoffDate) {
      throw new HttpError(400, "Complete the customer and device details before finalizing.", "INVALID_REQUEST");
    }
    const [{ count }] = await tx.select({ count: sql<number>`count(*)` })
      .from(recyclingReceiptsTable)
      .where(and(eq(recyclingReceiptsTable.storeId, storeId), eq(recyclingReceiptsTable.status, "finalized")));
    const [settings] = await tx.select({ invoicePrefix: settingsTable.invoicePrefix }).from(settingsTable).limit(1);
    const prefix = `${settings?.invoicePrefix?.replace(/INV-?$/, "") ?? "MOB-"}REC-`;
    const documentNumber = `${prefix}${String(Number(count) + 1).padStart(4, "0")}`;
    const [result] = await tx.update(recyclingReceiptsTable).set({
      documentNumber,
      status: "finalized",
      receivedByEmployeeId: current.id,
      receivedByEmployeeName: current.name,
      finalizedAt: new Date(),
    }).where(and(
      eq(recyclingReceiptsTable.id, id),
      eq(recyclingReceiptsTable.storeId, storeId),
      eq(recyclingReceiptsTable.status, "draft"),
    )).returning();
    return { receipt: result ?? existing, transitioned: Boolean(result) };
  });
  if (transitioned) await logAudit(req, "status_change", "recycling_receipt", finalized.id);
  return res.json(parseReceipt(finalized));
});

export default router;