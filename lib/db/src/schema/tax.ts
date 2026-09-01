import { pgTable, serial, integer, text, numeric, boolean, date, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taxProfilesTable = pgTable("tax_profiles", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull(),
  name: text("name").notNull().default("Canadian tax profile"),
  provinceCode: text("province_code").notNull().default("ON"),
  currency: text("currency").notNull().default("CAD"),
  gstRate: numeric("gst_rate", { precision: 6, scale: 4 }).notNull().default("0"),
  hstRate: numeric("hst_rate", { precision: 6, scale: 4 }).notNull().default("0"),
  pstRate: numeric("pst_rate", { precision: 6, scale: 4 }).notNull().default("0"),
  qstRate: numeric("qst_rate", { precision: 6, scale: 4 }).notNull().default("0"),
  effectiveFrom: date("effective_from").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  roundingMode: text("rounding_mode").notNull().default("subtotal"),
  partsTaxable: boolean("parts_taxable").notNull().default(true),
  labourTaxable: boolean("labour_taxable").notNull().default(true),
  depositsTaxable: boolean("deposits_taxable").notNull().default(false),
  accessoriesTaxable: boolean("accessories_taxable").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaxProfileSchema = createInsertSchema(taxProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTaxProfile = z.infer<typeof insertTaxProfileSchema>;
export type TaxProfile = typeof taxProfilesTable.$inferSelect;

export type TaxProfileSnapshot = {
  profileId: number | null;
  name: string;
  provinceCode: string;
  currency: string;
  gstRate: number;
  hstRate: number;
  pstRate: number;
  qstRate: number;
  effectiveFrom: string | null;
  enabled: boolean;
  roundingMode: string;
  partsTaxable: boolean;
  labourTaxable: boolean;
  depositsTaxable: boolean;
  accessoriesTaxable: boolean;
  taxExempt?: boolean;
  capturedAt: string;
};

export const taxProfileSnapshotColumn = jsonb("tax_profile_snapshot");