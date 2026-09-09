import { useEffect, useRef, useState } from "react";
import type { Sale } from "@workspace/api-client-react";
import {
  getGetRecyclingReceiptsQueryKey,
  useCreateRecyclingReceipt,
  useFinalizeRecyclingReceipt,
  useGetCustomers,
  useGetRecyclingReceipts,
  useUpdateRecyclingReceipt,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, FileCheck2, Printer, Recycle, Save } from "lucide-react";
import { RecyclingIntakeFields, emptyRecyclingDraft, type RecyclingDraft } from "./RecyclingIntakeFields";
import { RecyclingReceiptDocument } from "./RecyclingReceiptDocument";
import type { A4BusinessInfo } from "./A4DocumentFrame";

export function RecyclingReceiptPanel({ sale, business }: { sale: Sale; business: A4BusinessInfo }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const documentRef = useRef<HTMLDivElement>(null);
  const { data: receipts, isLoading } = useGetRecyclingReceipts({ saleId: sale.id });
  const { data: customers } = useGetCustomers({ search: sale.customerName || undefined });
  const receipt = receipts?.[0];
  const customer = customers?.find(item => item.id === sale.customerId);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<RecyclingDraft>(emptyRecyclingDraft);
  const createReceipt = useCreateRecyclingReceipt();
  const updateReceipt = useUpdateRecyclingReceipt();
  const finalizeReceipt = useFinalizeRecyclingReceipt();

  useEffect(() => {
    if (receipt) {
      setDraft({
        customerId: receipt.customerId ?? undefined,
        customerName: receipt.customerName,
        customerPhone: receipt.customerPhone,
        customerEmail: receipt.customerEmail ?? undefined,
        deviceType: receipt.deviceType,
        deviceBrand: receipt.deviceBrand,
        deviceModel: receipt.deviceModel,
        deviceColour: receipt.deviceColour,
        declaredCondition: receipt.declaredCondition,
        accessories: receipt.accessories,
        serialOrImei: receipt.serialOrImei ?? undefined,
        handoffDate: receipt.handoffDate,
      });
      return;
    }
    setDraft(current => ({
      ...current,
      customerId: sale.customerId ?? undefined,
      customerName: current.customerName || sale.customerName || "",
      customerPhone: current.customerPhone || customer?.phone || "",
      customerEmail: current.customerEmail || sale.customerEmail || customer?.email || undefined,
    }));
  }, [receipt, sale.customerId, sale.customerName, sale.customerEmail, customer?.phone, customer?.email]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetRecyclingReceiptsQueryKey({ saleId: sale.id }) });
  const payload = () => ({
    ...draft,
    customerEmail: draft.customerEmail || undefined,
    serialOrImei: draft.serialOrImei || undefined,
  });

  function create() {
    createReceipt.mutate({ data: { ...payload(), saleId: sale.id, customerId: draft.customerId } }, {
      onSuccess: () => { refresh(); setShowCreate(false); toast({ title: "Recycling draft created" }); },
      onError: (error: any) => toast({ title: "Could not create recycling draft", description: error?.message, variant: "destructive" }),
    });
  }

  function save() {
    if (!receipt) return;
    updateReceipt.mutate({ id: receipt.id, data: payload() }, {
      onSuccess: () => { refresh(); toast({ title: "Recycling draft saved" }); },
      onError: (error: any) => toast({ title: "Could not save recycling draft", description: error?.message, variant: "destructive" }),
    });
  }

  function finalize() {
    if (!receipt) return;
    finalizeReceipt.mutate({ id: receipt.id }, {
      onSuccess: result => { refresh(); toast({ title: "Recycling receipt finalized", description: result.documentNumber ?? undefined }); },
      onError: (error: any) => toast({ title: "Could not finalize receipt", description: error?.message, variant: "destructive" }),
    });
  }

  function print() {
    if (!receipt || receipt.status !== "finalized") return;
    document.body.classList.add("recycling-mode");
    window.addEventListener("afterprint", () => document.body.classList.remove("recycling-mode"), { once: true });
    window.print();
  }

  async function download() {
    if (!receipt || receipt.status !== "finalized" || !documentRef.current) return;
    toast({ title: "Generating recycling PDF…" });
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      await pdf.html(documentRef.current, {
        autoPaging: "text",
        width: 210,
        windowWidth: 794,
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        callback: generated => generated.save(`${receipt.documentNumber}.pdf`),
      });
      toast({ title: "Recycling PDF downloaded" });
    } catch {
      toast({ title: "PDF generation failed", variant: "destructive" });
    }
  }

  return (
    <section className="space-y-4">
      <Card className="no-print">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm"><Recycle className="h-4 w-4 text-primary" /> Recycling handoff</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Separate zero-value record. It never changes invoice totals, inventory, taxes, payments, or balance.</p>
            </div>
            {!receipt && !showCreate && <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>Add recycling receipt</Button>}
            {receipt?.status === "finalized" && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={print}><Printer className="h-3.5 w-3.5 mr-1.5" />Print</Button>
                <Button size="sm" variant="outline" onClick={download}><Download className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
              </div>
            )}
          </div>
        </CardHeader>
        {(showCreate || receipt) && (
          <CardContent className="space-y-4">
            {isLoading ? <p className="text-sm text-muted-foreground">Loading recycling details…</p> : (
              <>
                <RecyclingIntakeFields value={draft} onChange={setDraft} disabled={receipt?.status === "finalized"} />
                {receipt?.status === "finalized" ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600"><FileCheck2 className="h-4 w-4" /> Finalized as {receipt.documentNumber}</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {!receipt && <Button size="sm" onClick={create} disabled={createReceipt.isPending}>{createReceipt.isPending ? "Creating…" : "Create draft"}</Button>}
                    {receipt && <Button size="sm" variant="outline" onClick={save} disabled={updateReceipt.isPending}><Save className="h-3.5 w-3.5 mr-1.5" />{updateReceipt.isPending ? "Saving…" : "Save draft"}</Button>}
                    {receipt && <Button size="sm" onClick={finalize} disabled={finalizeReceipt.isPending}><FileCheck2 className="h-3.5 w-3.5 mr-1.5" />{finalizeReceipt.isPending ? "Finalizing…" : "Finalize receipt"}</Button>}
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>
      {receipt && (
        <div ref={documentRef} className="invoice-print-area recycling-print-area">
          <RecyclingReceiptDocument receipt={receipt} business={business} />
        </div>
      )}
    </section>
  );
}