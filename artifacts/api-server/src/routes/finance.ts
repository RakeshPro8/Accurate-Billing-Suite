import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, exists, gte, lte, or, sql } from "drizzle-orm";
import {
  db,
  customersTable, financeTransactionsTable, customerAccessLinksTable,
  notificationEventsTable, notificationTemplatesTable, privacyRequestsTable,
  repairsTable, repairStatusHistoryTable, salePaymentsTable,
  saleLineItemsTable, salesTable,
} from "@workspace/db";
import { requireCurrentStoreId } from "../lib/stores";
import { requireRole } from "../lib/auth";
import { HttpError } from "../lib/http";
import { logAudit } from "../lib/audit";
import type { Request } from "express";

const router = Router();
export const publicCustomerAccessRouter = Router();

const CUSTOMER_EVENTS = ["invoice", "estimate", "repair-status", "pickup", "payment", "reminder"] as const;
const CHANNELS = ["email", "sms"] as const;
const FINANCE_KINDS = ["payment", "deposit", "refund", "credit", "adjustment"] as const;
const NOTIFICATION_STATUSES = ["queued", "sent", "failed", "skipped"] as const;

function isNotificationEvent(value: unknown): value is typeof CUSTOMER_EVENTS[number] {
  return typeof value === "string" && (CUSTOMER_EVENTS as readonly string[]).includes(value);
}

function isChannel(value: unknown): value is typeof CHANNELS[number] {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}

function notificationId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid notification template id.");
  return id;
}

function validateRetryCount(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 5) {
    throw new HttpError(400, "Retry limit must be a whole number from 0 to 5.");
  }
}

function validateTemplateText(body: Record<string, unknown>, requireBody: boolean) {
  if (body.subject !== undefined && (typeof body.subject !== "string" || body.subject.length > 200)) {
    throw new HttpError(400, "Subject must be 200 characters or fewer.");
  }
  if (body.body !== undefined && (typeof body.body !== "string" || !body.body.trim() || body.body.length > 5000)) {
    throw new HttpError(400, "Message body must contain 1 to 5000 characters.");
  }
  if (requireBody && (typeof body.body !== "string" || !body.body.trim())) {
    throw new HttpError(400, "Message body is required.");
  }
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    throw new HttpError(400, "Enabled must be a boolean.");
  }
  if (body.maxRetries !== undefined) validateRetryCount(body.maxRetries);
}

