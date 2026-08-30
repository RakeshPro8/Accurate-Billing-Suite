import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useParams } from "wouter";
import {
  getGetCustomerFinanceQueryKey,
  getGetCustomerShareLinksQueryKey,
  getExportCustomerDataQueryKey,
  useAnonymizeCustomer,
  useCreateCustomerShareLink,
  useCreateFinanceTransaction,
  useCreateNotificationEvent,
  useCreatePaymentSession,
  useExportCustomerData,
  useGetCustomerFinance,
  useGetCustomerShareLinks,
  useRevokeCustomerShareLink,
  useUpdateCustomerPreferences,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEmployee } from "@/context/EmployeeContext";
import { formatCurrency, formatDate, formatDateTime, getRepairStatusColor, getRepairStatusLabel, getStatusColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, Download, Edit, ExternalLink, FileText, Gift, Link2, LockKeyhole, Mail, MapPin, Phone, Plus, ShieldAlert, ShieldCheck, ShoppingBag, Trash2, Wrench } from "lucide-react";

type RecordMap = Record<string, any>;
const asRecord = (item: unknown) => (item && typeof item === "object" ? item as RecordMap : {});
const labelFor = (value: unknown, fallback = "—") => value === null || value === undefined || value === "" ? fallback : String(value);

export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeEmployee } = useEmployee();
  const finance = useGetCustomerFinance(id, { query: { enabled: Boolean(id), queryKey: getGetCustomerFinanceQueryKey(id) } });
  const linksQuery = useGetCustomerShareLinks({ customerId: id }, { query: { enabled: Boolean(id), queryKey: getGetCustomerShareLinksQueryKey({ customerId: id }) } });
  const preferences = useUpdateCustomerPreferences();
  const createTransaction = useCreateFinanceTransaction();
  const paymentSession = useCreatePaymentSession();
  const notificationEvent = useCreateNotificationEvent();
  const createLink = useCreateCustomerShareLink();
  const revokeLink = useRevokeCustomerShareLink();
  const anonymize = useAnonymizeCustomer();
  const privacyExport = useExportCustomerData(id, { query: { enabled: false, queryKey: getExportCustomerDataQueryKey(id) } });
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const [newLink, setNewLink] = useState<{ targetType: "sale" | "repair"; targetId: string; expiresInHours: string }>({ targetType: "repair", targetId: "", expiresInHours: "48" });
  const [payment, setPayment] = useState({ repairId: "", kind: "payment", amount: "", method: "cash", note: "" });
  const profile = finance.data;
  const customer = asRecord(profile?.customer);
  const repairs = useMemo(() => (profile?.repairs ?? []).map(asRecord), [profile?.repairs]);
  const sales = useMemo(() => (profile?.sales ?? []).map(asRecord), [profile?.sales]);
  const links = linksQuery.data ?? [];
  const targetOptions = useMemo(() => newLink.targetType === "repair" ? repairs.map(item => ({ id: Number(item.id), label: labelFor(item.ticketNumber, `Repair ${item.id}`) })) : sales.map(item => ({ id: Number(item.id), label: labelFor(item.invoiceNumber, `Invoice ${item.id}`) })), [newLink.targetType, repairs, sales]);
  const stats = profile?.stats ?? {};

  function refreshed() {
    queryClient.invalidateQueries({ queryKey: getGetCustomerFinanceQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetCustomerShareLinksQueryKey({ customerId: id }) });
  }
  function success(description: string) { toast({ title: "Updated", description }); refreshed(); }
  function fail(description: string) { toast({ title: "Could not complete action", description, variant: "destructive" }); }

  async function exportCustomerData() {
    try {
      const result = await privacyExport.refetch();
      if (!result.data) throw new Error("empty");
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `customer-privacy-export-${id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export ready", description: "The redacted customer record was downloaded." });
    } catch { fail("The privacy export could not be prepared."); }
  }

  if (finance.isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-full" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-72 w-full" /></div>;
  if (finance.isError || !profile) return <div className="py-20 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-amber-400" /><p className="mt-3 text-sm text-muted-foreground">Finance profile unavailable. Check the customer ID and try again.</p><Button className="mt-4" variant="outline" onClick={() => finance.refetch()}>Retry</Button></div>;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customers")} className="mt-1 h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          <div><p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Finance profile</p><h1 className="mt-1 text-2xl font-semibold">{labelFor(customer.name, "Customer")}</h1><p className="mt-1 text-sm text-muted-foreground">Customer since {customer.createdAt ? formatDate(customer.createdAt) : "—"} · Relationship view, not a CRM.</p></div>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/customers/${id}/edit`)}><Edit className="h-3.5 w-3.5" /> Edit customer</Button><Button variant="outline" size="sm" className="gap-1.5" onClick={exportCustomerData} disabled={privacyExport.isFetching}><Download className="h-3.5 w-3.5" /> {privacyExport.isFetching ? "Preparing…" : "Privacy export"}</Button></div>
      </div>

      {customer.anonymizedAt && <Alert className="border-amber-500/30 bg-amber-500/5"><ShieldCheck className="h-4 w-4 text-amber-400" /><AlertTitle>Customer anonymized</AlertTitle><AlertDescription>Contact data was anonymized on {formatDateTime(customer.anonymizedAt)}. Finance history remains available for reconciliation.</AlertDescription></Alert>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding" value={formatCurrency(Number(stats.outstanding ?? 0))} accent={Number(stats.outstanding ?? 0) > 0} icon={LockKeyhole} />
        <StatCard label="Collected" value={formatCurrency(Number(stats.collected ?? 0))} icon={Check} />
        <StatCard label="Invoiced" value={formatCurrency(Number(stats.invoiced ?? 0))} icon={FileText} />
        <StatCard label="Repairs / orders" value={`${stats.repairCount ?? repairs.length} / ${stats.orderCount ?? sales.length}`} icon={Wrench} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Phone className="h-4 w-4 text-primary" /> Contact & consent</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Contact label="Phone" value={customer.phone} icon={Phone} />
              <Contact label="Email" value={customer.email} icon={Mail} />
              <Contact label="Address" value={customer.address} icon={MapPin} />
            </div>
            {customer.notes && <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">{customer.notes}</div>}
            <div className="border-t border-border/60 pt-4">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-medium">Notification preferences</p><p className="text-xs text-muted-foreground">Consent is checked before every delivery.</p></div><Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> {labelFor(customer.consentSource, "Not recorded")}</Badge></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Consent label="Email" checked={Boolean(customer.emailConsent)} onChange={checked => preferences.mutate({ id, data: { emailConsent: checked, source: "customer-detail" } }, { onSuccess: () => success("Email preference saved."), onError: () => fail("Email preference was not saved.") })} />
                <Consent label="SMS" checked={Boolean(customer.smsConsent)} onChange={checked => preferences.mutate({ id, data: { smsConsent: checked, source: "customer-detail" } }, { onSuccess: () => success("SMS preference saved."), onError: () => fail("SMS preference was not saved.") })} />
                <Consent label="Marketing" checked={Boolean(customer.marketingConsent)} onChange={checked => preferences.mutate({ id, data: { marketingConsent: checked, source: "customer-detail" } }, { onSuccess: () => success("Marketing preference saved."), onError: () => fail("Marketing preference was not saved.") })} />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">Last reviewed {customer.consentReviewedAt ? formatDateTime(customer.consentReviewedAt) : "not yet"}.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                <span className="mr-1 text-xs text-muted-foreground">Customer actions</span>
                {sales[0]?.id && <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={notificationEvent.isPending} onClick={() => notificationEvent.mutate({ data: { customerId: id, saleId: Number(sales[0].id), event: "invoice", channel: "email" } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance/notifications"] }); toast({ title: "Notification queued", description: "The invoice message passed the consent check." }); }, onError: () => fail("The invoice notification was not queued.") })}><Mail className="h-3.5 w-3.5" /> Queue invoice email</Button>}
                {repairs[0]?.id && <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={notificationEvent.isPending} onClick={() => notificationEvent.mutate({ data: { customerId: id, repairId: Number(repairs[0].id), event: "repair-status", channel: "email" } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance/notifications"] }); toast({ title: "Notification queued", description: "The repair update passed the consent check." }); }, onError: () => fail("The repair notification was not queued.") })}><Wrench className="h-3.5 w-3.5" /> Queue repair update</Button>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Gift className="h-4 w-4 text-primary" /> Loyalty & referral</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/15 p-3"><span className="text-sm">Loyalty member</span><Badge variant={customer.isLoyaltyMember ? "default" : "outline"}>{customer.isLoyaltyMember ? "Active" : "Not enrolled"}</Badge></div>
            <div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-muted-foreground">Points</p><p className="mt-1 text-xl font-semibold">{Number(customer.loyaltyPoints ?? 0).toLocaleString()}</p></div><div><p className="text-xs text-muted-foreground">Discount</p><p className="mt-1 text-xl font-semibold">{Number(customer.loyaltyDiscountPct ?? 0)}%</p></div></div>
            <div className="border-t border-border/60 pt-3"><p className="text-xs text-muted-foreground">Referral code</p><p className="mt-1 font-mono text-sm">{labelFor(customer.referralCode, "No referral code")}</p></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ledger">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1"><TabsTrigger value="ledger">Ledger & timeline</TabsTrigger><TabsTrigger value="repairs">Repairs</TabsTrigger><TabsTrigger value="purchases">Purchases</TabsTrigger><TabsTrigger value="sharing">Customer access</TabsTrigger><TabsTrigger value="privacy">Privacy controls</TabsTrigger></TabsList>
        <TabsContent value="ledger" className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle className="text-base">Finance ledger</CardTitle><Button size="sm" className="gap-1.5" onClick={() => setTransactionOpen(true)}><Plus className="h-3.5 w-3.5" /> Record payment</Button></CardHeader><CardContent>{profile.transactions.length ? <div className="divide-y divide-border/60">{profile.transactions.map(transaction => <div key={transaction.id} className="flex items-center gap-3 py-3"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary"><Check className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium capitalize">{transaction.kind} <span className="text-muted-foreground">· {transaction.method}</span></p><p className="text-xs text-muted-foreground">{formatDateTime(transaction.createdAt)}{transaction.note ? ` · ${transaction.note}` : ""}</p></div><span className="font-mono text-sm text-emerald-400">+{formatCurrency(transaction.amount, transaction.currency || "USD")}</span></div>)}</div> : <Empty text="No finance transactions yet." />}</CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Relationship timeline</CardTitle></CardHeader><CardContent>{profile.timeline.length ? <div className="space-y-0">{profile.timeline.map((item, index) => { const row = asRecord(item); return <div key={index} className="relative flex gap-3 pb-5 last:pb-0"><div className="relative mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary after:absolute after:left-1 after:top-2 after:h-full after:w-px after:bg-border last:after:hidden" /><div><p className="text-sm">{labelFor(row.label, labelFor(row.action, labelFor(row.type, "Activity")))}</p><p className="text-xs text-muted-foreground">{row.createdAt ? formatDateTime(String(row.createdAt)) : "Recorded activity"}</p></div></div>; })}</div> : <Empty text="No timeline events yet." />}</CardContent></Card>
        </TabsContent>
        <TabsContent value="repairs" className="mt-4"><RecordTable records={repairs} type="repair" onShare={(record) => { setNewLink({ targetType: "repair", targetId: String(record.id), expiresInHours: "48" }); setShareOpen(true); }} /></TabsContent>
        <TabsContent value="purchases" className="mt-4"><RecordTable records={sales} type="sale" onShare={(record) => { setNewLink({ targetType: "sale", targetId: String(record.id), expiresInHours: "48" }); setShareOpen(true); }} /></TabsContent>
        <TabsContent value="sharing" className="mt-4"><ShareLinks links={links} onCreate={() => { setNewLink(v => ({ ...v, targetId: targetOptions[0] ? String(targetOptions[0].id) : "" })); setShareOpen(true); }} onRevoke={linkId => revokeLink.mutate({ id: linkId }, { onSuccess: () => success("Access link revoked."), onError: () => fail("Access link could not be revoked.") })} onPayment={linkId => paymentSession.mutate({ data: { linkId } }, { onSuccess: result => { const url = (result as { url?: string; checkoutUrl?: string } | null)?.url || (result as { url?: string; checkoutUrl?: string } | null)?.checkoutUrl; if (url) window.location.assign(url); else toast({ title: "Payment session checked", description: "The payment provider response is ready for the staff workflow." }); }, onError: () => fail("Online payment is unavailable until a provider is enabled.") })} /></TabsContent>
        <TabsContent value="privacy" className="mt-4"><Card className="border-amber-500/20"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-amber-400" /> Data subject controls</CardTitle></CardHeader><CardContent className="space-y-4"><p className="max-w-2xl text-sm text-muted-foreground">Export a redacted record for a customer request, or anonymize contact data while preserving financial history required for reconciliation.</p><div className="flex flex-wrap gap-2"><Button variant="outline" className="gap-2" onClick={exportCustomerData}><Download className="h-4 w-4" /> Download redacted export</Button>{activeEmployee?.role === "admin" && <Button variant="destructive" className="gap-2" onClick={() => setAnonymizeOpen(true)} disabled={Boolean(customer.anonymizedAt)}><Trash2 className="h-4 w-4" /> Anonymize contact data</Button>}</div></CardContent></Card></TabsContent>
      </Tabs>

      <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}><DialogContent><DialogHeader><DialogTitle>Record finance transaction</DialogTitle><DialogDescription>Post a payment, deposit, credit, or adjustment to a repair balance.</DialogDescription></DialogHeader><div className="space-y-3"><Field label="Repair"><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={payment.repairId} onChange={e => setPayment(v => ({ ...v, repairId: e.target.value }))}><option value="">Select repair</option>{repairs.map(row => <option key={row.id} value={row.id}>{labelFor(row.ticketNumber, `Repair ${row.id}`)}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Kind"><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={payment.kind} onChange={e => setPayment(v => ({ ...v, kind: e.target.value }))}><option value="payment">Payment</option><option value="deposit">Deposit</option><option value="credit">Credit</option><option value="refund">Refund</option><option value="adjustment">Adjustment</option></select></Field><Field label="Amount"><Input type="number" min="0.01" step="0.01" value={payment.amount} onChange={e => setPayment(v => ({ ...v, amount: e.target.value }))} /></Field></div><Field label="Method"><Input value={payment.method} onChange={e => setPayment(v => ({ ...v, method: e.target.value }))} placeholder="cash, card, transfer" /></Field><Field label="Note"><Textarea rows={2} value={payment.note} onChange={e => setPayment(v => ({ ...v, note: e.target.value }))} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setTransactionOpen(false)}>Cancel</Button><Button disabled={!payment.repairId || Number(payment.amount) <= 0 || createTransaction.isPending} onClick={() => createTransaction.mutate({ data: { repairId: Number(payment.repairId), customerId: id, kind: payment.kind as any, amount: Number(payment.amount), method: payment.method, note: payment.note || undefined } }, { onSuccess: () => { setTransactionOpen(false); setPayment(v => ({ ...v, amount: "", note: "" })); success("Transaction recorded."); }, onError: () => fail("Transaction was not recorded.") })}>Post transaction</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={shareOpen} onOpenChange={setShareOpen}><DialogContent><DialogHeader><DialogTitle>Create customer access link</DialogTitle><DialogDescription>Share only the selected invoice or repair view. Links expire automatically.</DialogDescription></DialogHeader><div className="space-y-3"><Field label="View"><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newLink.targetType} onChange={e => setNewLink(v => ({ ...v, targetType: e.target.value as "sale" | "repair", targetId: "" }))}><option value="repair">Repair status</option><option value="sale">Invoice</option></select></Field><Field label="Record"><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={newLink.targetId} onChange={e => setNewLink(v => ({ ...v, targetId: e.target.value }))}><option value="">Select record</option>{targetOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field><Field label="Expires in hours"><Input type="number" min={1} max={168} value={newLink.expiresInHours} onChange={e => setNewLink(v => ({ ...v, expiresInHours: e.target.value }))} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setShareOpen(false)}>Cancel</Button><Button disabled={!newLink.targetId || createLink.isPending} onClick={() => createLink.mutate({ data: { targetType: newLink.targetType, targetId: Number(newLink.targetId), expiresInHours: Number(newLink.expiresInHours) } }, { onSuccess: result => { setShareOpen(false); navigator.clipboard?.writeText(`${window.location.origin}${result.path}`); toast({ title: "Link created", description: "The access URL was copied to your clipboard." }); refreshed(); }, onError: () => fail("Access link was not created.") })}>Create and copy link</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={anonymizeOpen} onOpenChange={setAnonymizeOpen}><DialogContent><DialogHeader><DialogTitle>Anonymize this customer?</DialogTitle><DialogDescription>This permanently removes contact details and keeps only the finance history needed for audit and reconciliation.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setAnonymizeOpen(false)}>Cancel</Button><Button variant="destructive" disabled={anonymize.isPending} onClick={() => anonymize.mutate({ id }, { onSuccess: () => { setAnonymizeOpen(false); success("Contact data anonymized."); }, onError: () => fail("Customer was not anonymized.") })}>Confirm anonymization</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent = false }: { label: string; value: string; icon: typeof Check; accent?: boolean }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className={`rounded-md p-2 ${accent ? "bg-amber-500/10 text-amber-400" : "bg-primary/10 text-primary"}`}><Icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-0.5 text-lg font-semibold ${accent ? "text-amber-300" : ""}`}>{value}</p></div></CardContent></Card>; }
function Contact({ label, value, icon: Icon }: { label: string; value?: unknown; icon: typeof Phone }) { return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-0.5 text-sm">{labelFor(value, "Not recorded")}</p></div></div>; }
function Consent({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="flex items-center justify-between rounded-md border bg-muted/10 px-3 py-2"><span className="text-xs">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>; }
function Empty({ text }: { text: string }) { return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>; }
function RecordTable({ records, type, onShare }: { records: RecordMap[]; type: "sale" | "repair"; onShare: (record: RecordMap) => void }) { const [, navigate] = useLocation(); return <Card><CardHeader className="pb-3"><CardTitle className="text-base">{type === "repair" ? "Repair history" : "Purchase history"}</CardTitle></CardHeader><CardContent>{records.length ? <div className="divide-y divide-border/60">{records.map(row => <div key={row.id} className="flex flex-wrap items-center gap-3 py-3"><div className={`rounded-md p-2 ${type === "repair" ? "bg-amber-500/10 text-amber-400" : "bg-primary/10 text-primary"}`}>{type === "repair" ? <Wrench className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}</div><div className="min-w-[150px] flex-1 cursor-pointer" onClick={() => navigate(`/${type === "repair" ? "repairs" : "sales"}/${row.id}`)}><p className="text-sm font-medium">{labelFor(row.ticketNumber, labelFor(row.invoiceNumber, `${type} ${row.id}`))}</p><p className="text-xs text-muted-foreground">{row.createdAt ? formatDate(String(row.createdAt)) : "—"}{row.deviceModel ? ` · ${row.deviceModel}` : ""}</p></div><Badge variant="outline" className={type === "repair" ? getRepairStatusColor(labelFor(row.status)) : getStatusColor(labelFor(row.status))}>{type === "repair" ? getRepairStatusLabel(labelFor(row.status)) : labelFor(row.status, "Recorded")}</Badge><span className="font-mono text-sm">{formatCurrency(Number(row.balance ?? row.total ?? 0))}</span><Button size="sm" variant="ghost" className="gap-1.5" onClick={() => onShare(row)}><Link2 className="h-3.5 w-3.5" /> Share</Button></div>)}</div> : <Empty text={type === "repair" ? "No repairs recorded." : "No purchases recorded."} />}</CardContent></Card>; }
function ShareLinks({ links, onCreate, onRevoke, onPayment }: { links: any[]; onCreate: () => void; onRevoke: (id: number) => void; onPayment: (id: number) => void }) { return <Card><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle className="text-base">Customer access links</CardTitle><p className="mt-1 text-xs text-muted-foreground">Tokens are never returned in the staff list after creation.</p></div><Button size="sm" className="gap-1.5" onClick={onCreate}><Plus className="h-3.5 w-3.5" /> New link</Button></CardHeader><CardContent>{links.length ? <div className="divide-y divide-border/60">{links.map(link => <div key={link.id} className="flex flex-wrap items-center gap-3 py-3"><Link2 className="h-4 w-4 text-primary" /><div className="min-w-[170px] flex-1"><p className="text-sm font-medium">{link.scope === "invoice" ? "Invoice view" : "Repair view"} <Badge variant="outline" className="ml-2 text-[10px]">{link.active ? "Active" : "Revoked"}</Badge></p><p className="text-xs text-muted-foreground">Expires {formatDateTime(link.expiresAt)} · {link.accessCount ?? 0} views</p></div>{link.active && link.scope === "invoice" && <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => onPayment(link.id)}><ExternalLink className="h-3.5 w-3.5" /> Check payment</Button>}{link.active && <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => window.confirm("Revoke this customer access link?") && onRevoke(link.id)}><Trash2 className="h-3.5 w-3.5" /> Revoke</Button>}</div>)}</div> : <Empty text="No customer links created." />}</CardContent></Card>; }