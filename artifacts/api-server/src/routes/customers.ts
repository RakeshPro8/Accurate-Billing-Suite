import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, salesTable } from "@workspace/db";
import { eq, ilike, or, sql, sum, count } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { search } = req.query as { search?: string };
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

    if (search) {
      baseQuery = baseQuery.where(
        or(
          ilike(customersTable.name, `%${search}%`),
          ilike(customersTable.email, `%${search}%`),
          ilike(customersTable.phone, `%${search}%`)
        )!
      );
    }

    const customers = await baseQuery.orderBy(customersTable.name);
    return res.json(customers.map(c => ({
      ...c,
      totalSpent: parseFloat(String(c.totalSpent)),
      totalOrders: Number(c.totalOrders),
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [customer] = await db.insert(customersTable).values({
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      notes: body.notes || null,
    }).returning();
    return res.status(201).json({ ...customer, totalSpent: 0, totalOrders: 0, createdAt: customer.createdAt.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!customer) return res.status(404).json({ error: "Not found" });
    const [stats] = await db.select({
      totalSpent: sql<number>`coalesce(sum(${salesTable.total}::numeric), 0)`,
      totalOrders: sql<number>`count(${salesTable.id})`,
    }).from(salesTable).where(eq(salesTable.customerId, id));
    return res.json({
      ...customer,
      totalSpent: parseFloat(String(stats.totalSpent)),
      totalOrders: Number(stats.totalOrders),
      createdAt: customer.createdAt.toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const body = req.body;
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.address !== undefined) updates.address = body.address;
    if (body.notes !== undefined) updates.notes = body.notes;
    const [customer] = await db.update(customersTable).set(updates).where(eq(customersTable.id, Number(req.params.id))).returning();
    if (!customer) return res.status(404).json({ error: "Not found" });
    return res.json({ ...customer, totalSpent: 0, totalOrders: 0, createdAt: customer.createdAt.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(customersTable).where(eq(customersTable.id, Number(req.params.id)));
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
