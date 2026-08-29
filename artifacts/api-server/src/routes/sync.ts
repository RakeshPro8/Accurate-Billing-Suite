import { createHash } from "node:crypto";
import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db, customersTable, salesTable, saleLineItemsTable, salePaymentsTable, saleEventsTable, repairsTable,
  repairPhotosTable, syncOperationsTable, storesTable, productsTable,
} from "@workspace/db";
import { requireCurrentStoreId } from "../lib/stores";
import { getTaxConfig, calculateTotals, assertMoney } from "../lib/tax";
import { logAudit } from "../lib/audit";
import { validateImageDataUrl } from "../lib/image-upload";

const router = Router();
const allowedActions = new Set(["create_sale", "create_customer", "create_repair", "repair_status", "repair_photo"]);
const statuses = ["intake", "diagnostic", "waiting_parts", "in_progress", "ready_qa", "completed", "picked_up", "cancelled"] as const;
const allowedStatuses = new Set<string>(statuses);
const transitions: Record<string, readonly string[]> = {
  intake: ["diagnostic", "cancelled"], diagnostic: ["waiting_parts", "in_progress", "cancelled"],
  waiting_parts: ["in_progress", "cancelled"], in_progress: ["waiting_parts", "ready_qa", "cancelled"],
  ready_qa: ["in_progress", "completed", "cancelled"], completed: ["picked_up"], picked_up: [], cancelled: [],
};

function hashOperation(operation: unknown) {
  return createHash("sha256").update(JSON.stringify(operation)).digest("hex");
}
function object(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
}
function hasDevicePassword(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasDevicePassword);
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) =>
    key.toLowerCase() === "devicepassword" || hasDevicePassword(nested));
}
function text(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
}
function optionalText(value: unknown, max = 500): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > max) throw new Error("Invalid offline operation.");
  return value.trim() || null;
}
function operationEnvelope(value: unknown): { operationId: string; action: string; body: Record<string, any>; expectedVersion?: string } | null {
  const op = object(value);
  if (!op || typeof op.operationId !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(op.operationId) ||
    typeof op.action !== "string" || !allowedActions.has(op.action) || !object(op.body) || hasDevicePassword(op.body) ||
    (op.expectedVersion !== undefined && (typeof op.expectedVersion !== "string" || op.expectedVersion.length > 64))) return null;
  return { operationId: op.operationId, action: op.action, body: op.body, expectedVersion: op.expectedVersion };
}
function parseSale(s: typeof salesTable.$inferSelect) {
  return { ...s, subtotal: Number(s.subtotal), taxRate: Number(s.taxRate), tax: Number(s.tax), discount: Number(s.discount), total: Number(s.total), createdAt: s.createdAt.toISOString() };
}

