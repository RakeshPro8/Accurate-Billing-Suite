import { Router } from "express";
import { randomBytes, randomInt } from "node:crypto";
import { db, employeesTable, pinResetRequestsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { hashPin } from "../lib/auth";
import { HttpError } from "../lib/http";
import { logAudit } from "../lib/audit";

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

function generateTemporaryPin() {
  return String(randomInt(100000, 1000000));
}

router.get("/", async (_req, res, next) => {
  try {
    const employees = await db.select().from(employeesTable).orderBy(employeesTable.name);
    return res.json(employees.map(parseEmployee));
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
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
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, "Employee ID is invalid.", "INVALID_REQUEST");
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
  } catch (error) {
    return next(error);
  }
});

router.get("/pin-reset-requests", async (_req, res, next) => {
  try {
    const requests = await db
      .select({
        id: pinResetRequestsTable.id,
        employeeId: pinResetRequestsTable.employeeId,
        employeeName: employeesTable.name,
        employeeRole: employeesTable.role,
        status: pinResetRequestsTable.status,
        note: pinResetRequestsTable.note,
        requestedAt: pinResetRequestsTable.requestedAt,
        reviewedAt: pinResetRequestsTable.reviewedAt,
      })
      .from(pinResetRequestsTable)
      .innerJoin(employeesTable, eq(pinResetRequestsTable.employeeId, employeesTable.id))
      .orderBy(desc(pinResetRequestsTable.requestedAt))
      .limit(100);
    return res.json(requests.map((request) => ({
      ...request,
      requestedAt: request.requestedAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
    })));
  } catch (error) {
    return next(error);
  }
});

router.post("/pin-reset-requests/:id/approve", async (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isSafeInteger(requestId) || requestId <= 0) {
      throw new HttpError(400, "Request ID is invalid.", "INVALID_REQUEST");
    }
    const temporaryPin = generateTemporaryPin();
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const pinHash = await hashPin(temporaryPin);
    const reviewerId = req.employee?.id;

    const result = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(pinResetRequestsTable)
        .where(eq(pinResetRequestsTable.id, requestId));
      if (!request) throw new HttpError(404, "PIN request not found.", "NOT_FOUND");
      if (request.status !== "pending") throw new HttpError(409, "This PIN request has already been reviewed.", "REQUEST_REVIEWED");

      const [employee] = await tx
        .update(employeesTable)
        .set({
          pin: null,
          pinHash,
          pinMustChange: true,
          pinExpiresAt: expiresAt,
        })
        .where(and(eq(employeesTable.id, request.employeeId), eq(employeesTable.active, true)))
        .returning({ id: employeesTable.id });
      if (!employee) throw new HttpError(409, "The employee account is inactive or unavailable.", "EMPLOYEE_UNAVAILABLE");

      const [updatedRequest] = await tx
        .update(pinResetRequestsTable)
        .set({ status: "approved", reviewedAt: new Date(), reviewedByEmployeeId: reviewerId ?? null })
        .where(eq(pinResetRequestsTable.id, requestId))
        .returning();
      return { request: updatedRequest, employeeId: employee.id };
    });

    await logAudit(req, "update", "employee", result.employeeId, {
      changed: "temporary_pin",
      requestId,
      expiresAt: expiresAt.toISOString(),
    });
    return res.json({
      requestId,
      employeeId: result.employeeId,
      temporaryPin,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/pin-reset-requests/:id/deny", async (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isSafeInteger(requestId) || requestId <= 0) {
      throw new HttpError(400, "Request ID is invalid.", "INVALID_REQUEST");
    }
    const [updated] = await db
      .update(pinResetRequestsTable)
      .set({ status: "denied", reviewedAt: new Date(), reviewedByEmployeeId: req.employee?.id ?? null })
      .where(and(eq(pinResetRequestsTable.id, requestId), eq(pinResetRequestsTable.status, "pending")))
      .returning();
    if (!updated) throw new HttpError(404, "Pending PIN request not found.", "NOT_FOUND");
    await logAudit(req, "update", "employee", updated.employeeId, { changed: "pin_reset_request", status: "denied", requestId });
    return res.json({ requestId, status: "denied" });
  } catch (error) {
    return next(error);
  }
});

router.post("/recovery-code", async (req, res, next) => {
  try {
    const employeeId = req.employee?.id;
    if (!employeeId) throw new HttpError(401, "Not authenticated.", "NOT_AUTHENTICATED");
    const recoveryCode = randomBytes(12).toString("hex").toUpperCase();
    const recoveryCodeHash = await hashPin(recoveryCode);
    const [updated] = await db
      .update(employeesTable)
      .set({ recoveryCodeHash, recoveryCodeUsedAt: null })
      .where(and(eq(employeesTable.id, employeeId), eq(employeesTable.role, "admin")))
      .returning({ id: employeesTable.id });
    if (!updated) throw new HttpError(403, "Only an administrator can create a recovery code.", "INSUFFICIENT_PERMISSIONS");
    await logAudit(req, "update", "employee", employeeId, { changed: "recovery_code" });
    return res.json({ recoveryCode });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, "Employee ID is invalid.", "INVALID_REQUEST");
    if (id === req.employee?.id) throw new HttpError(409, "You cannot delete your active employee account.", "EMPLOYEE_IN_USE");
    await db.delete(employeesTable).where(eq(employeesTable.id, id));
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
