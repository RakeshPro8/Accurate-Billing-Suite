import { useEffect, useMemo, useState } from "react";
import {
  getGetSettingsQueryKey,
  type ReceiptContentPreferences as ApiReceiptContentPreferences,
  type Settings,
  useUpdateSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReceiptPrint, DEFAULT_RECEIPT_CONTENT, type ReceiptContentPreferences } from "@/components/ReceiptPrint";
import { CheckCircle2, Eye, RotateCcw, Save, TriangleAlert } from "lucide-react";

type ReceiptContentDraft = Omit<Required<ReceiptContentPreferences>, "thankYouMessage" | "footerText"> & {
  thankYouMessage: string;
  footerText: string;
};

const TEXT_LIMITS = {
  thankYouMessage: 160,
  footerText: 600,
} as const;

function toDraft(settings: Settings): ReceiptContentDraft {
  return {
    ...DEFAULT_RECEIPT_CONTENT,
    ...(settings.receiptContent ?? {}),
    thankYouMessage: settings.receiptContent?.thankYouMessage ?? "",
    footerText: settings.receiptContent?.footerText ?? "",
  } as ReceiptContentDraft;
}

function toApiDraft(draft: ReceiptContentDraft): ApiReceiptContentPreferences {
  return {
    thankYouMessage: draft.thankYouMessage || null,
    footerText: draft.footerText || null,
    showBusinessContact: draft.showBusinessContact,
    showCustomerDetails: draft.showCustomerDetails,
    showPaymentMethod: draft.showPaymentMethod,
    showTaxBreakdown: draft.showTaxBreakdown,
    showQrCode: draft.showQrCode,
  };
}

interface ReceiptContentEditorProps {
  settings: Settings;
}

export function ReceiptContentEditor({ settings }: ReceiptContentEditorProps) {
  const queryClient = useQueryClient();
  const update = useUpdateSettings();
  const [draft, setDraft] = useState<ReceiptContentDraft>(() => toDraft(settings));
  const [saved, setSaved] = useState<ReceiptContentDraft>(() => toDraft(settings));
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const next = toDraft(settings);
    setSaved(next);
    if (!dirty) setDraft(next);
  }, [settings, dirty]);

  const validationMessage = useMemo(() => {
    if (draft.thankYouMessage.length > TEXT_LIMITS.thankYouMessage) {
      return `Thank-you message must be ${TEXT_LIMITS.thankYouMessage} characters or fewer.`;
    }
    if (draft.footerText.length > TEXT_LIMITS.footerText) {
      return `Footer and policy text must be ${TEXT_LIMITS.footerText} characters or fewer.`;
    }
    return null;
  }, [draft]);

  function updateDraft<K extends keyof ReceiptContentDraft>(field: K, value: ReceiptContentDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setFeedback(null);
  }

  function resetDraft() {
    setDraft(saved);
    setDirty(false);
    setFeedback(null);
  }

  function saveDraft() {
    if (validationMessage) {
      setFeedback({ kind: "error", message: validationMessage });
      return;
    }
    update.mutate(
      { data: { receiptContent: toApiDraft(draft) } },
      {
        onSuccess: (nextSettings) => {
          const next = toDraft(nextSettings);
          setSaved(next);
          setDraft(next);
          setDirty(false);
          setFeedback({ kind: "success", message: "Receipt content saved for this store." });
          queryClient.setQueryData(getGetSettingsQueryKey(), nextSettings);
        },
        onError: (error) => {
          setFeedback({
            kind: "error",
            message: error instanceof Error ? error.message : "Receipt content could not be saved.",
          });
        },
      },
    );
  }

  const previewBusiness = {
    businessName: settings.businessName,
    businessAddress: settings.businessAddress ?? undefined,
    businessPhone: settings.businessPhone ?? undefined,
    businessEmail: settings.businessEmail ?? undefined,
    logoUrl: settings.logoUrl ?? undefined,
    taxName: settings.taxName,
    receiptContent: draft,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Thermal receipt content</p>
          <p className="text-xs text-muted-foreground">
            These choices affect sales and quotations printed as 80 mm receipts. Invoice totals and captured tax never change.
          </p>
        </div>
        <span className={`text-xs ${dirty ? "text-amber-500" : "text-muted-foreground"}`} role="status">
          {dirty ? "Unsaved changes" : "Saved"}
        </span>
      </div>

      {feedback && (
        <Alert className={feedback.kind === "success" ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/40"}>
          {feedback.kind === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <TriangleAlert className="h-4 w-4 text-destructive" />}
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Copy and visibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="receipt-thank-you">Thank-you message</Label>
              <Textarea
                id="receipt-thank-you"
                value={draft.thankYouMessage}
                maxLength={TEXT_LIMITS.thankYouMessage}
                onChange={(event) => updateDraft("thankYouMessage", event.target.value)}
                placeholder="Thank you for choosing us!"
                rows={2}
              />
              <p className="text-xs text-muted-foreground text-right">
                {draft.thankYouMessage.length}/{TEXT_LIMITS.thankYouMessage}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-footer">Footer or policy text</Label>
              <Textarea
                id="receipt-footer"
                value={draft.footerText}
                maxLength={TEXT_LIMITS.footerText}
                onChange={(event) => updateDraft("footerText", event.target.value)}
                placeholder="Returns accepted within 30 days with proof of purchase."
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {draft.footerText.length}/{TEXT_LIMITS.footerText}
              </p>
            </div>

            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Optional receipt sections</p>
              {([
                ["showBusinessContact", "Business contact details", "Address, phone, and email under the store name."],
                ["showCustomerDetails", "Customer details", "Customer name or walk-in customer label."],
                ["showPaymentMethod", "Payment method", "The payment method captured on a sale."],
                ["showTaxBreakdown", "Tax breakdown", "The stored tax amount and tax profile, without recalculation."],
                ["showQrCode", "QR code", "The document QR code and number."],
              ] as const).map(([field, label, description]) => (
                <div key={field} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Label htmlFor={`receipt-${field}`} className="text-sm">{label}</Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    id={`receipt-${field}`}
                    checked={draft[field]}
                    onCheckedChange={(checked) => updateDraft(field, checked)}
                    aria-label={label}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button type="button" onClick={saveDraft} disabled={update.isPending || !dirty || Boolean(validationMessage)} className="gap-1.5">
                <Save className="h-4 w-4" /> {update.isPending ? "Saving…" : "Save receipt content"}
              </Button>
              <Button type="button" variant="outline" onClick={resetDraft} disabled={!dirty || update.isPending} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </div>
            {validationMessage && <p className="text-xs text-destructive">{validationMessage}</p>}
          </CardContent>
        </Card>

        <Card className="self-start bg-muted/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Live preview
            </CardTitle>
            <p className="text-xs text-muted-foreground">Uses the same renderer as Print Receipt.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto rounded-md bg-white p-2">
            <div className="min-w-[280px]">
              <ReceiptPrint
                mode="receipt"
                business={previewBusiness}
                data={{
                  invoiceNumber: "INV-PREVIEW",
                  createdAt: "2026-09-01T12:00:00.000Z",
                  customerName: "Alex Customer",
                  paymentMethod: "Card",
                  items: [{
                    name: "Screen replacement",
                    description: "Preview item",
                    quantity: 1,
                    unitPrice: 95,
                    discount: 0,
                    total: 95,
                  }],
                  subtotal: 95,
                  taxRate: 13,
                  tax: 12.35,
                  discount: 0,
                  total: 107.35,
                  notes: "Keep this receipt for your records.",
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}