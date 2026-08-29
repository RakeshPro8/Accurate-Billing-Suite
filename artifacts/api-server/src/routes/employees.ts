import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPin } from "../lib/auth";

const router = Router();

function parseEmployee(e: typeof employeesTable.$inferSelect) {
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    role: e.role,
    maxDiscountPct: parseFloat(e.maxDiscountPct),
    active: e.active,
    createdAt: e.createdAt.toISOString(),
  };
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 120;
}

function validPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4,8}$/.test(value);
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
    const { name, email, pin, role, maxDiscountPct, active } = req.body ?? {};
    if (!validName(name) || !validPin(pin)) {
      return res.status(400).json({ error: "Name and a 4-8 digit PIN are required." });
    }
    const validRoles = ["admin", "manager", "staff"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: "Role must be admin, manager, or staff." });
    }
    if (email !== undefined && email !== null && (typeof email !== "string" || email.length > 254)) {
      return res.status(400).json({ error: "Email is invalid." });
    }
    if (maxDiscountPct !== undefined && (!Number.isFinite(Number(maxDiscountPct)) || Number(maxDiscountPct) < 0 || Number(maxDiscountPct) > 100)) {
      return res.status(400).json({ error: "Discount limit must be between 0 and 100." });
    }
    const pinHash = await hashPin(pin);
    const [emp] = await db.insert(employeesTable).values({
      name: name.trim(),
      email: email || null,
      pin: null,
      pinHash,
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
    const { name, email, pin, role, maxDiscountPct, active } = req.body ?? {};
    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!validName(name)) return res.status(400).json({ error: "Name is required." });
      updates.name = name.trim();
    }
    if (email !== undefined) {
      if (email !== null && (typeof email !== "string" || email.length > 254)) return res.status(400).json({ error: "Email is invalid." });
      updates.email = email;
    }
    if (pin !== undefined) {
      if (!validPin(pin)) return res.status(400).json({ error: "PIN must be 4-8 digits." });
      updates.pin = null;
      updates.pinHash = await hashPin(pin);
    }
    if (role !== undefined) {
      const validRoles = ["admin", "manager", "staff"];
      if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role." });
      updates.role = role;
    }
    if (maxDiscountPct !== undefined) {
      if (!Number.isFinite(Number(maxDiscountPct)) || Number(maxDiscountPct) < 0 || Number(maxDiscountPct) > 100) return res.status(400).json({ error: "Discount limit must be between 0 and 100." });
      updates.maxDiscountPct = String(maxDiscountPct);
    }
    if (active !== undefined) {
      if (typeof active !== "boolean") return res.status(400).json({ error: "Active must be a boolean." });
      updates.active = active;
    }
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

export default router;
