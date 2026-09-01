import { pgTable, serial, text, numeric, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotationsTable = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quoteNumber: text("quote_number").notNull(),
  customerId: integer("customer_id"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  storeId: integer("store_id"),
  status: text("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  taxProfileId: integer("tax_profile_id"),
  taxProvinceCode: text("tax_province_code"),
  taxProfileSnapshot: jsonb("tax_profile_snapshot"),
  notes: text("notes"),
  validUntil: text("valid_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const quotationLineItemsTable = pgTable("quotation_line_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull(),
  type: text("type").notNull().default("product"),
  productId: integer("product_id"),
  serviceId: integer("service_id"),
  name: text("name").notNull(),
  description: text("description"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  taxExempt: boolean("tax_exempt").notNull().default(false),
});

export const insertQuotationSchema = createInsertSchema(quotationsTable).omit({ id: true, createdAt: true });
export const insertQuotationLineItemSchema = createInsertSchema(quotationLineItemsTable).omit({ id: true });
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type Quotation = typeof quotationsTable.$inferSelect;
export type QuotationLineItem = typeof quotationLineItemsTable.$inferSelect;
