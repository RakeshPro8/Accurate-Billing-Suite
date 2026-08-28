import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireRole } from "../lib/auth";

const router = Router();

router.get("/", requireRole("manager"), async (req, res) => {
  try {
    const { entityType, entityId, limit = "100" } = req.query;
    let query = db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt));
    if (entityType) {
      query = query.where(eq(auditLogsTable.entityType, String(entityType))) as typeof query;
    }
    if (entityId) {
      query = query.where(eq(auditLogsTable.entityId, String(entityId))) as typeof query;
    }
    const logs = await query.limit(Number(limit));
    return res.json(logs);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
