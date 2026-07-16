import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: integer("customer_id"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  employeeId: integer("employee_id"),
  employeeName: text("employee_name"),
  status: text("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  paymentMethod: text("payment_method"),
  dueDate: text("due_date"),
  paidAt: text("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const saleLineItemsTable = pgTable("sale_line_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  type: text("type").notNull().default("product"),
  productId: integer("product_id"),
  serviceId: integer("service_id"),
  name: text("name").notNull(),
  description: text("description"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true });
export const insertSaleLineItemSchema = createInsertSchema(saleLineItemsTable).omit({ id: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
export type SaleLineItem = typeof saleLineItemsTable.$inferSelect;