function employee(req: Request) {
  if (!req.employee) throw new HttpError(401, "Authentication is required.", "AUTH_REQUIRED");
  return req.employee;
}
function manager(req: Request) {
  const current = employee(req);
  if (!["admin", "manager"].includes(current.role)) throw new HttpError(403, "A manager or admin is required.", "FORBIDDEN");
  return current;
}
function amount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10_000_000) throw new HttpError(400, "Amount must be a positive value.", "INVALID_REQUEST");
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}
function date(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function maskDestination(value: string | null | undefined, channel: string) {
  if (!value) return null;
  if (channel === "sms") return `••••${value.replace(/\D/g, "").slice(-2)}`;
  const [local, domain] = value.split("@");
  return domain ? `${(local?.slice(0, 1) ?? "•")}***@${domain}` : "••••";
}
function safeTransaction(transaction: typeof financeTransactionsTable.$inferSelect) {
  return {
    id: transaction.id, customerId: transaction.customerId, saleId: transaction.saleId,
    repairId: transaction.repairId, kind: transaction.kind, amount: Number(transaction.amount),
    currency: transaction.currency, method: transaction.method, provider: transaction.provider,
    providerStatus: transaction.providerStatus, last4: transaction.last4,
    note: transaction.note, employeeName: transaction.employeeName, createdAt: date(transaction.createdAt),
  };
}
function publicSale(sale: typeof salesTable.$inferSelect, paid: number) {
  return {
    id: sale.id, invoiceNumber: sale.invoiceNumber, status: sale.status,
    total: Number(sale.total), paid: Math.max(0, paid),
    balance: Math.max(0, Number(sale.total) - paid), dueDate: sale.dueDate,
    createdAt: date(sale.createdAt),
  };
}

async function salePaymentTotal(saleId: number) {
  const [row] = await db.select({
    total: sql<number>`coalesce(sum(case when ${salePaymentsTable.kind} = 'refund' then -${salePaymentsTable.amount}::numeric else ${salePaymentsTable.amount}::numeric end), 0)`,
  }).from(salePaymentsTable).where(eq(salePaymentsTable.saleId, saleId));
  return Number(row?.total ?? 0);
}
async function getLink(token: string) {
  if (!/^[A-Za-z0-9_-]{40,120}$/.test(token)) return null;
  const [link] = await db.select().from(customerAccessLinksTable).where(eq(customerAccessLinksTable.tokenHash, hashToken(token))).limit(1);
  if (!link || link.revokedAt || link.expiresAt <= new Date()) return null;
  return link;
}

async function customerFinance(customerId: number, storeId: number) {
  const [customer] = await db.select().from(customersTable).where(and(eq(customersTable.id, customerId), eq(customersTable.storeId, storeId)));
  if (!customer) throw new HttpError(404, "Customer not found.", "NOT_FOUND");
  const [sales, repairs, transactions] = await Promise.all([
    db.select().from(salesTable).where(and(eq(salesTable.customerId, customerId), eq(salesTable.storeId, storeId))).orderBy(desc(salesTable.createdAt)),
    db.select().from(repairsTable).where(and(eq(repairsTable.customerId, customerId), eq(repairsTable.storeId, storeId))).orderBy(desc(repairsTable.createdAt)),
    db.select().from(financeTransactionsTable).where(and(
      eq(financeTransactionsTable.customerId, customerId),
      or(
        exists(sql`select 1 from repairs r where r.id = ${financeTransactionsTable.repairId} and r.store_id = ${storeId}`),
        exists(sql`select 1 from sales s where s.id = ${financeTransactionsTable.saleId} and s.store_id = ${storeId}`),
        sql`${financeTransactionsTable.repairId} is null and ${financeTransactionsTable.saleId} is null`,
      ),
    )).orderBy(desc(financeTransactionsTable.createdAt)),
  ]);
  const saleRows = await Promise.all(sales.map(async (sale) => {
    const paid = await salePaymentTotal(sale.id);
    return publicSale(sale, paid);
  }));
  const collected = transactions.reduce((sum, tx) => sum + (["refund", "credit"].includes(tx.kind) ? -Number(tx.amount) : Number(tx.amount)), 0)
    + saleRows.reduce((sum, sale) => sum + sale.paid, 0);
  const invoiced = saleRows.filter((sale) => !["voided", "refunded"].includes(sale.status)).reduce((sum, sale) => sum + sale.total, 0);
  const repairRows = repairs.map((repair) => ({
    id: repair.id, ticketNumber: repair.ticketNumber, status: repair.status,
    deviceType: repair.deviceType, deviceBrand: repair.deviceBrand, deviceModel: repair.deviceModel,
    total: Number(repair.total), deposit: Number(repair.deposit), balance: Number(repair.balance),
    warrantyState: repair.warrantyState, warrantyUntil: date(repair.warrantyUntil),
    returnEligibleUntil: date(repair.returnEligibleUntil), createdAt: date(repair.createdAt),
  }));
  const timeline = [
    ...saleRows.map((sale) => ({ at: sale.createdAt, type: "invoice", label: `${sale.invoiceNumber} · ${sale.status}`, amount: sale.total, id: sale.id })),
    ...repairRows.map((repair) => ({ at: repair.createdAt, type: "repair", label: `${repair.ticketNumber} · ${repair.status}`, amount: repair.total, id: repair.id })),
    ...transactions.map((tx) => ({ at: date(tx.createdAt), type: tx.kind, label: `${tx.kind} · ${tx.method}`, amount: Number(tx.amount), id: tx.id })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return {
    customer: {
      id: customer.id, name: customer.name, email: customer.email, phone: customer.phone,
      address: customer.address, notes: customer.notes, isLoyaltyMember: customer.isLoyaltyMember,
      loyaltyDiscountPct: Number(customer.loyaltyDiscountPct), loyaltyPoints: customer.loyaltyPoints,
      referralCode: customer.referralCode, emailConsent: customer.emailConsent, smsConsent: customer.smsConsent,
      marketingConsent: customer.marketingConsent, consentSource: customer.consentSource,
      consentReviewedAt: date(customer.consentReviewedAt), anonymizedAt: date(customer.anonymizedAt),
      createdAt: date(customer.createdAt),
    },
    stats: { invoiced, collected, outstanding: Math.max(0, invoiced - collected), orderCount: saleRows.length, repairCount: repairRows.length },
    sales: saleRows, repairs: repairRows, transactions: transactions.map(safeTransaction), timeline,
  };
}

router.get("/customers/:id", async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "Invalid customer id.");
  return res.json(await customerFinance(id, storeId));
});

router.patch("/customers/:id/preferences", async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const id = Number(req.params.id);
  const body = req.body ?? {};
  if (!Number.isSafeInteger(id) || id < 1 || ["emailConsent", "smsConsent", "marketingConsent"].some((key) => body[key] !== undefined && typeof body[key] !== "boolean")) {
    throw new HttpError(400, "Invalid notification preferences.");
  }
  const updates: Record<string, unknown> = {};
  for (const key of ["emailConsent", "smsConsent", "marketingConsent"] as const) if (body[key] !== undefined) updates[key] = body[key];
  if (!Object.keys(updates).length) throw new HttpError(400, "No preferences supplied.");
  updates.consentSource = typeof body.source === "string" ? body.source.slice(0, 120) : "staff";
  updates.consentReviewedAt = new Date();
  const [customer] = await db.update(customersTable).set(updates).where(and(eq(customersTable.id, id), eq(customersTable.storeId, storeId))).returning();
  if (!customer) throw new HttpError(404, "Customer not found.", "NOT_FOUND");
  await logAudit(req, "update", "customer", id, { event: "consent_reviewed", fields: Object.keys(updates).filter((key) => key !== "consentSource") });
  return res.json({ emailConsent: customer.emailConsent, smsConsent: customer.smsConsent, marketingConsent: customer.marketingConsent, consentSource: customer.consentSource, consentReviewedAt: date(customer.consentReviewedAt) });
});

