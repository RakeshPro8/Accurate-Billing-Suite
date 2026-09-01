import { Router } from "express";
import { db, taxProfilesTable, storesTable } from "@workspace/db";
import { and, desc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { requireCurrentStoreId } from "../lib/stores";
import { requireRole } from "../lib/auth";
import { HttpError, validateRequest } from "../lib/http";
import { logAudit } from "../lib/audit";

const router = Router();
const provinceCodes = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;
const profileId = z.object({ id: z.coerce.number().int().positive() });
const rate = z.coerce.number().finite().min(0).max(100);
const profileInput = z.object({
  name: z.string().trim().min(1).max(120),
  provinceCode: z.enum(provinceCodes),
  currency: z.literal("CAD"),
  gstRate: rate,
  hstRate: rate,
  pstRate: rate,
  qstRate: rate,
  effectiveFrom: z.string().date(),
  enabled: z.boolean(),
  roundingMode: z.enum(["line", "subtotal"]),
  partsTaxable: z.boolean(),
  labourTaxable: z.boolean(),
  depositsTaxable: z.boolean(),
  accessoriesTaxable: z.boolean(),
}).strict();

function parseProfile(profile: typeof taxProfilesTable.$inferSelect) {
  return {
    ...profile,
    gstRate: Number(profile.gstRate),
    hstRate: Number(profile.hstRate),
    pstRate: Number(profile.pstRate),
    qstRate: Number(profile.qstRate),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

async function scopedProfile(id: number, storeId: number) {
  const [profile] = await db.select().from(taxProfilesTable)
    .where(and(eq(taxProfilesTable.id, id), eq(taxProfilesTable.storeId, storeId))).limit(1);
  return profile;
}

router.get("/", validateRequest({ query: z.object({ includeDisabled: z.coerce.boolean().optional() }).strict() }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const includeDisabled = (req.query as { includeDisabled?: boolean }).includeDisabled === true;
  const profiles = await db.select().from(taxProfilesTable)
    .where(and(eq(taxProfilesTable.storeId, storeId), includeDisabled ? undefined : eq(taxProfilesTable.enabled, true)))
    .orderBy(desc(taxProfilesTable.effectiveFrom), desc(taxProfilesTable.id));
  const [store] = await db.select({ provinceCode: storesTable.provinceCode, currency: storesTable.currency }).from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
  const today = new Date().toISOString().slice(0, 10);
  const active = profiles.find((profile) => profile.enabled && profile.effectiveFrom <= today) ?? null;
  return res.json({
    store: { id: storeId, provinceCode: store?.provinceCode ?? "ON", currency: store?.currency ?? "CAD" },
    activeProfileId: active?.id ?? null,
    profiles: profiles.map(parseProfile),
  });
});

router.post("/", requireRole("admin"), validateRequest({ body: profileInput }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const body = req.body as z.infer<typeof profileInput>;
  const [profile] = await db.insert(taxProfilesTable).values({ ...body, storeId, gstRate: String(body.gstRate), hstRate: String(body.hstRate), pstRate: String(body.pstRate), qstRate: String(body.qstRate) }).returning();
  await logAudit(req, "create", "tax_profile", profile.id, { storeId, provinceCode: profile.provinceCode, effectiveFrom: profile.effectiveFrom });
  return res.status(201).json(parseProfile(profile));
});

router.patch("/:id", requireRole("admin"), validateRequest({ params: profileId, body: profileInput.partial() }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const id = Number(req.params.id);
  const existing = await scopedProfile(id, storeId);
  if (!existing) throw new HttpError(404, "Tax profile not found.", "NOT_FOUND");
  const body = req.body as Partial<z.infer<typeof profileInput>>;
  if (body.currency !== undefined && body.currency !== "CAD") throw new HttpError(400, "Tax profiles must use CAD.", "INVALID_REQUEST");
  const updates = { ...body, updatedAt: new Date(), ...(body.gstRate === undefined ? {} : { gstRate: String(body.gstRate) }), ...(body.hstRate === undefined ? {} : { hstRate: String(body.hstRate) }), ...(body.pstRate === undefined ? {} : { pstRate: String(body.pstRate) }), ...(body.qstRate === undefined ? {} : { qstRate: String(body.qstRate) }) };
  const [profile] = await db.update(taxProfilesTable).set(updates as any).where(and(eq(taxProfilesTable.id, id), eq(taxProfilesTable.storeId, storeId))).returning();
  await logAudit(req, "update", "tax_profile", id, { storeId, fields: Object.keys(body) });
  return res.json(parseProfile(profile));
});

router.post("/:id/retire", requireRole("admin"), validateRequest({ params: profileId, body: z.object({}).strict() }), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const id = Number(req.params.id);
  const existing = await scopedProfile(id, storeId);
  if (!existing) throw new HttpError(404, "Tax profile not found.", "NOT_FOUND");
  const [profile] = await db.update(taxProfilesTable).set({ enabled: false, updatedAt: new Date() })
    .where(and(eq(taxProfilesTable.id, id), eq(taxProfilesTable.storeId, storeId))).returning();
  await logAudit(req, "update", "tax_profile", id, { action: "retire", storeId });
  return res.json(parseProfile(profile));
});

export default router;