router.post("/replay", async (req, res) => {
  if (!Array.isArray(req.body?.operations) || req.body.operations.length > 25) {
    return res.status(400).json({ error: "Submit no more than 25 valid operations." });
  }
  const employeeId = req.employee!.id;
  let storeId: number;
  try { storeId = await requireCurrentStoreId(req); } catch { return res.status(409).json({ error: "Select an active store before syncing." }); }
  const [activeStore] = await db.select({ id: storesTable.id }).from(storesTable)
    .where(and(eq(storesTable.id, storeId), eq(storesTable.active, true))).limit(1);
  if (!activeStore) return res.status(409).json({ error: "Select an active store before syncing." });
  const results: Array<Record<string, unknown>> = [];

  for (const raw of req.body.operations) {
    const op = operationEnvelope(raw);
    if (!op) { results.push({ operationId: "", status: "error", message: "Unsupported or malformed offline operation." }); continue; }
    const requestHash = hashOperation(raw);
    const [existing] = await db.select().from(syncOperationsTable).where(and(
      eq(syncOperationsTable.operationId, op.operationId), eq(syncOperationsTable.employeeId, employeeId), eq(syncOperationsTable.storeId, storeId),
    )).limit(1);
    if (existing) {
      results.push(existing.requestHash === requestHash
        ? { operationId: op.operationId, status: existing.status, data: existing.response }
        : { operationId: op.operationId, status: "conflict", message: "Operation ID was already used for different work." });
      continue;
    }

    try {
      const response = await db.transaction(async (tx) => {
        // Serialize a given key before inspecting or reserving it. This closes
        // the read-then-insert race across replay requests and API instances.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${op.operationId}, 0))`);
        const [reserved] = await tx.select().from(syncOperationsTable).where(and(
          eq(syncOperationsTable.operationId, op.operationId),
          eq(syncOperationsTable.employeeId, employeeId),
          eq(syncOperationsTable.storeId, storeId),
        )).limit(1);
        if (reserved) {
          if (reserved.requestHash !== requestHash) throw new Error("Operation ID conflict.");
          return reserved.response;
        }
        // Reserve first: concurrent replays cannot perform the work twice.
        await tx.insert(syncOperationsTable).values({ operationId: op.operationId, employeeId, storeId, action: op.action, status: "processing", requestHash, response: null });
        let result: unknown;
        const body = op.body;
        if (op.action === "create_customer") {
          const name = text(body.name, 120); if (!name) throw new Error("Customer name is required.");
          const [customer] = await tx.insert(customersTable).values({ name, email: optionalText(body.email, 254), phone: optionalText(body.phone, 64), address: optionalText(body.address, 500), notes: optionalText(body.notes, 4000), storeId }).returning();
          result = { ...customer, totalSpent: 0, totalOrders: 0, createdAt: customer.createdAt.toISOString() };
        } else if (op.action === "repair_status") {
          const repairId = Number(body.repairId); const status = body.status;
          if (!Number.isInteger(repairId) || !allowedStatuses.has(status)) throw new Error("Invalid repair status operation.");
          const [repair] = await tx.select().from(repairsTable).where(and(eq(repairsTable.id, repairId), eq(repairsTable.storeId, storeId))).limit(1);
          if (!repair) throw new Error("Repair ticket is unavailable.");
          if (op.expectedVersion && repair.updatedAt.toISOString() !== op.expectedVersion) throw new Error("Repair changed while this device was offline.");
          if (repair.status !== status && !transitions[repair.status]?.includes(status)) throw new Error("This repair status change is not allowed.");
          const now = new Date();
          const [updated] = await tx.update(repairsTable).set({ status, updatedAt: now, ...(status === "completed" ? { completedAt: now } : {}), ...(status === "picked_up" ? { pickedUpAt: now } : {}) }).where(and(eq(repairsTable.id, repairId), eq(repairsTable.storeId, storeId))).returning();
          result = { id: updated.id, status: updated.status, updatedAt: updated.updatedAt.toISOString() };
        } else if (op.action === "repair_photo") {
          const repairId = Number(body.repairId); if (!Number.isInteger(repairId)) throw new Error("Invalid repair photo.");
          const [repair] = await tx.select({ id: repairsTable.id }).from(repairsTable).where(and(eq(repairsTable.id, repairId), eq(repairsTable.storeId, storeId))).limit(1);
          if (!repair) throw new Error("Repair ticket is unavailable.");
          if (typeof body.dataUrl !== "string") throw new Error("Invalid repair photo.");
          validateImageDataUrl(body.dataUrl);
          const [created] = await tx.insert(repairPhotosTable).values({ repairId, dataUrl: body.dataUrl, caption: optionalText(body.caption, 250) }).returning();
          result = { id: created.id, repairId, caption: created.caption, createdAt: created.createdAt.toISOString() };
        } else if (op.action === "create_sale") {
          if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) throw new Error("A sale needs valid line items.");
          const items = body.items.map((item: unknown) => {
            const line = object(item); if (!line || !text(line.name, 250)) throw new Error("A sale contains an invalid line item.");
            assertMoney(line.quantity, "Quantity"); assertMoney(line.unitPrice, "Unit price"); assertMoney(line.discount ?? 0, "Line discount");
            if (Number(line.quantity) <= 0 || Number(line.discount ?? 0) > Number(line.quantity) * Number(line.unitPrice)) throw new Error("A sale contains an invalid line item.");
            return line;
          });
          const discount = assertMoney(body.discount ?? 0, "Discount");
          const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice) - Number(item.discount ?? 0), 0);
          if (discount > subtotal || (subtotal > 0 && discount / subtotal * 100 > req.employee!.maxDiscountPct)) throw new Error("Discount exceeds your authorization.");
          const totals = calculateTotals(
            items.map((item) => ({
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              discount: Number(item.discount ?? 0),
            })),
            await getTaxConfig(),
            discount,
          );
          if (body.customerId !== undefined) {
            const customerId = Number(body.customerId);
            if (!Number.isInteger(customerId)) throw new Error("Invalid sale customer.");
            const [customer] = await tx.select({ id: customersTable.id }).from(customersTable)
              .where(and(eq(customersTable.id, customerId), eq(customersTable.storeId, storeId))).limit(1);
            if (!customer) throw new Error("Sale customer is unavailable.");
          }
          for (const item of items) {
            if (item.productId === undefined || item.productId === null) continue;
            const productId = Number(item.productId);
            if (!Number.isInteger(productId)) throw new Error("Invalid sale product.");
            const [product] = await tx.select({ id: productsTable.id }).from(productsTable)
              .where(and(eq(productsTable.id, productId), eq(productsTable.storeId, storeId))).limit(1);
            if (!product) throw new Error("Sale product is unavailable.");
          }
          // Invoice numbers are allocated serially per store.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(19001, ${storeId})`);
          const [settings] = await tx.select({ prefix: sql<string>`coalesce((select invoice_prefix from settings limit 1), 'INV-')` }).from(salesTable).limit(1);
          const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(salesTable).where(eq(salesTable.storeId, storeId));
           const committed = body.status !== "draft";
           const status = body.status === "paid" ? "paid" : committed ? "invoice" : "draft";
           const [sale] = await tx.insert(salesTable).values({ invoiceNumber: `${settings?.prefix ?? "INV-"}${String(Number(count) + 1).padStart(4, "0")}`, idempotencyKey: op.operationId, customerId: Number.isInteger(body.customerId) ? body.customerId : null, customerName: optionalText(body.customerName, 120), customerEmail: optionalText(body.customerEmail, 254), employeeId, employeeName: req.employee!.name, storeId, status, subtotal: String(totals.subtotal), taxRate: String(totals.taxRate), tax: String(totals.tax), discount: String(discount), total: String(totals.total), notes: optionalText(body.notes, 4000), paymentMethod: body.status === "paid" ? optionalText(body.paymentMethod, 80) ?? "Cash" : null, paidAt: body.status === "paid" ? new Date().toISOString() : null }).returning();
           await Promise.all(items.map((item) => tx.insert(saleLineItemsTable).values({ saleId: sale.id, type: text(item.type, 40) ?? "product", productId: Number.isInteger(item.productId) ? item.productId : null, serviceId: Number.isInteger(item.serviceId) ? item.serviceId : null, name: text(item.name, 250)!, description: optionalText(item.description, 1000), quantity: String(item.quantity), unitPrice: String(item.unitPrice), discount: String(item.discount ?? 0), total: String(Number(item.quantity) * Number(item.unitPrice) - Number(item.discount ?? 0)) })));
           if (committed) {
             for (const item of items) {
               if (item.productId === undefined || item.productId === null) continue;
               const [updatedProduct] = await tx.update(productsTable).set({ stock: sql`${productsTable.stock} - ${Number(item.quantity)}` }).where(and(eq(productsTable.id, Number(item.productId)), eq(productsTable.storeId, storeId), sql`${productsTable.stock} >= ${Number(item.quantity)}`)).returning({ id: productsTable.id });
               if (!updatedProduct) throw new Error(`Insufficient stock for ${item.name}.`);
             }
           }
           if (body.status === "paid") {
             await tx.insert(salePaymentsTable).values({ saleId: sale.id, amount: String(totals.total), method: optionalText(body.paymentMethod, 80) ?? "Cash", kind: "payment", employeeId, employeeName: req.employee!.name, idempotencyKey: `${op.operationId}-payment` });
           }
           await tx.insert(saleEventsTable).values({ saleId: sale.id, action: "created", fromStatus: null, toStatus: status, employeeId, employeeName: req.employee!.name });
           result = parseSale(sale);
        } else {
          const deviceType = text(body.deviceType, 120), problemDescription = text(body.problemDescription, 4000);
          if (!deviceType || !problemDescription) throw new Error("Device type and problem description are required.");
          const deposit = assertMoney(body.deposit ?? 0, "Deposit");
          if (deposit < 0) throw new Error("Invalid repair deposit.");
          if (body.customerId !== undefined) {
            const customerId = Number(body.customerId);
            if (!Number.isInteger(customerId)) throw new Error("Invalid repair customer.");
            const [customer] = await tx.select({ id: customersTable.id }).from(customersTable)
              .where(and(eq(customersTable.id, customerId), eq(customersTable.storeId, storeId))).limit(1);
            if (!customer) throw new Error("Repair customer is unavailable.");
          }
          // Device credentials deliberately are neither accepted nor persisted by replay.
          // Ticket numbers are allocated serially per store.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(19002, ${storeId})`);
          const [{ count }] = await tx.select({ count: sql<number>`count(*)` }).from(repairsTable).where(eq(repairsTable.storeId, storeId));
          const [repair] = await tx.insert(repairsTable).values({ ticketNumber: `REP-${String(Number(count) + 1).padStart(4, "0")}`, customerId: Number.isInteger(body.customerId) ? body.customerId : null, customerName: optionalText(body.customerName, 120), customerPhone: optionalText(body.customerPhone, 64), customerEmail: optionalText(body.customerEmail, 254), deviceType, deviceBrand: optionalText(body.deviceBrand, 120), deviceModel: optionalText(body.deviceModel, 120), serialNumber: optionalText(body.serialNumber, 160), imei: optionalText(body.imei, 160), problemDescription, diagnosticNotes: optionalText(body.diagnosticNotes, 4000), status: "intake", priority: ["low", "normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal", storeId, deposit: String(deposit), total: "0", balance: "0" }).returning();
          result = { id: repair.id, ticketNumber: repair.ticketNumber, status: repair.status, createdAt: repair.createdAt.toISOString() };
        }
        await tx.update(syncOperationsTable).set({ status: "completed", response: result }).where(and(eq(syncOperationsTable.operationId, op.operationId), eq(syncOperationsTable.employeeId, employeeId), eq(syncOperationsTable.storeId, storeId)));
        return result;
      });
      const auditTarget = op.action === "create_sale" ? "sale" : op.action === "create_customer" ? "customer"
        : op.action === "repair_photo" ? "repair_photo" : "repair";
      await logAudit(req, op.action === "repair_status" ? "status_change" : "create", auditTarget, op.operationId, { offline: true });
      results.push({ operationId: op.operationId, status: "completed", data: response });
    } catch {
      results.push({ operationId: op.operationId, status: "error", message: "Operation could not be replayed." });
    }
  }
  return res.json({ results });
});
export default router;