router.post("/transactions", async (req, res) => {
  const current = employee(req);
  const storeId = await requireCurrentStoreId(req);
  const body = req.body ?? {};
  const kind = String(body.kind ?? "");
  if (!(FINANCE_KINDS as readonly string[]).includes(kind)) throw new HttpError(400, "Invalid finance transaction type.");
  const repairId = body.repairId == null ? null : Number(body.repairId);
  const customerId = body.customerId == null ? null : Number(body.customerId);
  if (!repairId || !Number.isSafeInteger(repairId) || repairId < 1) throw new HttpError(400, "A repair is required for a manual finance transaction.");
  if (kind === "adjustment" && !["admin", "manager"].includes(current.role)) throw new HttpError(403, "A manager or admin is required for adjustments.", "FORBIDDEN");
  const key = req.get("Idempotency-Key");
  if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new HttpError(400, "An Idempotency-Key header is required.");
  const result = await db.transaction(async (tx) => {
    const [repair] = await tx.select().from(repairsTable).where(and(eq(repairsTable.id, repairId), eq(repairsTable.storeId, storeId))).for("update");
    if (!repair) throw new HttpError(404, "Repair not found.", "NOT_FOUND");
    if (customerId !== null && customerId !== repair.customerId) throw new HttpError(400, "Customer does not match the repair.");
    const [existing] = await tx.select().from(financeTransactionsTable).where(and(eq(financeTransactionsTable.idempotencyKey, key), eq(financeTransactionsTable.repairId, repairId))).limit(1);
    if (existing) return existing;
    const [totals] = await tx.select({
      collected: sql<number>`coalesce(sum(case when ${financeTransactionsTable.kind} in ('refund','credit') then -${financeTransactionsTable.amount}::numeric else ${financeTransactionsTable.amount}::numeric end), 0)`,
    }).from(financeTransactionsTable).where(eq(financeTransactionsTable.repairId, repairId));
    const value = amount(body.amount);
    const collected = Number(totals?.collected ?? 0) + Number(repair.deposit);
    if (["refund", "credit"].includes(kind) && value > collected + 0.005) throw new HttpError(409, "Refund or credit exceeds captured repair payments.", "REFUND_CONFLICT");
    const [transaction] = await tx.insert(financeTransactionsTable).values({
      customerId: repair.customerId, repairId, kind, amount: String(value), currency: String(body.currency ?? "USD").slice(0, 3).toUpperCase(),
      method: String(body.method ?? "manual").slice(0, 80), provider: body.provider ? String(body.provider).slice(0, 80) : null,
      providerPaymentId: null, providerSessionId: null, providerStatus: null, last4: body.last4 && /^\d{4}$/.test(body.last4) ? body.last4 : null,
      idempotencyKey: key, note: body.note ? String(body.note).slice(0, 500) : null, employeeId: current.id, employeeName: current.name,
    }).returning();
    const signed = ["refund", "credit"].includes(kind) ? -value : value;
    const nextDeposit = kind === "deposit" ? Number(repair.deposit) + value : Number(repair.deposit);
    await tx.update(repairsTable).set({ deposit: String(nextDeposit), balance: String(Math.max(0, Number(repair.total) - collected - signed + (kind === "deposit" ? 0 : 0))), updatedAt: new Date() }).where(eq(repairsTable.id, repair.id));
    return transaction;
  });
  await logAudit(req, "payment", "repair", repairId, { kind, amount: Number(result.amount), currency: result.currency });
  return res.status(201).json(safeTransaction(result));
});

