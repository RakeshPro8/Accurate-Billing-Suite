import { useEffect, useMemo, useState } from "react";
import { Clock3, ExternalLink, ListChecks, Megaphone, Search, ShieldAlert, Save, Volume2 } from "lucide-react";
import {
  getGetCustomerRightsQueryKey,
  type CustomerRightsEntry,
  useGetCustomerRights,
  useRetireCustomerRightsEntry,
  useUpdateCustomerRightsEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEmployee } from "@/context/EmployeeContext";
import { useLocale } from "@/context/LocaleContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const provinces = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const provinceLabels: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador",
  NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island",
  QC: "Quebec", SK: "Saskatchewan", YT: "Yukon",
};
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

type Draft = {
  title: string;
  summary: string;
  readAloudScript: string;
  sourceUrl: string;
  effectiveFrom: string;
  lastReviewedAt: string;
  steps: string;
  doText: string;
  avoid: string;
  escalation: string;
};

function draftFromEntry(entry: CustomerRightsEntry): Draft {
  return {
    title: entry.title,
    summary: entry.summary,
    readAloudScript: entry.readAloudScript ?? "",
    sourceUrl: entry.sourceUrl,
    effectiveFrom: entry.effectiveFrom,
    lastReviewedAt: entry.lastReviewedAt,
    steps: entry.infographic.steps.join("\n"),
    doText: entry.infographic.do.join("\n"),
    avoid: entry.infographic.avoid.join("\n"),
    escalation: entry.infographic.escalation,
  };
}

function infographicFromDraft(draft: Draft) {
  return {
    steps: draft.steps.split("\n").map((line) => line.trim()).filter(Boolean),
    do: draft.doText.split("\n").map((line) => line.trim()).filter(Boolean),
    avoid: draft.avoid.split("\n").map((line) => line.trim()).filter(Boolean),
    escalation: draft.escalation.trim(),
  };
}

