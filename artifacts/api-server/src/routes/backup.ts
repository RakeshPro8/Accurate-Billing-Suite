import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  servicesTable,
  customersTable,
  employeesTable,
  settingsTable,
  storesTable,
  salesTable,
  saleLineItemsTable,
  quotationsTable,
  quotationLineItemsTable,
  repairsTable,
  repairPhotosTable,
  repairPartsTable,
  auditLogsTable,
} from "@workspace/db";
import { requireRole } from "../lib/auth";

const router = Router();

router.get("/backup", requireRole("admin"), async (_req, res) => {
  try {
    const [products, services, customers, employees, settings, stores, sales, saleLineItems, quotations, quotationLineItems, repairs, repairPhotos, repairParts, auditLogs] = await Promise.all([
      db.select().from(productsTable),
      db.select().from(servicesTable),
      db.select().from(customersTable),
      db.select().from(employeesTable),
      db.select().from(settingsTable),
      db.select().from(storesTable),
      db.select().from(salesTable),
      db.select().from(saleLineItemsTable),
      db.select().from(quotationsTable),
      db.select().from(quotationLineItemsTable),
      db.select().from(repairsTable),
      db.select().from(repairPhotosTable),
      db.select().from(repairPartsTable),
      db.select().from(auditLogsTable),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      tables: {
        products,
        services,
        customers,
        employees,
        settings,
        stores,
        sales,
        saleLineItems,
        quotations,
        quotationLineItems,
        repairs,
        repairPhotos,
        repairParts,
        auditLogs,
      },
    };

    res.setHeader("Content-Disposition", `attachment; filename="mobilinq-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader("Content-Type", "application/json");
    return res.json(backup);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
