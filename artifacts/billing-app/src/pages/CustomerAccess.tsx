import { useParams } from "wouter";
import { useGetPublicCustomerAccess, useCreatePublicPaymentSession } from "@workspace/api-client-react";
import { formatCurrency, formatDate, getRepairStatusLabel } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowUpRight, Clock3, FileText, ShieldCheck, Wrench } from "lucide-react";

function value(record: Record<string, unknown> | undefined, key: string, fallback = "") {
  const result = record?.[key];
  return result === null || result === undefined ? fallback : String(result);
}

export default function CustomerAccess() {
  const { token = "" } = useParams<{ token: string }>();
  const { data: view, isLoading, isError } = useGetPublicCustomerAccess(token, {
    query: { enabled: Boolean(token), queryKey: ["/api/public/customer-access", token] },
  });
  const payment = useCreatePublicPaymentSession();
  const invoice = view?.invoice as Record<string, unknown> | undefined;
  const repair = view?.repair as Record<string, unknown> | undefined;
  const expired = view ? new Date(view.expiresAt).getTime() <= Date.now() : false;

  if (isLoading) {
    return <main className="min-h-[100dvh] bg-background px-4 py-10 sm:px-6"><div className="mx-auto max-w-xl space-y-4"><Skeleton className="h-9 w-44" /><Skeleton className="h-56 w-full" /><Skeleton className="h-32 w-full" /></div></main>;
  }

  if (isError || !view || expired) {
    return (
      <main className="min-h-[100dvh] bg-background px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl">
          <BrandMark />
          <Card className="mt-12 border-amber-500/30">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <h1 className="text-xl font-semibold">{isError ? "This link is unavailable" : "This link has expired"}</h1>
              <p className="text-sm text-muted-foreground">Ask the repair shop to create a new customer access link. No staff workspace data is available here.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const canPay = view.scope === "invoice" && Boolean(invoice);
  const total = Number(invoice?.total ?? invoice?.amount ?? 0);
  const balance = Number(invoice?.balance ?? invoice?.outstanding ?? 0);
  const providerMessage = view.paymentProvider?.message || "Online payment is unavailable until a payment provider is enabled.";

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl">
        <BrandMark />
        <div className="mt-10 space-y-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">Customer access</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Hello, {view.customer.name || "there"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">A secure, limited view shared by your repair shop.</p>
          </div>

          <Alert className="border-primary/25 bg-primary/5">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <AlertTitle>Privacy-first access</AlertTitle>
            <AlertDescription>This page only shows the invoice or repair status selected by the shop. Internal notes and staff details stay private.</AlertDescription>
          </Alert>

          {view.scope === "invoice" && invoice ? (
            <Card className="border-primary/25">
              <CardHeader className="border-b border-border/70">
                <div className="flex items-start justify-between gap-3">
                  <div><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Invoice</CardTitle><p className="mt-1 font-mono text-xs text-muted-foreground">{value(invoice, "invoiceNumber", "Invoice")}</p></div>
                  <Badge variant="outline">{value(invoice, "status", "Open")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="Total" value={formatCurrency(total)} />
                  <Metric label="Balance due" value={formatCurrency(balance)} emphasis={balance > 0} />
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  <span>Issued {value(invoice, "createdAt") ? formatDate(value(invoice, "createdAt")) : "—"}</span>
                  <span>Due {value(invoice, "dueDate") ? formatDate(value(invoice, "dueDate")) : "On receipt"}</span>
                </div>
                <Alert className="border-amber-500/25 bg-amber-500/5">
                  <Clock3 className="h-4 w-4 text-amber-400" />
                  <AlertDescription>Online payment is unavailable until a payment provider is enabled. {providerMessage}</AlertDescription>
                </Alert>
                <Button className="w-full gap-2" disabled={!canPay || balance <= 0 || payment.isPending} onClick={() => payment.mutate({ token }, { onSuccess: result => { const url = (result as { url?: string; checkoutUrl?: string } | null)?.url || (result as { url?: string; checkoutUrl?: string } | null)?.checkoutUrl; if (url) window.location.assign(url); }, onError: () => undefined })}>
                  <ArrowUpRight className="h-4 w-4" /> {payment.isPending ? "Checking payment options…" : "Pay online"}
                </Button>
                {payment.isError && <p className="text-center text-xs text-amber-400">{providerMessage}</p>}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/25">
              <CardHeader className="border-b border-border/70"><CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" /> Repair status</CardTitle></CardHeader>
              <CardContent className="space-y-5 p-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Device</p>
                  <p className="mt-1 text-lg font-medium">{value(repair, "deviceModel", value(repair, "deviceType", "Your device"))}</p>
                  <p className="font-mono text-xs text-muted-foreground">{value(repair, "ticketNumber", "Repair ticket")}</p>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-4">
                  <span className="text-sm text-muted-foreground">Current status</span>
                  <Badge variant="outline">{getRepairStatusLabel(value(repair, "status", "in_progress"))}</Badge>
                </div>
                {Number(repair?.balance ?? 0) > 0 && <Metric label="Balance due at pickup" value={formatCurrency(Number(repair?.balance))} emphasis />}
                <p className="text-xs text-muted-foreground">This status is current as of the last update. Contact the shop directly if you need help with your repair.</p>
              </CardContent>
            </Card>
          )}

          <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Link expires {formatDate(view.expiresAt)}.</p>
        </div>
      </div>
    </main>
  );
}

function BrandMark() {
  return <div className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">M</span> Mobilinq</div>;
}

function Metric({ label, value: amount, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-semibold ${emphasis ? "text-primary" : ""}`}>{amount}</p></div>;
}