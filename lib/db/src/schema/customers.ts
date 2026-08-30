import { pgTable, serial, text, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  isLoyaltyMember: boolean("is_loyalty_member").notNull().default(false),
  loyaltyDiscountPct: numeric("loyalty_discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  referralCode: text("referral_code"),
  referredByCustomerId: integer("referred_by_customer_id"),
  emailConsent: boolean("email_consent").notNull().default(false),
  smsConsent: boolean("sms_consent").notNull().default(false),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  consentSource: text("consent_source"),
  consentReviewedAt: timestamp("consent_reviewed_at"),
  anonymizedAt: timestamp("anonymized_at"),
  storeId: integer("store_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
