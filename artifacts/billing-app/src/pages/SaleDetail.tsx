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
import {
  ArrowLeft, Printer, Download, ChevronDown, Check, Edit, Mail, FileText
} from "lucide-react";

export default function SaleDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

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

  function handlePrint() {
    window.print();
  }

  async function handlePDF() {
    if (!printRef.current) return;
    toast({ title: "Generating PDF..." });
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
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
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</Button>
          <Button size="sm" variant="outline" onClick={handlePDF} className="gap-1.5"><Download className="h-3.5 w-3.5" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={handleCSV} className="gap-1.5"><FileText className="h-3.5 w-3.5" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/sales/${id}/edit`)} className="gap-1.5"><Edit className="h-3.5 w-3.5" /> Edit</Button>
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

      {/* Printable Invoice */}
      <div ref={printRef} className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#0d4d47] text-white p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold mb-0.5">{settings?.businessName ?? "Your Business"}</div>
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
                  <td className="py-2.5 text-right">{item.discount > 0 ? `-${formatCurrency(item.discount)}` : "—"}</td>
                  <td className="py-2.5 text-right font-semibold">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount</span>
                  <span>-{formatCurrency(sale.discount)}</span>
                </div>
              )}
              {sale.taxRate > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({sale.taxRate}%)</span>
                  <span>{formatCurrency(sale.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2 text-[#0d4d47]">
                <span>TOTAL</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
              {sale.paymentMethod && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Payment</span>
                  <span>{sale.paymentMethod}</span>
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
  );
}
