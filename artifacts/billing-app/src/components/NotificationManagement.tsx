import { useState } from "react";
import type { ReactNode } from "react";
import {
  getGetNotificationEventsQueryKey,
  getGetNotificationTemplatesQueryKey,
  useCreateNotificationTemplate,
  useGetNotificationEvents,
  useGetNotificationTemplates,
  useRetryNotificationEvent,
  useUpdateNotificationTemplate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BellRing, CheckCircle2, Plus, RefreshCw, Save, XCircle } from "lucide-react";

const events = ["invoice", "estimate", "repair-status", "pickup", "payment", "reminder"] as const;
const channels = ["email", "sms"] as const;

export function NotificationManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const templatesQuery = useGetNotificationTemplates();
  const eventsQuery = useGetNotificationEvents();
  const createTemplate = useCreateNotificationTemplate();
  const updateTemplate = useUpdateNotificationTemplate();
  const retryEvent = useRetryNotificationEvent();
  const [newTemplate, setNewTemplate] = useState({ event: "invoice", channel: "email", subject: "Your Mobilinq invoice", body: "Your invoice is ready.", enabled: true, maxRetries: 2 });

  function notify(message: string, error = false) {
    toast({ title: error ? "Action failed" : "Saved", description: message, variant: error ? "destructive" : "default" });
  }

  function create() {
    createTemplate.mutate({ data: newTemplate as never }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetNotificationTemplatesQueryKey() }); notify("Notification template created."); },
      onError: () => notify("The template could not be created.", true),
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-primary" /> Notification templates</CardTitle><p className="text-xs text-muted-foreground">Keep customer messages concise, consent-aware, and useful at the counter.</p></CardHeader>
        <CardContent className="space-y-4">
          {templatesQuery.isLoading ? <Skeleton className="h-32 w-full" /> : templatesQuery.isError ? <RetryNotice message="Templates could not be loaded." onRetry={() => templatesQuery.refetch()} /> : templatesQuery.data?.length ? templatesQuery.data.map(template => <TemplateEditor key={template.id} template={template} onSave={(data) => updateTemplate.mutate({ id: template.id, data }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetNotificationTemplatesQueryKey() }); notify("Template updated."); }, onError: () => notify("The template could not be updated.", true) })} saving={updateTemplate.isPending} />) : <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">No templates yet. Add the first delivery message below.</p>}
          <div className="rounded-lg border border-dashed border-primary/25 bg-primary/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Plus className="h-4 w-4 text-primary" /> Add template</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Event"><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newTemplate.event} onChange={e => setNewTemplate(v => ({ ...v, event: e.target.value }))}>{events.map(event => <option key={event}>{event}</option>)}</select></Field>
              <Field label="Channel"><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newTemplate.channel} onChange={e => setNewTemplate(v => ({ ...v, channel: e.target.value }))}>{channels.map(channel => <option key={channel}>{channel}</option>)}</select></Field>
              <Field label="Subject"><Input value={newTemplate.subject} onChange={e => setNewTemplate(v => ({ ...v, subject: e.target.value }))} /></Field>
              <Field label="Max retries"><Input type="number" min={0} max={5} value={newTemplate.maxRetries} onChange={e => setNewTemplate(v => ({ ...v, maxRetries: Number(e.target.value) }))} /></Field>
              <Field label="Message body" className="sm:col-span-2"><Textarea value={newTemplate.body} onChange={e => setNewTemplate(v => ({ ...v, body: e.target.value }))} rows={3} /></Field>
            </div>
            <Button type="button" size="sm" className="mt-3 gap-2" onClick={create} disabled={createTemplate.isPending || !newTemplate.body.trim()}><Plus className="h-3.5 w-3.5" /> Add template</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Delivery events</CardTitle><p className="text-xs text-muted-foreground">Operational visibility into recent customer notifications. Destinations are masked.</p></CardHeader>
        <CardContent>
          {eventsQuery.isLoading ? <Skeleton className="h-40 w-full" /> : eventsQuery.isError ? <RetryNotice message="Delivery events could not be loaded." onRetry={() => eventsQuery.refetch()} /> : eventsQuery.data?.length ? <div className="divide-y divide-border/60">{eventsQuery.data.slice(0, 20).map(event => <div key={event.id} className="flex flex-wrap items-center gap-3 py-3"><StatusIcon status={event.status} /><div className="min-w-[130px] flex-1"><p className="text-sm font-medium">{event.event} <span className="text-muted-foreground">via {event.channel}</span></p><p className="text-xs text-muted-foreground">{event.destinationMasked || "Destination withheld"} · {new Date(event.createdAt).toLocaleString()}</p></div><span className="font-mono text-xs text-muted-foreground">{event.attempts} attempt{event.attempts === 1 ? "" : "s"}</span>{event.status === "failed" && <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => retryEvent.mutate({ id: event.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetNotificationEventsQueryKey() }); notify("Delivery queued again."); }, onError: () => notify("Retry could not be queued.", true) })} disabled={retryEvent.isPending}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>}</div>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">No delivery events recorded.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateEditor({ template, onSave, saving }: { template: { id: number; event: string; channel: string; subject?: string; body: string; enabled?: boolean; maxRetries?: number }; onSave: (data: { subject?: string; body?: string; enabled?: boolean; maxRetries?: number }) => void; saving: boolean }) {
  const [draft, setDraft] = useState({ subject: template.subject || "", body: template.body, enabled: template.enabled !== false, maxRetries: template.maxRetries ?? 2 });
  return <div className="rounded-md border bg-muted/10 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><span className="text-sm font-medium">{template.event}</span><span className="ml-2 font-mono text-[11px] uppercase text-muted-foreground">{template.channel}</span></div><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="accent-primary" checked={draft.enabled} onChange={e => setDraft(v => ({ ...v, enabled: e.target.checked }))} /> Enabled</label></div><div className="grid gap-3 sm:grid-cols-[1fr_100px]"><Field label="Subject"><Input value={draft.subject} onChange={e => setDraft(v => ({ ...v, subject: e.target.value }))} /></Field><Field label="Retries"><Input type="number" min={0} max={5} value={draft.maxRetries} onChange={e => setDraft(v => ({ ...v, maxRetries: Number(e.target.value) }))} /></Field><Field label="Body" className="sm:col-span-2"><Textarea rows={2} value={draft.body} onChange={e => setDraft(v => ({ ...v, body: e.target.value }))} /></Field></div><Button type="button" size="sm" variant="outline" className="mt-3 gap-2" onClick={() => onSave(draft)} disabled={saving}><Save className="h-3.5 w-3.5" /> Save template</Button></div>;
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) { return <div className={`space-y-1.5 ${className}`}><Label className="text-xs">{label}</Label>{children}</div>; }
function StatusIcon({ status }: { status: string }) { return status === "sent" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : status === "failed" ? <XCircle className="h-4 w-4 text-destructive" /> : <RefreshCw className="h-4 w-4 text-amber-400" />; }
function RetryNotice({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/5 p-4 text-sm"><span className="text-muted-foreground">{message}</span><Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button></div>; }