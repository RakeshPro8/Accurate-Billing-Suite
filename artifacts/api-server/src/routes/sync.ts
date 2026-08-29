import { createHash } from "node:crypto";
import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db, customersTable, salesTable, saleLineItemsTable, repairsTable,
  repairPhotosTable, syncOperationsTable,
} from "@workspace/db";
import { getCurrentStoreId } from "../lib/stores";
import { getTaxConfig, calculateTotals, assertMoney } from "../lib/tax";
import { logAudit } from "../lib/audit";

const router = Router();
const allowedActions = new Set(["create_sale", "create_customer", "create_repair", "repair_status", "repair_photo"]);
const allowedStatuses = new Set(["intake", "diagnostic", "waiting_parts", "in_progress", "ready_qa", "completed", "picked_up", "cancelled"]);

function hashOperation(operation: unknown) {
  return createHash("sha256").update(JSON.stringify(operation)).digest("hex");
}

function parseSale(s: typeof salesTable.$inferSelect) {
  return {
    ...s,
    subtotal: Number(s.subtotal), taxRate: Number(s.taxRate), tax: Number(s.tax),
    discount: Number(s.discount), total: Number(s.total), createdAt: s.createdAt.toISOString(),
  };
}

router.post("/replay", async (req, res) => {
  const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
  if (operations.length > 25) return res.status(400).json({ error: "A maximum of 25 operations may be replayed at once." });
  const results: Array<Record<string, unknown>> = [];
  const employeeId = req.employee!.id;
  const storeId = await getCurrentStoreId(req);

  for (const operation of operations) {
    const operationId = typeof operation?.operationId === "string" ? operation.operationId : "";
    const action = operation?.action;
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(operationId) || !allowedActions.has(action)) {
      results.push({ operationId, status: "error", message: "Unsupported or malformed offline operation." });
      continue;
    }
    const requestHash = hashOperation(operation);
    const [existing] = await db.select().from(syncOperationsTable)
      .where(eq(syncOperationsTable.operationId, operationId)).limit(1);
    if (existing) {
      if (existing.employeeId !== employeeId || existing.requestHash !== requestHash) {
        results.push({ operationId, status: "conflict", message: "Operation ID was already used for different work." });
      } else {
        results.push({ operationId, status: existing.status, data: existing.response });
      }
      continue;
    }

    try {
      const body = operation.body ?? {};
      let response: unknown;
      if (action === "create_customer") {
        if (typeof body.name !== "string" || !body.name.trim()) throw new Error("Customer name is required.");
        const [customer] = await db.insert(customersTable).values({
          name: body.name.trim(), email: body.email || null, phone: body.phone || null,
          address: body.address || null, notes: body.notes || null, storeId,
        }).returning();
        response = { ...customer, totalSpent: 0, totalOrders: 0, createdAt: customer.createdAt.toISOString() };
        await logAudit(req, "create", "customer", customer.id, { offline: true });
      } else if (action === "repair_status") {
        const repairId = Number(body.repairId);
        if (!Number.isInteger(repairId) || !allowedStatuses.has(body.status)) throw new Error("Invalid repair status operation.");
        const [repair] = await db.select().from(repairsTable).where(eq(repairsTable.id, repairId)).limit(1);
        if (!repair) throw new Error("Repair ticket not found.");
        if (operation.expectedVersion && repair.updatedAt.toISOString() !== operation.expectedVersion) {
          results.push({ operationId, status: "conflict", message: "Repair changed while this device was offline." });
          continue;
        }
        const updateData: Record<string, unknown> = { status: body.status, updatedAt: new Date() };
        if (body.status === "completed") updateData.completedAt = new Date();
        if (body.status === "picked_up") updateData.pickedUpAt = new Date();
        const [updated] = await db.update(repairsTable).set(updateData).where(eq(repairsTable.id, repairId)).returning();
        response = { id: updated.id, status: updated.status, updatedAt: updated.updatedAt.toISOString() };
        await logAudit(req, "status_change", "repair", updated.id, { status: updated.status, offline: true });
      } else if (action === "repair_photo") {
        const repairId = Number(body.repairId);
        if (!Number.isInteger(repairId) || typeof body.dataUrl !== "string" || body.dataUrl.length > 3_000_000) throw new Error("Invalid or oversized repair photo.");
        const [repair] = await db.select().from(repairsTable).where(eq(repairsTable.id, repairId)).limit(1);
        if (!repair) throw new Error("Repair ticket not found.");
        const [photo] = await db.insert(repairPhotosTable).values({ repairId, dataUrl: body.dataUrl, caption: body.caption || null }).returning();
        response = { id: photo.id, repairId, caption: photo.caption, createdAt: photo.createdAt.toISOString() };
        await logAudit(req, "create", "repair_photo", photo.id, { offline: true });
      } else if (action === "create_sale") {
        const items = Array.isArray(body.items) ? body.items : [];
        const discount = assertMoney(body.discount ?? 0, "Discount");
        const subtotalBeforeDiscount = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
        if (subtotalBeforeDiscount > 0 && (discount / subtotalBeforeDiscount) * 100 > req.employee!.maxDiscountPct) {
          throw new Error("Discount exceeds your authorization.");
        }
        const totals = calculateTotals(items, await getTaxConfig(), discount);
        const [settings] = await db.select({ prefix: sql<string>`coalesce((select invoice_prefix from settings limit 1), 'INV-')` }).from(salesTable).limit(1);
        const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(salesTable);
        const [sale] = await db.insert(salesTable).values({
          invoiceNumber: `${settings?.prefix ?? "INV-"}${String(Number(count) + 1).padStart(4, "0")}`,
          customerId: body.customerId || null, customerName: body.customerName || null,
          customerEmail: body.customerEmail || null, employeeId, employeeName: req.employee!.name,
          storeId, status: body.status === "draft" ? "draft" : "invoice",
          subtotal: String(totals.subtotal), taxRate: String(totals.taxRate), tax: String(totals.tax),
          discount: String(discount), total: String(totals.total), notes: body.notes || null,
          paymentMethod: body.status === "paid" ? (body.paymentMethod || "Cash") : null,
          paidAt: body.status === "paid" ? new Date().toISOString() : null,
        }).returning();
        await Promise.all(items.map(async (item: any) => {
          assertMoney(item.quantity, "Quantity"); assertMoney(item.unitPrice, "Unit price");
          await db.insert(saleLineItemsTable).values({
            saleId: sale.id, type: item.type || "product", productId: item.productId || null,
            serviceId: item.serviceId || null, name: String(item.name || "Item"),
            description: item.description || null, quantity: String(item.quantity),
            unitPrice: String(item.unitPrice), discount: String(item.discount || 0),
            total: String(Math.max(0, Number(item.quantity) * Number(item.unitPrice) - Number(item.discount || 0))),
          });
        }));
        response = parseSale(sale);
        await logAudit(req, "create", "sale", sale.id, { offline: true, total: totals.total });
      } else {
        const fields = ["deviceType", "problemDescription"] as const;
        if (!fields.every((field) => typeof body[field] === "string" && body[field].trim())) throw new Error("Device type and problem description are required.");
        const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(repairsTable);
        const [repair] = await db.insert(repairsTable).values({
          ticketNumber: `REP-${String(Number(count) + 1).padStart(4, "0")}`,
          customerId: body.customerId || null, customerName: body.customerName || null,
          customerPhone: body.customerPhone || null, customerEmail: body.customerEmail || null,
          deviceType: body.deviceType.trim(), deviceBrand: body.deviceBrand || null,
          deviceModel: body.deviceModel || null, serialNumber: body.serialNumber || null,
          imei: body.imei || null, problemDescription: body.problemDescription.trim(),
          diagnosticNotes: body.diagnosticNotes || null, status: "intake", priority: body.priority || "normal",
          storeId, deposit: String(Math.max(0, Number(body.deposit || 0))), total: "0", balance: "0",
        }).returning();
        response = { id: repair.id, ticketNumber: repair.ticketNumber, status: repair.status, createdAt: repair.createdAt.toISOString() };
        await logAudit(req, "create", "repair", repair.id, { offline: true });
      }
      await db.insert(syncOperationsTable).values({ operationId, employeeId, storeId, action, status: "completed", requestHash, response });
      results.push({ operationId, status: "completed", data: response });
    } catch (error) {
      results.push({ operationId, status: "error", message: error instanceof Error ? error.message : "Operation could not be replayed." });
    }
  }
  return res.json({ results });
});

export default router;