import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { requireCurrentStoreId } from "../lib/stores";
import { HttpError } from "../lib/http";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { category, search } = req.query as { category?: string; search?: string };
    if ((search && (typeof search !== "string" || search.length > 100)) || (category && (typeof category !== "string" || category.length > 80))) throw new HttpError(400, "Invalid request.");
    let query = db.select().from(productsTable).$dynamic();
    const conditions = [];
    const storeId = await requireCurrentStoreId(req);
    conditions.push(eq(productsTable.storeId, storeId));
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
    throw e;
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};
    const storeId = await requireCurrentStoreId(req);
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 200 || typeof body.sku !== "string" || !body.sku.trim() || !Number.isFinite(Number(body.price)) || Number(body.price) < 0 || !Number.isInteger(body.stock ?? 0)) throw new HttpError(400, "Invalid product.");
    const [product] = await db.insert(productsTable).values({
      name: body.name,
      sku: body.sku,
      category: body.category,
      description: body.description || null,
      price: String(body.price),
      cost: body.cost ? String(body.cost) : null,
      stock: body.stock ?? 0,
      unit: body.unit || "pcs",
       storeId,
    }).returning();
    return res.status(201).json({ ...product, price: parseFloat(product.price), cost: product.cost ? parseFloat(product.cost) : null, createdAt: product.createdAt.toISOString() });
  } catch (e) {
    throw e;
  }
});

router.get("/:id", async (req, res) => {
  try {
    const storeId = await requireCurrentStoreId(req);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid product id.");
    const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.storeId, storeId)));
    if (!product) return res.status(404).json({ error: "Not found" });
    return res.json({ ...product, price: parseFloat(product.price), cost: product.cost ? parseFloat(product.cost) : null, createdAt: product.createdAt.toISOString() });
  } catch (e) {
    throw e;
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const storeId = await requireCurrentStoreId(req);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || (body.price !== undefined && (!Number.isFinite(Number(body.price)) || Number(body.price) < 0)) || (body.stock !== undefined && (!Number.isInteger(body.stock) || body.stock < 0))) throw new HttpError(400, "Invalid product.");
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.sku !== undefined) updates.sku = body.sku;
    if (body.category !== undefined) updates.category = body.category;
    if (body.description !== undefined) updates.description = body.description;
    if (body.price !== undefined) updates.price = String(body.price);
    if (body.cost !== undefined) updates.cost = String(body.cost);
    if (body.stock !== undefined) updates.stock = body.stock;
    if (body.unit !== undefined) updates.unit = body.unit;
    if (!Object.keys(updates).length) throw new HttpError(400, "No product fields supplied.");
    const [product] = await db.update(productsTable).set(updates).where(and(eq(productsTable.id, id), eq(productsTable.storeId, storeId))).returning();
    if (!product) return res.status(404).json({ error: "Not found" });
    return res.json({ ...product, price: parseFloat(product.price), cost: product.cost ? parseFloat(product.cost) : null, createdAt: product.createdAt.toISOString() });
  } catch (e) {
    throw e;
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const storeId = await requireCurrentStoreId(req);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid product id.");
    await db.delete(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.storeId, storeId)));
    return res.status(204).send();
  } catch (e) {
    throw e;
  }
});

export default router;
