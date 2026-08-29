import { Router } from "express";
import { db } from "@workspace/db";
import { servicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireCurrentStoreId } from "../lib/stores";
import { HttpError } from "../lib/http";

const router = Router();

router.get("/", async (req, res) => {
  try {
    await requireCurrentStoreId(req);
    const services = await db.select().from(servicesTable).orderBy(servicesTable.name);
    return res.json(services.map(s => ({
      ...s,
      price: parseFloat(s.price),
      createdAt: s.createdAt.toISOString(),
    })));
  } catch (e) {
    throw e;
  }
});

router.post("/", async (req, res) => {
  try {
    await requireCurrentStoreId(req);
    const body = req.body ?? {};
    if (typeof body.name !== "string" || !body.name.trim() || typeof body.category !== "string" || !body.category.trim() || !Number.isFinite(Number(body.price)) || Number(body.price) < 0) throw new HttpError(400, "Invalid service.");
    const [service] = await db.insert(servicesTable).values({
      name: body.name,
      category: body.category,
      description: body.description || null,
      price: String(body.price),
      duration: body.duration || null,
    }).returning();
    return res.status(201).json({ ...service, price: parseFloat(service.price), createdAt: service.createdAt.toISOString() });
  } catch (e) {
    throw e;
  }
});

router.patch("/:id", async (req, res) => {
  try {
    await requireCurrentStoreId(req);
    const id = Number(req.params.id);
    const body = req.body ?? {};
    if (!Number.isSafeInteger(id) || id < 1 || (body.price !== undefined && (!Number.isFinite(Number(body.price)) || Number(body.price) < 0))) throw new HttpError(400, "Invalid service.");
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.description !== undefined) updates.description = body.description;
    if (body.price !== undefined) updates.price = String(body.price);
    if (body.duration !== undefined) updates.duration = body.duration;
    if (!Object.keys(updates).length) throw new HttpError(400, "No service fields supplied.");
    const [service] = await db.update(servicesTable).set(updates).where(eq(servicesTable.id, id)).returning();
    if (!service) return res.status(404).json({ error: "Not found" });
    return res.json({ ...service, price: parseFloat(service.price), createdAt: service.createdAt.toISOString() });
  } catch (e) {
    throw e;
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await requireCurrentStoreId(req);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid service id.");
    await db.delete(servicesTable).where(eq(servicesTable.id, id));
    return res.status(204).send();
  } catch (e) {
    throw e;
  }
});

export default router;
