import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  getGetNotificationEventsQueryKey,
  getGetNotificationTemplatesQueryKey,
  useCreateNotificationTemplate,
  useGetNotificationEvents,
  useGetNotificationTemplates,
  useRetryNotificationEvent,
  useUpdateNotificationTemplate,
  type GetNotificationEventsParams,
  type NotificationEvent,
  type NotificationTemplate,
  type NotificationTemplateInput,
  type NotificationTemplateUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BellRing, CheckCircle2, ChevronDown, ChevronRight, Plus, RefreshCw, Save, XCircle } from "lucide-react";

const events = ["invoice", "estimate", "repair-status", "pickup", "payment", "reminder"] as const;
const channels = ["email", "sms"] as const;
const statuses = ["queued", "sent", "failed", "skipped"] as const;
type TemplateDraft = {
  event: string;
  channel: string;
  subject: string;
  body: string;
  enabled: boolean;
  maxRetries: string;
};

function apiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message.replace(/^HTTP \d+ [^:]*:\s*/, "") : fallback;
}

function validateTemplate(draft: TemplateDraft) {
  const errors: Partial<Record<keyof TemplateDraft, string>> = {};
  if (!events.includes(draft.event as typeof events[number])) errors.event = "Choose a supported event.";
  if (!channels.includes(draft.channel as typeof channels[number])) errors.channel = "Choose a supported channel.";
  if (!draft.body.trim()) errors.body = "Message body is required.";
  else if (draft.body.length > 5000) errors.body = "Message body must be 5000 characters or fewer.";
  if (draft.subject.length > 200) errors.subject = "Subject must be 200 characters or fewer.";
  const retries = Number(draft.maxRetries);
  if (!/^\d+$/.test(draft.maxRetries) || !Number.isInteger(retries) || retries < 0 || retries > 5) {
    errors.maxRetries = "Use a whole number from 0 to 5.";
  }
  return errors;
}

function templatePayload(draft: TemplateDraft): NotificationTemplateInput {
  return {
    event: draft.event as NotificationTemplateInput["event"],
    channel: draft.channel as NotificationTemplateInput["channel"],
    subject: draft.subject.trim(),
    body: draft.body.trim(),
    enabled: draft.enabled,
    maxRetries: Number(draft.maxRetries),
  };
}

function draftFromTemplate(template: NotificationTemplate): TemplateDraft {
  return {
    event: template.event,
    channel: template.channel,
    subject: template.subject ?? "",
    body: template.body,
    enabled: template.enabled !== false,
    maxRetries: String(template.maxRetries ?? 3),
  };
}

export function NotificationManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const templatesQuery = useGetNotificationTemplates();
  const createTemplate = useCreateNotificationTemplate();
  const [newTemplate, setNewTemplate] = useState<TemplateDraft>({
    event: "invoice",
    channel: "email",
    subject: "Your Mobilinq invoice",
    body: "Your invoice is ready.",
    enabled: true,
    maxRetries: "2",
  });
  const [createError, setCreateError] = useState<string | null>(null);

  function notify(message: string, error = false) {
    toast({ title: error ? "Action failed" : "Saved", description: message, variant: error ? "destructive" : "default" });
  }

  function create() {
    const errors = validateTemplate(newTemplate);
    if (Object.keys(errors).length) {
      setCreateError(Object.values(errors)[0] ?? "Check the template fields.");
      return;
    }
    setCreateError(null);
    createTemplate.mutate({ data: templatePayload(newTemplate) }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationTemplatesQueryKey() });
        setNewTemplate((current) => ({ ...current, body: "", subject: "" }));
        notify("Notification template created.");
      },
      onError: (error) => {
        const message = apiErrorMessage(error, "The template could not be created.");
        setCreateError(message);
        notify(message, true);
      },
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-primary" /> Notification templates</CardTitle>
          <p className="text-xs text-muted-foreground">Keep customer messages concise, consent-aware, and useful at the counter.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {templatesQuery.isLoading ? <Skeleton className="h-32 w-full" /> :
            templatesQuery.isError ? <RetryNotice message="Templates could not be loaded." onRetry={() => templatesQuery.refetch()} /> :
              templatesQuery.data?.length ? templatesQuery.data.map((template) => (
                <TemplateEditor key={template.id} template={template} onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: getGetNotificationTemplatesQueryKey() });
                }} notify={notify} />
              )) :
                <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">No templates yet. Add the first delivery message below.</p>}

          <div className="rounded-lg border border-dashed border-primary/25 bg-primary/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Plus className="h-4 w-4 text-primary" /> Add template</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Event" error={createError && !newTemplate.event ? createError : undefined}>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newTemplate.event} onChange={(e) => setNewTemplate((v) => ({ ...v, event: e.target.value }))}>
                  {events.map((event) => <option key={event} value={event}>{event}</option>)}
                </select>
              </Field>
              <Field label="Channel">
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newTemplate.channel} onChange={(e) => setNewTemplate((v) => ({ ...v, channel: e.target.value }))}>
                  {channels.map((channel) => <option key={channel} value={channel}>{channel.toUpperCase()}</option>)}
                </select>
              </Field>
              <Field label="Subject">
                <Input value={newTemplate.subject} maxLength={200} onChange={(e) => setNewTemplate((v) => ({ ...v, subject: e.target.value }))} />
              </Field>
              <Field label="Max retries">
                <Input type="number" min={0} max={5} step={1} value={newTemplate.maxRetries} onChange={(e) => setNewTemplate((v) => ({ ...v, maxRetries: e.target.value }))} />
              </Field>
              <Field label="Message body" className="sm:col-span-2">
                <Textarea value={newTemplate.body} maxLength={5000} onChange={(e) => setNewTemplate((v) => ({ ...v, body: e.target.value }))} rows={3} />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={newTemplate.enabled} onChange={(e) => setNewTemplate((v) => ({ ...v, enabled: e.target.checked }))} />
                Enabled
              </label>
            </div>
            {createError && <p className="mt-3 text-xs text-destructive" role="alert">{createError}</p>}
            <Button type="button" size="sm" className="mt-3 gap-2" onClick={create} disabled={createTemplate.isPending}>
              <Plus className="h-3.5 w-3.5" /> {createTemplate.isPending ? "Adding…" : "Add template"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeliveryEvents />
    </div>
  );
}

