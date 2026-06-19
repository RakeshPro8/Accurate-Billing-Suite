import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function parseSettings(s: typeof settingsTable.$inferSelect) {
  return {
    ...s,
    taxRate: parseFloat(String(s.taxRate)),
    smtpPort: s.smtpPort ?? null,
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
    res.json(parseSettings(settings));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch("/", async (req, res) => {
  try {
    const body = req.body;
    const updates: Record<string, unknown> = {};
    const strFields = ["businessName","businessAddress","businessPhone","businessEmail","currency","invoicePrefix","quotePrefix","invoiceFooter","thankYouMessage","smtpHost","smtpUser","smtpPass"] as const;
    strFields.forEach(f => { if (body[f] !== undefined) updates[f] = body[f]; });
    if (body.taxRate !== undefined) updates.taxRate = String(body.taxRate);
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
    res.json(parseSettings(settings));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
