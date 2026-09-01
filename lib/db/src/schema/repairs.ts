import { pgTable, serial, text, numeric, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const repairsTable = pgTable("repairs", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull(),
  customerId: integer("customer_id"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  deviceType: text("device_type").notNull(),
  deviceBrand: text("device_brand"),
  deviceModel: text("device_model"),
  serialNumber: text("serial_number"),
  imei: text("imei"),
  devicePassword: text("device_password"),
  problemDescription: text("problem_description").notNull(),
  diagnosticNotes: text("diagnostic_notes"),
  status: text("status").notNull().default("intake"),
  priority: text("priority").notNull().default("normal"),
  technicianId: integer("technician_id"),
  technicianName: text("technician_name"),
  storeId: integer("store_id"),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 2 }),
  deposit: numeric("deposit", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 6, scale: 4 }).notNull().default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  taxProfileId: integer("tax_profile_id"),
  taxProvinceCode: text("tax_province_code"),
  taxProfileSnapshot: jsonb("tax_profile_snapshot"),
  balance: numeric("balance", { precision: 10, scale: 2 }).notNull().default("0"),
  notifiedAt: timestamp("notified_at"),
  pickedUpAt: timestamp("picked_up_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  dueDate: timestamp("due_date"),
  slaHours: integer("sla_hours"),
  approvalState: text("approval_state").notNull().default("pending"),
  warrantyState: text("warranty_state").notNull().default("none"),
  warrantyUntil: timestamp("warranty_until"),
  returnEligibleUntil: timestamp("return_eligible_until"),
});

export const repairPhotosTable = pgTable("repair_photos", {
  id: serial("id").primaryKey(),
  repairId: integer("repair_id").notNull(),
  caption: text("caption"),
  dataUrl: text("data_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const repairPartsTable = pgTable("repair_parts", {
  id: serial("id").primaryKey(),
  repairId: integer("repair_id").notNull(),
  productId: integer("product_id").notNull(),
  name: text("name").notNull(),
  serialNumber: text("serial_number"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRepairSchema = createInsertSchema(repairsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRepairPhotoSchema = createInsertSchema(repairPhotosTable).omit({ id: true, createdAt: true });
export const insertRepairPartSchema = createInsertSchema(repairPartsTable).omit({ id: true, createdAt: true });

export type InsertRepair = z.infer<typeof insertRepairSchema>;
export type Repair = typeof repairsTable.$inferSelect;
export type RepairPhoto = typeof repairPhotosTable.$inferSelect;
export type RepairPart = typeof repairPartsTable.$inferSelect;
