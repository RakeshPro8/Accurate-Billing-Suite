import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guidanceEntriesTable = pgTable("guidance_entries", {
  id: serial("id").primaryKey(),
  provinceCode: text("province_code").notNull(),
  topic: text("topic").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  readAloudScript: text("read_aloud_script"),
  sourceUrl: text("source_url").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  lastReviewedAt: date("last_reviewed_at").notNull(),
  reviewStatus: text("review_status").notNull().default("draft"),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGuidanceEntrySchema = createInsertSchema(guidanceEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGuidanceEntry = z.infer<typeof insertGuidanceEntrySchema>;
export type GuidanceEntry = typeof guidanceEntriesTable.$inferSelect;