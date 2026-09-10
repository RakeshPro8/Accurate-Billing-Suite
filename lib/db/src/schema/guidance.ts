import { pgTable, serial, integer, text, date, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guidanceEntriesTable = pgTable("guidance_entries", {
  id: serial("id").primaryKey(),
  provinceCode: text("province_code").notNull(),
  topic: text("topic").notNull(),
  language: text("language").notNull().default("en"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  readAloudScript: text("read_aloud_script"),
  infographic: jsonb("infographic").notNull().default({}),
  sourceUrl: text("source_url").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  lastReviewedAt: date("last_reviewed_at").notNull(),
  reviewStatus: text("review_status").notNull().default("draft"),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  provinceTopicLanguageUnique: uniqueIndex("guidance_entries_province_topic_language_idx").on(table.provinceCode, table.topic, table.language),
}));

export const insertGuidanceEntrySchema = createInsertSchema(guidanceEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGuidanceEntry = z.infer<typeof insertGuidanceEntrySchema>;
export type GuidanceEntry = typeof guidanceEntriesTable.$inferSelect;