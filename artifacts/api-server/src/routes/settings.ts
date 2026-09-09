import { Router } from "express";
import { db } from "@workspace/db";
import { receiptContentPreferencesTable, settingsTable, storesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { requireRole } from "../lib/auth";
import { requireCurrentStoreId } from "../lib/stores";
import { HttpError } from "../lib/http";
import { eq } from "drizzle-orm";

const router = Router();
const THEME_PRESETS = ["terminal", "ocean", "sunset", "berry", "forest", "monochrome"] as const;
const RECEIPT_CONTENT_FIELDS = [
  "thankYouMessage",
  "footerText",
  "showBusinessContact",
  "showCustomerDetails",
  "showPaymentMethod",
  "showTaxBreakdown",
  "showQrCode",
] as const;
const RECEIPT_TEXT_LIMITS = { thankYouMessage: 160, footerText: 600 } as const;

function parseReceiptContent(
  settings: typeof settingsTable.$inferSelect,
  preferences?: typeof receiptContentPreferencesTable.$inferSelect,
) {
  return {
    thankYouMessage: preferences ? preferences.thankYouMessage : settings.thankYouMessage,
    footerText: preferences ? preferences.footerText : settings.invoiceFooter,
    showBusinessContact: preferences?.showBusinessContact ?? true,
    showCustomerDetails: preferences?.showCustomerDetails ?? true,
    showPaymentMethod: preferences?.showPaymentMethod ?? true,
    showTaxBreakdown: preferences?.showTaxBreakdown ?? true,
    showQrCode: preferences?.showQrCode ?? true,
  };
}

function parseSettings(
  s: typeof settingsTable.$inferSelect,
  receiptContent?: typeof receiptContentPreferencesTable.$inferSelect,
) {
  return {
    id: s.id,
    appName: s.appName,
    businessName: s.businessName,
    businessAddress: s.businessAddress,
    businessPhone: s.businessPhone,
    businessEmail: s.businessEmail,
    logoUrl: s.logoUrl,
     theme: (THEME_PRESETS as readonly string[]).includes(s.theme) ? s.theme : "berry",
    currency: s.currency,
    taxRate: parseFloat(String(s.taxRate)),
    taxName: s.taxName,
    taxEnabled: s.taxEnabled,
    gstRate: parseFloat(String(s.gstRate ?? "0")),
    qstRate: parseFloat(String(s.qstRate ?? "0")),
    invoicePrefix: s.invoicePrefix,
    quotePrefix: s.quotePrefix,
    invoiceFooter: s.invoiceFooter,
    thankYouMessage: s.thankYouMessage,
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort ?? null,
    smtpUser: s.smtpUser,
    smtpConfigured: Boolean(s.smtpHost && s.smtpUser && s.smtpPass),
    defaultStoreId: s.defaultStoreId,
    receiptContent: parseReceiptContent(s, receiptContent),
  };
}

function validateReceiptContent(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "Invalid receipt content.");
  }

  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!(RECEIPT_CONTENT_FIELDS as readonly string[]).includes(key)) {
      throw new HttpError(400, "Invalid receipt content.");
    }
  }

  const updates: Record<string, unknown> = {};
  for (const field of RECEIPT_CONTENT_FIELDS) {
    if (body[field] === undefined) continue;
    if (field === "thankYouMessage" || field === "footerText") {
      if (body[field] !== null && typeof body[field] !== "string") {
        throw new HttpError(400, "Receipt copy must be text.");
      }
      const value = typeof body[field] === "string" ? body[field].trim() : null;
      if (value && value.length > RECEIPT_TEXT_LIMITS[field]) {
        throw new HttpError(400, `Receipt ${field === "thankYouMessage" ? "thank-you message" : "footer"} is too long.`);
      }
      updates[field] = value || null;
    } else if (typeof body[field] !== "boolean") {
      throw new HttpError(400, "Receipt visibility choices must be boolean.");
    } else {
      updates[field] = body[field];
    }
  }
  return updates;
}

router.get("/", requireRole("manager"), async (req, res) => {
  try {
    const storeId = await requireCurrentStoreId(req);
    let [settings] = await db.select().from(settingsTable).limit(1);
    if (!settings) {
      [settings] = await db.insert(settingsTable).values({
        businessName: "My Store",
        currency: "USD",
        taxRate: "0",
        invoicePrefix: "INV-",
        quotePrefix: "QUO-",
      }).returning();
    }
    const [receiptContent] = await db.select().from(receiptContentPreferencesTable)
      .where(eq(receiptContentPreferencesTable.storeId, storeId)).limit(1);
    return res.json(parseSettings(settings, receiptContent));
  } catch (e) {
    throw e;
  }
});

