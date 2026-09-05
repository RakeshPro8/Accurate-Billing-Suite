import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  appName: text("app_name").notNull().default("Mobilinq"),
  businessName: text("business_name").notNull().default("Mobilinq"),
  businessAddress: text("business_address"),
  businessPhone: text("business_phone"),
  businessEmail: text("business_email"),
  logoUrl: text("logo_url"),
  theme: text("theme").notNull().default("terminal"),
  currency: text("currency").notNull().default("USD"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  taxName: text("tax_name").notNull().default("Tax"),
  taxEnabled: boolean("tax_enabled").notNull().default(true),
  // GST/QST kept for backward compatibility; prefer taxRate/taxName for new receipts.
  gstRate: numeric("gst_rate", { precision: 5, scale: 3 }).notNull().default("0"),
  qstRate: numeric("qst_rate", { precision: 6, scale: 4 }).notNull().default("0"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  quotePrefix: text("quote_prefix").notNull().default("QUO-"),
  invoiceFooter: text("invoice_footer"),
  thankYouMessage: text("thank_you_message"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  // Multi-location framework: default store id. Records inherit this when created.
  defaultStoreId: integer("default_store_id"),
});

/**
 * Receipt presentation is store-scoped and intentionally separate from the
 * installation-wide invoice settings above. A missing row is a supported
 * legacy state; the API derives the old thank-you/footer values and enables
 * every optional section for those installations.
 */
export const receiptContentPreferencesTable = pgTable("receipt_content_preferences", {
  storeId: integer("store_id").primaryKey(),
  thankYouMessage: text("thank_you_message"),
  footerText: text("footer_text"),
  showBusinessContact: boolean("show_business_contact").notNull().default(true),
  showCustomerDetails: boolean("show_customer_details").notNull().default(true),
  showPaymentMethod: boolean("show_payment_method").notNull().default(true),
  showTaxBreakdown: boolean("show_tax_breakdown").notNull().default(true),
  showQrCode: boolean("show_qr_code").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
export type ReceiptContentPreferences = typeof receiptContentPreferencesTable.$inferSelect;
