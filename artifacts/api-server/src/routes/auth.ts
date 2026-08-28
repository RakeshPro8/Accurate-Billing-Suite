import { Router } from "express";
import { db, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPin, verifyPin, getEmployeeById } from "../lib/auth";

const router = Router();

function parseEmployee(emp: typeof employeesTable.$inferSelect) {
  return {
    id: emp.id,
    name: emp.name,
    email: emp.email,
    role: emp.role,
    maxDiscountPct: parseFloat(String(emp.maxDiscountPct)),
    active: emp.active,
    createdAt: emp.createdAt.toISOString(),
  };
}

router.post("/verify-pin", async (req, res) => {
  try {
    const { employeeId, pin } = req.body;
    if (!employeeId || !pin) {
      return res.status(400).json({ error: "employeeId and pin are required." });
    }
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(employeeId)));
    if (!emp) return res.status(404).json({ error: "Employee not found." });
    if (!emp.active) return res.status(403).json({ error: "Employee account is inactive." });

    let valid = false;
    if (emp.pinHash) {
      valid = await verifyPin(String(pin), emp.pinHash);
    } else if (emp.pin) {
      // One-time migration from plaintext to hash
      valid = emp.pin === String(pin);
      if (valid) {
        const hashed = await hashPin(String(pin));
        await db.update(employeesTable).set({ pinHash: hashed, pin: null }).where(eq(employeesTable.id, emp.id));
      }
    }

    if (!valid) return res.status(401).json({ error: "Incorrect PIN." });

    req.session.employeeId = emp.id;
    return res.json({ verified: true, employee: parseEmployee(emp) });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.get("/session", async (req, res) => {
  try {
    if (!req.session.employeeId) {
      return res.json({ authenticated: false });
    }
    const emp = await getEmployeeById(req.session.employeeId);
    if (!emp || !emp.active) {
      req.session.destroy(() => {});
      return res.json({ authenticated: false });
    }
    return res.json({ authenticated: true, employee: emp });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: String(err) });
    }
    res.clearCookie("mobilinq.sid");
    return res.json({ loggedOut: true });
  });
});

export default router;