router.post("/share-links", async (req, res) => {
  const current = employee(req);
  const storeId = await requireCurrentStoreId(req);
  const body = req.body ?? {};
  const targetType = body.targetType === "sale" || body.targetType === "repair" ? body.targetType : null;
  const targetId = Number(body.targetId);
  if (!targetType || !Number.isSafeInteger(targetId) || targetId < 1) throw new HttpError(400, "A sale or repair target is required.");
  let customerId: number | null = null;
  if (targetType === "sale") {
    const [sale] = await db.select({ customerId: salesTable.customerId }).from(salesTable).where(and(eq(salesTable.id, targetId), eq(salesTable.storeId, storeId)));
    customerId = sale?.customerId ?? null;
  } else {
    const [repair] = await db.select({ customerId: repairsTable.customerId }).from(repairsTable).where(and(eq(repairsTable.id, targetId), eq(repairsTable.storeId, storeId)));
    customerId = repair?.customerId ?? null;
  }
  if (!customerId) throw new HttpError(400, "This record has no linked customer.");
  const hours = Math.min(168, Math.max(1, Number(body.expiresInHours ?? 48)));
  if (!Number.isFinite(hours)) throw new HttpError(400, "Invalid expiration.");
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const [link] = await db.insert(customerAccessLinksTable).values({
    storeId, customerId, saleId: targetType === "sale" ? targetId : null, repairId: targetType === "repair" ? targetId : null,
    tokenHash: hashToken(rawToken), scope: targetType === "sale" ? "invoice" : "repair-status", expiresAt, createdBy: current.id,
  }).returning({ id: customerAccessLinksTable.id, expiresAt: customerAccessLinksTable.expiresAt });
  await logAudit(req, "create", "customer", customerId, { event: "access_link_created", targetType, targetId, expiresAt: expiresAt.toISOString() });
  return res.status(201).json({ id: link.id, token: rawToken, scope: targetType === "sale" ? "invoice" : "repair-status", expiresAt: expiresAt.toISOString(), path: `/customer-access/${rawToken}` });
});

router.get("/share-links", async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
  const links = await db.select({
    id: customerAccessLinksTable.id, customerId: customerAccessLinksTable.customerId, saleId: customerAccessLinksTable.saleId,
    repairId: customerAccessLinksTable.repairId, scope: customerAccessLinksTable.scope, expiresAt: customerAccessLinksTable.expiresAt,
    revokedAt: customerAccessLinksTable.revokedAt, createdAt: customerAccessLinksTable.createdAt, accessCount: customerAccessLinksTable.accessCount,
  }).from(customerAccessLinksTable).where(and(eq(customerAccessLinksTable.storeId, storeId), customerId ? eq(customerAccessLinksTable.customerId, customerId) : undefined)).orderBy(desc(customerAccessLinksTable.createdAt));
  return res.json(links.map((link) => ({ ...link, expiresAt: date(link.expiresAt), revokedAt: date(link.revokedAt), createdAt: date(link.createdAt), active: !link.revokedAt && link.expiresAt > new Date() })));
});

router.post("/share-links/:id/revoke", async (req, res) => {
  manager(req);
  const storeId = await requireCurrentStoreId(req);
  const id = Number(req.params.id);
  const [link] = await db.update(customerAccessLinksTable).set({ revokedAt: new Date() }).where(and(eq(customerAccessLinksTable.id, id), eq(customerAccessLinksTable.storeId, storeId))).returning();
  if (!link) throw new HttpError(404, "Share link not found.", "NOT_FOUND");
  await logAudit(req, "update", "customer", link.customerId, { event: "access_link_revoked", linkId: id });
  return res.json({ revoked: true });
});

