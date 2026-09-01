import { useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetQuotation, useUpdateQuotation, useCreateSale,
  getGetQuotationQueryKey, getGetQuotationsQueryKey, getGetSalesQueryKey,
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
import { ArrowLeft, Printer, Download, ChevronDown, Check, Edit, FileText, RefreshCw, Receipt } from "lucide-react";

export default function QuotationDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quoteRef = useRef<HTMLDivElement>(null);

  const { data: quote, isLoading } = useGetQuotation(id, { query: { queryKey: getGetQuotationQueryKey(id) } });
  const { data: settings } = useGetSettings();
  const updateQuotation = useUpdateQuotation();
  const createSale = useCreateSale();

  function markStatus(status: string) {
    updateQuotation.mutate({ id, data: { status } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetQuotationsQueryKey() });
        toast({ title: `Marked as ${status}` });
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  function convertToInvoice() {
    if (!quote) return;
    createSale.mutate({
      data: {
        customerId: quote.customerId ?? undefined,
        customerName: quote.customerName ?? undefined,
        customerEmail: quote.customerEmail ?? undefined,
        status: "invoice",
        taxRate: quote.taxRate ?? 0,
        discount: quote.discount ?? 0,
        notes: quote.notes ?? undefined,
        items: (quote.items ?? []).map((i: any) => ({
          type: i.type, productId: i.productId, serviceId: i.serviceId,
          name: i.name, description: i.description ?? undefined,
          quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount ?? 0,
        })),
      }
    }, {
      onSuccess: (sale) => {
        queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() });
        markStatus("converted");
        toast({ title: "Converted to invoice!", description: sale.invoiceNumber });
        navigate(`/sales/${sale.id}`);
      },
      onError: () => toast({ title: "Failed to convert", variant: "destructive" }),
    });
  }

  function handlePrintQuote() {
    recordAuditEvent("print", "quotation", id);
    window.print();
  }

  function handlePrintReceipt() {
    recordAuditEvent("print", "quotation", id);
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
    if (!quoteRef.current) return;
    toast({ title: "Generating PDF…" });
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(quoteRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${quote?.quoteNumber ?? "quote"}.pdf`);
      toast({ title: "PDF downloaded!" });
    } catch {
      toast({ title: "PDF failed", variant: "destructive" });
    }
  }

  function handleCSV() {
    if (!quote) return;
    downloadCSV(
      `${quote.quoteNumber}.csv`,
      (quote.items ?? []).map((i: any) => [i.name, i.description ?? "", i.quantity, i.unitPrice, i.discount ?? 0, i.total]),
      ["Item", "Description", "Qty", "Unit Price", "Discount", "Total"]
    );
  }

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (!quote) return <div className="text-center py-16 text-muted-foreground">Quotation not found.</div>;

  const items = quote.items ?? [];
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
    quoteNumber: quote.quoteNumber,
    createdAt: quote.createdAt,
    customerName: quote.customerName ?? undefined,
    customerEmail: quote.customerEmail ?? undefined,
    status: quote.status,
    items: items.map((i: any) => ({
      name: i.name, description: i.description ?? undefined,
      quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount ?? 0, total: i.total,
    })),
    subtotal: quote.subtotal,
    taxRate: quote.taxRate ?? 0,
    tax: quote.tax ?? 0,
    discount: quote.discount ?? 0,
    total: quote.total,
    notes: quote.notes ?? undefined,
  };

  return (
    <div className="space-y-4">
      {/* Thermal receipt — hidden on screen, shown in receipt-mode print */}
      <div className="receipt-print-area" style={{ display: "none" }}>
        <ReceiptPrint data={receiptData} business={business} mode="receipt" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/quotations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{quote.quoteNumber}</h1>
            <p className="text-xs text-muted-foreground">{formatDate(quote.createdAt)}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ml-2 ${getStatusColor(quote.status)}`}>{quote.status}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handlePrintQuote} className="gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</Button>
          <Button size="sm" variant="outline" onClick={handlePrintReceipt} className="gap-1.5 border-teal-400 text-teal-700 hover:bg-teal-50">
            <Receipt className="h-3.5 w-3.5" /> Print Receipt (TSP100)
          </Button>
          <Button size="sm" variant="outline" onClick={handlePDF} className="gap-1.5"><Download className="h-3.5 w-3.5" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={handleCSV} className="gap-1.5"><FileText className="h-3.5 w-3.5" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/quotations/${id}/edit`)} className="gap-1.5"><Edit className="h-3.5 w-3.5" /> Edit</Button>
          <Button size="sm" variant="outline" onClick={convertToInvoice} disabled={createSale.isPending || quote.status === "converted"} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Convert to Invoice
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">Status <ChevronDown className="h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {["draft", "sent", "accepted", "expired", "converted"].map(s => (
                <DropdownMenuItem key={s} onClick={() => markStatus(s)} className="gap-2 capitalize">
                  {quote.status === s && <Check className="h-3.5 w-3.5" />}
                  <span className={quote.status === s ? "font-semibold" : ""}>{s}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* A4 Quotation — hidden in receipt-mode print via CSS */}
      <div ref={quoteRef} className="invoice-print-area">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="bg-[#1e3a5f] text-white p-8">
            <div className="flex items-start justify-between">
              <div>
                {settings?.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt="logo"
                    className="mb-3 max-h-16 max-w-[140px] object-contain brightness-0 invert"
                  />
                )}
                <div className="text-2xl font-bold mb-0.5">{settings?.businessName ?? "Your Business"}</div>
                {settings?.businessAddress && <div className="text-sm text-blue-200">{settings.businessAddress}</div>}
                {settings?.businessPhone && <div className="text-sm text-blue-200">{settings.businessPhone}</div>}
                {settings?.businessEmail && <div className="text-sm text-blue-200">{settings.businessEmail}</div>}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-300">QUOTATION</div>
                <div className="text-lg font-mono mt-1">{quote.quoteNumber}</div>
                <div className="text-sm text-blue-200 mt-1">Date: {formatDate(quote.createdAt)}</div>
                {quote.expiresAt && <div className="text-sm text-blue-200">Valid Until: {formatDate(quote.expiresAt)}</div>}
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-8">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Prepared For</div>
              <div className="font-semibold text-lg">{quote.customerName || "Customer"}</div>
              {quote.customerEmail && <div className="text-sm text-muted-foreground">{quote.customerEmail}</div>}
            </div>

            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b-2 border-[#1e3a5f]">
                  <th className="text-left py-2 font-semibold text-muted-foreground">Description</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground">Qty</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground">Unit Price</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground">Disc</th>
                  <th className="text-right py-2 font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium">{item.name}</div>
                      {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
                    </td>
                    <td className="py-2.5 text-right">{item.quantity}</td>
                    <td className="py-2.5 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2.5 text-right">{item.discount > 0 ? `-${formatCurrency(item.discount)}` : "—"}</td>
                    <td className="py-2.5 text-right font-semibold">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(quote.subtotal)}</span></div>
                {(quote.discount ?? 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{formatCurrency(quote.discount ?? 0)}</span></div>
                )}
                {(quote.taxRate ?? 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground"><span>{settings?.taxName ?? "Tax"} ({quote.taxRate}%)</span><span>{formatCurrency(quote.tax ?? 0)}</span></div>
                )}
                {quote.taxProvinceCode && <div className="flex justify-between text-xs text-muted-foreground"><span>Tax profile</span><span>{quote.taxProvinceCode} · captured</span></div>}
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2 text-[#1e3a5f]">
                  <span>TOTAL</span><span>{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>

            {(quote.notes || settings?.thankYouMessage) && (
              <div className="mt-8 pt-6 border-t text-sm text-muted-foreground">
                {quote.notes && <p className="mb-2"><span className="font-medium">Notes:</span> {quote.notes}</p>}
                {settings?.thankYouMessage && <p className="font-medium text-[#1e3a5f]">{settings.thankYouMessage}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