export default function CustomerRights() {
  const { activeEmployee } = useEmployee();
  const { locale, t, formatDate } = useLocale();
  const isAdmin = activeEmployee?.role === "admin";
  const [province, setProvince] = useState("all");
  const [topic, setTopic] = useState("all");
  const [status, setStatus] = useState("published");
  const [search, setSearch] = useState("");
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const queryClient = useQueryClient();
  const query = useGetCustomerRights({
    provinceCode: province === "all" ? undefined : province,
    topic: topic === "all" ? undefined : topic,
    language: locale,
    status: isAdmin ? status as "draft" | "published" | "retired" : undefined,
  });
  const publishedReviewQuery = useGetCustomerRights(
    { language: locale, status: "published" },
    { query: { queryKey: getGetCustomerRightsQueryKey({ language: locale, status: "published" }), enabled: isAdmin } },
  );
  const draftReviewQuery = useGetCustomerRights(
    { language: locale, status: "draft" },
    { query: { queryKey: getGetCustomerRightsQueryKey({ language: locale, status: "draft" }), enabled: isAdmin } },
  );
  const update = useUpdateCustomerRightsEntry();
  const retire = useRetireCustomerRightsEntry();
  const entries = useMemo(() => (query.data?.entries ?? []).filter((entry) => {
    const needle = search.trim().toLowerCase();
    return !needle || `${entry.title} ${entry.summary} ${entry.provinceCode} ${topicLabels[entry.topic] ?? entry.topic}`.toLowerCase().includes(needle);
  }), [query.data?.entries, search]);
  const reviewQueue = useMemo(() => {
    const byId = new Map<number, CustomerRightsEntry>();
    for (const entry of [...(publishedReviewQuery.data?.entries ?? []), ...(draftReviewQuery.data?.entries ?? [])]) {
      byId.set(entry.id, entry);
    }
    return [...byId.values()]
      .filter((entry) => entry.reviewStatus === "draft" || entry.reviewReminder !== "current")
      .sort((a, b) => {
        const priority = (entry: CustomerRightsEntry) => entry.reviewStatus === "draft" ? -2 : entry.reviewReminder === "overdue" ? -1 : 0;
        return priority(a) - priority(b) || (a.reviewDaysRemaining ?? Number.MIN_SAFE_INTEGER) - (b.reviewDaysRemaining ?? Number.MIN_SAFE_INTEGER);
      });
  }, [draftReviewQuery.data?.entries, publishedReviewQuery.data?.entries]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: getGetCustomerRightsQueryKey({
        provinceCode: province === "all" ? undefined : province,
        topic: topic === "all" ? undefined : topic,
        language: locale,
        status: isAdmin ? status as "draft" | "published" | "retired" : undefined,
      }),
    });
  }

  function payload(entry: CustomerRightsEntry, values: Draft, reviewStatus: "draft" | "published" | "retired") {
    return {
      provinceCode: entry.provinceCode,
      topic: entry.topic,
      language: entry.language,
      title: values.title,
      summary: values.summary,
      readAloudScript: values.readAloudScript || null,
      infographic: infographicFromDraft(values),
      sourceUrl: values.sourceUrl,
      effectiveFrom: values.effectiveFrom,
      lastReviewedAt: values.lastReviewedAt,
      reviewStatus,
    };
  }

  function publish(entry: CustomerRightsEntry) {
    update.mutate({
      id: entry.id,
      data: {
        ...payload(entry, draft && editingId === entry.id ? draft : draftFromEntry(entry), "published"),
        lastReviewedAt: new Date().toISOString().slice(0, 10),
      },
    }, { onSuccess: refresh });
  }

  function saveEdit(entry: CustomerRightsEntry) {
    if (!draft) return;
    update.mutate({ id: entry.id, data: payload(entry, draft, entry.reviewStatus) }, {
      onSuccess: () => { setEditingId(null); setDraft(null); refresh(); },
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><Megaphone className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.2em]">{t("Employee reference")}</span></div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("Customer Rights Guide")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("Calm, plain-language prompts for cellphone and tablet repair conversations. Use the official source and ask a manager when a question is outside the guide.")}</p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 py-1.5"><ShieldAlert className="h-3.5 w-3.5" /> {t("Internal compliance aid")} · {locale === "fr" ? "Français" : "English"}</Badge>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>{t("Not legal advice")}</AlertTitle>
        <AlertDescription>{t("Do not present these cards as legal advice or promise an outcome. Guidance is only usable when marked published; confirm the official source and escalate uncertain questions.")}</AlertDescription>
      </Alert>
      {!isOnline && <Alert className="border-amber-500/40 bg-amber-500/10"><ShieldAlert className="h-4 w-4 text-amber-400" /><AlertTitle>{t("Offline read-only mode")}</AlertTitle><AlertDescription>{t("Showing the last cached published guide. Do not rely on a stale entry for a new legal or payment question; reconnect or ask a manager.")}</AlertDescription></Alert>}

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_200px_220px]">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search the guide…")} className="pl-9" /></div>
          <Select value={province} onValueChange={setProvince}><SelectTrigger aria-label={t("Filter by jurisdiction")}><SelectValue placeholder={t("All jurisdictions")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("All jurisdictions")}</SelectItem>{provinces.map((code) => <SelectItem key={code} value={code}>{code} · {provinceLabels[code]}</SelectItem>)}</SelectContent></Select>
          <Select value={topic} onValueChange={setTopic}><SelectTrigger aria-label={t("Filter by topic")}><SelectValue placeholder={t("All topics")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("All topics")}</SelectItem>{Object.entries(topicLabels).map(([value, label]) => <SelectItem key={value} value={value}>{t(label)}</SelectItem>)}</SelectContent></Select>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span className="rounded-full border bg-muted/30 px-2.5 py-1">{province === "all" ? t("All jurisdictions") : `${province} · ${provinceLabels[province]}`}</span>
        <span className="rounded-full border bg-muted/30 px-2.5 py-1">{topic === "all" ? t("All topics") : t(topicLabels[topic])}</span>
        <span className="rounded-full border bg-muted/30 px-2.5 py-1">{locale === "fr" ? "Français" : "English"}</span>
        <span>{entries.length} {t("published")} {entries.length === 1 ? t("entry") : t("entries")}</span>
      </div>

      {isAdmin && <Card className="border-amber-500/30">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium">{t("Content governance")}</p><p className="text-xs text-muted-foreground">{t("Admins can review, edit, publish, or retire entries. Employees only see published entries.")}</p></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="published">{t("Published")}</SelectItem><SelectItem value="draft">{t("Needs review")}</SelectItem><SelectItem value="retired">{t("Retired")}</SelectItem></SelectContent></Select>
        </CardContent>
      </Card>}

      {isAdmin && <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4 text-primary" /> {t("Review ownership queue")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("Managers own this review queue. It is a reminder only: entries are never published or changed automatically.")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {publishedReviewQuery.isLoading || draftReviewQuery.isLoading ? <p className="text-sm text-muted-foreground">{t("Checking review dates…")}</p> : reviewQueue.length === 0 ? <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">{t("No entries need attention for this language.")}</div> :
            <div className="space-y-2">{reviewQueue.slice(0, 8).map((entry) => {
              const reason = entry.reviewStatus === "draft"
                ? t("Draft needs manager review before it can be published.")
                : entry.reviewReminder === "overdue"
                  ? t("The annual review window has passed. Recheck the official source.")
                  : `${t("Review due")} ${formatDate(entry.reviewDueAt)}.`;
              return <div key={entry.id} className="flex flex-col gap-3 rounded-md border bg-background/70 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5"><Badge variant={entry.reviewReminder === "overdue" ? "destructive" : "outline"}>{entry.provinceCode} · {provinceLabels[entry.provinceCode]}</Badge><Badge variant="outline">{t(topicLabels[entry.topic] ?? entry.topic)}</Badge><Badge variant="outline">{entry.language === "fr" ? "Français" : "English"}</Badge></div>
                  <p className="font-medium">{entry.title}</p>
                  <p className="text-xs text-muted-foreground">{reason} {t("Last reviewed")} {formatDate(entry.lastReviewedAt)}.</p>
                  <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3 shrink-0" /> {entry.sourceUrl}</a>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => { setStatus(entry.reviewStatus); setProvince(entry.provinceCode); setTopic(entry.topic); setSearch(""); }}>{t("Open entry")}</Button>
              </div>;
            })}</div>}
          {reviewQueue.length > 8 && <p className="text-xs text-muted-foreground">{t("Showing the first 8 items. Use the filters below for the complete queue.")}</p>}
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" /> {t("Reminder window: 30 days before the annual review date.")}</p>
        </CardContent>
      </Card>}

      {query.isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">{t("Loading reviewed guidance…")}</p> : query.isError ? <Alert variant="destructive"><AlertTitle>{t("Guide unavailable")}</AlertTitle><AlertDescription>{t("There is no safe legal-content fallback. Reconnect or ask a manager for the approved source.")}</AlertDescription></Alert> : entries.length === 0 ? <Card><CardContent className="p-10 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">{t("No guidance matches")}</p><p className="mt-1 text-sm text-muted-foreground">{isAdmin ? t("Review entries or adjust the filters. Nothing is invented or fetched from an unreviewed source.") : t("Ask a manager rather than relying on an unreviewed claim.")}</p></CardContent></Card> :
        <div className="grid gap-4 md:grid-cols-2">{entries.map((entry) => <Card key={entry.id} data-locale-ignore className={entry.stale ? "border-destructive/50" : ""}>
          <CardHeader className="space-y-3 pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base leading-snug">{entry.title}</CardTitle><Badge variant={statusVariant(entry)}>{entry.stale ? t("Stale review") : t(entry.reviewStatus)}</Badge></div><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">{entry.provinceCode} · {provinceLabels[entry.provinceCode]}</Badge><span>{t(topicLabels[entry.topic] ?? entry.topic)}</span></div></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {isAdmin && editingId === entry.id && draft ? <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={t("Title")} />
              <Textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder={t("Plain-language article")} rows={3} />
              <Textarea value={draft.readAloudScript} onChange={(event) => setDraft({ ...draft, readAloudScript: event.target.value })} placeholder={t("Read-aloud wording")} rows={2} />
              <Textarea value={draft.steps} onChange={(event) => setDraft({ ...draft, steps: event.target.value })} placeholder={t("Steps, one per line")} rows={3} />
              <div className="grid gap-2 sm:grid-cols-2"><Textarea value={draft.doText} onChange={(event) => setDraft({ ...draft, doText: event.target.value })} placeholder={t("Do, one per line")} rows={3} /><Textarea value={draft.avoid} onChange={(event) => setDraft({ ...draft, avoid: event.target.value })} placeholder={t("Avoid, one per line")} rows={3} /></div>
              <Textarea value={draft.escalation} onChange={(event) => setDraft({ ...draft, escalation: event.target.value })} placeholder={t("Manager escalation point")} rows={2} />
              <Input value={draft.sourceUrl} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} placeholder={t("Official source URL")} />
              <div className="grid gap-2 sm:grid-cols-2"><Input type="date" value={draft.effectiveFrom} onChange={(event) => setDraft({ ...draft, effectiveFrom: event.target.value })} /><Input type="date" value={draft.lastReviewedAt} onChange={(event) => setDraft({ ...draft, lastReviewedAt: event.target.value })} /></div>
              <div className="flex gap-2"><Button size="sm" onClick={() => saveEdit(entry)} disabled={update.isPending}><Save className="mr-1.5 h-3.5 w-3.5" /> {t("Save changes")}</Button><Button size="sm" variant="outline" onClick={() => { setEditingId(null); setDraft(null); }}>{t("Cancel")}</Button></div>
            </div> : <><p>{entry.summary}</p>{entry.readAloudScript && <div className="rounded-md border border-primary/20 bg-primary/5 p-3"><p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary"><Volume2 className="h-3.5 w-3.5" /> {t("Read-aloud option")}</p><p className="italic text-muted-foreground">“{entry.readAloudScript}”</p></div>}<Infographic entry={entry} t={t} /></>}
            <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground"><a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">{t("Official source")} <ExternalLink className="h-3 w-3" /></a><p>{t("Effective")} {formatDate(entry.effectiveFrom)} · {t("Last reviewed")} {formatDate(entry.lastReviewedAt)}</p><p>{entry.disclaimer}</p></div>
            {isAdmin && <div className="flex flex-wrap gap-2">{editingId !== entry.id && <Button size="sm" variant="outline" onClick={() => { setEditingId(entry.id); setDraft(draftFromEntry(entry)); }}>{t("Edit")}</Button>}<Button size="sm" className="gap-1.5" onClick={() => publish(entry)} disabled={update.isPending}><Save className="h-3.5 w-3.5" /> {t("Mark reviewed & publish")}</Button>{entry.reviewStatus !== "retired" && <Button size="sm" variant="outline" onClick={() => retire.mutate({ id: entry.id }, { onSuccess: refresh })}>{t("Retire")}</Button>}</div>}
          </CardContent>
        </Card>)}</div>}
      <p className="text-center text-xs text-muted-foreground">{t("Read-only offline cache")}: {query.data?.offlineSafe ? t("enabled for published guidance") : t("not available")} · {t("Retrieved")} {query.data?.retrievedAt ? formatDate(query.data.retrievedAt) : t("not yet")}</p>
    </div>
  );
}

