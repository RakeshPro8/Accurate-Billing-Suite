import { Router } from "express";
import { db, storesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { getCurrentStoreId, setCurrentStoreId } from "../lib/stores";
import { logAudit } from "../lib/audit";
import { HttpError } from "../lib/http";

const router = Router();
const provinceCodes = new Set(["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"]);

router.get("/", requireAuth, async (_req, res) => {
  try {
    const stores = await db.select().from(storesTable).orderBy(storesTable.name);
    return res.json(stores);
  } catch (e) {
    throw e;
  }
});

router.get("/current", requireAuth, async (req, res) => {
  try {
    const storeId = await getCurrentStoreId(req);
    const [store] = storeId
      ? await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1)
      : [];
    return res.json({ storeId, store: store ?? null });
  } catch (e) {
    return res.status(500).json({ error: "Unable to load current store." });
  }
});

router.patch("/current", requireAuth, async (req, res) => {
  try {
    const storeId = req.body?.storeId === null ? null : Number(req.body?.storeId);
    if (storeId !== null && (!Number.isSafeInteger(storeId) || storeId < 1)) {
      return res.status(400).json({ error: "storeId must be an integer or null." });
    }
    if (storeId !== null) {
      const [store] = await db.select().from(storesTable)
        .where(eq(storesTable.id, storeId)).limit(1);
      if (!store || !store.active) return res.status(404).json({ error: "Active store not found." });
    }
    await setCurrentStoreId(req, storeId);
    await logAudit(req, "store", "store", storeId ?? undefined, { selected: storeId });
    return res.json({ storeId });
  } catch (e) {
    return res.status(500).json({ error: "Unable to select current store." });
  }
});

router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { name, address, phone, email, isDefault, provinceCode = "ON", currency = "CAD" } = req.body ?? {};
    if (typeof name !== "string" || !name.trim() || name.length > 200 || !provinceCodes.has(provinceCode) || currency !== "CAD" || (email && (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) || (isDefault !== undefined && typeof isDefault !== "boolean")) throw new HttpError(400, "Invalid store.");
    const store = await db.transaction(async (tx) => {
      const [activeDefault] = await tx.select({ id: storesTable.id }).from(storesTable)
        .where(sql`${storesTable.active} = true AND ${storesTable.isDefault} = true`).limit(1);
      const shouldBeDefault = isDefault === true || !activeDefault;
      if (shouldBeDefault) await tx.update(storesTable).set({ isDefault: false }).where(sql`${storesTable.isDefault} = true`);
      const [created] = await tx.insert(storesTable).values({ name: name.trim(), address: address || null, phone: phone || null, email: email || null, isDefault: shouldBeDefault, provinceCode, currency }).returning();
      return created;
    });
    await logAudit(req, "create", "store", store.id, { name: store.name });
    return res.status(201).json(store);
  } catch (e) {
    throw e;
  }
});

router.patch("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, phone, email, isDefault, active, provinceCode, currency } = req.body ?? {};
    if (!Number.isSafeInteger(id) || id < 1 || (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 200)) || (provinceCode !== undefined && !provinceCodes.has(provinceCode)) || (currency !== undefined && currency !== "CAD") || (email && (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) || (isDefault !== undefined && typeof isDefault !== "boolean") || (active !== undefined && typeof active !== "boolean")) throw new HttpError(400, "Invalid store.");
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (provinceCode !== undefined) updates.provinceCode = provinceCode;
    if (currency !== undefined) updates.currency = currency;
    if (active !== undefined) updates.active = active;
    if (!Object.keys(updates).length && isDefault !== true) throw new HttpError(400, "No store fields supplied.");
    const store = await db.transaction(async (tx) => {
      if (isDefault === true) { await tx.update(storesTable).set({ isDefault: false }).where(sql`${storesTable.isDefault} = true`); updates.isDefault = true; }
      const [updated] = await tx.update(storesTable).set(updates).where(eq(storesTable.id, id)).returning();
      return updated;
    });
    if (!store) return res.status(404).json({ error: "Store not found." });
    await logAudit(req, "update", "store", store.id, { fields: Object.keys(updates) });
    return res.json(store);
  } catch (e) {
    throw e;
  }
});

export default router;