function TemplateEditor({
  template,
  onSaved,
  notify,
}: {
  template: NotificationTemplate;
  onSaved: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const updateTemplate = useUpdateNotificationTemplate();
  const [draft, setDraft] = useState(() => draftFromTemplate(template));
  const [errors, setErrors] = useState<Partial<Record<keyof TemplateDraft, string>>>({});
  const [saved, setSaved] = useState(false);
  const initial = draftFromTemplate(template);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  useEffect(() => {
    setDraft(draftFromTemplate(template));
    setErrors({});
    setSaved(false);
  }, [template]);

  function save() {
    const nextErrors = validateTemplate(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const data: NotificationTemplateUpdate = templatePayload(draft);
    updateTemplate.mutate({ id: template.id, data }, {
      onSuccess: () => {
        setSaved(true);
        onSaved();
        notify("Template updated.");
      },
      onError: (error) => notify(apiErrorMessage(error, "The template could not be updated."), true),
    });
  }

  return (
    <div className="rounded-md border bg-muted/10 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Edit notification template</p>
          <p className="text-xs text-muted-foreground">Choose when and how this message is delivered.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={draft.enabled} onChange={(e) => setDraft((v) => ({ ...v, enabled: e.target.checked }))} />
          Enabled
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Event" error={errors.event}>
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.event} onChange={(e) => setDraft((v) => ({ ...v, event: e.target.value }))}>
            {events.map((event) => <option key={event} value={event}>{event}</option>)}
          </select>
        </Field>
        <Field label="Channel" error={errors.channel}>
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.channel} onChange={(e) => setDraft((v) => ({ ...v, channel: e.target.value }))}>
            {channels.map((channel) => <option key={channel} value={channel}>{channel.toUpperCase()}</option>)}
          </select>
        </Field>
        <Field label="Subject" error={errors.subject}>
          <Input value={draft.subject} maxLength={200} onChange={(e) => setDraft((v) => ({ ...v, subject: e.target.value }))} />
        </Field>
        <Field label="Max retries" error={errors.maxRetries}>
          <Input type="number" min={0} max={5} step={1} value={draft.maxRetries} onChange={(e) => setDraft((v) => ({ ...v, maxRetries: e.target.value }))} />
        </Field>
        <Field label="Message body" className="sm:col-span-2" error={errors.body}>
          <Textarea rows={3} maxLength={5000} value={draft.body} onChange={(e) => setDraft((v) => ({ ...v, body: e.target.value }))} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" className="gap-2" onClick={save} disabled={updateTemplate.isPending || !dirty}>
          <Save className="h-3.5 w-3.5" /> {updateTemplate.isPending ? "Saving…" : "Save template"}
        </Button>
        {saved && <span className="flex items-center gap-1 text-xs text-emerald-400" role="status"><CheckCircle2 className="h-3.5 w-3.5" /> Applied</span>}
      </div>
    </div>
  );
}

