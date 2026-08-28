import { pgTable, serial, text, numeric, integer, boolean } from "drizzle-orm/pg-core";
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

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
