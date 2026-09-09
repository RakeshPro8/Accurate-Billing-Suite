import { pgTable, serial, text, integer, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recyclingReceiptsTable = pgTable("recycling_receipts", {
  id: serial("id").primaryKey(),
  documentNumber: text("document_number"),
  storeId: integer("store_id").notNull(),
  saleId: integer("sale_id"),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  deviceType: text("device_type").notNull(),
  deviceBrand: text("device_brand").notNull(),
  deviceModel: text("device_model").notNull(),
  deviceColour: text("device_colour").notNull(),
  declaredCondition: text("declared_condition").notNull(),
  accessories: text("accessories").notNull(),
  serialOrImei: text("serial_or_imei"),
  handoffDate: date("handoff_date", { mode: "string" }).notNull(),
  receivedByEmployeeId: integer("received_by_employee_id"),
  receivedByEmployeeName: text("received_by_employee_name"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at"),
}, (table) => ({
  storeDocumentNumberUnique: uniqueIndex("recycling_receipts_store_document_idx").on(table.storeId, table.documentNumber),
  storeSaleUnique: uniqueIndex("recycling_receipts_store_sale_idx").on(table.storeId, table.saleId),
}));

export const insertRecyclingReceiptSchema = createInsertSchema(recyclingReceiptsTable).omit({
  id: true,
  createdAt: true,
  finalizedAt: true,
});
export type InsertRecyclingReceipt = z.infer<typeof insertRecyclingReceiptSchema>;
export type RecyclingReceipt = typeof recyclingReceiptsTable.$inferSelect;