function DeliveryEvents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const retryEvent = useRetryNotificationEvent();
  const [filters, setFilters] = useState({ status: "", event: "", channel: "" });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const params = useMemo<GetNotificationEventsParams>(() => ({
    status: filters.status ? filters.status as GetNotificationEventsParams["status"] : undefined,
    event: filters.event ? filters.event as GetNotificationEventsParams["event"] : undefined,
    channel: filters.channel ? filters.channel as GetNotificationEventsParams["channel"] : undefined,
  }), [filters]);
  const eventsQuery = useGetNotificationEvents(params);

  function retry(event: NotificationEvent) {
    setRetryingId(event.id);
    retryEvent.mutate({ id: event.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationEventsQueryKey() });
        toast({ title: "Delivery queued", description: "The failed notification will be attempted again." });
      },
      onError: (error) => toast({ title: "Retry unavailable", description: apiErrorMessage(error, "Retry could not be queued."), variant: "destructive" }),
      onSettled: () => setRetryingId(null),
    });
  }

  const rows = eventsQuery.data ?? [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Delivery events</CardTitle>
            <p className="text-xs text-muted-foreground">Read-only operational history. Destinations are masked; only eligible failed deliveries can be retried.</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => eventsQuery.refetch()} disabled={eventsQuery.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${eventsQuery.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3" aria-label="Delivery event filters">
          <FilterSelect label="Status" value={filters.status} onChange={(value) => setFilters((v) => ({ ...v, status: value }))} options={statuses} />
          <FilterSelect label="Event" value={filters.event} onChange={(value) => setFilters((v) => ({ ...v, event: value }))} options={events} />
          <FilterSelect label="Channel" value={filters.channel} onChange={(value) => setFilters((v) => ({ ...v, channel: value }))} options={channels} />
        </div>
        {eventsQuery.isLoading ? <Skeleton className="h-40 w-full" /> :
          eventsQuery.isError ? <RetryNotice message="Delivery events could not be loaded." onRetry={() => eventsQuery.refetch()} /> :
            rows.length ? <div className="divide-y divide-border/60">{rows.map((event) => {
              const isExpanded = expanded.has(event.id);
              return (
                <div key={event.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusIcon status={event.status} />
                    <button type="button" className="min-w-[130px] flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm" aria-expanded={isExpanded} onClick={() => setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(event.id)) next.delete(event.id); else next.add(event.id);
                      return next;
                    })}>
                      <p className="text-sm font-medium">{event.event} <span className="text-muted-foreground">via {event.channel}</span></p>
                      <p className="text-xs text-muted-foreground">{event.destinationMasked || "Destination withheld"} · {new Date(event.createdAt).toLocaleString()}</p>
                    </button>
                    <span className="font-mono text-xs text-muted-foreground">{event.attempts} attempt{event.attempts === 1 ? "" : "s"}</span>
                    {event.status === "failed" && <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => retry(event)} disabled={retryingId === event.id || retryEvent.isPending}><RefreshCw className={`h-3.5 w-3.5 ${retryingId === event.id ? "animate-spin" : ""}`} /> Retry</Button>}
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                  </div>
                  {isExpanded && <div className="ml-7 mt-3 grid gap-2 rounded-md border bg-muted/20 p-3 text-xs sm:grid-cols-2" role="region" aria-label={`Details for delivery ${event.id}`}>
                    <Detail label="Status" value={event.status} />
                    <Detail label="Attempts" value={String(event.attempts)} />
                    <Detail label="Created" value={new Date(event.createdAt).toLocaleString()} />
                    <Detail label="Sent" value={event.sentAt ? new Date(event.sentAt).toLocaleString() : "Not sent"} />
                    <Detail label="Destination" value={event.destinationMasked || "Withheld"} />
                    {event.nextRetryAt && <Detail label="Next retry" value={new Date(event.nextRetryAt).toLocaleString()} />}
                    {event.lastError && <div className="sm:col-span-2"><Detail label="Failure context" value={event.lastError} /></div>}
                  </div>}
                </div>
              );
            })}</div> :
              <p className="py-6 text-center text-sm text-muted-foreground">No delivery events match these filters.</p>}
      </CardContent>
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}><option value="">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="uppercase tracking-wide text-[10px] text-muted-foreground">{label}</p><p className="mt-0.5 break-words">{value}</p></div>;
}

function Field({ label, children, className = "", error }: { label: string; children: ReactNode; className?: string; error?: string }) {
  return <div className={`space-y-1.5 ${className}`}><Label className="text-xs">{label}</Label>{children}{error && <p className="text-xs text-destructive" role="alert">{error}</p>}</div>;
}

function StatusIcon({ status }: { status: string }) {
  return status === "sent" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-label="Sent" /> : status === "failed" ? <XCircle className="h-4 w-4 text-destructive" aria-label="Failed" /> : <RefreshCw className="h-4 w-4 text-amber-400" aria-label={status} />;
}

function RetryNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/5 p-4 text-sm"><span className="text-muted-foreground">{message}</span><Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button></div>;
}