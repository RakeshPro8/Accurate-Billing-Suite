import { Router } from "express";
import { db, storesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireRole } from "../lib/auth";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const stores = await db.select().from(storesTable).orderBy(storesTable.name);
    return res.json(stores);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
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
    return res.json(store);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
