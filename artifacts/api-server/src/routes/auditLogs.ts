import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { logAudit, type AuditAction, type AuditEntityType } from "../lib/audit";
import { requireCurrentStoreId } from "../lib/stores";
import { HttpError } from "../lib/http";

const router = Router();

router.get("/", requireRole("manager"), async (req, res) => {
  try {
    const { action, entityType, entityId, dateFrom, dateTo, limit = "100" } = req.query;
    const storeId = await requireCurrentStoreId(req);
    const actions = new Set<AuditAction>(["create", "update", "delete", "print", "payment", "status_change", "convert", "store"]);
    const entities = new Set<AuditEntityType>(["sale", "quotation", "repair", "backup", "customer", "product", "settings", "store"]);
    if ((action && (!actions.has(action as AuditAction))) || (entityType && !entities.has(entityType as AuditEntityType)) || (entityId && (typeof entityId !== "string" || entityId.length > 64)) || !Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 500) throw new HttpError(400, "Invalid audit log filter.");
    const from = dateFrom ? new Date(String(dateFrom)) : null;
    const to = dateTo ? new Date(String(dateTo)) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) throw new HttpError(400, "Invalid audit log date range.");
    let query = db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt));
    const filters = [];
    if (action) filters.push(eq(auditLogsTable.action, String(action)));
    if (entityType) filters.push(eq(auditLogsTable.entityType, String(entityType)));
    if (entityId) filters.push(eq(auditLogsTable.entityId, String(entityId)));
    filters.push(eq(auditLogsTable.storeId, storeId));
    if (from) filters.push(gte(auditLogsTable.createdAt, from));
    if (to) filters.push(lte(auditLogsTable.createdAt, to));
    if (filters.length) query = query.where(and(...filters)) as typeof query;
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
    const logs = await query.limit(safeLimit);
    return res.json(logs.map(({ details, ...log }) => ({
      ...log,
      details: details && typeof details === "object" ? details : null,
      createdAt: log.createdAt.toISOString(),
    })));
  } catch (e) {
    throw e;
  }
});

router.post("/", requireAuth, async (req, res) => {
  const actions = new Set<AuditAction>(["print", "payment", "status_change"]);
  const entities = new Set<AuditEntityType>(["sale", "quotation", "repair", "backup"]);
  const { action, entityType, entityId } = req.body ?? {};
  if (!actions.has(action) || !entities.has(entityType)) return res.status(400).json({ error: "Unsupported audit event." });
  if (entityId !== undefined && (typeof entityId !== "string" && !Number.isSafeInteger(entityId) || String(entityId).length > 64)) return res.status(400).json({ error: "Invalid audit event." });
  await requireCurrentStoreId(req);
  await logAudit(req, action, entityType, entityId);
  return res.status(201).json({ recorded: true });
});

export default router;
