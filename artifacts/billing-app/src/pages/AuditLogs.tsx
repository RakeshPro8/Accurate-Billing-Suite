import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, RefreshCw, Search, CalendarDays, MapPin, UserRound, SlidersHorizontal } from "lucide-react";
import { getGetAuditLogsQueryKey, getGetCurrentStoreQueryKey, useGetAuditLogs, useGetCurrentStore, useGetStores, type AuditLog, type GetAuditLogsParams } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

type FilterState = { storeId: string; entityType: string; action: string; actor: string; dateFrom: string; dateTo: string };

const actions = ["create", "update", "delete", "login", "logout", "print", "payment", "store", "authentication", "convert", "status_change"];
const entities = ["tax_profile", "guidance_entry", "sale", "quotation", "repair", "repair_photo", "customer", "product", "service", "employee", "settings", "store", "backup"];
const emptyFilters: FilterState = { storeId: "current", entityType: "all", action: "all", actor: "", dateFrom: "", dateTo: "" };

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function detailSummary(details: Record<string, unknown> | null | undefined) {
  if (!details) return "Recorded change";
  const parts: string[] = [];
  if (Array.isArray(details.fields) && details.fields.length > 0) parts.push(`Fields: ${details.fields.join(", ")}`);
  if (typeof details.action === "string") parts.push(labelize(details.action));
  if (typeof details.topic === "string") parts.push(labelize(details.topic));
  if (typeof details.provinceCode === "string") parts.push(details.provinceCode);
  if (typeof details.reviewStatus === "string") parts.push(`Status: ${labelize(details.reviewStatus)}`);
  if (typeof details.effectiveFrom === "string") parts.push(`Effective ${details.effectiveFrom}`);
  return parts.length > 0 ? parts.join(" · ") : "Recorded change";
}

export default function AuditLogs() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [applied, setApplied] = useState<FilterState>(emptyFilters);
  const queryClient = useQueryClient();
  const { data: stores = [], isLoading: storesLoading } = useGetStores();
  const { data: currentStore, isLoading: currentStoreLoading } = useGetCurrentStore();
  const storeId = applied.storeId === "current" ? currentStore?.storeId ?? undefined : Number(applied.storeId);
  const params: GetAuditLogsParams = {
    storeId,
    action: applied.action === "all" ? undefined : applied.action as GetAuditLogsParams["action"],
    entityType: applied.entityType === "all" ? undefined : applied.entityType as GetAuditLogsParams["entityType"],
    actor: applied.actor.trim() || undefined,
    dateFrom: applied.dateFrom || undefined,
    dateTo: applied.dateTo || undefined,
    limit: 200,
  };
  const query = useGetAuditLogs(params, { query: { enabled: Boolean(storeId), queryKey: getGetAuditLogsQueryKey(params) } });
  const logs: AuditLog[] = query.data ?? [];
  const selectedStoreName = useMemo(() => {
    if (applied.storeId === "current") return currentStore?.store?.name ?? "current location";
    return stores.find((store) => String(store.id) === applied.storeId)?.name ?? "selected location";
  }, [applied.storeId, currentStore?.store?.name, stores]);
  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const applyFilters = () => setApplied({ ...filters });
  const clearFilters = () => { setFilters(emptyFilters); setApplied(emptyFilters); };
  useEffect(() => {
    const onStoreChanged = () => {
      void queryClient.invalidateQueries({ queryKey: getGetCurrentStoreQueryKey() });
    };
    window.addEventListener("mobilinq:store-changed", onStoreChanged);
    return () => window.removeEventListener("mobilinq:store-changed", onStoreChanged);
  }, [queryClient]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="mb-2 flex items-center gap-2 text-primary"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.2em]">Compliance review</span></div><h1 className="text-2xl font-bold">Audit trail</h1><p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">Review tax-profile and customer-rights changes by location, actor, action, and date. Only privacy-safe change context is shown.</p></div>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching || !storeId} className="gap-2"><RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh</Button>
      </div>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5"><Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location</Label><Select value={filters.storeId} onValueChange={(value) => setFilter("storeId", value)}><SelectTrigger aria-label="Filter by store" disabled={storesLoading || currentStoreLoading}><SelectValue placeholder="Location" /></SelectTrigger><SelectContent><SelectItem value="current">Current location ({currentStore?.store?.name ?? "selected"})</SelectItem>{stores.map((store) => <SelectItem key={store.id} value={String(store.id)}>{store.name}{store.active ? "" : " (inactive)"}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Entity type</Label><Select value={filters.entityType} onValueChange={(value) => setFilter("entityType", value)}><SelectTrigger aria-label="Filter by entity type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All record types</SelectItem>{entities.map((item) => <SelectItem key={item} value={item}>{labelize(item)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Action</Label><Select value={filters.action} onValueChange={(value) => setFilter("action", value)}><SelectTrigger aria-label="Filter by action"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All actions</SelectItem>{actions.map((item) => <SelectItem key={item} value={item}>{labelize(item)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Actor</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={filters.actor} onChange={(event) => setFilter("actor", event.target.value)} placeholder="Name or employee ID" aria-label="Filter by actor" /></div></div>
            <div className="space-y-1.5"><Label className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> From date</Label><Input type="date" value={filters.dateFrom} onChange={(event) => setFilter("dateFrom", event.target.value)} aria-label="Filter from date" /></div>
            <div className="space-y-1.5"><Label className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> To date</Label><Input type="date" value={filters.dateTo} onChange={(event) => setFilter("dateTo", event.target.value)} aria-label="Filter to date" /></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><p className="text-xs text-muted-foreground">Filters apply to the selected location and never show PINs, credentials, or customer contact data.</p><div className="flex gap-2"><Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear</Button><Button type="button" size="sm" onClick={applyFilters} className="gap-1.5"><Search className="h-3.5 w-3.5" /> Apply filters</Button></div></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> {query.isLoading ? "Loading events…" : `${logs.length} event${logs.length === 1 ? "" : "s"}`}<span className="ml-auto text-xs font-normal text-muted-foreground">{selectedStoreName}</span></CardTitle></CardHeader>
        <CardContent className="p-0">
          {query.isLoading || currentStoreLoading ? <div className="p-6 text-sm text-muted-foreground">Loading audit events for {selectedStoreName}…</div> : query.isError ? <div role="alert" className="flex items-center justify-between gap-3 p-6 text-sm"><span className="text-destructive">Audit history is unavailable right now. Reconnect and try again.</span><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button></div> : !storeId ? <div className="p-8 text-center text-sm text-muted-foreground">Select an active location before reviewing audit events.</div> : logs.length === 0 ? <div className="p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No matching audit events</p><p className="mt-1 text-sm text-muted-foreground">Try another location or widen the date and action filters.</p></div> : <div className="divide-y">{logs.map((log) => <div key={log.id} className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-start sm:gap-4"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2"><Badge variant="outline">{labelize(log.action)}</Badge><span className="font-medium">{labelize(log.entityType)}{log.entityId ? ` #${log.entityId}` : ""}</span><span className="text-muted-foreground">by {log.employeeName ?? "system"}</span><p className="basis-full text-xs text-muted-foreground">{detailSummary(log.details as Record<string, unknown> | null)}</p></div><time className="shrink-0 text-xs text-muted-foreground sm:text-right" dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}