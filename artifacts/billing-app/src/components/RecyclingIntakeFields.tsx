import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RecyclingReceiptInput } from "@workspace/api-client-react";

export type RecyclingDraft = Omit<RecyclingReceiptInput, "saleId" | "customerId"> & {
  customerId?: number;
};

export const emptyRecyclingDraft = (): RecyclingDraft => ({
  customerName: "",
  customerPhone: "",
  customerEmail: undefined,
  deviceType: "",
  deviceBrand: "",
  deviceModel: "",
  deviceColour: "",
  declaredCondition: "bricked",
  accessories: "Aucun",
  serialOrImei: undefined,
  handoffDate: new Date().toISOString().slice(0, 10),
});

export function RecyclingIntakeFields({
  value,
  onChange,
  disabled = false,
}: {
  value: RecyclingDraft;
  onChange: (value: RecyclingDraft) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof RecyclingDraft>(key: K, next: RecyclingDraft[K]) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Nom du client" required><Input disabled={disabled} value={value.customerName} onChange={e => set("customerName", e.target.value)} /></Field>
        <Field label="Téléphone" required><Input disabled={disabled} value={value.customerPhone} onChange={e => set("customerPhone", e.target.value)} /></Field>
        <Field label="Courriel"><Input disabled={disabled} type="email" value={value.customerEmail ?? ""} onChange={e => set("customerEmail", e.target.value || undefined)} /></Field>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Type d’appareil" required><Input disabled={disabled} placeholder="Téléphone intelligent" value={value.deviceType} onChange={e => set("deviceType", e.target.value)} /></Field>
        <Field label="Marque" required><Input disabled={disabled} placeholder="Google" value={value.deviceBrand} onChange={e => set("deviceBrand", e.target.value)} /></Field>
        <Field label="Modèle" required><Input disabled={disabled} placeholder="Pixel 9" value={value.deviceModel} onChange={e => set("deviceModel", e.target.value)} /></Field>
        <Field label="Couleur" required><Input disabled={disabled} value={value.deviceColour} onChange={e => set("deviceColour", e.target.value)} /></Field>
        <Field label="État déclaré" required>
          <Select disabled={disabled} value={value.declaredCondition} onValueChange={next => set("declaredCondition", next as RecyclingDraft["declaredCondition"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="working">Fonctionnel</SelectItem>
              <SelectItem value="damaged">Endommagé</SelectItem>
              <SelectItem value="bricked">Briqué / hors d’usage</SelectItem>
              <SelectItem value="unknown">État inconnu</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Accessoires inclus" required><Input disabled={disabled} value={value.accessories} onChange={e => set("accessories", e.target.value)} /></Field>
        <Field label="N° de série / IMEI (facultatif)"><Input disabled={disabled} autoComplete="off" value={value.serialOrImei ?? ""} onChange={e => set("serialOrImei", e.target.value || undefined)} /></Field>
        <Field label="Date de remise" required><Input disabled={disabled} type="date" value={value.handoffDate} onChange={e => set("handoffDate", e.target.value)} /></Field>
      </div>
      <p className="text-xs text-muted-foreground">Valeur, compensation, TPS et TVQ : 0,00 $. Aucun montant de cette remise ne sera ajouté à la facture.</p>
    </div>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}{required ? " *" : ""}</Label>{children}</div>;
}