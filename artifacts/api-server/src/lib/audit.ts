import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";

export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "print" | "convert" | "status_change";
export type AuditEntityType = "sale" | "quotation" | "repair" | "customer" | "product" | "service" | "employee" | "settings" | "store" | "backup";

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
    storeId: null,
    action,
    entityType,
    entityId: entityId ? String(entityId) : null,
    details: details ?? null,
  });
}

declare global {
  namespace Express {
    interface Request {
      employee?: { id: number; name: string; role: string; maxDiscountPct: number; active: boolean };
    }
  }
}