function Infographic({ entry, t }: { entry: CustomerRightsEntry; t: (key: string) => string }) {
  return <section aria-labelledby={`at-a-glance-${entry.id}`} className="space-y-3 rounded-lg border bg-muted/20 p-3">
    <h3 id={`at-a-glance-${entry.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{t("At a glance")}</h3>
    <ol className="grid gap-2 sm:grid-cols-3">{entry.infographic.steps.map((step, index) => <li key={`${entry.id}-step-${index}`} className="flex gap-2 rounded-md border bg-background/70 p-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{index + 1}</span><span className="text-xs leading-relaxed">{step}</span></li>)}</ol>
    <div className="grid gap-3 sm:grid-cols-2">
      <GuidePanel title={t("Do")} items={entry.infographic.do} tone="positive" />
      <GuidePanel title={t("Avoid")} items={entry.infographic.avoid} tone="caution" />
    </div>
    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5"><p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-300">{t("Manager / escalation point")}</p><p className="text-xs leading-relaxed">{entry.infographic.escalation}</p></div>
    <p className="text-[11px] text-muted-foreground">{t("Instructional aid only; it does not make a legal determination.")}</p>
  </section>;
}

function GuidePanel({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "caution" }) {
  return <div className={`rounded-md border p-2.5 ${tone === "positive" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}><p className="mb-1 text-xs font-semibold">{title}</p><ul className="space-y-1 text-xs leading-relaxed">{items.map((item, index) => <li key={`${title}-${index}`} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{item}</span></li>)}</ul></div>;
}