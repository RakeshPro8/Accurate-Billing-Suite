import { useGetDashboardSummary, useGetTopProducts, useGetRevenueByCategory } from "@workspace/api-client-react";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Clock, FileText } from "lucide-react";
import { Link } from "wouter";

const COLORS = ["#0d9488","#3b82f6","#a855f7","#f59e0b","#ef4444","#10b981"];

function StatCard({ title, value, icon: Icon, trend, trendValue, link }: {
  title: string; value: string; icon: React.ElementType;
  trend?: "up" | "down"; trendValue?: string; link?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
            {trend && trendValue && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${trend === "up" ? "text-emerald-600" : "text-red-500"}`}>
                {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trendValue} vs last week
              </p>
            )}
          </div>
          <div className="bg-primary/10 rounded-lg p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        {link && (
          <Link href={link}>
            <span className="text-xs text-primary hover:underline mt-2 inline-block">View all →</span>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: topProducts } = useGetTopProducts();
  const { data: revenueByCategory } = useGetRevenueByCategory();

  const weekTrend = summary
    ? summary.revenueLastWeek > 0
      ? ((summary.revenueThisWeek - summary.revenueLastWeek) / summary.revenueLastWeek * 100).toFixed(1)
      : null
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Business overview for this month</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard
              title="Revenue (MTD)" icon={DollarSign}
              value={formatCurrency(summary?.totalRevenueMtd ?? 0)}
              trend={weekTrend ? (parseFloat(weekTrend) >= 0 ? "up" : "down") : undefined}
              trendValue={weekTrend ? `${Math.abs(parseFloat(weekTrend))}%` : undefined}
            />
            <StatCard title="Sales (MTD)" icon={ShoppingCart} value={String(summary?.totalSalesMtd ?? 0)} link="/sales" />
            <StatCard title="Total Customers" icon={Users} value={String(summary?.totalCustomers ?? 0)} link="/customers" />
            <StatCard title="Pending Invoices" icon={Clock} value={String(summary?.pendingInvoices ?? 0)} link="/sales" />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Daily Revenue (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-52 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={summary?.dailyRevenue ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDateShort} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} width={50} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} labelFormatter={formatDateShort} />
                  <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Category Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {!revenueByCategory ? <Skeleton className="h-52 w-full" /> : (
              <div>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={revenueByCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="revenue" paddingAngle={3}>
                      {revenueByCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {revenueByCategory.map((cat, i) => (
                    <div key={cat.category} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground">{cat.category}</span>
                      </div>
                      <span className="font-medium">{cat.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Top Selling Items</CardTitle>
        </CardHeader>
        <CardContent>
          {!topProducts ? <Skeleton className="h-24 w-full" /> : topProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No sales yet. Create your first invoice to see stats here.</p>
              <Link href="/sales/new"><span className="text-primary text-sm hover:underline mt-1 inline-block">Create Invoice →</span></Link>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topProducts.slice(0, 6)} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} width={50} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Bar dataKey="totalRevenue" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
