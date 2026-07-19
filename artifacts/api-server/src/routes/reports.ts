import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleLineItemsTable, customersTable, productsTable, servicesTable, quotationsTable } from "@workspace/db";
import { eq, gte, lte, and, sql } from "drizzle-orm";

const router = Router();

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() + (6 - r.getDay()));
  r.setHours(23, 59, 59, 999);
  return r;
}
function startOfMonth(y: number, m: number) { return new Date(y, m - 1, 1, 0, 0, 0, 0); }
function endOfMonth(y: number, m: number)   { return new Date(y, m, 0, 23, 59, 59, 999); }

router.get("/dashboard", async (_req, res) => {
  try {
    const now = new Date();
    const mtdStart = startOfMonth(now.getFullYear(), now.getMonth() + 1);
    const weekStart = startOfWeek(now);
    const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
    const lastWeekEnd   = new Date(weekStart); lastWeekEnd.setMilliseconds(-1);

    const [mtdStats] = await db.select({
      revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
      count:   sql<number>`count(*)`,
    }).from(salesTable).where(and(gte(salesTable.createdAt, mtdStart), eq(salesTable.status, "paid")));

    const [weekStats] = await db.select({
      revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
    }).from(salesTable).where(and(gte(salesTable.createdAt, weekStart), eq(salesTable.status, "paid")));

    const [lastWeekStats] = await db.select({
      revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
    }).from(salesTable).where(and(
      gte(salesTable.createdAt, lastWeekStart),
      lte(salesTable.createdAt, lastWeekEnd),
      eq(salesTable.status, "paid")
    ));

    const [{ count: totalCustomers }]  = await db.select({ count: sql<number>`count(*)` }).from(customersTable);
    const [{ count: pendingInvoices }] = await db.select({ count: sql<number>`count(*)` }).from(salesTable).where(eq(salesTable.status, "invoice"));
    const [{ count: openQuotations }]  = await db.select({ count: sql<number>`count(*)` }).from(quotationsTable).where(eq(quotationsTable.status, "draft"));

    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 29);
    const dailySales = await db.select({
      date:       sql<string>`date_trunc('day', created_at)::text`,
      revenue:    sql<number>`coalesce(sum(total::numeric), 0)`,
      salesCount: sql<number>`count(*)`,
    }).from(salesTable)
      .where(gte(salesTable.createdAt, thirtyDaysAgo))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    return res.json({
      totalRevenueMtd:  parseFloat(String(mtdStats.revenue)),
      totalSalesMtd:    Number(mtdStats.count),
      totalCustomers:   Number(totalCustomers),
      pendingInvoices:  Number(pendingInvoices),
      openQuotations:   Number(openQuotations),
      revenueThisWeek:  parseFloat(String(weekStats.revenue)),
      revenueLastWeek:  parseFloat(String(lastWeekStats.revenue)),
      dailyRevenue: dailySales.map(d => ({
        date: String(d.date).substring(0, 10),
        revenue:    parseFloat(String(d.revenue)),
        salesCount: Number(d.salesCount),
      })),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.get("/weekly", async (req, res) => {
  try {
    const weekOffset = Number(req.query.weekOffset) || 0;
    const base = new Date();
    base.setDate(base.getDate() - weekOffset * 7);
    const weekStart = startOfWeek(base);
    const weekEnd   = endOfWeek(new Date(weekStart));

    const sales = await db.select().from(salesTable)
      .where(and(gte(salesTable.createdAt, weekStart), lte(salesTable.createdAt, weekEnd)));

    const [{ newCustomers }] = await db.select({ newCustomers: sql<number>`count(*)` }).from(customersTable)
      .where(and(gte(customersTable.createdAt, weekStart), lte(customersTable.createdAt, weekEnd)));

    const paidSales = sales.filter(s => s.status === "paid");
    const totalRevenue = paidSales.reduce((sum, s) => sum + parseFloat(s.total), 0);

    const dailyMap: Record<string, { revenue: number; salesCount: number }> = {};
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      dailyMap[new Date(d).toISOString().split("T")[0]] = { revenue: 0, salesCount: 0 };
    }
    paidSales.forEach(s => {
      const day = s.createdAt.toISOString().split("T")[0];
      if (dailyMap[day]) { dailyMap[day].revenue += parseFloat(s.total); dailyMap[day].salesCount++; }
    });

    const allItems = await db.select().from(saleLineItemsTable);
    const paidIds = new Set(paidSales.map(s => s.id));
    const itemMap: Record<string, { name: string; type: string; totalRevenue: number; totalQty: number }> = {};
    allItems.filter(i => paidIds.has(i.saleId)).forEach(i => {
      if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, type: i.type, totalRevenue: 0, totalQty: 0 };
      itemMap[i.name].totalRevenue += parseFloat(i.total);
      itemMap[i.name].totalQty    += parseFloat(i.quantity);
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);

    return res.json({
      weekStart: weekStart.toISOString().split("T")[0],
      weekEnd:   weekEnd.toISOString().split("T")[0],
      totalRevenue,
      totalSales: paidSales.length,
      newCustomers: Number(newCustomers),
      avgSaleValue: paidSales.length ? totalRevenue / paidSales.length : 0,
      topItems,
      dailyBreakdown: Object.entries(dailyMap).map(([date, v]) => ({ date, ...v })),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.get("/monthly", async (req, res) => {
  try {
    const year  = Number(req.query.year)  || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const start = startOfMonth(year, month);
    const end   = endOfMonth(year, month);

    const sales = await db.select().from(salesTable)
      .where(and(gte(salesTable.createdAt, start), lte(salesTable.createdAt, end)));

    const [{ newCustomers }] = await db.select({ newCustomers: sql<number>`count(*)` }).from(customersTable)
      .where(and(gte(customersTable.createdAt, start), lte(customersTable.createdAt, end)));

    const paidSales = sales.filter(s => s.status === "paid");
    const totalRevenue = paidSales.reduce((sum, s) => sum + parseFloat(s.total), 0);

    const weekMap: Record<number, { revenue: number; salesCount: number }> = {};
    paidSales.forEach(s => {
      const w = Math.ceil(s.createdAt.getDate() / 7);
      if (!weekMap[w]) weekMap[w] = { revenue: 0, salesCount: 0 };
      weekMap[w].revenue += parseFloat(s.total);
      weekMap[w].salesCount++;
    });

    return res.json({
      year, month,
      totalRevenue,
      totalSales:   sales.length,
      newCustomers: Number(newCustomers),
      avgSaleValue: paidSales.length ? totalRevenue / paidSales.length : 0,
      revenueByWeek: Object.entries(weekMap).map(([w, v]) => ({ week: Number(w), ...v })),
      salesList: sales.map(s => ({
        ...s,
        subtotal:  parseFloat(s.subtotal),
        taxRate:   parseFloat(s.taxRate),
        tax:       parseFloat(s.tax),
        discount:  parseFloat(s.discount),
        total:     parseFloat(s.total),
        createdAt: s.createdAt.toISOString(),
        items: [],
      })),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.get("/top-products", async (_req, res) => {
  try {
    const items = await db.select().from(saleLineItemsTable);
    const map: Record<string, { name: string; type: string; totalRevenue: number; totalQty: number }> = {};
    items.forEach(i => {
      if (!map[i.name]) map[i.name] = { name: i.name, type: i.type, totalRevenue: 0, totalQty: 0 };
      map[i.name].totalRevenue += parseFloat(i.total);
      map[i.name].totalQty    += parseFloat(i.quantity);
    });
    return res.json(Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.get("/revenue-by-category", async (_req, res) => {
  try {
    const items    = await db.select().from(saleLineItemsTable);
    const products = await db.select({ id: productsTable.id, category: productsTable.category }).from(productsTable);
    const services = await db.select({ id: servicesTable.id, category: servicesTable.category }).from(servicesTable);
    const pMap = Object.fromEntries(products.map(p => [p.id, p.category]));
    const sMap = Object.fromEntries(services.map(s => [s.id, s.category]));

    const catMap: Record<string, number> = {};
    items.forEach(i => {
      const cat = i.productId ? (pMap[i.productId] || "Accessories")
                : i.serviceId ? (sMap[i.serviceId] || "Repairs")
                : i.type === "service" ? "Repairs" : "Accessories";
      catMap[cat] = (catMap[cat] || 0) + parseFloat(i.total);
    });
    const total = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
    return res.json(Object.entries(catMap).map(([category, revenue]) => ({
      category,
      revenue,
      percentage: Math.round((revenue / total) * 100),
    })));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export default router;
