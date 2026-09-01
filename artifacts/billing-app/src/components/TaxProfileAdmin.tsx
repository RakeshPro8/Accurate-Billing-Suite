import { useState } from "react";
import { CalendarClock, Percent, Power, Save } from "lucide-react";
import {
  getGetTaxProfilesQueryKey,
  useCreateTaxProfile,
  useGetTaxProfiles,
  useRetireTaxProfile,
  type TaxProfileInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const provinces = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;
const blank: TaxProfileInput = { name: "Canadian tax profile", provinceCode: "ON", currency: "CAD", gstRate: 0, hstRate: 0, pstRate: 0, qstRate: 0, effectiveFrom: new Date().toISOString().slice(0, 10), enabled: true, roundingMode: "subtotal", partsTaxable: true, labourTaxable: true, depositsTaxable: false, accessoriesTaxable: true };

export function TaxProfileAdmin() {
  const { data } = useGetTaxProfiles({ includeDisabled: true });
  const create = useCreateTaxProfile();
  const retire = useRetireTaxProfile();
  const client = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<TaxProfileInput>(blank);
  const set = <K extends keyof TaxProfileInput>(key: K, value: TaxProfileInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const refresh = () => void client.invalidateQueries({ queryKey: getGetTaxProfilesQueryKey({ includeDisabled: true }) });
  const save = () => create.mutate({ data: form }, { onSuccess: () => { refresh(); toast({ title: "Tax profile scheduled" }); }, onError: () => toast({ title: "Could not save tax profile", variant: "destructive" }) });

  return <Card className="border-primary/20">
    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Percent className="h-4 w-4 text-primary" /> Canadian tax profiles</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-xs text-muted-foreground">Profiles are scoped to the selected location. Use a future effective date for a rate change; existing documents keep their captured profile and amounts. Currency is fixed to CAD.</p>
      <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2"><Label>Profile name</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Province / territory</Label><Select value={form.provinceCode} onValueChange={(value) => set("provinceCode", value as TaxProfileInput["provinceCode"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{provinces.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Effective from</Label><Input type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} /></div>
        {(["gstRate", "hstRate", "pstRate", "qstRate"] as const).map((key) => <div className="space-y-1.5" key={key}><Label>{key.replace("Rate", "").toUpperCase()} rate (%)</Label><Input type="number" min="0" max="100" step="0.0001" value={form[key]} onChange={(e) => set(key, Number(e.target.value))} /></div>)}
        <div className="space-y-1.5"><Label>Rounding</Label><Select value={form.roundingMode} onValueChange={(value) => set("roundingMode", value as TaxProfileInput["roundingMode"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="subtotal">Round at subtotal</SelectItem><SelectItem value="line">Round each line</SelectItem></SelectContent></Select></div>
        <div className="flex flex-wrap items-end gap-3 text-xs sm:col-span-2 lg:col-span-3">{(["partsTaxable", "labourTaxable", "depositsTaxable", "accessoriesTaxable"] as const).map((key) => <label className="flex items-center gap-1.5" key={key}><input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} className="accent-primary" />{key.replace("Taxable", "")} taxable</label>)}</div>
        <Button type="button" className="gap-2 lg:col-span-1" onClick={save} disabled={create.isPending}><Save className="h-4 w-4" /> {create.isPending ? "Saving…" : "Schedule profile"}</Button>
      </div>
      <div className="space-y-2">{data?.profiles.map((profile) => (
        <div key={profile.id} className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-medium"><span>{profile.name}</span><Badge variant={profile.id === data.activeProfileId ? "default" : "outline"}>{profile.id === data.activeProfileId ? "Active now" : profile.enabled ? "Scheduled" : "Disabled"}</Badge><span className="text-xs text-muted-foreground">{profile.provinceCode} · effective {profile.effectiveFrom}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">GST {profile.gstRate}% · HST {profile.hstRate}% · PST {profile.pstRate}% · QST {profile.qstRate}% · {profile.roundingMode} rounding</p>
          </div>
          {profile.enabled && <Button type="button" variant="ghost" size="sm" className="w-fit gap-1" onClick={() => retire.mutate({ id: profile.id }, { onSuccess: refresh })}><Power className="h-3.5 w-3.5" /> Disable</Button>}
        </div>
      ))}</div>
      {!data?.profiles.length && <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground"><CalendarClock className="mb-2 h-4 w-4" />No location-specific profile yet. Legacy global settings remain the explicit fallback.</div>}
    </CardContent>
  </Card>;
}