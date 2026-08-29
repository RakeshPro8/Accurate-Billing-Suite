import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { logAudit, type AuditAction, type AuditEntityType } from "../lib/audit";

const router = Router();

router.get("/", requireRole("manager"), async (req, res) => {
  try {
    const { action, entityType, entityId, storeId, dateFrom, dateTo, limit = "100" } = req.query;
    let query = db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt));
    const filters = [];
    if (action) filters.push(eq(auditLogsTable.action, String(action)));
    if (entityType) filters.push(eq(auditLogsTable.entityType, String(entityType)));
    if (entityId) filters.push(eq(auditLogsTable.entityId, String(entityId)));
    if (storeId) filters.push(eq(auditLogsTable.storeId, Number(storeId)));
    if (dateFrom) filters.push(gte(auditLogsTable.createdAt, new Date(String(dateFrom))));
    if (dateTo) filters.push(lte(auditLogsTable.createdAt, new Date(String(dateTo))));
    if (filters.length) query = query.where(and(...filters)) as typeof query;
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
    const logs = await query.limit(safeLimit);
    return res.json(logs.map(({ details, ...log }) => ({
      ...log,
      details: details && typeof details === "object" ? details : null,
      createdAt: log.createdAt.toISOString(),
    })));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const actions = new Set<AuditAction>(["print", "payment", "status_change"]);
  const entities = new Set<AuditEntityType>(["sale", "quotation", "repair", "backup"]);
  const { action, entityType, entityId } = req.body ?? {};
  if (!actions.has(action) || !entities.has(entityType)) return res.status(400).json({ error: "Unsupported audit event." });
  await logAudit(req, action, entityType, entityId);
  return res.status(201).json({ recorded: true });
});

export default router;
