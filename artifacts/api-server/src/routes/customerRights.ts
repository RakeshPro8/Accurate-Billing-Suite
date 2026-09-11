import { Router } from "express";
import { db, guidanceEntriesTable } from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "../lib/auth";
import { HttpError, validateRequest } from "../lib/http";
import { logAudit } from "../lib/audit";
import { requireCurrentStoreId } from "../lib/stores";
import {
  languages,
  provinceCodes,
  getReviewReminder,
  reviewIntervalDays,
  reviewDueAt,
  reviewDaysRemaining,
  sourceByProvince,
  topicCopy,
  topics,
  type GuideLanguage,
  type GuideTopic,
} from "../data/customerRightsCatalog";

const router = Router();
const statuses = ["draft", "published", "retired"] as const;
const entryId = z.object({ id: z.coerce.number().int().positive() });
const infographicInput = z.object({
  steps: z.array(z.string().trim().min(1).max(240)).min(3).max(5),
  do: z.array(z.string().trim().min(1).max(240)).min(1).max(4),
  avoid: z.array(z.string().trim().min(1).max(240)).min(1).max(4),
  escalation: z.string().trim().min(1).max(500),
}).strict();
const entryInput = z.object({
  provinceCode: z.enum(provinceCodes),
  topic: z.enum(topics),
  language: z.enum(languages),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(2_000),
  readAloudScript: z.string().trim().max(2_000).nullable().optional(),
  infographic: infographicInput,
  sourceUrl: z.string().url().max(500).refine((value) => /^https:\/\//i.test(value), "Official sources must use HTTPS."),
  effectiveFrom: z.string().date(),
  lastReviewedAt: z.string().date(),
  reviewStatus: z.enum(statuses),
}).strict();

function stale(lastReviewedAt: string) {
  const review = new Date(`${lastReviewedAt}T00:00:00Z`).getTime();
  return !Number.isFinite(review) || Date.now() - review > reviewIntervalDays * 24 * 60 * 60 * 1000;
}

function parseEntry(entry: typeof guidanceEntriesTable.$inferSelect) {
  return {
    ...entry,
    stale: stale(entry.lastReviewedAt),
    reviewDueAt: reviewDueAt(entry.lastReviewedAt),
    reviewReminder: getReviewReminder(entry.lastReviewedAt),
    reviewDaysRemaining: reviewDaysRemaining(entry.lastReviewedAt),
    disclaimer: "Internal compliance aid only — not legal advice. Do not promise an outcome. Confirm questions with a manager and the official source.",
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function starterEntry(provinceCode: typeof provinceCodes[number], topic: GuideTopic, language: GuideLanguage, today: string) {
  const copy = topicCopy[topic][language];
  return {
    provinceCode,
    topic,
    language,
    title: copy.title,
    summary: copy.summary,
    readAloudScript: copy.script,
    infographic: copy.infographic,
    sourceUrl: sourceByProvince[provinceCode],
    effectiveFrom: today,
    lastReviewedAt: today,
    reviewStatus: "published" as const,
  };
}

async function seedCatalog() {
  const existing = await db.select({
    id: guidanceEntriesTable.id,
    provinceCode: guidanceEntriesTable.provinceCode,
    topic: guidanceEntriesTable.topic,
    language: guidanceEntriesTable.language,
    reviewStatus: guidanceEntriesTable.reviewStatus,
    createdBy: guidanceEntriesTable.createdBy,
    updatedBy: guidanceEntriesTable.updatedBy,
  }).from(guidanceEntriesTable);
  const today = new Date().toISOString().slice(0, 10);
  const existingKeys = new Set(existing.map((entry) => `${entry.provinceCode}:${entry.topic}:${entry.language}`));
  const values = provinceCodes.flatMap((provinceCode) => topics.flatMap((topic) => languages.filter((language) => !existingKeys.has(`${provinceCode}:${topic}:${language}`)).map((language) => starterEntry(provinceCode, topic, language, today))));
  if (values.length > 0) {
    await db.insert(guidanceEntriesTable)
      .values(values)
      .onConflictDoNothing({
        target: [guidanceEntriesTable.provinceCode, guidanceEntriesTable.topic, guidanceEntriesTable.language],
      });
  }

  // The original one-language bootstrap created unpublished rows without an actor.
  // Upgrade only those untouched system rows; any manager-authored row is left alone.
  const legacyRows = existing.filter((entry) => (
    entry.language === "en" &&
    entry.reviewStatus === "draft" &&
    entry.createdBy === null &&
    entry.updatedBy === null &&
    topics.includes(entry.topic as GuideTopic) &&
    provinceCodes.includes(entry.provinceCode as typeof provinceCodes[number])
  ));
  for (const entry of legacyRows) {
    const copy = starterEntry(entry.provinceCode as typeof provinceCodes[number], entry.topic as GuideTopic, "en", today);
    await db.update(guidanceEntriesTable)
      .set(copy)
      .where(eq(guidanceEntriesTable.id, entry.id));
  }
}

router.get("/", validateRequest({ query: z.object({ provinceCode: z.enum(provinceCodes).optional(), topic: z.enum(topics).optional(), language: z.enum(languages).default("en"), status: z.enum(statuses).optional() }).strict() }), async (req, res) => {
  await requireCurrentStoreId(req);
  const query = req.query as { provinceCode?: typeof provinceCodes[number]; topic?: typeof topics[number]; language: GuideLanguage; status?: typeof statuses[number] };
  const isAdmin = req.employee?.role === "admin";
  await seedCatalog();
  const conditions = [
    query.provinceCode ? eq(guidanceEntriesTable.provinceCode, query.provinceCode) : undefined,
    query.topic ? eq(guidanceEntriesTable.topic, query.topic) : undefined,
    eq(guidanceEntriesTable.language, query.language),
    isAdmin && query.status ? eq(guidanceEntriesTable.reviewStatus, query.status) : eq(guidanceEntriesTable.reviewStatus, "published"),
  ].filter(Boolean) as any[];
  const entries = await db.select().from(guidanceEntriesTable).where(and(...conditions)).orderBy(asc(guidanceEntriesTable.provinceCode), asc(guidanceEntriesTable.topic), desc(guidanceEntriesTable.updatedAt));
  return res.json({ entries: entries.map(parseEntry), retrievedAt: new Date().toISOString(), offlineSafe: true });
});

router.post("/", requireRole("admin"), validateRequest({ body: entryInput }), async (req, res) => {
  await requireCurrentStoreId(req);
  const body = req.body as z.infer<typeof entryInput>;
  const [entry] = await db.insert(guidanceEntriesTable).values({ ...body, createdBy: req.employee?.id, updatedBy: req.employee?.id }).returning();
  await logAudit(req, "create", "guidance_entry", entry.id, { provinceCode: entry.provinceCode, topic: entry.topic, reviewStatus: entry.reviewStatus });
  return res.status(201).json(parseEntry(entry));
});

router.patch("/:id", requireRole("admin"), validateRequest({ params: entryId, body: entryInput.partial() }), async (req, res) => {
  await requireCurrentStoreId(req);
  const id = Number(req.params.id);
  const [existing] = await db.select().from(guidanceEntriesTable).where(eq(guidanceEntriesTable.id, id)).limit(1);
  if (!existing) throw new HttpError(404, "Guidance entry not found.", "NOT_FOUND");
  const body = req.body as Partial<z.infer<typeof entryInput>>;
  const [entry] = await db.update(guidanceEntriesTable).set({ ...body, updatedBy: req.employee?.id, updatedAt: new Date() }).where(eq(guidanceEntriesTable.id, id)).returning();
  await logAudit(req, "update", "guidance_entry", id, { fields: Object.keys(body), reviewStatus: body.reviewStatus });
  return res.json(parseEntry(entry));
});

router.post("/:id/retire", requireRole("admin"), validateRequest({ params: entryId, body: z.object({}).strict() }), async (req, res) => {
  await requireCurrentStoreId(req);
  const id = Number(req.params.id);
  const [entry] = await db.update(guidanceEntriesTable).set({ reviewStatus: "retired", updatedBy: req.employee?.id, updatedAt: new Date() }).where(eq(guidanceEntriesTable.id, id)).returning();
  if (!entry) throw new HttpError(404, "Guidance entry not found.", "NOT_FOUND");
  await logAudit(req, "update", "guidance_entry", id, { action: "retire", provinceCode: entry.provinceCode, topic: entry.topic });
  return res.json(parseEntry(entry));
});

export default router;