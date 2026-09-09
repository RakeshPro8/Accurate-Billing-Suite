import { Router } from "express";
import { db, auditLogsTable, storesTable } from "@workspace/db";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireRole } from "../lib/auth";
import { logAudit, toPrivacySafeAuditCsv, toSafeAuditDetails, type AuditAction, type AuditEntityType } from "../lib/audit";
import { requireCurrentStoreId } from "../lib/stores";
import { HttpError } from "../lib/http";

const router = Router();

const actions = ["create", "update", "delete", "login", "logout", "print", "payment", "store", "authentication", "convert", "status_change"] as const;
const entities = ["sale", "quotation", "repair", "repair_photo", "recycling_receipt", "customer", "product", "service", "employee", "settings", "store", "backup", "tax_profile", "guidance_entry"] as const;
const auditQuery = z.object({
  action: z.enum(actions).optional(),
  entityType: z.enum(entities).optional(),
  storeId: z.coerce.number().int().positive().optional(),
  actor: z.string().trim().max(120).optional(),
  dateFrom: z.string().trim().max(40).optional(),
  dateTo: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict();

function parseFilterDate(value: string | undefined, endOfDay = false) {
  if (!value) return null;
  const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
    : value;
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid audit log date range.");
  return date;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function findAuditLogs(req: Parameters<typeof requireCurrentStoreId>[0], query: z.infer<typeof auditQuery>) {
  const storeId = query.storeId ?? await requireCurrentStoreId(req);
  const from = parseFilterDate(query.dateFrom);
  const to = parseFilterDate(query.dateTo, true);
  if (from && to && from > to) throw new HttpError(400, "Invalid audit log date range.");

  const filters = [
    eq(auditLogsTable.storeId, storeId),
    query.action ? eq(auditLogsTable.action, query.action satisfies AuditAction) : undefined,
    query.entityType ? eq(auditLogsTable.entityType, query.entityType satisfies AuditEntityType) : undefined,
    from ? gte(auditLogsTable.createdAt, from) : undefined,
    to ? lte(auditLogsTable.createdAt, to) : undefined,
  ].filter(Boolean) as NonNullable<Parameters<typeof and>[0]>[];
  if (query.actor) {
    const actor = escapeLike(query.actor);
    const actorId = /^\d+$/.test(query.actor) ? Number(query.actor) : null;
    filters.push(or(ilike(auditLogsTable.employeeName, `%${actor}%`), actorId ? eq(auditLogsTable.employeeId, actorId) : undefined) as NonNullable<Parameters<typeof and>[0]>);
  }

  const logs = await db.select().from(auditLogsTable)
    .where(and(...filters))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(query.limit);
  return { logs, storeId };
}

router.get("/", requireRole("manager"), async (req, res) => {
  const query = auditQuery.parse(req.query);
  const { logs } = await findAuditLogs(req, query);
  res.json(logs.map(({ details, ...log }) => ({
    ...log,
    details: toSafeAuditDetails(details),
    createdAt: log.createdAt.toISOString(),
  })));
});

router.get("/export", requireRole("manager"), async (req, res) => {
  const query = auditQuery.parse(req.query);
  const { logs, storeId } = await findAuditLogs(req, query);
  const [store] = await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
  const csv = toPrivacySafeAuditCsv(logs, store?.name ?? null);
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Disposition", `attachment; filename="mobilinq-audit-${date}.csv"`);
  res.setHeader("Cache-Control", "no-store");
  res.type("text/csv");
  res.send(csv);
});

router.post("/", requireAuth, async (req, res) => {
  const actions = new Set<AuditAction>(["print", "payment", "status_change"]);
  const entities = new Set<AuditEntityType>(["sale", "quotation", "repair", "recycling_receipt", "backup"]);
  const { action, entityType, entityId } = req.body ?? {};
  if (!actions.has(action) || !entities.has(entityType)) return res.status(400).json({ error: "Unsupported audit event." });
  if (entityId !== undefined && (typeof entityId !== "string" && !Number.isSafeInteger(entityId) || String(entityId).length > 64)) return res.status(400).json({ error: "Invalid audit event." });
  await requireCurrentStoreId(req);
  await logAudit(req, action, entityType, entityId);
  return res.status(201).json({ recorded: true });
});

export default router;