router.post("/payment-sessions", async (req, res) => {
  employee(req);
  const body = req.body ?? {};
  if (!body.linkId) throw new HttpError(400, "A share link is required.");
  return res.status(503).json({ code: "PAYMENT_PROVIDER_NOT_CONFIGURED", status: "unavailable", message: "Payment sessions are ready for a processor integration, but no provider is enabled. No payment credentials are stored by Mobilinq." });
});

router.get("/notifications/templates", requireRole("manager"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const templates = await db.select().from(notificationTemplatesTable).where(eq(notificationTemplatesTable.storeId, storeId)).orderBy(notificationTemplatesTable.event);
  return res.json(templates.map((template) => ({ ...template, createdAt: date(template.createdAt), updatedAt: date(template.updatedAt) })));
});

router.post("/notifications/templates", requireRole("admin"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const body = req.body ?? {};
  if (!isNotificationEvent(body.event) || !isChannel(body.channel)) throw new HttpError(400, "Choose a supported event and channel.");
  validateTemplateText(body, true);
  const maxRetries = body.maxRetries === undefined ? 3 : body.maxRetries;
  const [duplicate] = await db.select({ id: notificationTemplatesTable.id }).from(notificationTemplatesTable).where(and(
    eq(notificationTemplatesTable.storeId, storeId),
    eq(notificationTemplatesTable.event, body.event),
    eq(notificationTemplatesTable.channel, body.channel),
  )).limit(1);
  if (duplicate) throw new HttpError(409, "A template already exists for this event and channel.", "DUPLICATE_TEMPLATE");
  let template;
  try {
    [template] = await db.insert(notificationTemplatesTable).values({
      storeId, event: body.event, channel: body.channel, subject: body.subject?.trim() || null,
      body: body.body.trim(), enabled: body.enabled ?? true, maxRetries,
    }).returning();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      throw new HttpError(409, "A template already exists for this event and channel.", "DUPLICATE_TEMPLATE");
    }
    throw error;
  }
  return res.status(201).json({ ...template, createdAt: date(template.createdAt), updatedAt: date(template.updatedAt) });
});

router.patch("/notifications/templates/:id", requireRole("admin"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const body = req.body ?? {};
  const id = notificationId(req.params.id);
  if (body.event !== undefined && !isNotificationEvent(body.event)) throw new HttpError(400, "Choose a supported event.");
  if (body.channel !== undefined && !isChannel(body.channel)) throw new HttpError(400, "Choose a supported channel.");
  validateTemplateText(body, false);
  if (!Object.keys(body).length) throw new HttpError(400, "No template changes supplied.");
  const [existing] = await db.select().from(notificationTemplatesTable).where(and(eq(notificationTemplatesTable.id, id), eq(notificationTemplatesTable.storeId, storeId))).limit(1);
  if (!existing) throw new HttpError(404, "Notification template not found.", "NOT_FOUND");
  const event = body.event ?? existing.event;
  const channel = body.channel ?? existing.channel;
  const [duplicate] = await db.select({ id: notificationTemplatesTable.id }).from(notificationTemplatesTable).where(and(
    eq(notificationTemplatesTable.storeId, storeId),
    eq(notificationTemplatesTable.event, event),
    eq(notificationTemplatesTable.channel, channel),
  )).limit(1);
  if (duplicate && duplicate.id !== id) throw new HttpError(409, "A template already exists for this event and channel.", "DUPLICATE_TEMPLATE");
  const updates: Record<string, unknown> = { updatedAt: new Date(), event, channel };
  if (body.subject !== undefined) updates.subject = body.subject.trim() || null;
  if (body.body !== undefined) updates.body = body.body.trim();
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.maxRetries !== undefined) updates.maxRetries = body.maxRetries;
  let template;
  try {
    [template] = await db.update(notificationTemplatesTable).set(updates).where(and(eq(notificationTemplatesTable.id, id), eq(notificationTemplatesTable.storeId, storeId))).returning();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      throw new HttpError(409, "A template already exists for this event and channel.", "DUPLICATE_TEMPLATE");
    }
    throw error;
  }
  if (!template) throw new HttpError(404, "Notification template not found.", "NOT_FOUND");
  return res.json({ ...template, createdAt: date(template.createdAt), updatedAt: date(template.updatedAt) });
});

