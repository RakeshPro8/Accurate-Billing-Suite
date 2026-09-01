import { useMemo, useState } from "react";
import { ExternalLink, Megaphone, Search, Volume2, ShieldAlert, Save } from "lucide-react";
import {
  useGetCustomerRights,
  useUpdateCustomerRightsEntry,
  useRetireCustomerRightsEntry,
  getGetCustomerRightsQueryKey,
  type CustomerRightsEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEmployee } from "@/context/EmployeeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const provinces = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const topicLabels: Record<string, string> = {
  "authorization-estimates": "Authorization & estimates",
  diagnostics: "Diagnostics",
  "deposits-payment": "Deposits & payment",
  "parts-warranty": "Parts & warranty",
  "data-passwords": "Personal data & passwords",
  "abandoned-pickup": "Abandoned devices & pickup",
  receipts: "Receipts & records",
  complaints: "Complaints",
  escalation: "Escalation",
};

function statusVariant(entry: CustomerRightsEntry) {
  if (entry.stale) return "destructive" as const;
  return entry.reviewStatus === "published" ? "default" as const : "outline" as const;
}

export default function CustomerRights() {
  const { activeEmployee } = useEmployee();
  const isAdmin = activeEmployee?.role === "admin";
  const [province, setProvince] = useState("all");
  const [topic, setTopic] = useState("all");
  const [status, setStatus] = useState(isAdmin ? "published" : "published");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ title: "", summary: "", readAloudScript: "", sourceUrl: "", effectiveFrom: "", lastReviewedAt: "" });
  const queryClient = useQueryClient();
  const query = useGetCustomerRights({
    provinceCode: province === "all" ? undefined : province,
    topic: topic === "all" ? undefined : topic,
    status: isAdmin ? status as "draft" | "published" | "retired" : undefined,
  });
  const update = useUpdateCustomerRightsEntry();
  const retire = useRetireCustomerRightsEntry();
  const entries = useMemo(() => (query.data?.entries ?? []).filter((entry) => {
    const needle = search.trim().toLowerCase();
    return !needle || `${entry.title} ${entry.summary} ${entry.provinceCode}`.toLowerCase().includes(needle);
  }), [query.data?.entries, search]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getGetCustomerRightsQueryKey({ provinceCode: province === "all" ? undefined : province, topic: topic === "all" ? undefined : topic, status: isAdmin ? status as "draft" | "published" | "retired" : undefined }) });
  }

  function publish(entry: CustomerRightsEntry) {
    update.mutate({ id: entry.id, data: {
      provinceCode: entry.provinceCode, topic: entry.topic, title: entry.title, summary: entry.summary,
      readAloudScript: entry.readAloudScript, sourceUrl: entry.sourceUrl, effectiveFrom: entry.effectiveFrom,
      lastReviewedAt: new Date().toISOString().slice(0, 10), reviewStatus: "published",
    } }, { onSuccess: refresh });
  }

  function beginEdit(entry: CustomerRightsEntry) {
    setEditingId(entry.id);
    setDraft({ title: entry.title, summary: entry.summary, readAloudScript: entry.readAloudScript ?? "", sourceUrl: entry.sourceUrl, effectiveFrom: entry.effectiveFrom, lastReviewedAt: entry.lastReviewedAt });
  }

  function saveEdit(entry: CustomerRightsEntry) {
    update.mutate({ id: entry.id, data: {
      provinceCode: entry.provinceCode, topic: entry.topic, title: draft.title, summary: draft.summary,
      readAloudScript: draft.readAloudScript || null, sourceUrl: draft.sourceUrl, effectiveFrom: draft.effectiveFrom,
      lastReviewedAt: draft.lastReviewedAt, reviewStatus: entry.reviewStatus,
    } }, { onSuccess: () => { setEditingId(null); refresh(); } });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><Megaphone className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.2em]">Employee reference</span></div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Customer Rights Guide</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Calm, plain-language prompts for cellphone and tablet repair conversations. Use the official source and ask a manager when a question is outside the guide.</p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 py-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Internal compliance aid</Badge>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Not legal advice</AlertTitle>
        <AlertDescription>Do not present these cards as legal advice or promise an outcome. Guidance is only usable when marked published; confirm the official source and escalate uncertain questions.</AlertDescription>
      </Alert>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_180px_220px]">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the guide…" className="pl-9" /></div>
          <Select value={province} onValueChange={setProvince}><SelectTrigger><SelectValue placeholder="All jurisdictions" /></SelectTrigger><SelectContent><SelectItem value="all">All jurisdictions</SelectItem>{provinces.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select>
          <Select value={topic} onValueChange={setTopic}><SelectTrigger><SelectValue placeholder="All topics" /></SelectTrigger><SelectContent><SelectItem value="all">All topics</SelectItem>{Object.entries(topicLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        </CardContent>
      </Card>

      {isAdmin && <Card className="border-amber-500/30">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium">Content governance</p><p className="text-xs text-muted-foreground">Drafts are seeded for admin review. Employees only see published entries.</p></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="published">Published</SelectItem><SelectItem value="draft">Needs review</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent></Select>
        </CardContent>
      </Card>}

      {query.isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">Loading reviewed guidance…</p> : query.isError ? <Alert variant="destructive"><AlertTitle>Guide unavailable</AlertTitle><AlertDescription>There is no safe legal-content fallback. Reconnect or ask a manager for the approved source.</AlertDescription></Alert> : entries.length === 0 ? <Card><CardContent className="p-10 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No {isAdmin && status !== "published" ? status : "published"} guidance matches.</p><p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Review draft entries or adjust the filters. Nothing is invented or fetched from an unreviewed source." : "This jurisdiction or topic has no published guidance yet. Ask a manager rather than relying on an unreviewed claim."}</p></CardContent></Card> :
        <div className="grid gap-4 md:grid-cols-2">{entries.map((entry) => <Card key={entry.id} className={entry.stale ? "border-destructive/50" : ""}>
          <CardHeader className="space-y-3 pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base leading-snug">{entry.title}</CardTitle><Badge variant={statusVariant(entry)}>{entry.stale ? "Stale review" : entry.reviewStatus}</Badge></div><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">{entry.provinceCode}</Badge><span>{topicLabels[entry.topic] ?? entry.topic}</span></div></CardHeader>
           <CardContent className="space-y-4 text-sm">
             {isAdmin && editingId === entry.id ? <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
               <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Title" />
               <Textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="Plain-language summary" rows={3} />
               <Textarea value={draft.readAloudScript} onChange={(event) => setDraft({ ...draft, readAloudScript: event.target.value })} placeholder="Optional read-aloud script" rows={2} />
               <Input value={draft.sourceUrl} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} placeholder="Official source URL" />
               <div className="grid gap-2 sm:grid-cols-2"><Input type="date" value={draft.effectiveFrom} onChange={(event) => setDraft({ ...draft, effectiveFrom: event.target.value })} /><Input type="date" value={draft.lastReviewedAt} onChange={(event) => setDraft({ ...draft, lastReviewedAt: event.target.value })} /></div>
               <div className="flex gap-2"><Button size="sm" onClick={() => saveEdit(entry)} disabled={update.isPending}><Save className="mr-1.5 h-3.5 w-3.5" /> Save changes</Button><Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button></div>
             </div> : <><p>{entry.summary}</p>{entry.readAloudScript && <div className="rounded-md border border-primary/20 bg-primary/5 p-3"><p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary"><Volume2 className="h-3.5 w-3.5" /> Read-aloud option</p><p className="italic text-muted-foreground">“{entry.readAloudScript}”</p></div>}</>}
             <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground"><a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Official source <ExternalLink className="h-3 w-3" /></a><p>Effective {entry.effectiveFrom} · Last reviewed {entry.lastReviewedAt}</p><p>{entry.disclaimer}</p></div>
             {isAdmin && <div className="flex flex-wrap gap-2">{editingId !== entry.id && <Button size="sm" variant="outline" onClick={() => beginEdit(entry)}>Edit</Button>}<Button size="sm" className="gap-1.5" onClick={() => publish(entry)} disabled={update.isPending}><Save className="h-3.5 w-3.5" /> Mark reviewed & publish</Button>{entry.reviewStatus !== "retired" && <Button size="sm" variant="outline" onClick={() => retire.mutate({ id: entry.id }, { onSuccess: refresh })}>Retire</Button>}</div>}
          </CardContent>
        </Card>)}</div>}
      <p className="text-center text-xs text-muted-foreground">Read-only offline cache: {query.data?.offlineSafe ? "enabled for published guidance" : "not available"} · Retrieved {query.data?.retrievedAt ? new Date(query.data.retrievedAt).toLocaleString() : "not yet"}</p>
    </div>
  );
}