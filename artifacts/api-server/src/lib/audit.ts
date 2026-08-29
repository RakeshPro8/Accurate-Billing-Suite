import { db, auditLogsTable } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "print" | "payment" | "store" | "authentication" | "convert" | "status_change";
export type AuditEntityType = "sale" | "quotation" | "repair" | "repair_photo" | "customer" | "product" | "service" | "employee" | "settings" | "store" | "backup";

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

  await db.insert(auditLogsTable).values({
    employeeId: employeeId ?? null,
    employeeName,
    storeId: req.session?.storeId ?? null,
    action,
    entityType,
    entityId: entityId ? String(entityId) : null,
    details: details ?? null,
  });
}

export function auditMutation(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.employee) return;
    const [rawEntity, rawId] = req.path.split("/").filter(Boolean);
    const entityType = (rawEntity === "audit-logs" ? "settings" : rawEntity) as AuditEntityType;
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