router.get("/notifications", requireRole("manager"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const status = req.query.status ? String(req.query.status) : undefined;
  const event = req.query.event ? String(req.query.event) : undefined;
  const channel = req.query.channel ? String(req.query.channel) : undefined;
  if (status && !(NOTIFICATION_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, "Invalid notification status.");
  if (event && !isNotificationEvent(event)) throw new HttpError(400, "Invalid notification event.");
  if (channel && !isChannel(channel)) throw new HttpError(400, "Invalid notification channel.");
  const rows = await db.select().from(notificationEventsTable).where(and(
    eq(notificationEventsTable.storeId, storeId),
    status ? eq(notificationEventsTable.status, status) : undefined,
    event ? eq(notificationEventsTable.event, event) : undefined,
    channel ? eq(notificationEventsTable.channel, channel) : undefined,
  )).orderBy(desc(notificationEventsTable.createdAt)).limit(200);
  return res.json(rows.map((row) => ({ ...row, createdAt: date(row.createdAt), nextRetryAt: date(row.nextRetryAt), sentAt: date(row.sentAt) })));
});

router.post("/notifications", async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const body = req.body ?? {};
  const customerId = Number(body.customerId);
  if (!Number.isSafeInteger(customerId) || !(CUSTOMER_EVENTS as readonly string[]).includes(body.event) || !(CHANNELS as readonly string[]).includes(body.channel)) throw new HttpError(400, "Invalid notification request.");
  const [customer] = await db.select().from(customersTable).where(and(eq(customersTable.id, customerId), eq(customersTable.storeId, storeId)));
  if (!customer) throw new HttpError(404, "Customer not found.", "NOT_FOUND");
  const allowed = body.channel === "email" ? customer.emailConsent && Boolean(customer.email) : customer.smsConsent && Boolean(customer.phone);
  const destination = body.channel === "email" ? customer.email : customer.phone;
  const [event] = await db.insert(notificationEventsTable).values({
    storeId, customerId, saleId: body.saleId ? Number(body.saleId) : null, repairId: body.repairId ? Number(body.repairId) : null,
    event: body.event, channel: body.channel, destinationMasked: maskDestination(destination, body.channel),
    status: allowed ? "queued" : "skipped", unsubscribed: !allowed,
    lastError: allowed ? null : "Customer has not consented to this channel or no destination is available.",
  }).returning();
  return res.status(201).json({ ...event, createdAt: date(event.createdAt), nextRetryAt: date(event.nextRetryAt), sentAt: date(event.sentAt) });
});

router.post("/notifications/:id/retry", requireRole("manager"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const id = notificationId(req.params.id);
  const [existing] = await db.select().from(notificationEventsTable).where(and(eq(notificationEventsTable.id, id), eq(notificationEventsTable.storeId, storeId))).limit(1);
  if (!existing || existing.status !== "failed") throw new HttpError(404, "A failed notification was not found.", "NOT_FOUND");
  const [template] = await db.select({ maxRetries: notificationTemplatesTable.maxRetries }).from(notificationTemplatesTable).where(and(
    eq(notificationTemplatesTable.storeId, storeId),
    eq(notificationTemplatesTable.event, existing.event),
    eq(notificationTemplatesTable.channel, existing.channel),
  )).limit(1);
  const maxRetries = template?.maxRetries ?? 3;
  if (existing.attempts >= maxRetries) throw new HttpError(409, "This delivery has reached its retry limit.", "RETRY_LIMIT_REACHED");
  const [event] = await db.update(notificationEventsTable).set({ status: "queued", nextRetryAt: null, lastError: null }).where(and(
    eq(notificationEventsTable.id, id),
    eq(notificationEventsTable.storeId, storeId),
    eq(notificationEventsTable.status, "failed"),
  )).returning();
  if (!event) throw new HttpError(409, "The delivery changed before it could be retried.", "RETRY_CONFLICT");
  await logAudit(req, "update", "settings", id, { event: "notification_retry_queued" });
  return res.json({ ...event, createdAt: date(event.createdAt) });
});

