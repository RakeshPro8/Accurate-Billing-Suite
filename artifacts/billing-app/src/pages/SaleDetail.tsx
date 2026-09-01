import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetSale, useUpdateSale, useRecordSalePayment, useVoidSale, useRefundSale,
  useDuplicateSale, useSendSaleEmail, getGetSaleQueryKey, getGetSalesQueryKey,
  useGetSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate, getStatusColor, downloadCSV } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReceiptPrint } from "@/components/ReceiptPrint";
import { recordAuditEvent } from "@/lib/audit-client";
import {
  ArrowLeft, Printer, Download, Edit, FileText, Receipt, Mail, Copy, RotateCcw,
  DollarSign, Clock, AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SaleDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const paymentKey = useRef(crypto.randomUUID());
  const refundKey = useRef(crypto.randomUUID());
  const voidKey = useRef(crypto.randomUUID());
  const duplicateKey = useRef(crypto.randomUUID());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [voidOpen, setVoidOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  const { data: sale, isLoading } = useGetSale(id, { query: { queryKey: getGetSaleQueryKey(id) } });
  const { data: settings } = useGetSettings();
  const updateSale = useUpdateSale();
  const payment = useRecordSalePayment({ request: { headers: { "Idempotency-Key": paymentKey.current } } });
  const voidMutation = useVoidSale({ request: { headers: { "Idempotency-Key": voidKey.current } } });
  const refundMutation = useRefundSale({ request: { headers: { "Idempotency-Key": refundKey.current } } });
  const duplicateMutation = useDuplicateSale({ request: { headers: { "Idempotency-Key": duplicateKey.current } } });
  const emailMutation = useSendSaleEmail();

  function markStatus(status: string) {
    updateSale.mutate({ id, data: { status } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSaleQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() });
        toast({ title: `Marked as ${status}` });
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  function refreshSale() {
    queryClient.invalidateQueries({ queryKey: getGetSaleQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() });
  }
  function recordPayment() {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Enter a valid payment amount", variant: "destructive" }); return;
    }
    payment.mutate({ id, data: { amount, method: paymentMethod, reference: paymentReference || undefined } }, {
      onSuccess: () => { refreshSale(); setPaymentAmount(""); setPaymentReference(""); toast({ title: "Payment recorded" }); },
      onError: (error: any) => toast({ title: error?.message ?? "Payment could not be recorded", variant: "destructive" }),
    });
  }
  function voidInvoice() {
    voidMutation.mutate({ id, data: { note } }, {
      onSuccess: () => { setVoidOpen(false); refreshSale(); toast({ title: "Invoice voided", description: "The invoice remains available in the audit trail." }); },
      onError: (error: any) => toast({ title: error?.message ?? "Invoice could not be voided", variant: "destructive" }),
    });
  }
  function refundInvoice() {
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) { toast({ title: "Enter a valid refund amount", variant: "destructive" }); return; }
    refundMutation.mutate({ id, data: { amount, method: refundMethod, note } }, {
      onSuccess: () => { setRefundOpen(false); refreshSale(); setRefundAmount(""); setNote(""); toast({ title: "Refund recorded" }); },
      onError: (error: any) => toast({ title: error?.message ?? "Refund could not be recorded", variant: "destructive" }),
    });
  }
  function duplicateInvoice() {
    duplicateMutation.mutate({ id }, { onSuccess: (copy) => { toast({ title: "Draft duplicated" }); navigate(`/sales/${copy.id}/edit`); }, onError: (error: any) => toast({ title: error?.message ?? "Could not duplicate invoice", variant: "destructive" }) });
  }
  function emailInvoice() {
    const recipient = sale?.customerEmail;
    if (!recipient) { toast({ title: "No customer email on this invoice", variant: "destructive" }); return; }
    emailMutation.mutate({ id, data: { to: recipient } }, { onSuccess: () => toast({ title: "Invoice email sent", description: recipient }), onError: (error: any) => toast({ title: error?.message ?? "Email could not be sent", variant: "destructive" }) });
  }

  function handlePrintInvoice() {
    recordAuditEvent("print", "sale", id);
    window.print();
  }

  function handlePrintReceipt() {
    recordAuditEvent("print", "sale", id);
    const style = document.createElement("style");
    style.id = "__receipt-page-size";
    style.textContent = "@page { size: 80mm auto; margin: 3mm 3mm 6mm; }";
    document.head.appendChild(style);
    document.body.classList.add("receipt-mode");
    setTimeout(() => {
      window.print();
      document.body.classList.remove("receipt-mode");
      document.getElementById("__receipt-page-size")?.remove();
    }, 100);
  }

  async function handlePDF() {
    if (!invoiceRef.current) return;
    toast({ title: "Generating PDF…" });
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${sale?.invoiceNumber ?? "invoice"}.pdf`);
      toast({ title: "PDF downloaded!" });
    } catch {
      toast({ title: "PDF failed", variant: "destructive" });
    }
  }

  function handleCSV() {
    if (!sale) return;
    downloadCSV(
      `${sale.invoiceNumber}.csv`,
      sale.items?.map(i => [i.name, i.description ?? "", i.quantity, i.unitPrice, i.discount ?? 0, i.total]) ?? [],
      ["Item", "Description", "Qty", "Unit Price", "Discount", "Total"]
    );
  }

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (!sale) return <div className="text-center py-16 text-muted-foreground">Invoice not found.</div>;

  const items = sale.items ?? [];
  const business = {
    businessName: settings?.businessName,
    businessAddress: settings?.businessAddress ?? undefined,
    businessPhone: settings?.businessPhone ?? undefined,
    businessEmail: settings?.businessEmail ?? undefined,
    logoUrl: settings?.logoUrl ?? undefined,
    thankYouMessage: settings?.thankYouMessage ?? undefined,
    invoiceFooter: settings?.invoiceFooter ?? undefined,
    gstRate: settings?.gstRate ?? 0,
    qstRate: settings?.qstRate ?? 0,
    taxName: settings?.taxName ?? "Tax",
    taxEnabled: settings?.taxEnabled !== false,
    currency: settings?.currency ?? "USD",
  };

  const receiptData = {
    invoiceNumber: sale.invoiceNumber,
    createdAt: sale.createdAt,
    customerName: sale.customerName ?? undefined,
    customerEmail: sale.customerEmail ?? undefined,
    paymentMethod: sale.paymentMethod ?? undefined,
    status: sale.status,
    items: items.map(i => ({
      name: i.name,
      description: i.description ?? undefined,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount ?? 0,
      total: i.total,
    })),
    subtotal: sale.subtotal,
    taxRate: sale.taxRate ?? 0,
    tax: sale.tax ?? 0,
    discount: sale.discount ?? 0,
    total: sale.total,
    notes: sale.notes ?? undefined,
  };

  return (
    <div className="space-y-4">
      {/* ── Thermal receipt area (hidden on screen, shown when body.receipt-mode + @media print) ── */}
      <div className="receipt-print-area" style={{ display: "none" }}>
        <ReceiptPrint data={receiptData} business={business} mode="receipt" />
      </div>

      {/* ── Toolbar (screen only) ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/sales")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{sale.invoiceNumber}</h1>
            <p className="text-xs text-muted-foreground">{formatDate(sale.createdAt)}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ml-2 ${getStatusColor(sale.status)}`}>{sale.status}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handlePrintInvoice} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print Invoice
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrintReceipt} className="gap-1.5 border-teal-400 text-teal-700 hover:bg-teal-50">
            <Receipt className="h-3.5 w-3.5" /> Print Receipt (TSP100)
          </Button>
          <Button size="sm" variant="outline" onClick={handlePDF} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handleCSV} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/sales/${id}/edit`)} className="gap-1.5">
            <Edit className="h-3.5 w-3.5" /> Edit
          </Button>
          {sale.customerEmail && <Button size="sm" variant="outline" onClick={emailInvoice} disabled={emailMutation.isPending} className="gap-1.5"><Mail className="h-3.5 w-3.5" /> {emailMutation.isPending ? "Sending…" : "Email"}</Button>}
          <Button size="sm" variant="outline" onClick={duplicateInvoice} disabled={duplicateMutation.isPending} className="gap-1.5"><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
          {sale.status !== "voided" && sale.status !== "refunded" && <Button size="sm" variant="outline" onClick={() => setVoidOpen(true)} className="gap-1.5 text-destructive"><RotateCcw className="h-3.5 w-3.5" /> Void</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 no-print">
        <Card className="lg:col-span-2"><CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3"><div><p className="font-semibold">Payment collection</p><p className="text-xs text-muted-foreground">Every payment is recorded separately; card details are never stored.</p></div><span className={`text-lg font-bold ${(sale.balance ?? 0) > 0 ? "text-amber-500" : "text-emerald-500"}`}>{(sale.balance ?? 0) > 0 ? `${formatCurrency(sale.balance ?? 0)} due` : "Paid in full"}</span></div>
          {(sale.balance ?? 0) > 0 && sale.status !== "voided" && sale.status !== "refunded" && <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><div className="col-span-2"><Label className="text-xs">Amount</Label><Input className="h-10" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder={(sale.balance ?? 0).toFixed(2)} /></div><div><Label className="text-xs">Method</Label><Input className="h-10" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} /></div><div className="flex items-end"><Button className="w-full h-10" onClick={recordPayment} disabled={payment.isPending}><DollarSign className="h-4 w-4 mr-1" /> Record</Button></div><div className="col-span-2 md:col-span-4"><Input className="h-9 text-xs" placeholder="Safe processor reference (optional)" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} /></div></div>}
        </CardContent></Card>
        <Card><CardContent className="p-4"><p className="font-semibold mb-2">Payment history</p>{sale.payments?.length ? <div className="space-y-2">{sale.payments.map((entry) => <div key={entry.id} className="flex justify-between text-sm"><span><span className={entry.kind === "refund" ? "text-destructive" : "text-emerald-600"}>{entry.kind === "refund" ? "Refund" : "Payment"}</span><span className="text-muted-foreground"> · {entry.method}</span><span className="block text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span></span><strong>{entry.kind === "refund" ? "-" : ""}{formatCurrency(entry.amount)}</strong></div>)}</div> : <p className="text-sm text-muted-foreground">No payments recorded yet.</p>}</CardContent></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 no-print">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 mb-3"><Clock className="h-4 w-4 text-muted-foreground" /><p className="font-semibold">Status timeline</p></div>{sale.events?.length ? <div className="space-y-3">{sale.events.map((event) => <div key={event.id} className="border-l-2 border-primary/30 pl-3"><p className="text-sm font-medium capitalize">{event.action.replaceAll("_", " ")}{event.toStatus ? ` · ${event.toStatus}` : ""}</p><p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}{event.employeeName ? ` · ${event.employeeName}` : ""}</p>{event.note && <p className="text-xs mt-1">{event.note}</p>}</div>)}</div> : <p className="text-sm text-muted-foreground">No status events recorded.</p>}</CardContent></Card>
        <Card><CardContent className="p-4"><p className="font-semibold mb-2">Controlled actions</p><p className="text-xs text-muted-foreground mb-3">Voiding and refunding keep the invoice and audit history. They do not delete the sale.</p><div className="flex flex-wrap gap-2">{sale.status !== "voided" && sale.status !== "refunded" && <Button variant="outline" className="text-destructive" onClick={() => setVoidOpen(true)}><RotateCcw className="h-4 w-4 mr-1.5" /> Void invoice</Button>}{sale.status !== "voided" && (sale.payments?.some(p => p.kind === "payment") ?? false) && <Button variant="outline" onClick={() => setRefundOpen(true)}><DollarSign className="h-4 w-4 mr-1.5" /> Refund</Button>}</div></CardContent></Card>
      </div>

      {/* ── A4 Invoice — hidden in receipt mode via CSS ── */}
      <div ref={invoiceRef} className="invoice-print-area">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-[#0d4d47] text-white p-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-4 mb-3">
                  {settings?.logoUrl && (
                    <div className="bg-white rounded p-2">
                      <img
                        src={settings.logoUrl}
                        alt="logo"
                        className="max-h-14 max-w-[140px] object-contain"
                      />
                    </div>
                  )}
                  <div className="text-2xl font-bold mb-0.5">{settings?.businessName ?? "Mobilinq"}</div>
                </div>
                {settings?.businessAddress && <div className="text-sm text-teal-200">{settings.businessAddress}</div>}
                {settings?.businessPhone && <div className="text-sm text-teal-200">{settings.businessPhone}</div>}
                {settings?.businessEmail && <div className="text-sm text-teal-200">{settings.businessEmail}</div>}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-teal-300">INVOICE</div>
                <div className="text-lg font-mono mt-1">{sale.invoiceNumber}</div>
                <div className="text-sm text-teal-200 mt-1">Date: {formatDate(sale.createdAt)}</div>
                {sale.dueDate && <div className="text-sm text-teal-200">Due: {formatDate(sale.dueDate)}</div>}
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Bill To */}
            <div className="mb-8">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bill To</div>
              <div className="font-semibold text-lg">{sale.customerName || "Walk-in Customer"}</div>
              {sale.customerEmail && <div className="text-sm text-muted-foreground">{sale.customerEmail}</div>}
            </div>

            {/* Items Table */}
            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b-2 border-[#0d4d47]">
                  <th className="text-left py-2 font-semibold text-muted-foreground">Description</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground">Qty</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground">Unit Price</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground">Disc</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium">{item.name}</div>
                      {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
                    </td>
                    <td className="py-2.5 text-right">{item.quantity}</td>
                    <td className="py-2.5 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2.5 text-right">{(item.discount ?? 0) > 0 ? `-${formatCurrency(item.discount ?? 0)}` : "—"}</td>
                    <td className="py-2.5 text-right font-semibold">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span></div>
                {(sale.discount ?? 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{formatCurrency(sale.discount ?? 0)}</span></div>
                )}
                {(sale.taxRate ?? 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground"><span>{settings?.taxName ?? "Tax"} ({sale.taxRate ?? 0}%)</span><span>{formatCurrency(sale.tax ?? 0)}</span></div>
                )}
                {sale.taxProvinceCode && <div className="flex justify-between text-xs text-muted-foreground"><span>Tax profile</span><span>{sale.taxProvinceCode} · captured</span></div>}
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2 text-[#0d4d47]">
                  <span>TOTAL</span>
                  <span>{formatCurrency(sale.total)}</span>
                </div>
                {sale.paymentMethod && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Payment</span><span>{sale.paymentMethod}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            {(sale.notes || settings?.invoiceFooter || settings?.thankYouMessage) && (
              <div className="mt-8 pt-6 border-t text-sm text-muted-foreground">
                {sale.notes && <p className="mb-2"><span className="font-medium">Notes:</span> {sale.notes}</p>}
                {settings?.thankYouMessage && <p className="font-medium text-[#0d4d47]">{settings.thankYouMessage}</p>}
                {settings?.invoiceFooter && <p className="text-xs mt-1">{settings.invoiceFooter}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TSP100 tip card (screen only) ── */}
      <Card className="no-print border-teal-200 bg-teal-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <Receipt className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-teal-800">Star TSP100 FuturePRNT tip</p>
            <p className="text-teal-700 mt-0.5 text-xs leading-relaxed">
              Click <strong>Print Receipt (TSP100)</strong> → browser print dialog opens → select <em>"Star TSP100 Cutter"</em> as the printer →
              set paper size to <em>80 mm × Auto / Receipt</em> → Margins: None → Print.
              Install the <strong>FuturePRNT driver</strong> from Star Micronics if the printer isn't listed.
            </p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Void this invoice?</AlertDialogTitle><AlertDialogDescription>This keeps the invoice and its history for audit purposes. Posted inventory will be restored. This action requires manager permission and cannot be undone here.</AlertDialogDescription></AlertDialogHeader>
          <Textarea placeholder="Reason (optional)" value={note} onChange={e => setNote(e.target.value)} />
          <AlertDialogFooter><AlertDialogCancel>Keep invoice</AlertDialogCancel><AlertDialogAction onClick={voidInvoice} disabled={voidMutation.isPending} className="bg-destructive hover:bg-destructive/90">{voidMutation.isPending ? "Voiding…" : "Void invoice"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={refundOpen} onOpenChange={setRefundOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Record a refund</AlertDialogTitle><AlertDialogDescription>Refunds are recorded against captured payments. A full refund restores tracked inventory and marks the invoice refunded.</AlertDialogDescription></AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3"><div><Label className="text-xs">Amount</Label><Input type="number" min="0.01" step="0.01" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder={(sale.balance ? Math.max(0, sale.total - sale.balance) : sale.total).toFixed(2)} /></div><div><Label className="text-xs">Method</Label><Input value={refundMethod} onChange={e => setRefundMethod(e.target.value)} /></div></div>
          <Textarea placeholder="Reason (optional)" value={note} onChange={e => setNote(e.target.value)} />
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={refundInvoice} disabled={refundMutation.isPending}>{refundMutation.isPending ? "Recording…" : "Record refund"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
