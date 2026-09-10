import { Router } from "express";
import type { Request } from "express";
import { randomBytes } from "node:crypto";
import { db, employeesTable, pinResetRequestsTable } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { hashPin, verifyPin, getEmployeeById } from "../lib/auth";
import { logAudit } from "../lib/audit";

const router = Router();

const PIN_PATTERN = /^\d{4,8}$/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const MAX_TRACKED_ATTEMPTS = 10_000;
const failedAttempts = new Map<string, { count: number; firstAttemptAt: number; blockedUntil?: number }>();
const MAX_RESET_REQUESTS = 3;
const RESET_REQUEST_WINDOW_MS = 15 * 60_000;
const resetRequestAttempts = new Map<string, { count: number; firstAttemptAt: number }>();

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
    requiresPinChange: Boolean(emp.pinMustChange),
  };
}

function generateRecoveryCode() {
  return randomBytes(12).toString("hex").toUpperCase();
}

function normalizeRecoveryCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function validRecoveryCode(value: unknown): value is string {
  return normalizeRecoveryCode(value).length === 24;
}

function pinExpired(employee: typeof employeesTable.$inferSelect) {
  return Boolean(employee.pinExpiresAt && employee.pinExpiresAt.getTime() <= Date.now());
}

function resetRequestKey(req: Request, employeeId: number) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}:${employeeId}`;
}

function resetRequestAllowed(key: string) {
  const now = Date.now();
  const existing = resetRequestAttempts.get(key);
  if (!existing || now - existing.firstAttemptAt > RESET_REQUEST_WINDOW_MS) {
    resetRequestAttempts.set(key, { count: 1, firstAttemptAt: now });
    return true;
  }
  if (existing.count >= MAX_RESET_REQUESTS) return false;
  existing.count += 1;
  return true;
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

function pruneFailures() {
  const now = Date.now();
  for (const [key, attempt] of failedAttempts) {
    if ((!attempt.blockedUntil || attempt.blockedUntil <= now) && now - attempt.firstAttemptAt > ATTEMPT_WINDOW_MS) failedAttempts.delete(key);
  }
  // Do not allow untrusted identifiers/IPs to grow this in-memory limiter indefinitely.
  while (failedAttempts.size >= MAX_TRACKED_ATTEMPTS) {
    const oldest = failedAttempts.keys().next().value;
    if (oldest === undefined) break;
    failedAttempts.delete(oldest);
  }
}

function isBlocked(key: string): number {
  pruneFailures();
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
  pruneFailures();
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
    const recoveryCode = generateRecoveryCode();

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
        recoveryCodeHash: await hashPin(recoveryCode),
      }).returning();
      return employee;
    });

    if (!result) return res.status(409).json({ error: "Setup is already complete. Sign in with an employee PIN." });
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => error ? reject(error) : resolve());
    });
    req.session.employeeId = result.id;
    await logAudit(req, "login", "employee", result.id);
    return res.status(201).json({
      authenticated: true,
      employee: signInEmployee(result),
      recoveryCode,
    });
  } catch {
    return res.status(500).json({ error: "Unable to complete setup." });
  }
});

router.post("/pin-reset-requests", async (req, res) => {
  try {
    const { employeeId, note } = req.body ?? {};
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({ error: "Choose an employee account." });
    }
    if (note !== undefined && (typeof note !== "string" || note.trim().length > 500)) {
      return res.status(400).json({ error: "The note must be 500 characters or fewer." });
    }
    if (!resetRequestAllowed(resetRequestKey(req, employeeId))) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }

    const [employee] = await db
      .select({ id: employeesTable.id, active: employeesTable.active })
      .from(employeesTable)
      .where(eq(employeesTable.id, employeeId));
    if (!employee?.active) return res.status(202).json({ submitted: true });

    const [pending] = await db
      .select({ id: pinResetRequestsTable.id })
      .from(pinResetRequestsTable)
      .where(and(
        eq(pinResetRequestsTable.employeeId, employeeId),
        eq(pinResetRequestsTable.status, "pending"),
      ))
      .limit(1);
    if (!pending) {
      await db.insert(pinResetRequestsTable).values({
        employeeId,
        note: note?.trim() || null,
        status: "pending",
      });
    }
    return res.status(202).json({ submitted: true });
  } catch {
    return res.status(500).json({ error: "Unable to submit the PIN request." });
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
    if (!employee || !employee.active) {
      recordFailure(key);
      return res.status(401).json({ error: "Invalid employee ID or PIN." });
    }

    if (pinExpired(employee)) {
      recordFailure(key);
      return res.status(401).json({ error: "Invalid employee ID or PIN." });
    }

    let valid = employee.pinHash ? await verifyPin(pin, employee.pinHash) : employee.pin === pin;
    if (valid && !employee.pinHash && employee.pin) {
      // Migrate legacy plaintext PINs only after successful verification.
      const pinHash = await hashPin(pin);
      await db.update(employeesTable).set({ pinHash, pin: null }).where(eq(employeesTable.id, employee.id));
    }
    if (!valid) {
      recordFailure(key);
      return res.status(401).json({ error: "Invalid employee ID or PIN." });
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

router.post("/change-pin", async (req, res) => {
  try {
    const employeeId = req.session.employeeId;
    const { newPin } = req.body ?? {};
    if (!employeeId) return res.status(401).json({ error: "Not authenticated. Please sign in." });
    if (!validatePin(newPin)) return res.status(400).json({ error: "PIN must be 4-8 digits." });

    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId));
    if (!employee?.active) return res.status(401).json({ error: "Not authenticated. Please sign in." });
    const pinHash = await hashPin(newPin);
    const [updated] = await db.update(employeesTable)
      .set({ pin: null, pinHash, pinMustChange: false, pinExpiresAt: null })
      .where(eq(employeesTable.id, employee.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Employee account not found." });
    await logAudit(req, "update", "employee", employee.id, { changed: "pin" });
    return res.json({ authenticated: true, employee: signInEmployee(updated) });
  } catch {
    return res.status(500).json({ error: "Unable to change the PIN." });
  }
});

router.post("/admin-recovery", async (req, res) => {
  try {
    const { recoveryCode, newPin } = req.body ?? {};
    if (!validRecoveryCode(recoveryCode) || !validatePin(newPin)) {
      return res.status(400).json({ error: "Enter the recovery code and a new 4-8 digit PIN." });
    }

    const admins = await db.select().from(employeesTable).where(and(
      eq(employeesTable.role, "admin"),
      eq(employeesTable.active, true),
      isNull(employeesTable.recoveryCodeUsedAt),
    ));
    let matchedAdmin: typeof admins[number] | undefined;
    const normalizedCode = normalizeRecoveryCode(recoveryCode);
    for (const admin of admins) {
      if (admin.recoveryCodeHash && await verifyPin(normalizedCode, admin.recoveryCodeHash)) {
        matchedAdmin = admin;
        break;
      }
    }
    if (!matchedAdmin) return res.status(401).json({ error: "The recovery code is invalid or has already been used." });

    const pinHash = await hashPin(newPin);
    const [updated] = await db.update(employeesTable)
      .set({
        pin: null,
        pinHash,
        pinMustChange: false,
        pinExpiresAt: null,
        recoveryCodeUsedAt: new Date(),
      })
      .where(and(eq(employeesTable.id, matchedAdmin.id), isNull(employeesTable.recoveryCodeUsedAt)))
      .returning();
    if (!updated) return res.status(401).json({ error: "The recovery code is invalid or has already been used." });

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => error ? reject(error) : resolve());
    });
    req.session.employeeId = updated.id;
    await logAudit(req, "login", "employee", updated.id, { method: "admin_recovery" });
    return res.json({ authenticated: true, employee: signInEmployee(updated) });
  } catch {
    return res.status(500).json({ error: "Unable to complete admin recovery." });
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