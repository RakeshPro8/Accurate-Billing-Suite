import { useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetSale, useUpdateSale, getGetSaleQueryKey, getGetSalesQueryKey,
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
  ArrowLeft, Printer, Download, ChevronDown, Check, Edit, FileText, Receipt
} from "lucide-react";

export default function SaleDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const { data: sale, isLoading } = useGetSale(id, { query: { queryKey: getGetSaleQueryKey(id) } });
  const { data: settings } = useGetSettings();
  const updateSale = useUpdateSale();

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">Status <ChevronDown className="h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {["draft", "invoice", "paid", "cancelled"].map(s => (
                <DropdownMenuItem key={s} onClick={() => markStatus(s)} className="gap-2 capitalize">
                  {sale.status === s && <Check className="h-3.5 w-3.5" />}
                  <span className={sale.status === s ? "font-semibold" : ""}>{s}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
    </div>
  );
}
