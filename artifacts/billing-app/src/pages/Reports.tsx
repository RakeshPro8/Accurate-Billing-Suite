import { useState } from "react";
import { useGetWeeklyReport, useGetMonthlyReport, useGetTopProducts, useGetRevenueByCategory, useGetReceivables, useGetTaxSummary } from "@workspace/api-client-react";
import { formatCurrency, formatDate, downloadCSV } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Download, ChevronLeft, ChevronRight, TrendingUp, Users, ShoppingCart, DollarSign, Filter, FileSpreadsheet, Landmark, ReceiptText, ShieldCheck } from "lucide-react";
import { apiUrl } from "@/lib/api-config";

const COLORS = ["#00e5c8","#3b82f6","#a855f7","#f59e0b","#ef4444","#10b981"];

function SummaryCard({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-lg shrink-0"><Icon className="h-4 w-4 text-primary" /></div>
        <div><p className="text-xs text-muted-foreground">{title}</p><p className="text-lg font-bold">{value}</p></div>
      </CardContent>
    </Card>
  );
}

interface SalesFilter {
  dateFrom: string;
  dateTo: string;
  status: string;
  employeeId: string;
}

export default function Reports() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const [filter, setFilter] = useState<SalesFilter>({
    dateFrom: firstOfMonth,
    dateTo: today.toISOString().split("T")[0],
    status: "all",
    employeeId: "",
  });
  const [csvLoading, setCsvLoading] = useState(false);
  const [taxFrom, setTaxFrom] = useState(firstOfMonth);
  const [taxTo, setTaxTo] = useState(today.toISOString().split("T")[0]);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);

  const { data: weekly, isLoading: loadingWeekly } = useGetWeeklyReport({ weekOffset });
  const { data: monthly, isLoading: loadingMonthly } = useGetMonthlyReport({ year: reportYear, month: reportMonth });
  const { data: topProducts } = useGetTopProducts();
  const { data: revenueByCategory } = useGetRevenueByCategory();
  const { data: receivables, isLoading: loadingReceivables } = useGetReceivables();
  const { data: taxSummary, isLoading: loadingTax } = useGetTaxSummary({ dateFrom: taxFrom, dateTo: taxTo });

  function exportWeeklyCSV() {
    if (!weekly) return;
    downloadCSV(
      `weekly-report-${weekly.weekStart}.csv`,
      weekly.dailyBreakdown.map(d => [d.date, d.revenue, d.salesCount]),
      ["Date", "Revenue", "Sales Count"]
    );
  }

  async function exportMonthlyExcel() {
    if (!monthly) return;
    const XLSX = await import("@e965/xlsx");
    const wb = XLSX.utils.book_new();
    const salesData = [
      ["Invoice #", "Customer", "Employee", "Date", "Status", "Payment", "Subtotal", "Tax", "Discount", "Total"],
      ...monthly.salesList.map((s: any) => [
        s.invoiceNumber, s.customerName || "Walk-in", s.employeeName || "—", formatDate(s.createdAt),
        s.status, s.paymentMethod || "",
        s.subtotal, s.tax, s.discount, s.total
      ])
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(salesData);
    ws1["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Sales");
    const summaryData = [
      ["Summary", ""],
      ["Period", `${new Date(reportYear, reportMonth - 1).toLocaleString("default", { month: "long" })} ${reportYear}`],
      ["Total Revenue", monthly.totalRevenue],
      ["Total Sales", monthly.totalSales],
      ["Average Sale Value", monthly.avgSaleValue],
      ["New Customers", monthly.newCustomers],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");
    const monthName = new Date(reportYear, reportMonth - 1).toLocaleString("default", { month: "long" });
    XLSX.writeFile(wb, `monthly-report-${monthName}-${reportYear}.xlsx`);
  }

  async function exportFilteredCSV() {
    setCsvLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.dateFrom) params.set("dateFrom", filter.dateFrom);
      if (filter.dateTo) params.set("dateTo", new Date(filter.dateTo + "T23:59:59").toISOString());
      if (filter.status && filter.status !== "all") params.set("status", filter.status);
      if (filter.employeeId) params.set("employeeId", filter.employeeId);
      const resp = await fetch(`${apiUrl("/sales")}?${params.toString()}`, { credentials: "include" });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(payload?.error ?? `Unable to load sales (HTTP ${resp.status}).`);
      const sales = Array.isArray(payload) ? payload : (payload?.items ?? []);
      if (!sales.length) { alert("No sales found for the selected filters."); return; }
      const XLSX = await import("@e965/xlsx");
      const wb = XLSX.utils.book_new();
      const rows = [
        ["Invoice #", "Customer", "Employee", "Date", "Status", "Payment", "Subtotal ($)", "Tax ($)", "Discount ($)", "Total ($)"],
        ...sales.map((s: any) => [
          s.invoiceNumber,
          s.customerName || "Walk-in",
          s.employeeName || "—",
          new Date(s.createdAt).toLocaleDateString(),
          s.status,
          s.paymentMethod || "—",
          Number(s.subtotal).toFixed(2),
          Number(s.tax).toFixed(2),
          Number(s.discount).toFixed(2),
          Number(s.total).toFixed(2),
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, "Sales History");
      const totalRevenue = sales.reduce((s: number, r: any) => s + Number(r.total), 0);
      const summaryWs = XLSX.utils.aoa_to_sheet([
        ["Export Summary", ""],
        ["Date Range", `${filter.dateFrom} to ${filter.dateTo}`],
        ["Status Filter", filter.status === "all" ? "All" : filter.status],
        ["Total Records", sales.length],
        ["Total Revenue", `$${totalRevenue.toFixed(2)}`],
      ]);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
      XLSX.writeFile(wb, `sales-export-${filter.dateFrom}-to-${filter.dateTo}.xlsx`);
    } catch (e) {
      alert("Export failed: " + String(e));
    } finally {
      setCsvLoading(false);
    }
  }

  async function downloadReconciliation() {
    setReconciliationLoading(true);
    try {
      const response = await fetch(apiUrl("/finance/reconciliation-export"), { credentials: "include" });
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mobilinq-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Reconciliation export failed. Check your connection and try again.");
    } finally {
      setReconciliationLoading(false);
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleString("default", { month: "long" }),
  }));
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">Business analytics and exportable reports</p>
      </div>

      <Tabs defaultValue="export">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="export">Sales Export</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="receivables">Receivables</TabsTrigger>
          <TabsTrigger value="tax">Tax summary</TabsTrigger>
        </TabsList>

        {/* Filtered CSV Export */}
        <TabsContent value="export" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> Filter & Export Sales History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">From Date</Label>
                  <Input type="date" value={filter.dateFrom} onChange={e => setFilter(f => ({ ...f, dateFrom: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">To Date</Label>
                  <Input type="date" value={filter.dateTo} onChange={e => setFilter(f => ({ ...f, dateTo: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={filter.status} onValueChange={v => setFilter(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">&nbsp;</Label>
                  <Button onClick={exportFilteredCSV} disabled={csvLoading} className="w-full h-8 text-sm gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {csvLoading ? "Exporting..." : "Export Excel"}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                  const now = new Date();
                  setFilter(f => ({
                    ...f,
                    dateFrom: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
                    dateTo: now.toISOString().split("T")[0],
                  }));
                }}>This Month</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                  const now = new Date();
                  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  setFilter(f => ({
                    ...f,
                    dateFrom: last.toISOString().split("T")[0],
                    dateTo: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0],
                  }));
                }}>Last Month</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                  const now = new Date();
                  setFilter(f => ({
                    ...f,
                    dateFrom: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0],
                    dateTo: now.toISOString().split("T")[0],
                  }));
                }}>This Year</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                  setFilter(f => ({ ...f, status: "paid" }));
                }}>Paid Only</Button>
              </div>
              <p className="text-xs text-muted-foreground">Exports an Excel spreadsheet with invoice details including employee name, customer, date, payment method, and all financial totals.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly */}
        <TabsContent value="weekly" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o + 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[160px] text-center">
                {weekly ? `${weekly.weekStart} — ${weekly.weekEnd}` : "Loading..."}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={weekOffset === 0} onClick={() => setWeekOffset(o => o - 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={exportWeeklyCSV} disabled={!weekly} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>

          {loadingWeekly ? (
            <div className="space-y-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-24 w-full"/>)}</div>
          ) : weekly ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard title="Revenue" value={formatCurrency(weekly.totalRevenue)} icon={DollarSign} />
                <SummaryCard title="Sales" value={String(weekly.totalSales)} icon={ShoppingCart} />
                <SummaryCard title="Avg Sale" value={formatCurrency(weekly.avgSaleValue ?? 0)} icon={TrendingUp} />
                <SummaryCard title="New Customers" value={String(weekly.newCustomers)} icon={Users} />
              </div>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Daily Revenue</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weekly.dailyBreakdown}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} width={50} />
                      <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                      <Bar dataKey="revenue" fill="#00e5c8" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* Monthly */}
        <TabsContent value="monthly" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Select value={String(reportMonth)} onValueChange={v => setReportMonth(Number(v))}>
                <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(reportYear)} onValueChange={v => setReportYear(Number(v))}>
                <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={exportMonthlyExcel} disabled={!monthly} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export Excel (.xlsx)
            </Button>
          </div>

          {loadingMonthly ? (
            <div className="space-y-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-24 w-full"/>)}</div>
          ) : monthly ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard title="Revenue" value={formatCurrency(monthly.totalRevenue)} icon={DollarSign} />
                <SummaryCard title="Total Sales" value={String(monthly.totalSales)} icon={ShoppingCart} />
                <SummaryCard title="Avg Sale" value={formatCurrency(monthly.avgSaleValue ?? 0)} icon={TrendingUp} />
                <SummaryCard title="New Customers" value={String(monthly.newCustomers)} icon={Users} />
              </div>
              {monthly.salesList?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">All Sales This Month</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="border-b"><tr>
                          <th className="text-left py-2 font-medium text-muted-foreground">Invoice</th>
                          <th className="text-left py-2 font-medium text-muted-foreground">Customer</th>
                          <th className="text-left py-2 font-medium text-muted-foreground">Employee</th>
                          <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Total</th>
                        </tr></thead>
                        <tbody className="divide-y">
                          {monthly.salesList.map((s: any) => (
                            <tr key={s.id}>
                              <td className="py-2 font-mono">{s.invoiceNumber}</td>
                              <td className="py-2">{s.customerName || "Walk-in"}</td>
                              <td className="py-2 text-muted-foreground">{s.employeeName || "—"}</td>
                              <td className="py-2 text-muted-foreground">{formatDate(s.createdAt)}</td>
                              <td className="py-2 capitalize">{s.status}</td>
                              <td className="py-2 text-right font-semibold">{formatCurrency(s.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* Finance reporting */}
        <TabsContent value="receivables" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs uppercase tracking-[0.18em] text-primary">Finance operations</p><h2 className="mt-1 text-lg font-semibold">Receivables & aging</h2><p className="text-sm text-muted-foreground">Outstanding customer balances as of {receivables?.asOf ? formatDate(receivables.asOf) : "today"}.</p></div>
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadReconciliation} disabled={reconciliationLoading}><ShieldCheck className="h-3.5 w-3.5" /> {reconciliationLoading ? "Preparing…" : "Download reconciliation CSV"}</Button>
          </div>
          {loadingReceivables ? <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : receivables ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3"><SummaryCard title="Outstanding" value={formatCurrency(Number(receivables.totals.outstanding ?? 0))} icon={Landmark} /><SummaryCard title="Overdue" value={formatCurrency(Number(receivables.totals.overdue ?? 0))} icon={ReceiptText} /><SummaryCard title="Open invoices" value={String(receivables.items.length)} icon={FileSpreadsheet} /></div>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Open balances</CardTitle></CardHeader><CardContent>{receivables.items.length ? <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="border-b"><tr><th className="py-2 text-left font-medium text-muted-foreground">Invoice</th><th className="py-2 text-left font-medium text-muted-foreground">Customer</th><th className="py-2 text-left font-medium text-muted-foreground">Due</th><th className="py-2 text-left font-medium text-muted-foreground">Aging</th><th className="py-2 text-right font-medium text-muted-foreground">Balance</th></tr></thead><tbody className="divide-y">{receivables.items.map((item, index) => <tr key={item.id ?? index}><td className="py-2 font-mono">{item.invoiceNumber || "—"}</td><td className="py-2">{item.customerName || "Customer"}</td><td className="py-2 text-muted-foreground">{item.dueDate ? formatDate(item.dueDate) : "No due date"}</td><td className={`py-2 ${Number(item.daysOverdue ?? 0) > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{item.agingBucket || (Number(item.daysOverdue ?? 0) > 0 ? `${item.daysOverdue} days overdue` : "Current")}</td><td className="py-2 text-right font-semibold">{formatCurrency(Number(item.balance ?? 0))}</td></tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-muted-foreground">No outstanding receivables.</p>}</CardContent></Card>
            </>
          ) : <p className="text-sm text-muted-foreground">Receivables data is unavailable.</p>}
        </TabsContent>

        <TabsContent value="tax" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-primary">Finance operations</p><h2 className="mt-1 text-lg font-semibold">Tax summary</h2><p className="text-sm text-muted-foreground">Paid sales summarized for a selected filing period.</p></div><div className="flex items-end gap-2"><div><Label className="text-xs">From</Label><Input type="date" className="h-8 text-sm" value={taxFrom} onChange={e => setTaxFrom(e.target.value)} /></div><div><Label className="text-xs">To</Label><Input type="date" className="h-8 text-sm" value={taxTo} onChange={e => setTaxTo(e.target.value)} /></div></div></div>
          {loadingTax ? <Skeleton className="h-44 w-full" /> : taxSummary ? <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Paid sales · {formatDate(taxSummary.dateFrom)} — {formatDate(taxSummary.dateTo)}</CardTitle></CardHeader><CardContent><div className="grid gap-5 sm:grid-cols-4"><SummaryCard title="Invoices" value={String(taxSummary.invoiceCount)} icon={FileSpreadsheet} /><SummaryCard title="Subtotal" value={formatCurrency(taxSummary.subtotal)} icon={DollarSign} /><SummaryCard title="Tax collected" value={formatCurrency(taxSummary.tax)} icon={ReceiptText} /><SummaryCard title="Total" value={formatCurrency(taxSummary.total)} icon={Landmark} /></div><p className="mt-5 text-xs text-muted-foreground">This summary reflects paid sales returned by the finance service. Keep the reconciliation CSV with your filing records.</p></CardContent></Card> : <p className="text-sm text-muted-foreground">Tax summary is unavailable.</p>}
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Revenue by Category</CardTitle></CardHeader>
              <CardContent>
                {!revenueByCategory ? <Skeleton className="h-48 w-full" /> : revenueByCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data yet — create sales to see category breakdown.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={revenueByCategory} cx="50%" cy="50%" outerRadius={70} dataKey="revenue" paddingAngle={3}>
                          {revenueByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {revenueByCategory.map((cat, i) => (
                        <div key={cat.category} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span>{cat.category}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{cat.percentage}%</span>
                            <span className="font-medium">{formatCurrency(cat.revenue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 10 Products & Services</CardTitle></CardHeader>
              <CardContent>
                {!topProducts ? <Skeleton className="h-48 w-full" /> : topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No sales data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {topProducts.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-4 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{item.name}</span>
                            <span className="font-semibold ml-2 shrink-0">{formatCurrency(item.totalRevenue)}</span>
                          </div>
                          <div className="bg-muted rounded-full h-1.5 mt-1">
                            <div className="bg-primary rounded-full h-1.5" style={{ width: `${(item.totalRevenue / (topProducts[0]?.totalRevenue || 1)) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
