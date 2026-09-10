import { pgTable, serial, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  // Deprecated: plaintext PIN kept only for one-time migration. Always null for new employees.
  pin: text("pin"),
  pinHash: text("pin_hash"),
  role: text("role").notNull().default("staff"),
  maxDiscountPct: numeric("max_discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  pinMustChange: boolean("pin_must_change").notNull().default(false),
  pinExpiresAt: timestamp("pin_expires_at"),
  recoveryCodeHash: text("recovery_code_hash"),
  recoveryCodeUsedAt: timestamp("recovery_code_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
