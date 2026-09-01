import { db, auditLogsTable } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "print" | "payment" | "store" | "authentication" | "convert" | "status_change";
export type AuditEntityType = "sale" | "quotation" | "repair" | "repair_photo" | "customer" | "product" | "service" | "employee" | "settings" | "store" | "backup" | "tax_profile" | "guidance_entry";

export interface AuditDetails {
  [key: string]: unknown;
}

export async function logAudit(
  req: Request,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string | number | undefined,
  details?: AuditDetails,
) {
  const employeeId = req.session?.employeeId;
  let employeeName: string | null = null;
  if (employeeId && req.employee) {
    employeeName = req.employee.name;
  }

  try {
    await db.insert(auditLogsTable).values({
      employeeId: employeeId ?? null,
      employeeName,
      storeId: req.session?.storeId ?? null,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      details: details ?? null,
    });
  } catch {
    // Audit failures must not turn a successful business operation into a
    // crashed request or terminate the API process.
    logger.error({ path: req.originalUrl }, "Audit log write failed");
  }
}

const AUDIT_ENTITY_TYPES = new Set<AuditEntityType>([
  "sale",
  "quotation",
  "repair",
  "repair_photo",
  "customer",
  "product",
  "service",
  "employee",
  "settings",
  "store",
  "backup",
  "tax_profile",
  "guidance_entry",
]);

export function auditMutation(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.employee) return;
    const routePath = req.originalUrl.split("?")[0].replace(/^\/api(?:\/|$)/, "");
    const [rawEntity, rawId] = routePath.split("/").filter(Boolean);
    const normalizedEntity = rawEntity === "audit-logs" ? "settings" : rawEntity;
    if (!AUDIT_ENTITY_TYPES.has(normalizedEntity as AuditEntityType)) {
      logger.warn({ path: req.originalUrl }, "Skipping audit for unmapped mutation");
      return;
    }
    const entityType = normalizedEntity as AuditEntityType;
    const action: AuditAction = req.path.includes("/status") ? "status_change"
      : req.path.includes("/pay") ? "payment"
      : req.method === "POST" ? "create"
      : req.method === "DELETE" ? "delete" : "update";
    void logAudit(req, action, entityType, rawId, { method: req.method, statusCode: res.statusCode });
  });
  next();
}

declare global {
  namespace Express {
    interface Request {
      employee?: { id: number; name: string; role: string; maxDiscountPct: number; active: boolean };
    }
  }
}