router.patch("/", requireRole("admin"), async (req, res) => {
  try {
    const storeId = await requireCurrentStoreId(req);
     const body = req.body ?? {};
     if (body.theme !== undefined) throw new HttpError(400, "Apply a theme from the dedicated theme control.");
    if (body.businessEmail !== undefined && (typeof body.businessEmail !== "string" || (body.businessEmail !== "" && (body.businessEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.businessEmail))))) throw new HttpError(400, "Invalid settings.");
    if (body.smtpPort !== undefined && body.smtpPort !== null && (!Number.isInteger(Number(body.smtpPort)) || Number(body.smtpPort) < 1 || Number(body.smtpPort) > 65535)) throw new HttpError(400, "Invalid settings.");
    for (const field of ["taxRate", "gstRate", "qstRate"]) if (body[field] !== undefined && (typeof body[field] !== "number" || !Number.isFinite(body[field]) || body[field] < 0 || body[field] > 100)) throw new HttpError(400, "Invalid settings.");
    if (body.taxEnabled !== undefined && typeof body.taxEnabled !== "boolean") throw new HttpError(400, "Invalid tax setting.");
    if (body.taxName !== undefined && typeof body.taxName !== "string") throw new HttpError(400, "Invalid tax name.");
    if (body.defaultStoreId !== undefined && body.defaultStoreId !== null && (typeof body.defaultStoreId !== "number" || !Number.isSafeInteger(body.defaultStoreId))) throw new HttpError(400, "Invalid default store.");
    const receiptContentUpdates = body.receiptContent === undefined ? {} : validateReceiptContent(body.receiptContent);
    const updates: Record<string, unknown> = {};
     const strFields = ["appName","businessName","businessAddress","businessPhone","businessEmail","logoUrl","currency","invoicePrefix","quotePrefix","invoiceFooter","thankYouMessage","smtpHost","smtpUser","smtpPass"] as const;
     strFields.forEach(f => {
       if (body[f] !== undefined && typeof body[f] !== "string") throw new HttpError(400, `Invalid ${f}.`);
       if (body[f] !== undefined) updates[f] = body[f];
     });
    if (body.taxRate !== undefined) updates.taxRate = String(body.taxRate);
    if (body.gstRate !== undefined) updates.gstRate = String(body.gstRate);
    if (body.qstRate !== undefined) updates.qstRate = String(body.qstRate);
    if (body.taxName !== undefined) updates.taxName = String(body.taxName).trim() || "Tax";
    if (body.taxEnabled !== undefined) updates.taxEnabled = Boolean(body.taxEnabled);
    if (body.defaultStoreId !== undefined) {
      const defaultStoreId = body.defaultStoreId ?? null;
      if (defaultStoreId !== null && (!Number.isSafeInteger(defaultStoreId) || defaultStoreId < 1)) throw new HttpError(400, "Invalid default store.");
      updates.defaultStoreId = defaultStoreId;
    }
     if (body.smtpPort !== undefined) updates.smtpPort = body.smtpPort === null ? null : Number(body.smtpPort);

    const result = await db.transaction(async (tx) => {
      if (updates.defaultStoreId) {
        const [store] = await tx.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.id, updates.defaultStoreId as number)).limit(1);
        if (!store) throw new HttpError(400, "Invalid default store.");
      }
      let [current] = await tx.select().from(settingsTable).limit(1);
      if (!current) {
        [current] = await tx.insert(settingsTable).values({
          businessName: "My Store",
          currency: "USD",
          taxRate: "0",
          invoicePrefix: "INV-",
          quotePrefix: "QUO-",
          ...updates,
        }).returning();
      } else if (Object.keys(updates).length > 0) {
        [current] = await tx.update(settingsTable).set(updates).where(sql`id = ${current.id}`).returning();
      }

      let [receiptContent] = await tx.select().from(receiptContentPreferencesTable)
        .where(eq(receiptContentPreferencesTable.storeId, storeId)).limit(1);
      if (Object.keys(receiptContentUpdates).length > 0) {
        const legacyDefaults = parseReceiptContent(current);
        const valueFor = (field: keyof typeof legacyDefaults, fallback: unknown) =>
          Object.prototype.hasOwnProperty.call(receiptContentUpdates, field)
            ? receiptContentUpdates[field]
            : (receiptContent?.[field] ?? fallback);
        const values = {
          storeId,
          thankYouMessage: valueFor("thankYouMessage", legacyDefaults.thankYouMessage) as string | null,
          footerText: valueFor("footerText", legacyDefaults.footerText) as string | null,
          showBusinessContact: valueFor("showBusinessContact", true) as boolean,
          showCustomerDetails: valueFor("showCustomerDetails", true) as boolean,
          showPaymentMethod: valueFor("showPaymentMethod", true) as boolean,
          showTaxBreakdown: valueFor("showTaxBreakdown", true) as boolean,
          showQrCode: valueFor("showQrCode", true) as boolean,
          updatedAt: new Date(),
        };
        [receiptContent] = await tx.insert(receiptContentPreferencesTable).values(values)
          .onConflictDoUpdate({ target: receiptContentPreferencesTable.storeId, set: values })
          .returning();
      }
      return { current, receiptContent };
    });
    await logAudit(req, "update", "settings", result.current.id, {
      fields: [
        ...Object.keys(updates).filter((key) => key !== "smtpPass"),
        ...Object.keys(receiptContentUpdates).map((key) => `receiptContent.${key}`),
      ],
    });
    return res.json(parseSettings(result.current, result.receiptContent));
  } catch (e) {
    throw e;
  }
});

router.patch("/theme", requireRole("admin"), async (req, res) => {
  const storeId = await requireCurrentStoreId(req);
  const body = req.body ?? {};
  if (!(THEME_PRESETS as readonly string[]).includes(body.theme)) throw new HttpError(400, "Choose a supported theme.");
  let [current] = await db.select().from(settingsTable).limit(1);
  if (!current) {
    [current] = await db.insert(settingsTable).values({
      businessName: "My Store",
      currency: "USD",
      taxRate: "0",
      invoicePrefix: "INV-",
      quotePrefix: "QUO-",
      theme: body.theme,
    }).returning();
  } else {
    [current] = await db.update(settingsTable).set({ theme: body.theme }).where(eq(settingsTable.id, current.id)).returning();
  }
  await logAudit(req, "update", "settings", current.id, { fields: ["theme"], storeId });
  const [receiptContent] = await db.select().from(receiptContentPreferencesTable)
    .where(eq(receiptContentPreferencesTable.storeId, storeId)).limit(1);
  return res.json(parseSettings(current, receiptContent));
});

export default router;
