import bcrypt from "bcrypt";
import { db, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export const SALT_ROUNDS = 12;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  return bcrypt.compare(pin, pinHash);
}

export interface AuthedEmployee {
  id: number;
  name: string;
  email: string | null;
  role: string;
  maxDiscountPct: number;
  active: boolean;
}

export async function getEmployeeById(id: number): Promise<AuthedEmployee | null> {
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) return null;
  return {
    id: emp.id,
    name: emp.name,
    email: emp.email,
    role: emp.role,
    maxDiscountPct: parseFloat(String(emp.maxDiscountPct)),
    active: emp.active,
  };
}

export async function loadEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.session?.employeeId;
    if (!employeeId) {
      next();
      return;
    }

    const emp = await getEmployeeById(employeeId);
    if (emp?.active) {
      req.employee = emp;
      next();
      return;
    }

    // A session is not valid just because it contains an employee ID. Resolve
    // the employee on every request so deactivation/removal takes effect
    // immediately, then discard the stale session.
    req.session.destroy(() => next());
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.employee) {
    res.status(401).json({ error: "Not authenticated. Please sign in." });
    return;
  }
  next();
}

export function requireRole(minRole: "staff" | "manager" | "admin") {
  const hierarchy: Record<string, number> = { staff: 1, manager: 2, admin: 3 };
  const minLevel = hierarchy[minRole] ?? 1;
  return (req: Request, res: Response, next: NextFunction) => {
    const emp = req.employee;
    if (!emp) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    if ((hierarchy[emp.role] ?? 0) < minLevel) {
      res.status(403).json({ error: "Insufficient permissions." });
      return;
    }
    next();
  };
}

declare module "express-session" {
  interface SessionData {
    employeeId?: number;
    storeId?: number;
    storeScopeAll?: boolean;
  }
}
