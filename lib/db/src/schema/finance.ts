import { pgTable, serial, text, integer, boolean, numeric, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Append-only finance ledger for repair deposits, credits, refunds and
 * provider reconciliation. Card numbers, CVV, bank data and raw link tokens
 * are deliberately not stored.
 */
export const financeTransactionsTable = pgTable("finance_transactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  saleId: integer("sale_id"),
  repairId: integer("repair_id"),
  kind: text("kind").notNull(), // payment, deposit, refund, credit, adjustment
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  method: text("method").notNull().default("manual"),
  provider: text("provider"),
  providerPaymentId: text("provider_payment_id"),
  providerSessionId: text("provider_session_id"),
  providerStatus: text("provider_status"),
  last4: text("last4"),
  idempotencyKey: text("idempotency_key"),
  note: text("note"),
  employeeId: integer("employee_id"),
  employeeName: text("employee_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customerAccessLinksTable = pgTable("customer_access_links", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull(),
  customerId: integer("customer_id").notNull(),
  saleId: integer("sale_id"),
  repairId: integer("repair_id"),
  tokenHash: text("token_hash").notNull().unique(),
  scope: text("scope").notNull().default("view"),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at"),
  accessCount: integer("access_count").notNull().default(0),
});

export const notificationTemplatesTable = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull(),
  event: text("event").notNull(),
  channel: text("channel").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  maxRetries: integer("max_retries").notNull().default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  storeEventChannelUnique: uniqueIndex("notification_templates_store_event_channel_idx").on(table.storeId, table.event, table.channel),
}));

export const notificationEventsTable = pgTable("notification_events", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull(),
  customerId: integer("customer_id"),
  saleId: integer("sale_id"),
  repairId: integer("repair_id"),
  event: text("event").notNull(),
  channel: text("channel").notNull(),
  destinationMasked: text("destination_masked"),
  status: text("status").notNull().default("queued"), // queued, sent, failed, skipped
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  providerMessageId: text("provider_message_id"),
  nextRetryAt: timestamp("next_retry_at"),
  sentAt: timestamp("sent_at"),
  unsubscribed: boolean("unsubscribed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const privacyRequestsTable = pgTable("privacy_requests", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull(),
  customerId: integer("customer_id").notNull(),
  kind: text("kind").notNull(), // export, correction, anonymize
  status: text("status").notNull().default("completed"),
  requestedBy: integer("requested_by"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFinanceTransactionSchema = createInsertSchema(financeTransactionsTable).omit({ id: true, createdAt: true });
export const insertCustomerAccessLinkSchema = createInsertSchema(customerAccessLinksTable).omit({ id: true, createdAt: true });
export type InsertFinanceTransaction = z.infer<typeof insertFinanceTransactionSchema>;
export type FinanceTransaction = typeof financeTransactionsTable.$inferSelect;
export type CustomerAccessLink = typeof customerAccessLinksTable.$inferSelect;
export type NotificationTemplate = typeof notificationTemplatesTable.$inferSelect;
export type NotificationEvent = typeof notificationEventsTable.$inferSelect;
export type PrivacyRequest = typeof privacyRequestsTable.$inferSelect;