import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, salesTable } from "@workspace/db";
import { and, eq, ilike, or, sql, sum, count } from "drizzle-orm";
import { requireCurrentStoreId } from "../lib/stores";
import { HttpError } from "../lib/http";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { search } = req.query as { search?: string };
    if (search && (typeof search !== "string" || search.length > 100)) throw new HttpError(400, "Invalid search.");
    const storeId = await requireCurrentStoreId(req);
    let baseQuery = db.select({
      id: customersTable.id,
      name: customersTable.name,
      email: customersTable.email,
      phone: customersTable.phone,
      address: customersTable.address,
      notes: customersTable.notes,
      createdAt: customersTable.createdAt,
      totalSpent: sql<number>`coalesce(sum(${salesTable.total}::numeric), 0)`,
      totalOrders: sql<number>`count(${salesTable.id})`,
    }).from(customersTable)
      .leftJoin(salesTable, eq(salesTable.customerId, customersTable.id))
      .groupBy(customersTable.id)
      .$dynamic();

    const conditions = [];
    if (search) conditions.push(or(
          ilike(customersTable.name, `%${search}%`),
          ilike(customersTable.email, `%${search}%`),
          ilike(customersTable.phone, `%${search}%`)
        )!);
    conditions.push(eq(customersTable.storeId, storeId));
    if (conditions.length) baseQuery = baseQuery.where(and(...conditions));

    const customers = await baseQuery.orderBy(customersTable.name);
    return res.json(customers.map(c => ({
      ...c,
      totalSpent: parseFloat(String(c.totalSpent)),
      totalOrders: Number(c.totalOrders),
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (e) {
    throw e;
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};
    const storeId = await requireCurrentStoreId(req);
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 200 || (body.email && (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)))) throw new HttpError(400, "Invalid customer.");
    const [customer] = await db.insert(customersTable).values({
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      notes: body.notes || null,
       storeId,
    }).returning();
    return res.status(201).json({ ...customer, totalSpent: 0, totalOrders: 0, createdAt: customer.createdAt.toISOString() });
  } catch (e) {
    throw e;
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const storeId = await requireCurrentStoreId(req);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid customer id.");
    const [customer] = await db.select().from(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.storeId, storeId)));
    if (!customer) return res.status(404).json({ error: "Not found" });
    const [stats] = await db.select({
      totalSpent: sql<number>`coalesce(sum(${salesTable.total}::numeric), 0)`,
      totalOrders: sql<number>`count(${salesTable.id})`,
    }).from(salesTable).where(and(eq(salesTable.customerId, id), eq(salesTable.storeId, storeId)));
    return res.json({
      ...customer,
      totalSpent: parseFloat(String(stats.totalSpent)),
      totalOrders: Number(stats.totalOrders),
      createdAt: customer.createdAt.toISOString(),
    });
  } catch (e) {
    throw e;
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const storeId = await requireCurrentStoreId(req);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || (body.email && (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)))) throw new HttpError(400, "Invalid customer.");
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.address !== undefined) updates.address = body.address;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (!Object.keys(updates).length) throw new HttpError(400, "No customer fields supplied.");
    const [customer] = await db.update(customersTable).set(updates).where(and(eq(customersTable.id, id), eq(customersTable.storeId, storeId))).returning();
    if (!customer) return res.status(404).json({ error: "Not found" });
    return res.json({ ...customer, totalSpent: 0, totalOrders: 0, createdAt: customer.createdAt.toISOString() });
  } catch (e) {
    throw e;
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const storeId = await requireCurrentStoreId(req);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid customer id.");
    await db.delete(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.storeId, storeId)));
    return res.status(204).send();
  } catch (e) {
    throw e;
  }
});

export default router;
