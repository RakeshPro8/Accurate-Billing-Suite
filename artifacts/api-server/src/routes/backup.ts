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
  recyclingReceiptsTable,
} from "@workspace/db";
import { requireRole } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { requireCurrentStoreId } from "../lib/stores";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/backup", requireRole("admin"), async (req, res) => {
  try {
    const storeId = await requireCurrentStoreId(req);
    const [products, services, customers, employees, settings, stores, sales, saleLineItems, quotations, quotationLineItems, repairs, repairPhotos, repairParts, recyclingReceipts, auditLogs] = await Promise.all([
       db.select().from(productsTable).where(eq(productsTable.storeId, storeId)),
      db.select().from(servicesTable),
       db.select().from(customersTable).where(eq(customersTable.storeId, storeId)),
      db.select({
        id: employeesTable.id,
        name: employeesTable.name,
        email: employeesTable.email,
        role: employeesTable.role,
        maxDiscountPct: employeesTable.maxDiscountPct,
        active: employeesTable.active,
        createdAt: employeesTable.createdAt,
      }).from(employeesTable),
      db.select({
        id: settingsTable.id,
        appName: settingsTable.appName,
        businessName: settingsTable.businessName,
        businessAddress: settingsTable.businessAddress,
        businessPhone: settingsTable.businessPhone,
        businessEmail: settingsTable.businessEmail,
        logoUrl: settingsTable.logoUrl,
        theme: settingsTable.theme,
        currency: settingsTable.currency,
        taxRate: settingsTable.taxRate,
        taxName: settingsTable.taxName,
        taxEnabled: settingsTable.taxEnabled,
        gstRate: settingsTable.gstRate,
        qstRate: settingsTable.qstRate,
        invoicePrefix: settingsTable.invoicePrefix,
        quotePrefix: settingsTable.quotePrefix,
        invoiceFooter: settingsTable.invoiceFooter,
        thankYouMessage: settingsTable.thankYouMessage,
        defaultStoreId: settingsTable.defaultStoreId,
      }).from(settingsTable),
       db.select().from(storesTable).where(eq(storesTable.id, storeId)),
       db.select().from(salesTable).where(eq(salesTable.storeId, storeId)),
       db.select().from(saleLineItemsTable),
       db.select().from(quotationsTable).where(eq(quotationsTable.storeId, storeId)),
       db.select().from(quotationLineItemsTable),
      db.select({
        id: repairsTable.id, ticketNumber: repairsTable.ticketNumber, customerId: repairsTable.customerId,
        customerName: repairsTable.customerName, customerPhone: repairsTable.customerPhone,
        customerEmail: repairsTable.customerEmail, deviceType: repairsTable.deviceType,
        deviceBrand: repairsTable.deviceBrand, deviceModel: repairsTable.deviceModel,
        serialNumber: repairsTable.serialNumber, imei: repairsTable.imei,
        problemDescription: repairsTable.problemDescription, diagnosticNotes: repairsTable.diagnosticNotes,
        status: repairsTable.status, priority: repairsTable.priority, technicianId: repairsTable.technicianId,
        technicianName: repairsTable.technicianName, storeId: repairsTable.storeId,
        estimatedCost: repairsTable.estimatedCost, deposit: repairsTable.deposit, total: repairsTable.total,
        balance: repairsTable.balance, notifiedAt: repairsTable.notifiedAt, pickedUpAt: repairsTable.pickedUpAt,
        completedAt: repairsTable.completedAt, createdAt: repairsTable.createdAt, updatedAt: repairsTable.updatedAt,
       }).from(repairsTable).where(eq(repairsTable.storeId, storeId)),
      db.select({ id: repairPhotosTable.id, repairId: repairPhotosTable.repairId, caption: repairPhotosTable.caption, createdAt: repairPhotosTable.createdAt }).from(repairPhotosTable),
      db.select().from(repairPartsTable),
       db.select().from(recyclingReceiptsTable).where(eq(recyclingReceiptsTable.storeId, storeId)),
       db.select().from(auditLogsTable).where(eq(auditLogsTable.storeId, storeId)),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: "2.0",
      included: [
        "catalog, customers, sales and line items, quotations and line items",
         "repair records without device unlock credentials, repair parts, recycling receipts, stores",
        "business/tax configuration without SMTP secrets, and privacy-safe audit metadata",
      ],
      excluded: [
        "employee PINs and password/PIN hashes",
        "session rows and session identifiers",
        "SMTP passwords and all other authentication credentials",
        "repair device passwords/unlock codes",
        "repair photo bytes and other attachment contents",
      ],
      tables: {
        products,
        services,
        customers,
        employees,
        settings,
        stores,
        sales,
         saleLineItems: saleLineItems.filter((item) => sales.some((sale) => sale.id === item.saleId)),
        quotations,
         quotationLineItems: quotationLineItems.filter((item) => quotations.some((quote) => quote.id === item.quotationId)),
        repairs,
         repairPhotos: repairPhotos.filter((photo) => repairs.some((repair) => repair.id === photo.repairId)),
         repairParts: repairParts.filter((part) => repairs.some((repair) => repair.id === part.repairId)),
         recyclingReceipts,
        auditLogs,
      },
    };

    await logAudit(req, "print", "backup", undefined, { version: "2.0", redacted: true });
    res.setHeader("Content-Disposition", `attachment; filename="mobilinq-backup-v2-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader("Content-Type", "application/json");
    return res.json(backup);
  } catch (e) {
    throw e;
  }
});

export default router;
