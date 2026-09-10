import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const pinResetRequestsTable = pgTable("pin_reset_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedByEmployeeId: integer("reviewed_by_employee_id"),
});

export type PinResetRequest = typeof pinResetRequestsTable.$inferSelect;