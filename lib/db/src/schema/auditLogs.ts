import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id"),
  employeeName: text("employee_name"),
  storeId: integer("store_id"),
  action: text("action").notNull(), // e.g. create, update, delete, login, logout, print
  entityType: text("entity_type").notNull(), // e.g. sale, repair, customer, product, employee, settings
  entityId: text("entity_id"), // string id for flexibility
  details: jsonb("details"), // extra context
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
