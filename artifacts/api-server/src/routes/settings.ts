import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logAudit } from "../lib/audit";

const router = Router();

function parseSettings(s: typeof settingsTable.$inferSelect) {
  return {
    id: s.id,
    appName: s.appName,
    businessName: s.businessName,
    businessAddress: s.businessAddress,
    businessPhone: s.businessPhone,
    businessEmail: s.businessEmail,
    logoUrl: s.logoUrl,
    theme: s.theme,
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
  };
}

router.get("/", async (_req, res) => {
  try {
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
    return res.json(parseSettings(settings));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.patch("/", async (req, res) => {
  try {
    const body = req.body;
    const updates: Record<string, unknown> = {};
    const strFields = ["appName","businessName","businessAddress","businessPhone","businessEmail","logoUrl","theme","currency","invoicePrefix","quotePrefix","invoiceFooter","thankYouMessage","smtpHost","smtpUser","smtpPass"] as const;
    strFields.forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
    if (body.taxRate !== undefined) updates.taxRate = String(body.taxRate);
    if (body.gstRate !== undefined) updates.gstRate = String(body.gstRate);
    if (body.qstRate !== undefined) updates.qstRate = String(body.qstRate);
    if (body.taxName !== undefined) updates.taxName = String(body.taxName).trim() || "Tax";
    if (body.taxEnabled !== undefined) updates.taxEnabled = Boolean(body.taxEnabled);
    if (body.defaultStoreId !== undefined) updates.defaultStoreId = body.defaultStoreId ? Number(body.defaultStoreId) : null;
    if (body.smtpPort !== undefined) updates.smtpPort = Number(body.smtpPort);

    let [settings] = await db.select().from(settingsTable).limit(1);
    if (!settings) {
      [settings] = await db.insert(settingsTable).values({
        businessName: "My Store", currency: "USD", taxRate: "0",
        invoicePrefix: "INV-", quotePrefix: "QUO-", ...updates
      }).returning();
    } else {
      [settings] = await db.update(settingsTable).set(updates)
        .where(sql`id = ${settings.id}`).returning();
    }
    await logAudit(req, "update", "settings", settings.id, { fields: Object.keys(updates).filter((key) => key !== "smtpPass") });
    return res.json(parseSettings(settings));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
