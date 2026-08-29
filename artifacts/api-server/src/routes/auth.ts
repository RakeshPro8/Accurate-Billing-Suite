import { Router } from "express";
import type { Request } from "express";
import { db, employeesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { hashPin, verifyPin, getEmployeeById } from "../lib/auth";
import { logAudit } from "../lib/audit";

const router = Router();

const PIN_PATTERN = /^\d{4,8}$/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const failedAttempts = new Map<string, { count: number; firstAttemptAt: number; blockedUntil?: number }>();

type PublicEmployee = {
  id: number;
  name: string;
  email: string | null;
  role: string;
  maxDiscountPct: number;
  active: boolean;
  createdAt: string;
};

function publicEmployee(emp: typeof employeesTable.$inferSelect): PublicEmployee {
  return {
    id: emp.id,
    name: emp.name,
    email: emp.email,
    role: emp.role,
    maxDiscountPct: Number(emp.maxDiscountPct),
    active: emp.active,
    createdAt: emp.createdAt.toISOString(),
  };
}

function signInEmployee(emp: typeof employeesTable.$inferSelect) {
  return {
    id: emp.id,
    name: emp.name,
    email: emp.email,
    role: emp.role,
    maxDiscountPct: Number(emp.maxDiscountPct),
    active: emp.active,
  };
}

function validateName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 120;
}

function validateEmail(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function attemptKey(req: Request, employeeId: number) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}:${employeeId}`;
}

function isBlocked(key: string): number {
  const attempt = failedAttempts.get(key);
  if (!attempt) return 0;
  const now = Date.now();
  if (attempt.blockedUntil && attempt.blockedUntil > now) return attempt.blockedUntil - now;
  if (now - attempt.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    failedAttempts.delete(key);
    return 0;
  }
  return 0;
}

function recordFailure(key: string) {
  const now = Date.now();
  const previous = failedAttempts.get(key);
  const attempt = !previous || now - previous.firstAttemptAt > ATTEMPT_WINDOW_MS
    ? { count: 1, firstAttemptAt: now }
    : { ...previous, count: previous.count + 1 };
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) attempt.blockedUntil = now + LOCKOUT_MS;
  failedAttempts.set(key, attempt);
}

function clearFailures(key: string) {
  failedAttempts.delete(key);
}

function validatePin(value: unknown): value is string {
  return typeof value === "string" && PIN_PATTERN.test(value);
}

/**
 * Employee authentication contract:
 * - setup-status and employees expose no credentials and are safe before login.
 * - bootstrap is one-time and creates an admin plus its server session.
 * - sign-in verifies a 4–8 digit PIN, rotates the session, and returns only
 *   the active employee profile. PINs never appear in responses or audit data.
 * - session re-resolves the employee, so removal/deactivation invalidates it.
 */
router.get("/setup-status", async (_req, res) => {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(employeesTable);
    return res.json({ needsSetup: Number(count) === 0 });
  } catch {
    return res.status(500).json({ error: "Unable to check setup status." });
  }
});

router.get("/employees", async (_req, res) => {
  try {
    const employees = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        role: employeesTable.role,
        maxDiscountPct: employeesTable.maxDiscountPct,
        active: employeesTable.active,
      })
      .from(employeesTable)
      .where(eq(employeesTable.active, true))
      .orderBy(employeesTable.name);
    return res.json(employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      maxDiscountPct: Number(employee.maxDiscountPct),
    })));
  } catch {
    return res.status(500).json({ error: "Unable to load employees." });
  }
});

router.post("/bootstrap", async (req, res) => {
  try {
    const { name, email, pin } = req.body ?? {};
    if (!validateName(name) || !validateEmail(email) || !validatePin(pin)) {
      return res.status(400).json({ error: "Enter a name, optional valid email, and a 4-8 digit PIN." });
    }

    const result = await db.transaction(async (tx) => {
      // Serialize first-user creation across concurrent browser tabs/workers.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(748291)`);
      const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(employeesTable);
      if (Number(count) !== 0) return null;
      const [employee] = await tx.insert(employeesTable).values({
        name: name.trim(),
        email: email || null,
        pin: null,
        pinHash: await hashPin(pin),
        role: "admin",
        maxDiscountPct: "100",
        active: true,
      }).returning();
      return employee;
    });

    if (!result) return res.status(409).json({ error: "Setup is already complete. Sign in with an employee PIN." });
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => error ? reject(error) : resolve());
    });
    req.session.employeeId = result.id;
    await logAudit(req, "login", "employee", result.id);
    return res.status(201).json({ authenticated: true, employee: signInEmployee(result) });
  } catch {
    return res.status(500).json({ error: "Unable to complete setup." });
  }
});

router.post("/sign-in", async (req, res) => {
  try {
    const { employeeId, pin } = req.body ?? {};
    if (!Number.isInteger(employeeId) || employeeId <= 0 || !validatePin(pin)) {
      return res.status(400).json({ error: "Choose an employee and enter a 4-8 digit PIN." });
    }

    const key = attemptKey(req, employeeId);
    const remaining = isBlocked(key);
    if (remaining > 0) {
      res.setHeader("Retry-After", Math.ceil(remaining / 1000));
      return res.status(429).json({ error: "Too many incorrect attempts. Try again shortly." });
    }

    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId));
    if (!employee) return res.status(404).json({ error: "Employee account not found." });
    if (!employee.active) return res.status(403).json({ error: "Employee account is inactive." });

    let valid = employee.pinHash ? await verifyPin(pin, employee.pinHash) : employee.pin === pin;
    if (valid && !employee.pinHash && employee.pin) {
      // Migrate legacy plaintext PINs only after successful verification.
      const pinHash = await hashPin(pin);
      await db.update(employeesTable).set({ pinHash, pin: null }).where(eq(employeesTable.id, employee.id));
    }
    if (!valid) {
      recordFailure(key);
      return res.status(401).json({ error: "Incorrect PIN." });
    }

    clearFailures(key);
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => error ? reject(error) : resolve());
    });
    req.session.employeeId = employee.id;
    await logAudit(req, "login", "employee", employee.id);
    return res.json({ authenticated: true, employee: signInEmployee(employee) });
  } catch {
    return res.status(500).json({ error: "Unable to sign in." });
  }
});

router.get("/session", async (req, res) => {
  try {
    if (!req.session.employeeId) return res.json({ authenticated: false });
    const employee = await getEmployeeById(req.session.employeeId);
    if (!employee?.active) {
      await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
      res.clearCookie("mobilinq.sid");
      return res.json({ authenticated: false });
    }
    return res.json({ authenticated: true, employee });
  } catch {
    return res.status(500).json({ error: "Unable to inspect session." });
  }
});

router.post("/logout", async (req, res) => {
  try {
    if (req.session.employeeId) await logAudit(req, "logout", "employee", req.session.employeeId);
    await new Promise<void>((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    res.clearCookie("mobilinq.sid");
    return res.json({ loggedOut: true });
  } catch {
    return res.status(500).json({ error: "Unable to sign out." });
  }
});

export default router;