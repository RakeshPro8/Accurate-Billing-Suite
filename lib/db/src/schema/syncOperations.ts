import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const syncOperationsTable = pgTable("sync_operations", {
  id: serial("id").primaryKey(),
  operationId: text("operation_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  storeId: integer("store_id"),
  action: text("action").notNull(),
  status: text("status").notNull().default("completed"),
  requestHash: text("request_hash").notNull(),
  response: jsonb("response"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  operationIdUnique: uniqueIndex("sync_operations_operation_id_idx").on(table.operationId),
}));