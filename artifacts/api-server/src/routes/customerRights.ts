import { Router } from "express";
import { db, guidanceEntriesTable } from "@workspace/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "../lib/auth";
import { HttpError, validateRequest } from "../lib/http";
import { logAudit } from "../lib/audit";

const router = Router();
const provinceCodes = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;
const topics = ["authorization-estimates", "diagnostics", "deposits-payment", "parts-warranty", "data-passwords", "abandoned-pickup", "receipts", "complaints", "escalation"] as const;
const statuses = ["draft", "published", "retired"] as const;
const entryId = z.object({ id: z.coerce.number().int().positive() });
const entryInput = z.object({
  provinceCode: z.enum(provinceCodes),
  topic: z.enum(topics),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(2_000),
  readAloudScript: z.string().trim().max(2_000).nullable().optional(),
  sourceUrl: z.string().url().max(500),
  effectiveFrom: z.string().date(),
  lastReviewedAt: z.string().date(),
  reviewStatus: z.enum(statuses),
}).strict();

const sourceByProvince: Record<string, string> = {
  AB: "https://www.alberta.ca/consumer-protection.aspx", BC: "https://www.consumerprotectionbc.ca/",
  MB: "https://www.gov.mb.ca/cca/cpo/", NB: "https://www.fcnb.ca/en/consumer-protection",
  NL: "https://www.gov.nl.ca/dgsnl/consumer/", NS: "https://novascotia.ca/just/regulations/regs/cpcgen.htm",
  NT: "https://www.justice.gov.nt.ca/en/consumer-affairs/", NU: "https://www.gov.nu.ca/community-and-government-services/information/consumer-affairs",
  ON: "https://www.ontario.ca/page/consumer-protection-ontario", PE: "https://www.princeedwardisland.ca/en/topic/consumer-protection",
  QC: "https://www.opc.gouv.qc.ca/", SK: "https://www.saskatchewan.ca/business/consumer-protection",
  YT: "https://yukon.ca/en/consumer-protection",
};
const topicCopy: Record<typeof topics[number], { title: string; summary: string; script: string }> = {
  "authorization-estimates": { title: "Authorization and estimates", summary: "Confirm what work the customer has authorized, the estimate, and how changes will be handled before proceeding. Keep the written record with the repair ticket.", script: "Before we start, let’s review the work you’re authorizing and the estimate. If the scope or price changes, we’ll pause and explain the change before continuing." },
  diagnostics: { title: "Diagnostics", summary: "Explain what diagnostic work is needed, whether it has a charge, and what the customer will receive after the diagnosis. Do not promise a repair result before inspection.", script: "We’ll inspect the device and explain what we find. A diagnosis helps us recommend next steps; it does not guarantee that the device can be repaired." },
  "deposits-payment": { title: "Deposits and payment", summary: "Record deposits and payment terms clearly, provide a receipt, and follow the store’s approved process for refunds or disputed amounts.", script: "Here is the amount being paid today and what it applies to. I’ll give you a receipt, and we can explain the store’s process if you have a payment question." },
  "parts-warranty": { title: "Parts and warranty", summary: "Tell the customer which parts or services are included, what warranty language has been approved, and where to find the official terms. Never promise coverage beyond the written terms.", script: "I can explain the approved warranty terms for this work. I don’t want to promise an outcome that is not written, so let’s review the terms together." },
  "data-passwords": { title: "Personal data and device passwords", summary: "Ask only for access needed for the authorized work, avoid recording unnecessary personal information, and follow the store’s secure device-credential process.", script: "We only need access that is necessary for the authorized diagnostic or repair. You can ask what we need and how any access information is protected." },
  "abandoned-pickup": { title: "Abandoned devices and pickup", summary: "Give the customer clear pickup information and use the approved notice and escalation process for devices left after the stated pickup period. Do not dispose of a device based on an informal promise.", script: "We’ll tell you when the device is ready and how to pick it up. If plans change, please contact us so we can explain the next steps under our approved policy." },
  receipts: { title: "Receipts and records", summary: "Provide a receipt or repair record showing the work, amounts, taxes where applicable, payments, and contact details for questions.", script: "Here is your receipt and repair record, including the amounts and payment recorded today. Please keep it in case you need to contact us." },
  complaints: { title: "Complaints", summary: "Listen without arguing, document the concern without unnecessary personal details, and explain the store’s approved review path. Do not retaliate or promise a specific result.", script: "I’m sorry this has been frustrating. I’ll record your concern and explain the next review step. I can’t promise the outcome, but I can make sure it is handled through the approved process." },
  escalation: { title: "Escalation", summary: "Escalate questions about legal rights, safety, privacy, disputed charges, or an outcome you cannot approve to a manager and the official source listed here.", script: "This question needs a manager or an official source rather than a guess from me. I’ll escalate it and make sure you know what happens next." },
};

