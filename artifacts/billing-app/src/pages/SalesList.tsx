import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSalesQueryKey, useGetEmployees, useGetSales, useGetStores, voidSale,
} from "@workspace/api-client-react";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { useEmployee } from "@/context/EmployeeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye,
  Filter, Loader2, Plus, Receipt, RotateCcw, Search, WifiOff,
} from "lucide-react";

const STATUSES = ["all", "draft", "invoice", "paid", "voided", "refunded"];
const PAYMENT_METHODS = ["all", "Cash", "Credit Card", "Debit Card", "Bank Transfer", "Check", "Mobile Pay"];
type FilterState = { search: string; status: string; dateFrom: string; dateTo: string; employeeId: string; storeId: string; paymentMethod: string; outstanding: string; sort: string; direction: "asc" | "desc"; page: number };

function initialFilters(): FilterState {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  return {
    search: params.get("search") ?? "", status: params.get("status") ?? "all",
    dateFrom: params.get("dateFrom") ?? "", dateTo: params.get("dateTo") ?? "",
    employeeId: params.get("employeeId") ?? "all", storeId: params.get("storeId") ?? "all",
    paymentMethod: params.get("paymentMethod") ?? "all", outstanding: params.get("outstanding") ?? "all",
    sort: params.get("sort") ?? "createdAt", direction: params.get("direction") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
  };
}