router.get("/receivables", requireRole("manager"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const rows = await db.select().from(salesTable).where(and(eq(salesTable.storeId, storeId), eq(salesTable.status, "invoice"))).orderBy(desc(salesTable.createdAt));
  const result = await Promise.all(rows.map(async (sale) => {
    const paid = await salePaymentTotal(sale.id);
    const balance = Math.max(0, Number(sale.total) - paid);
    const due = sale.dueDate ? new Date(sale.dueDate) : null;
    const daysOverdue = due && due < new Date() && balance > 0 ? Math.floor((Date.now() - due.getTime()) / 86_400_000) : 0;
    return { id: sale.id, invoiceNumber: sale.invoiceNumber, customerId: sale.customerId, customerName: sale.customerName, total: Number(sale.total), paid, balance, dueDate: sale.dueDate, daysOverdue, agingBucket: daysOverdue > 90 ? "90+" : daysOverdue > 60 ? "61-90" : daysOverdue > 30 ? "31-60" : daysOverdue > 0 ? "1-30" : "current" };
  }));
  return res.json({ asOf: new Date().toISOString(), totals: { outstanding: result.reduce((sum, row) => sum + row.balance, 0), overdue: result.filter((row) => row.daysOverdue > 0).reduce((sum, row) => sum + row.balance, 0) }, items: result });
});

router.get("/tax-summary", requireRole("manager"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const from = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : new Date(new Date().getFullYear(), 0, 1);
  const to = req.query.dateTo ? new Date(String(req.query.dateTo)) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new HttpError(400, "Invalid reporting dates.");
  const [row] = await db.select({
    subtotal: sql<number>`coalesce(sum(${salesTable.subtotal}::numeric), 0)`, tax: sql<number>`coalesce(sum(${salesTable.tax}::numeric), 0)`,
    total: sql<number>`coalesce(sum(${salesTable.total}::numeric), 0)`, invoiceCount: sql<number>`count(*)`,
  }).from(salesTable).where(and(eq(salesTable.storeId, storeId), eq(salesTable.status, "paid"), gte(salesTable.createdAt, from), lte(salesTable.createdAt, to)));
  return res.json({ dateFrom: from.toISOString(), dateTo: to.toISOString(), invoiceCount: Number(row?.invoiceCount ?? 0), subtotal: Number(row?.subtotal ?? 0), tax: Number(row?.tax ?? 0), total: Number(row?.total ?? 0) });
});

router.get("/reconciliation-export", requireRole("manager"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const [payments, finance] = await Promise.all([
    db.select({ id: salePaymentsTable.id, saleId: salePaymentsTable.saleId, amount: salePaymentsTable.amount, method: salePaymentsTable.method, kind: salePaymentsTable.kind, reference: salePaymentsTable.reference, createdAt: salePaymentsTable.createdAt }).from(salePaymentsTable).innerJoin(salesTable, eq(salesTable.id, salePaymentsTable.saleId)).where(eq(salesTable.storeId, storeId)).orderBy(desc(salePaymentsTable.createdAt)),
    db.select().from(financeTransactionsTable).where(or(
      exists(sql`select 1 from repairs r where r.id = ${financeTransactionsTable.repairId} and r.store_id = ${storeId}`),
      exists(sql`select 1 from sales s where s.id = ${financeTransactionsTable.saleId} and s.store_id = ${storeId}`),
    )),
  ]);
  // The export intentionally includes no names, emails, phone numbers, raw tokens,
  // provider references or notes. It is safe to hand to a bookkeeper.
  const financeRows = finance.filter((row) => row.id > 0);
  const lines = [["record_id", "sale_id", "repair_id", "kind", "amount", "currency", "method", "created_at"],
    ...payments.map((p) => [String(p.id), String(p.saleId), "", p.kind, String(Number(p.amount)), "", p.method, p.createdAt.toISOString()]),
    ...financeRows.map((p) => [String(p.id), "", String(p.repairId ?? ""), p.kind, String(Number(p.amount)), p.currency, p.method, p.createdAt.toISOString()])];
  const csv = lines.map((line) => line.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(",")).join("\n");
  await logAudit(req, "print", "backup", undefined, { event: "reconciliation_export", rowCount: lines.length - 1 });
  res.setHeader("Content-Disposition", `attachment; filename="mobilinq-reconciliation-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.type("text/csv").send(csv);
});

router.get("/customers/:id/privacy-export", requireRole("admin"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const data = await customerFinance(Number(req.params.id), storeId);
  await db.insert(privacyRequestsTable).values({ storeId, customerId: Number(req.params.id), kind: "export", status: "completed", requestedBy: employee(req).id, completedAt: new Date() });
  await logAudit(req, "print", "customer", Number(req.params.id), { event: "privacy_export", redacted: true });
  return res.json({ exportedAt: new Date().toISOString(), redacted: true, data: { ...data, customer: { ...data.customer, email: data.customer.email ? maskDestination(data.customer.email, "email") : null, phone: data.customer.phone ? maskDestination(data.customer.phone, "sms") : null, notes: null } } });
});

router.post("/customers/:id/anonymize", requireRole("admin"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const id = Number(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [customer] = await tx.select().from(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.storeId, storeId))).for("update");
    if (!customer) throw new HttpError(404, "Customer not found.", "NOT_FOUND");
    if (customer.anonymizedAt) return customer;
    const [updated] = await tx.update(customersTable).set({
      name: `Anonymized customer #${id}`, email: null, phone: null, address: null, notes: null,
      emailConsent: false, smsConsent: false, marketingConsent: false, consentSource: "anonymized", consentReviewedAt: new Date(), anonymizedAt: new Date(),
    }).where(eq(customersTable.id, id)).returning();
    await tx.insert(privacyRequestsTable).values({ storeId, customerId: id, kind: "anonymize", status: "completed", requestedBy: employee(req).id, completedAt: new Date() });
    return updated;
  });
  await logAudit(req, "update", "customer", id, { event: "customer_anonymized", financialHistoryRetained: true });
  return res.json({ anonymized: true, customerId: result.id, anonymizedAt: date(result.anonymizedAt) });
});

