import { Router } from "express";
import { db, storesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { getCurrentStoreId, setCurrentStoreId } from "../lib/stores";
import { logAudit } from "../lib/audit";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const stores = await db.select().from(storesTable).orderBy(storesTable.name);
    return res.json(stores);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
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

router.patch("/current", async (req, res) => {
  try {
    const storeId = req.body?.storeId === null ? null : Number(req.body?.storeId);
    if (storeId !== null && !Number.isInteger(storeId)) {
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
    const { name, address, phone, email, isDefault } = req.body;
    if (!name) return res.status(400).json({ error: "Store name is required." });
    if (isDefault) {
      await db.update(storesTable).set({ isDefault: false }).where(sql`${storesTable.isDefault} = true`);
    }
    const [store] = await db.insert(storesTable).values({
      name,
      address: address || null,
      phone: phone || null,
      email: email || null,
      isDefault: isDefault === true,
    }).returning();
    await logAudit(req, "create", "store", store.id, { name: store.name });
    return res.status(201).json(store);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.patch("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, phone, email, isDefault, active } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (active !== undefined) updates.active = active;
    if (isDefault === true) {
      await db.update(storesTable).set({ isDefault: false }).where(sql`${storesTable.isDefault} = true`);
      updates.isDefault = true;
    }
    const [store] = await db.update(storesTable).set(updates).where(eq(storesTable.id, id)).returning();
    if (!store) return res.status(404).json({ error: "Store not found." });
    await logAudit(req, "update", "store", store.id, { fields: Object.keys(updates) });
    return res.json(store);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
