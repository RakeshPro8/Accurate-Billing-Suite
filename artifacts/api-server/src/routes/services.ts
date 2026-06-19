import { Router } from "express";
import { db } from "@workspace/db";
import { servicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const services = await db.select().from(servicesTable).orderBy(servicesTable.name);
    res.json(services.map(s => ({
      ...s,
      price: parseFloat(s.price),
      createdAt: s.createdAt.toISOString(),
    })));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [service] = await db.insert(servicesTable).values({
      name: body.name,
      category: body.category,
      description: body.description || null,
      price: String(body.price),
      duration: body.duration || null,
    }).returning();
    res.status(201).json({ ...service, price: parseFloat(service.price), createdAt: service.createdAt.toISOString() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const body = req.body;
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.description !== undefined) updates.description = body.description;
    if (body.price !== undefined) updates.price = String(body.price);
    if (body.duration !== undefined) updates.duration = body.duration;
    const [service] = await db.update(servicesTable).set(updates).where(eq(servicesTable.id, Number(req.params.id))).returning();
    if (!service) return res.status(404).json({ error: "Not found" });
    res.json({ ...service, price: parseFloat(service.price), createdAt: service.createdAt.toISOString() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(servicesTable).where(eq(servicesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
