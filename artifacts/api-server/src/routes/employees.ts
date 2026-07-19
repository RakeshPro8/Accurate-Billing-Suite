import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function parseEmployee(e: typeof employeesTable.$inferSelect) {
  return {
    ...e,
    maxDiscountPct: parseFloat(e.maxDiscountPct),
    createdAt: e.createdAt.toISOString(),
    pin: undefined,
  };
}

router.get("/", async (_req, res) => {
  try {
    const employees = await db.select().from(employeesTable).orderBy(employeesTable.name);
    return res.json(employees.map(parseEmployee));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, email, pin, role, maxDiscountPct, active } = req.body;
    if (!name || !pin || pin.length < 4 || pin.length > 8) {
      return res.status(400).json({ error: "Name and a 4-8 digit PIN are required." });
    }
    const validRoles = ["admin", "manager", "staff"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: "Role must be admin, manager, or staff." });
    }
    const [emp] = await db.insert(employeesTable).values({
      name,
      email: email || null,
      pin,
      role: role || "staff",
      maxDiscountPct: String(maxDiscountPct ?? 0),
      active: active !== false,
    }).returning();
    return res.status(201).json(parseEmployee(emp));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, pin, role, maxDiscountPct, active } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (pin !== undefined) {
      if (pin.length < 4 || pin.length > 8) return res.status(400).json({ error: "PIN must be 4-8 digits." });
      updates.pin = pin;
    }
    if (role !== undefined) {
      const validRoles = ["admin", "manager", "staff"];
      if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role." });
      updates.role = role;
    }
    if (maxDiscountPct !== undefined) updates.maxDiscountPct = String(maxDiscountPct);
    if (active !== undefined) updates.active = active;
    const [emp] = await db.update(employeesTable).set(updates).where(eq(employeesTable.id, id)).returning();
    if (!emp) return res.status(404).json({ error: "Employee not found." });
    return res.json(parseEmployee(emp));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(employeesTable).where(eq(employeesTable.id, id));
    return res.status(204).send();
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.post("/verify-pin", async (req, res) => {
  try {
    const { employeeId, pin } = req.body;
    if (!employeeId || !pin) return res.status(400).json({ error: "employeeId and pin are required." });
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(employeeId)));
    if (!emp) return res.status(404).json({ error: "Employee not found." });
    if (!emp.active) return res.status(403).json({ error: "Employee account is inactive." });
    if (emp.pin !== String(pin)) return res.status(401).json({ error: "Incorrect PIN." });
    return res.json({
      verified: true,
      employee: parseEmployee(emp),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
