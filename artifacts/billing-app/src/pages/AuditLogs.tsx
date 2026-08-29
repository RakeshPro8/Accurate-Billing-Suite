import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface AuditLog {
  id: number; employeeName?: string | null; storeId?: number | null; action: string;
  entityType: string; entityId?: string | null; details?: Record<string, unknown> | null; createdAt: string;
}
const API = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const query = new URLSearchParams({ limit: "200" });
    if (action !== "all") query.set("action", action);
    if (entityType !== "all") query.set("entityType", entityType);
    try {
      const response = await fetch(`${API}/audit-logs?${query}`, { credentials: "include" });
      if (response.ok) setLogs(await response.json());
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [action, entityType]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Audit trail</h1><p className="text-sm text-muted-foreground mt-0.5">Privacy-safe activity history attributed to signed-in employees.</p></div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <Select value={action} onValueChange={setAction}><SelectTrigger className="w-[170px]" aria-label="Filter by action"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All actions</SelectItem>{["create", "update", "delete", "print", "payment", "status_change", "store", "login", "logout"].map((item) => <SelectItem key={item} value={item}>{item.replace("_", " ")}</SelectItem>)}</SelectContent></Select>
          <Select value={entityType} onValueChange={setEntityType}><SelectTrigger className="w-[170px]" aria-label="Filter by record type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All record types</SelectItem>{["sale", "quotation", "repair", "customer", "product", "service", "employee", "settings", "store", "backup"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          <Input className="w-full sm:w-[220px]" placeholder="Filters update automatically" disabled aria-label="Audit privacy notice" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> {logs.length} events</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-6 text-sm text-muted-foreground">Loading audit events…</div> : logs.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No matching events.</div> : <div className="divide-y">{logs.map((log) => <div key={log.id} className="p-4 flex flex-wrap items-center gap-3 text-sm"><Badge variant="outline">{log.action.replace("_", " ")}</Badge><span className="font-medium">{log.entityType}{log.entityId ? ` #${log.entityId}` : ""}</span><span className="text-muted-foreground">by {log.employeeName ?? "system"}</span><span className="text-muted-foreground ml-auto">{formatDate(log.createdAt)}</span></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}