export default function SalesList() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [querySearch, setQuerySearch] = useState(filters.search);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [voidOpen, setVoidOpen] = useState(false);
  const { activeEmployee } = useEmployee();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canVoid = activeEmployee?.role === "admin" || activeEmployee?.role === "manager";
  const { data: employees } = useGetEmployees({ query: { enabled: canVoid, queryKey: ["employees"] } });
  const { data: stores } = useGetStores();
  const queryParams = useMemo(() => ({
    search: querySearch || undefined, status: filters.status === "all" ? undefined : filters.status,
    dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined,
    employeeId: filters.employeeId === "all" ? undefined : Number(filters.employeeId),
    storeId: filters.storeId === "all" ? undefined : Number(filters.storeId),
    paymentMethod: filters.paymentMethod === "all" ? undefined : filters.paymentMethod,
    outstanding: filters.outstanding === "all" ? undefined : filters.outstanding === "yes",
    sort: filters.sort as any, direction: filters.direction as any, page: filters.page, limit: 25,
  }), [filters, querySearch]);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetSales(queryParams);
  const sales = data?.items ?? [];
  const totalPages = data?.pagination.totalPages ?? 0;
  const selectable = sales.filter((sale) => sale.status !== "voided" && sale.status !== "refunded");
  const allSelected = selectable.length > 0 && selectable.every((sale) => selected.has(sale.id));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuerySearch(filters.search);
      setFilters((current) => current.page === 1 ? current : { ...current, page: 1 });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [filters.search]);

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all" && !(key === "page" && value === 1)) params.set(key, String(value));
    });
    window.history.replaceState(null, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
    setSelected(new Set());
  }, [filters]);

  useEffect(() => {
    const refreshForStore = () => { void queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() }); };
    window.addEventListener("mobilinq:store-changed", refreshForStore);
    return () => window.removeEventListener("mobilinq:store-changed", refreshForStore);
  }, [queryClient]);

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "search" || key !== "page" ? { page: 1 } : {}) }));
  }
  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function confirmBulkVoid() {
    const ids = [...selected];
    setVoidOpen(false);
    try {
      await Promise.all(ids.map((id) => voidSale(id, { note: "Bulk void from sales workspace" }, { headers: { "Idempotency-Key": crypto.randomUUID() } })));
      toast({ title: `${ids.length} sale${ids.length === 1 ? "" : "s"} voided`, description: "Inventory was restored where tracked." });
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() });
    } catch (bulkError: any) {
      toast({ title: "Bulk action incomplete", description: bulkError?.message ?? "One or more sales could not be voided.", variant: "destructive" });
      await refetch();
    }
  }
  function sortBy(sort: string) {
    setFilters((current) => ({ ...current, sort, direction: current.sort === sort && current.direction === "desc" ? "asc" : "desc", page: 1 }));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Sales workspace</h1>
            {!navigator.onLine && <span className="inline-flex items-center gap-1 text-xs text-amber-500"><WifiOff className="h-3.5 w-3.5" /> Offline</span>}
          </div>
          <p className="text-muted-foreground text-sm">Find, collect, and reconcile every sale.</p>
        </div>
        <Link href="/sales/new"><Button size="sm" className="gap-1.5 min-h-10"><Plus className="h-4 w-4" /> New sale</Button></Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Summary title="Matching sales" value={String(data?.summary.count ?? 0)} detail="in current filter" />
        <Summary title="Gross total" value={formatCurrency(data?.summary.total ?? 0)} detail="historical invoice totals" />
        <Summary title="Outstanding" value={formatCurrency(data?.summary.outstanding ?? 0)} detail="still to collect" accent />
      </div>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search sales" className="pl-9 h-11" placeholder="Search invoice, customer, email, phone, SKU, or item…" value={filters.search} onChange={(event) => setFilter("search", event.target.value)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            <Select value={filters.status} onValueChange={(value) => setFilter("status", value)}><SelectTrigger className="h-10"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status === "all" ? "All statuses" : status}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.paymentMethod} onValueChange={(value) => setFilter("paymentMethod", value)}><SelectTrigger className="h-10"><SelectValue placeholder="Payment" /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((method) => <SelectItem key={method} value={method}>{method === "all" ? "All payments" : method}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.outstanding} onValueChange={(value) => setFilter("outstanding", value)}><SelectTrigger className="h-10"><SelectValue placeholder="Balance" /></SelectTrigger><SelectContent><SelectItem value="all">Any balance</SelectItem><SelectItem value="yes">Outstanding</SelectItem><SelectItem value="no">Paid in full</SelectItem></SelectContent></Select>
            <Select value={filters.employeeId} onValueChange={(value) => setFilter("employeeId", value)}><SelectTrigger className="h-10"><SelectValue placeholder="Employee" /></SelectTrigger><SelectContent><SelectItem value="all">All employees</SelectItem>{employees?.map((person) => <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.storeId} onValueChange={(value) => setFilter("storeId", value)}><SelectTrigger className="h-10"><SelectValue placeholder="Store" /></SelectTrigger><SelectContent><SelectItem value="all">All stores</SelectItem>{stores?.map((store) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}</SelectContent></Select>
            <Input aria-label="From date" type="date" className="h-10" value={filters.dateFrom} onChange={(event) => setFilter("dateFrom", event.target.value)} />
            <Input aria-label="To date" type="date" className="h-10" value={filters.dateTo} onChange={(event) => setFilter("dateTo", event.target.value)} />
            <Button variant="outline" className="h-10 gap-1.5" onClick={() => setFilters(initialFilters)}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
          </div>
        </CardContent>
      </Card>

      {canVoid && selected.size > 0 && <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2"><span className="text-sm font-medium">{selected.size} selected</span><Button variant="outline" size="sm" className="gap-1.5 min-h-10" onClick={() => setVoidOpen(true)}><RotateCcw className="h-3.5 w-3.5" /> Void selected</Button></div>}

      {isError ? <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Sales could not be loaded</AlertTitle><AlertDescription className="flex items-center justify-between gap-3"><span>{(error as any)?.message ?? "Check your connection and try again."}</span><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></AlertDescription></Alert> : isLoading ? <div className="space-y-2">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-lg" />)}</div> : !sales.length ? <Card><CardContent className="py-16 text-center"><Filter className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" /><p className="font-medium">No sales match these filters</p><p className="text-sm text-muted-foreground mt-1">Try a different search or create a new sale.</p><Link href="/sales/new"><Button className="mt-4" size="sm"><Plus className="h-4 w-4 mr-1.5" /> New sale</Button></Link></CardContent></Card> : (
        <>
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm" aria-label="Sales results"><thead className="bg-muted/50 border-b"><tr>
              <th className="p-3 w-10"><Checkbox aria-label="Select all visible sales" checked={allSelected} onCheckedChange={(checked) => setSelected(checked ? new Set(selectable.map((sale) => sale.id)) : new Set())} /></th>
              <SortHead label="Invoice" sort="invoiceNumber" active={filters.sort} direction={filters.direction} onSort={sortBy} /><SortHead label="Customer" sort="customerName" active={filters.sort} direction={filters.direction} onSort={sortBy} /><SortHead label="Date" sort="createdAt" active={filters.sort} direction={filters.direction} onSort={sortBy} /><th className="text-left p-3 font-medium text-muted-foreground">Status</th><th className="text-right p-3 font-medium text-muted-foreground">Balance</th><SortHead label="Total" sort="total" active={filters.sort} direction={filters.direction} onSort={sortBy} /><th className="p-3" /></tr></thead>
              <tbody className="divide-y">{sales.map((sale) => { const balance = sale.balance ?? 0; return <tr key={sale.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/sales/${sale.id}`)}><td className="p-3" onClick={(event) => event.stopPropagation()}><Checkbox aria-label={`Select ${sale.invoiceNumber}`} checked={selected.has(sale.id)} onCheckedChange={() => toggle(sale.id)} /></td><td className="p-3 font-mono text-xs font-medium">{sale.invoiceNumber}</td><td className="p-3 max-w-[180px] truncate">{sale.customerName || <span className="text-muted-foreground italic">Walk-in</span>}</td><td className="p-3 text-muted-foreground">{formatDate(sale.createdAt)}</td><td className="p-3"><Status status={sale.status} /></td><td className="p-3 text-right text-amber-500">{balance > 0 ? formatCurrency(balance) : "—"}</td><td className="p-3 text-right font-semibold">{formatCurrency(sale.total)}</td><td className="p-3" onClick={(event) => event.stopPropagation()}><Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`View ${sale.invoiceNumber}`} onClick={() => navigate(`/sales/${sale.id}`)}><Eye className="h-4 w-4" /></Button></td></tr>; })}</tbody></table>
          </div>
          <div className="md:hidden space-y-2">{sales.map((sale) => { const balance = sale.balance ?? 0; return <button key={sale.id} type="button" className="w-full text-left rounded-lg border bg-card p-4 min-h-28 hover:border-primary/50" onClick={() => navigate(`/sales/${sale.id}`)}><div className="flex items-start justify-between gap-3"><div><div className="font-mono text-xs font-semibold">{sale.invoiceNumber}</div><div className="font-medium mt-1">{sale.customerName || "Walk-in customer"}</div></div><Status status={sale.status} /></div><div className="flex items-end justify-between mt-3 text-xs text-muted-foreground"><span>{formatDate(sale.createdAt)}</span><span className="text-right"><strong className="text-foreground text-base">{formatCurrency(sale.total)}</strong>{balance > 0 && <em className="block not-italic text-amber-500">Due {formatCurrency(balance)}</em>}</span></div></button>; })}</div>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Page {data?.pagination.page ?? 1} of {Math.max(1, totalPages)} · {data?.pagination.total ?? 0} results</span><div className="flex gap-2"><Button variant="outline" size="sm" className="min-h-10" disabled={(data?.pagination.page ?? 1) <= 1 || isFetching} onClick={() => setFilter("page", Math.max(1, filters.page - 1))}><ChevronLeft className="h-4 w-4" /> Previous</Button><Button variant="outline" size="sm" className="min-h-10" disabled={filters.page >= totalPages || isFetching} onClick={() => setFilter("page", filters.page + 1)}>Next <ChevronRight className="h-4 w-4" /></Button></div>{isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}</div>
        </>
      )}
      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Void {selected.size} sale{selected.size === 1 ? "" : "s"}?</AlertDialogTitle><AlertDialogDescription>This keeps the invoices for audit purposes and restores tracked inventory. It cannot be undone from the sales workspace.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep sales</AlertDialogCancel><AlertDialogAction onClick={() => void confirmBulkVoid()} className="bg-destructive hover:bg-destructive/90">Void sales</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

function Summary({ title, value, detail, accent = false }: { title: string; value: string; detail: string; accent?: boolean }) { return <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p><p className={`text-xl font-bold mt-1 ${accent ? "text-amber-500" : ""}`}>{value}</p><p className="text-xs text-muted-foreground mt-1">{detail}</p></CardContent></Card>; }
function Status({ status }: { status: string }) { return <span className={`text-xs px-2 py-1 rounded-full capitalize font-medium ${getStatusColor(status)}`}>{status}</span>; }
function SortHead({ label, sort, active, direction, onSort }: { label: string; sort: string; active: string; direction: "asc" | "desc"; onSort: (sort: string) => void }) { return <th className="text-left p-3 font-medium text-muted-foreground"><button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(sort)}>{label}{active === sort && (direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button></th>; }