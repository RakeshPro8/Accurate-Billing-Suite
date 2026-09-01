import { db, auditLogsTable } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "print" | "payment" | "store" | "authentication" | "convert" | "status_change";
export type AuditEntityType = "sale" | "quotation" | "repair" | "repair_photo" | "customer" | "product" | "service" | "employee" | "settings" | "store" | "backup" | "tax_profile" | "guidance_entry";

export interface AuditDetails {
  [key: string]: unknown;
}

const SAFE_DETAIL_KEYS = new Set([
  "action",
  "effectiveFrom",
  "fields",
  "method",
  "provinceCode",
  "reviewStatus",
  "selected",
  "statusCode",
  "topic",
]);

const AUDIT_EXPORT_HEADERS = [
  "Actor ID",
  "Actor",
  "Location ID",
  "Location",
  "Action",
  "Affected record",
  "Timestamp",
  "Change context",
];

/**
 * Audit details are written by many business routes. Keep the read API
 * deliberately allow-listed so a future audit writer cannot expose customer
 * contact data, PINs, credentials, or other request payload fields.
 */
export function toSafeAuditDetails(details: unknown): AuditDetails | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const safe: AuditDetails = {};
  for (const key of SAFE_DETAIL_KEYS) {
    const value = (details as Record<string, unknown>)[key];
    if (key === "fields") {
      if (Array.isArray(value)) {
        const fields = value.filter((field): field is string => typeof field === "string").slice(0, 30);
        if (fields.length > 0) safe.fields = fields;
      }
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length > 0 ? safe : null;
}

export interface PrivacySafeAuditExportEvent {
  employeeId: number | null;
  employeeName: string | null;
  storeId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown;
  createdAt: Date;
}

function csvCell(value: string | number | null) {
  const stringValue = value === null ? "" : String(value);
  // Quoting prevents delimiter/newline injection; the apostrophe prevents
  // spreadsheet applications from evaluating untrusted formula prefixes.
  const safeValue = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

/**
 * Build the compliance export from an explicit, privacy-safe column set.
 * This must not be replaced with serializing the audit table row: audit
 * details can contain request data that is intentionally hidden from readers.
 */
export function toPrivacySafeAuditCsv(events: PrivacySafeAuditExportEvent[], locationName: string | null) {
  const rows = events.map((event) => [
    csvCell(event.employeeId),
    csvCell(event.employeeName ?? "system"),
    csvCell(event.storeId),
    csvCell(locationName ?? "Unknown location"),
    csvCell(event.action),
    csvCell(`${event.entityType}${event.entityId ? ` #${event.entityId}` : ""}`),
    csvCell(event.createdAt.toISOString()),
    csvCell(JSON.stringify(toSafeAuditDetails(event.details) ?? {})),
  ].join(","));
  return `${AUDIT_EXPORT_HEADERS.map((header) => csvCell(header)).join(",")}\r\n${rows.length > 0 ? `${rows.join("\r\n")}\r\n` : ""}`;
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
