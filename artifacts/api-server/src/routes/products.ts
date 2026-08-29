import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { getCurrentStoreId } from "../lib/stores";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { category, search } = req.query as { category?: string; search?: string };
    let query = db.select().from(productsTable).$dynamic();
    const conditions = [];
    const storeId = await getCurrentStoreId(req);
    if (storeId) conditions.push(eq(productsTable.storeId, storeId));
    if (category) conditions.push(eq(productsTable.category, category));
    if (search) conditions.push(or(ilike(productsTable.name, `%${search}%`), ilike(productsTable.sku, `%${search}%`))!);
    if (conditions.length > 0) query = query.where(sql`${conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} AND ${c}`)}`);
    const products = await query.orderBy(productsTable.name);
    return res.json(products.map(p => ({
      ...p,
      price: parseFloat(p.price),
      cost: p.cost ? parseFloat(p.cost) : null,
      createdAt: p.createdAt.toISOString(),
    })));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [product] = await db.insert(productsTable).values({
      name: body.name,
      sku: body.sku,
      category: body.category,
      description: body.description || null,
      price: String(body.price),
      cost: body.cost ? String(body.cost) : null,
      stock: body.stock ?? 0,
      unit: body.unit || "pcs",
      storeId: await getCurrentStoreId(req),
    }).returning();
    return res.status(201).json({ ...product, price: parseFloat(product.price), cost: product.cost ? parseFloat(product.cost) : null, createdAt: product.createdAt.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const storeId = await getCurrentStoreId(req);
    const id = Number(req.params.id);
    const [product] = await db.select().from(productsTable).where(storeId ? and(eq(productsTable.id, id), eq(productsTable.storeId, storeId)) : eq(productsTable.id, id));
    if (!product) return res.status(404).json({ error: "Not found" });
    return res.json({ ...product, price: parseFloat(product.price), cost: product.cost ? parseFloat(product.cost) : null, createdAt: product.createdAt.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const body = req.body;
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.sku !== undefined) updates.sku = body.sku;
    if (body.category !== undefined) updates.category = body.category;
    if (body.description !== undefined) updates.description = body.description;
    if (body.price !== undefined) updates.price = String(body.price);
    if (body.cost !== undefined) updates.cost = String(body.cost);
    if (body.stock !== undefined) updates.stock = body.stock;
    if (body.unit !== undefined) updates.unit = body.unit;
    const [product] = await db.update(productsTable).set(updates).where(eq(productsTable.id, Number(req.params.id))).returning();
    if (!product) return res.status(404).json({ error: "Not found" });
    return res.json({ ...product, price: parseFloat(product.price), cost: product.cost ? parseFloat(product.cost) : null, createdAt: product.createdAt.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(productsTable).where(eq(productsTable.id, Number(req.params.id)));
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
