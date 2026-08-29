import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(), name: text("name").notNull(), contactName: text("contact_name"),
  email: text("email"), phone: text("phone"), address: text("address"), notes: text("notes"),
  active: boolean("active").notNull().default(true), storeId: integer("store_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(), updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(), orderNumber: text("order_number").notNull(), supplierId: integer("supplier_id").notNull(),
  storeId: integer("store_id").notNull(), status: text("status").notNull().default("draft"),
  notes: text("notes"), orderedAt: timestamp("ordered_at"), expectedAt: timestamp("expected_at"),
  createdBy: integer("created_by"), createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const purchaseOrderLinesTable = pgTable("purchase_order_lines", {
  id: serial("id").primaryKey(), purchaseOrderId: integer("purchase_order_id").notNull(), productId: integer("product_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(), receivedQuantity: numeric("received_quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(), backordered: boolean("backordered").notNull().default(false),
});
export const receiptsTable = pgTable("receipts", {
  id: serial("id").primaryKey(), purchaseOrderId: integer("purchase_order_id").notNull(), storeId: integer("store_id").notNull(),
  receivedBy: integer("received_by"), idempotencyKey: text("idempotency_key"), receivedAt: timestamp("received_at").notNull().defaultNow(),
});
export const receiptLinesTable = pgTable("receipt_lines", {
  id: serial("id").primaryKey(), receiptId: integer("receipt_id").notNull(), purchaseOrderLineId: integer("purchase_order_line_id").notNull(),
  productId: integer("product_id").notNull(), quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
});
export const inventoryMovementsTable = pgTable("inventory_movements", {
  id: serial("id").primaryKey(), productId: integer("product_id").notNull(), storeId: integer("store_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(), reason: text("reason").notNull(),
  employeeId: integer("employee_id"), employeeName: text("employee_name"), idempotencyKey: text("idempotency_key"),
  referenceType: text("reference_type"), referenceId: text("reference_id"), createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const productAliasesTable = pgTable("product_aliases", { id: serial("id").primaryKey(), productId: integer("product_id").notNull(), alias: text("alias").notNull(), storeId: integer("store_id") });
export const productVariantsTable = pgTable("product_variants", { id: serial("id").primaryKey(), productId: integer("product_id").notNull(), name: text("name").notNull(), sku: text("sku"), attributes: text("attributes"), storeId: integer("store_id") });
export const bundleComponentsTable = pgTable("bundle_components", { id: serial("id").primaryKey(), bundleProductId: integer("bundle_product_id").notNull(), componentProductId: integer("component_product_id").notNull(), quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull() });
export const supplierProductsTable = pgTable("supplier_products", { id: serial("id").primaryKey(), supplierId: integer("supplier_id").notNull(), productId: integer("product_id").notNull(), supplierSku: text("supplier_sku"), unitCost: numeric("unit_cost", { precision: 12, scale: 2 }), leadTimeDays: integer("lead_time_days") });
export const productCostHistoryTable = pgTable("product_cost_history", { id: serial("id").primaryKey(), productId: integer("product_id").notNull(), storeId: integer("store_id"), cost: numeric("cost", { precision: 12, scale: 2 }).notNull(), source: text("source").notNull(), createdAt: timestamp("created_at").notNull().defaultNow() });
export const inventoryReservationsTable = pgTable("inventory_reservations", { id: serial("id").primaryKey(), productId: integer("product_id").notNull(), storeId: integer("store_id").notNull(), quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(), status: text("status").notNull().default("reserved"), referenceType: text("reference_type"), referenceId: text("reference_id"), employeeId: integer("employee_id"), createdAt: timestamp("created_at").notNull().defaultNow(), releasedAt: timestamp("released_at") });
export const serialRecordsTable = pgTable("serial_records", { id: serial("id").primaryKey(), productId: integer("product_id").notNull(), storeId: integer("store_id").notNull(), serialNumber: text("serial_number").notNull(), imei: text("imei"), status: text("status").notNull().default("in_stock"), warrantyUntil: timestamp("warranty_until"), createdAt: timestamp("created_at").notNull().defaultNow() });
export const repairStatusHistoryTable = pgTable("repair_status_history", { id: serial("id").primaryKey(), repairId: integer("repair_id").notNull(), fromStatus: text("from_status"), toStatus: text("to_status").notNull(), notes: text("notes"), employeeId: integer("employee_id"), createdAt: timestamp("created_at").notNull().defaultNow() });
export const repairConditionChecksTable = pgTable("repair_condition_checks", { id: serial("id").primaryKey(), repairId: integer("repair_id").notNull(), checkName: text("check_name").notNull(), result: text("result").notNull(), notes: text("notes"), employeeId: integer("employee_id"), createdAt: timestamp("created_at").notNull().defaultNow() });
export const repairApprovalsTable = pgTable("repair_approvals", { id: serial("id").primaryKey(), repairId: integer("repair_id").notNull(), approved: boolean("approved").notNull(), estimate: numeric("estimate", { precision: 12, scale: 2 }), notes: text("notes"), employeeId: integer("employee_id"), createdAt: timestamp("created_at").notNull().defaultNow() });

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Supplier = typeof suppliersTable.$inferSelect;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type PurchaseOrderLine = typeof purchaseOrderLinesTable.$inferSelect;
export type InventoryMovement = typeof inventoryMovementsTable.$inferSelect;
export type InventoryReservation = typeof inventoryReservationsTable.$inferSelect;
export type SerialRecord = typeof serialRecordsTable.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;