publicCustomerAccessRouter.get("/:token", async (req, res) => {
  const link = await getLink(req.params.token);
  if (!link) return res.status(404).json({ error: "This customer link is expired or no longer available.", code: "LINK_UNAVAILABLE" });
  if (link.accessCount >= 100) return res.status(429).json({ error: "This link has reached its access limit.", code: "LINK_RATE_LIMITED" });
  await db.update(customerAccessLinksTable).set({ lastAccessedAt: new Date(), accessCount: link.accessCount + 1 }).where(eq(customerAccessLinksTable.id, link.id));
  const [customer] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, link.customerId));
  if (!customer) return res.status(404).json({ error: "Customer record unavailable.", code: "NOT_FOUND" });
  if (link.saleId) {
    const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, link.saleId));
    if (!sale) return res.status(404).json({ error: "Invoice unavailable.", code: "NOT_FOUND" });
    const paid = await salePaymentTotal(sale.id);
    const items = await db.select({ name: saleLineItemsTable.name, quantity: saleLineItemsTable.quantity, unitPrice: saleLineItemsTable.unitPrice, total: saleLineItemsTable.total }).from(saleLineItemsTable).where(eq(saleLineItemsTable.saleId, sale.id));
    return res.json({ scope: "invoice", expiresAt: date(link.expiresAt), customer: { name: customer.name }, invoice: { ...publicSale(sale, paid), items: items.map((item) => ({ ...item, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), total: Number(item.total) })) }, paymentProvider: { enabled: false, message: "Online payment is not enabled for this store." } });
  }
  const [repair] = await db.select().from(repairsTable).where(eq(repairsTable.id, link.repairId!));
  if (!repair) return res.status(404).json({ error: "Repair unavailable.", code: "NOT_FOUND" });
  const statuses = await db.select({ toStatus: repairStatusHistoryTable.toStatus, createdAt: repairStatusHistoryTable.createdAt }).from(repairStatusHistoryTable).where(eq(repairStatusHistoryTable.repairId, repair.id)).orderBy(desc(repairStatusHistoryTable.createdAt));
  return res.json({ scope: "repair-status", expiresAt: date(link.expiresAt), customer: { name: customer.name }, repair: { ticketNumber: repair.ticketNumber, status: repair.status, deviceType: repair.deviceType, deviceBrand: repair.deviceBrand, deviceModel: repair.deviceModel, estimatedCost: repair.estimatedCost ? Number(repair.estimatedCost) : null, balance: Number(repair.balance), warrantyState: repair.warrantyState, warrantyUntil: date(repair.warrantyUntil), createdAt: date(repair.createdAt), statusHistory: statuses.map((item) => ({ status: item.toStatus, createdAt: date(item.createdAt) })) }, paymentProvider: { enabled: false, message: "Online payment is not enabled for this store." } });
});

publicCustomerAccessRouter.post("/:token/payment-session", async (req, res) => {
  const link = await getLink(req.params.token);
  if (!link) return res.status(404).json({ error: "This customer link is expired or no longer available.", code: "LINK_UNAVAILABLE" });
  return res.status(503).json({ code: "PAYMENT_PROVIDER_NOT_CONFIGURED", status: "unavailable", message: "Online payment is not enabled for this store." });
});

export default router;