function stale(lastReviewedAt: string) {
  const review = new Date(`${lastReviewedAt}T00:00:00Z`).getTime();
  return !Number.isFinite(review) || Date.now() - review > 365 * 24 * 60 * 60 * 1000;
}

function parseEntry(entry: typeof guidanceEntriesTable.$inferSelect) {
  return {
    ...entry,
    stale: stale(entry.lastReviewedAt),
    disclaimer: "Internal compliance aid only — not legal advice. Do not promise an outcome. Confirm questions with a manager and the official source.",
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

async function seedDrafts() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(guidanceEntriesTable);
  if (Number(count) > 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const values = provinceCodes.flatMap((provinceCode) => topics.map((topic) => {
    const copy = topicCopy[topic];
    return { provinceCode, topic, title: copy.title, summary: copy.summary, readAloudScript: copy.script, sourceUrl: sourceByProvince[provinceCode], effectiveFrom: today, lastReviewedAt: today, reviewStatus: "draft" as const };
  }));
  await db.insert(guidanceEntriesTable).values(values);
}

router.get("/", validateRequest({ query: z.object({ provinceCode: z.enum(provinceCodes).optional(), topic: z.enum(topics).optional(), status: z.enum(statuses).optional() }).strict() }), async (req, res) => {
  const query = req.query as { provinceCode?: typeof provinceCodes[number]; topic?: typeof topics[number]; status?: typeof statuses[number] };
  const isAdmin = req.employee?.role === "admin";
  if (isAdmin && query.status !== undefined) await seedDrafts();
  const conditions = [
    query.provinceCode ? eq(guidanceEntriesTable.provinceCode, query.provinceCode) : undefined,
    query.topic ? eq(guidanceEntriesTable.topic, query.topic) : undefined,
    isAdmin && query.status ? eq(guidanceEntriesTable.reviewStatus, query.status) : eq(guidanceEntriesTable.reviewStatus, "published"),
  ].filter(Boolean) as any[];
  const entries = await db.select().from(guidanceEntriesTable).where(and(...conditions)).orderBy(asc(guidanceEntriesTable.provinceCode), asc(guidanceEntriesTable.topic), desc(guidanceEntriesTable.updatedAt));
  return res.json({ entries: entries.map(parseEntry), retrievedAt: new Date().toISOString(), offlineSafe: true });
});

router.post("/", requireRole("admin"), validateRequest({ body: entryInput }), async (req, res) => {
  const body = req.body as z.infer<typeof entryInput>;
  const [entry] = await db.insert(guidanceEntriesTable).values({ ...body, createdBy: req.employee?.id, updatedBy: req.employee?.id }).returning();
  await logAudit(req, "create", "guidance_entry", entry.id, { provinceCode: entry.provinceCode, topic: entry.topic, reviewStatus: entry.reviewStatus });
  return res.status(201).json(parseEntry(entry));
});

router.patch("/:id", requireRole("admin"), validateRequest({ params: entryId, body: entryInput.partial() }), async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(guidanceEntriesTable).where(eq(guidanceEntriesTable.id, id)).limit(1);
  if (!existing) throw new HttpError(404, "Guidance entry not found.", "NOT_FOUND");
  const body = req.body as Partial<z.infer<typeof entryInput>>;
  const [entry] = await db.update(guidanceEntriesTable).set({ ...body, updatedBy: req.employee?.id, updatedAt: new Date() }).where(eq(guidanceEntriesTable.id, id)).returning();
  await logAudit(req, "update", "guidance_entry", id, { fields: Object.keys(body), reviewStatus: body.reviewStatus });
  return res.json(parseEntry(entry));
});

router.post("/:id/retire", requireRole("admin"), validateRequest({ params: entryId, body: z.object({}).strict() }), async (req, res) => {
  const id = Number(req.params.id);
  const [entry] = await db.update(guidanceEntriesTable).set({ reviewStatus: "retired", updatedBy: req.employee?.id, updatedAt: new Date() }).where(eq(guidanceEntriesTable.id, id)).returning();
  if (!entry) throw new HttpError(404, "Guidance entry not found.", "NOT_FOUND");
  await logAudit(req, "update", "guidance_entry", id, { action: "retire", provinceCode: entry.provinceCode, topic: entry.topic });
  return res.json(parseEntry(entry));
});

export default router;