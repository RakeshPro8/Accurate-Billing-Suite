import { useEffect, useRef, useState } from "react";
import { useApplySettingsTheme, useGetSettings, useUpdateSettings, getGetSettingsQueryKey, type SettingsUpdate, type ThemePreset } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { StoreAdmin } from "@/components/StoreAdmin";
import { AlertTriangle, Bell, Building2, CheckCircle2, Download, ImageIcon, Mail, MapPin, MonitorCog, Palette, Percent, Printer, RefreshCw, Save, ShieldCheck, Trash2, Type, Upload, type LucideIcon } from "lucide-react";
import { apiUrl, getApiEndpointStatus } from "@/lib/api-config";
import { readDesktopDiagnostics, type DesktopDiagnostics } from "@/lib/desktop-diagnostics";
import { getLastSyncAt } from "@/lib/offline-store";
import { readUiPreferences, saveUiPreferences, UI_PREFERENCES_EVENT } from "@/lib/ui-preferences";
import { NotificationManagement } from "@/components/NotificationManagement";
import { TaxProfileAdmin } from "@/components/TaxProfileAdmin";
import { ReceiptContentEditor } from "@/components/ReceiptContentEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SettingsGroupId = "business" | "billing" | "notifications" | "stores" | "appearance" | "backup";

const settingsGroups: Array<{ id: SettingsGroupId; label: string; description: string; icon: LucideIcon }> = [
  { id: "business", label: "Business", description: "Identity, contact details, and email delivery", icon: Building2 },
  { id: "billing", label: "Billing", description: "Invoices, tax, and receipt content", icon: Percent },
  { id: "notifications", label: "Notifications", description: "Customer and staff notification rules", icon: Bell },
  { id: "stores", label: "Stores", description: "Locations and tax profiles", icon: MapPin },
  { id: "appearance", label: "Appearance", description: "Branding and workspace theme", icon: Palette },
  { id: "backup", label: "Backup & recovery", description: "Redacted exports and desktop diagnostics", icon: ShieldCheck },
];

function formatDiagnosticDate(value: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function DesktopDiagnosticsPanel() {
  const [diagnostics, setDiagnostics] = useState<DesktopDiagnostics>({
    appVersion: "Loading…",
    serviceWorkerVersion: "Loading…",
    lastSyncAt: getLastSyncAt(),
  });
  const [refreshing, setRefreshing] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const endpoint = getApiEndpointStatus();

  async function refreshDiagnostics() {
    setRefreshing(true);
    try {
      setDiagnostics(await readDesktopDiagnostics());
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshDiagnostics();
    const onSync = () => setDiagnostics((current) => ({ ...current, lastSyncAt: getLastSyncAt() }));
    window.addEventListener("mobilinq:last-sync", onSync);
    return () => window.removeEventListener("mobilinq:last-sync", onSync);
  }, []);

  useEffect(() => {
    let mounted = true;
    const onUpdateAvailable = () => setUpdateAvailable(true);

    window.addEventListener("mobilinq:service-worker-update", onUpdateAvailable);
    void navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL).then((registration) => {
      if (mounted && registration?.waiting) {
        setUpdateAvailable(true);
      }
    });

    return () => {
      mounted = false;
      window.removeEventListener("mobilinq:service-worker-update", onUpdateAvailable);
    };
  }, []);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MonitorCog className="h-4 w-4 text-primary" /> Desktop / PWA diagnostics
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Admin-only runtime details for the installed desktop app and its company-server connection.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {updateAvailable && (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <RefreshCw className="h-4 w-4 text-amber-400" />
            <AlertTitle>Update ready</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>A newer version of Mobilinq is ready. Reload the app to apply the update.</span>
              <Button type="button" size="sm" className="gap-1.5" onClick={() => window.location.reload()}>
                <RefreshCw className="h-3.5 w-3.5" /> Reload app
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">API origin</p>
            <p className="mt-1 break-all font-mono text-sm">{endpoint.origin}</p>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">App version</p>
            <p className="mt-1 font-mono text-sm">{diagnostics.appVersion}</p>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Service-worker version</p>
            <p className="mt-1 font-mono text-sm">{diagnostics.serviceWorkerVersion}</p>
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last sync time</p>
            <p className="mt-1 text-sm">{formatDiagnosticDate(diagnostics.lastSyncAt)}</p>
          </div>
        </div>

        {endpoint.warning ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{endpoint.warning} Requests are using the app origin until this deployment setting is corrected.</p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <p>
              Same-origin session protection is active. Approved company-server builds may set <code className="font-mono text-foreground">VITE_API_ORIGIN</code> to the exact HTTPS origin serving this app; credentials are never sent to another origin.
            </p>
          </div>
        )}

        {!endpoint.secure && (
          <p className="text-xs text-amber-400">
            This page is not using HTTPS. Install the desktop PWA only from the HTTPS company-server origin.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void refreshDiagnostics()} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh diagnostics
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Open browser print dialog
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          For a supported thermal print, use Print on a sale receipt or repair ticket, then choose the OS-installed thermal printer in the browser dialog. Mobilinq does not request direct USB or network-printer access.
        </p>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings();
  const applyTheme = useApplySettingsTheme();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [localTheme, setLocalTheme] = useState<ThemePreset | null>(() => readUiPreferences().theme);
  const [activeGroup, setActiveGroup] = useState<SettingsGroupId>("business");
  const [saveFeedback, setSaveFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isDirty } } = useForm<any>({
    mode: "onBlur",
  });
  const themeValue = (watch("theme") || settings?.theme || "berry") as ThemePreset;
  const taxEnabled = watch("taxEnabled") !== false;
  const [themeApplied, setThemeApplied] = useState<ThemePreset | null>(null);

  const themes = [
    {
      id: "terminal",
      label: "Terminal",
      desc: "Dark, technical, and compact",
      color: "hsl(173 100% 45%)",
      surface: "hsl(240 30% 8%)",
      panel: "hsl(240 40% 4%)",
      mode: "Dark",
    },
    {
      id: "ocean",
      label: "Ocean",
      desc: "Bright workspace with navy navigation",
      color: "hsl(199 89% 43%)",
      surface: "hsl(0 0% 100%)",
      panel: "hsl(222 45% 15%)",
      mode: "Light",
    },
    {
      id: "sunset",
      label: "Sunset",
      desc: "Warm, welcoming, and editorial",
      color: "hsl(15 80% 51%)",
      surface: "hsl(42 100% 99%)",
      panel: "hsl(20 60% 24%)",
      mode: "Light",
    },
    {
      id: "berry",
      label: "Burgundy",
      desc: "Deep burgundy with rounded surfaces",
      color: "hsl(327 78% 62%)",
      surface: "hsl(275 32% 13%)",
      panel: "hsl(283 43% 6%)",
      mode: "Dark",
    },
    {
      id: "forest",
      label: "Forest",
      desc: "Natural green with calm white panels",
      color: "hsl(154 60% 31%)",
      surface: "hsl(0 0% 100%)",
      panel: "hsl(150 40% 16%)",
      mode: "Light",
    },
    {
      id: "monochrome",
      label: "Monochrome",
      desc: "Focused black, white, and gray",
      color: "hsl(0 0% 12%)",
      surface: "hsl(0 0% 100%)",
      panel: "hsl(0 0% 14%)",
      mode: "Light",
    },
  ];

  useEffect(() => {
    const onPreferencesChange = (event: Event) => {
      const theme = (event as CustomEvent<{ theme?: ThemePreset | null }>).detail?.theme;
      setLocalTheme(theme ?? null);
    };
    window.addEventListener(UI_PREFERENCES_EVENT, onPreferencesChange);
    return () => window.removeEventListener(UI_PREFERENCES_EVENT, onPreferencesChange);
  }, []);

  useEffect(() => {
    if (settings) {
      const localTheme = readUiPreferences().theme;
      setLocalTheme(localTheme);
      reset({ ...settings, theme: localTheme ?? settings.theme, smtpPort: settings.smtpPort ?? undefined, gstRate: settings.gstRate ?? undefined, qstRate: settings.qstRate ?? undefined });
      setLogoPreview(settings.logoUrl ?? null);
    }
  }, [settings, reset]);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: "Image too large", description: "Please use an image under 500 KB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      setValue("logoUrl", dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogoPreview(null);
    setValue("logoUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onSubmit(data: any) {
    const payload: SettingsUpdate = {
      appName: typeof data.appName === "string" ? data.appName : undefined,
      businessName: typeof data.businessName === "string" ? data.businessName : undefined,
      businessAddress: typeof data.businessAddress === "string" ? data.businessAddress : undefined,
      businessPhone: typeof data.businessPhone === "string" ? data.businessPhone : undefined,
      businessEmail: typeof data.businessEmail === "string" ? data.businessEmail : undefined,
      logoUrl: logoPreview ?? "",
      currency: typeof data.currency === "string" ? data.currency : undefined,
      taxName: typeof data.taxName === "string" ? data.taxName : undefined,
      taxEnabled: Boolean(data.taxEnabled),
      invoicePrefix: typeof data.invoicePrefix === "string" ? data.invoicePrefix : undefined,
      quotePrefix: typeof data.quotePrefix === "string" ? data.quotePrefix : undefined,
      invoiceFooter: typeof data.invoiceFooter === "string" ? data.invoiceFooter : undefined,
      thankYouMessage: typeof data.thankYouMessage === "string" ? data.thankYouMessage : undefined,
      smtpHost: typeof data.smtpHost === "string" ? data.smtpHost : undefined,
      smtpUser: typeof data.smtpUser === "string" ? data.smtpUser : undefined,
    };
    for (const field of ["taxRate", "gstRate", "qstRate"] as const) {
      const value = Number(data[field]);
      if (Number.isFinite(value)) payload[field] = value;
    }
    if (data.smtpPort !== "" && data.smtpPort !== null && data.smtpPort !== undefined) {
      const value = Number(data.smtpPort);
      if (Number.isInteger(value) && value >= 1 && value <= 65535) payload.smtpPort = value;
    }
    if (typeof data.smtpPass === "string" && data.smtpPass.trim()) payload.smtpPass = data.smtpPass;

    update.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
         setSaveFeedback({ kind: "success", message: "Business settings saved." });
        toast({ title: "Settings saved", description: "Your business settings have been updated." });
      },
       onError: (error) => {
         setSaveFeedback({ kind: "error", message: error instanceof Error ? error.message : "Failed to save settings." });
         toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save settings.", variant: "destructive" });
       },
    });
  }

  function onApplyTheme() {
    applyTheme.mutate({ data: { theme: themeValue } }, {
      onSuccess: () => {
        const current = readUiPreferences();
        saveUiPreferences({ ...current, theme: themeValue });
        setThemeApplied(themeValue);
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Theme applied", description: "This workspace and this device now use the selected theme." });
      },
      onError: (error) => toast({ title: "Theme not applied", description: error instanceof Error ? error.message : "The selected theme could not be applied.", variant: "destructive" }),
    });
  }

  async function downloadBackup() {
    setBackupLoading(true);
    try {
      const response = await fetch(apiUrl("/backup"), { credentials: "include" });
      if (!response.ok) throw new Error("Backup download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mobilinq-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: "The versioned redacted operational export is ready." });
    } catch {
      toast({ title: "Backup unavailable", description: "Stay online and try again.", variant: "destructive" });
    } finally {
      setBackupLoading(false);
    }
  }

  if (isLoading) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Workspace control center</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the business, billing, locations, and devices that power Mobilinq.</p>
        </div>
        <span className="w-fit rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-muted-foreground">Admin only</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Tabs value={activeGroup} onValueChange={(value) => setActiveGroup(value as SettingsGroupId)} orientation="vertical">
          <Card className="border-primary/15 bg-card/80">
            <CardContent className="p-3 sm:p-4">
              <div className="sm:hidden">
                <Label htmlFor="settings-group">Settings section</Label>
                <Select value={activeGroup} onValueChange={(value) => setActiveGroup(value as SettingsGroupId)}>
                  <SelectTrigger id="settings-group" className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>{settingsGroups.map((group) => <SelectItem key={group.id} value={group.id}>{group.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <TabsList className="hidden h-auto w-full grid-cols-3 gap-1 bg-muted/60 p-1 sm:grid lg:grid-cols-6">
                {settingsGroups.map((group) => {
                  const Icon = group.icon;
                  return <TabsTrigger key={group.id} value={group.id} className="h-auto min-h-16 flex-col items-start justify-center gap-1 px-3 py-2 text-left data-[state=active]:border-primary/20 data-[state=active]:bg-background">
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><span>{group.label}</span></span>
                    <span className="hidden text-[11px] font-normal text-muted-foreground lg:block">{group.description}</span>
                  </TabsTrigger>;
                })}
              </TabsList>
            </CardContent>
          </Card>

          <TabsContent forceMount value="business" className="space-y-5 pt-1">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" /> Business information</CardTitle><p className="text-xs text-muted-foreground">This information appears on invoices, quotations, and receipts.</p></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="businessName">Business name</Label><Input id="businessName" {...register("businessName")} placeholder="My Store" /></div>
                <div className="space-y-1.5"><Label htmlFor="businessAddress">Address</Label><Textarea id="businessAddress" {...register("businessAddress")} placeholder="123 Main St, City, Province" rows={2} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="businessPhone">Phone</Label><Input id="businessPhone" {...register("businessPhone")} placeholder="+1 (555) 000-0000" /></div>
                  <div className="space-y-1.5"><Label htmlFor="businessEmail">Email</Label><Input id="businessEmail" {...register("businessEmail", { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address." } })} type="email" placeholder="hello@mystore.com" aria-invalid={Boolean(errors.businessEmail)} />{errors.businessEmail && <p className="text-xs text-destructive">{String(errors.businessEmail.message)}</p>}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4 text-primary" /> Email delivery</CardTitle><p className="text-xs text-muted-foreground">Optional SMTP settings are used when staff send invoices by email. Passwords are never shown in the backup export.</p></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="smtpHost">SMTP host</Label><Input id="smtpHost" {...register("smtpHost")} placeholder="smtp.gmail.com" /></div>
                <div className="space-y-1.5"><Label htmlFor="smtpPort">SMTP port</Label><Input id="smtpPort" {...register("smtpPort", { valueAsNumber: true })} type="number" min="1" max="65535" placeholder="587" /></div>
                <div className="space-y-1.5"><Label htmlFor="smtpUser">SMTP username</Label><Input id="smtpUser" {...register("smtpUser")} placeholder="user@gmail.com" /></div>
                <div className="space-y-1.5"><Label htmlFor="smtpPass">SMTP password</Label><Input id="smtpPass" {...register("smtpPass")} type="password" placeholder="Leave blank to keep current password" autoComplete="new-password" /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent forceMount value="billing" className="space-y-5 pt-1">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Percent className="h-4 w-4 text-primary" /> Billing</CardTitle><p className="text-xs text-muted-foreground">Invoice settings and thermal receipt content are separated so financial totals stay predictable.</p></CardHeader>
              <CardContent>
                <Tabs defaultValue="invoice" className="w-full">
                  <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
                    <TabsTrigger value="invoice">Invoice &amp; tax</TabsTrigger>
                    <TabsTrigger value="receipt">Receipt content</TabsTrigger>
                  </TabsList>
                  <TabsContent forceMount value="invoice" className="pt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label htmlFor="currency">Currency</Label><Input id="currency" {...register("currency")} placeholder="CAD" /></div>
                      <div className="space-y-1.5"><Label htmlFor="taxRate">Default tax rate (%)</Label><Input id="taxRate" {...register("taxRate", { valueAsNumber: true, min: 0, max: 100 })} type="number" step="0.01" min="0" max="100" placeholder="0" disabled={!taxEnabled} /></div>
                      <div className="space-y-1.5"><Label htmlFor="taxName">Tax display name</Label><Input id="taxName" {...register("taxName")} placeholder="Tax, GST, VAT…" /></div>
                      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input {...register("taxEnabled")} type="checkbox" className="h-4 w-4 accent-primary" /><span>Apply tax to new sales and quotations</span></label>
                      <div className="space-y-1.5"><Label htmlFor="gstRate">GST rate (%) <span className="text-xs text-muted-foreground">e.g. 5</span></Label><Input id="gstRate" {...register("gstRate", { valueAsNumber: true })} type="number" step="0.001" min="0" max="100" placeholder="0" /></div>
                      <div className="space-y-1.5"><Label htmlFor="qstRate">QST rate (%) <span className="text-xs text-muted-foreground">e.g. 9.975</span></Label><Input id="qstRate" {...register("qstRate", { valueAsNumber: true })} type="number" step="0.0001" min="0" max="100" placeholder="0" /></div>
                      <p className="text-xs text-muted-foreground sm:col-span-2">{taxEnabled ? "The server applies this rate to new sales and quotations; saved invoices keep their original totals." : "Tax is disabled for new transactions. Existing records remain unchanged."}</p>
                      <div className="space-y-1.5"><Label htmlFor="invoicePrefix">Invoice prefix</Label><Input id="invoicePrefix" {...register("invoicePrefix")} placeholder="INV-" /></div>
                      <div className="space-y-1.5"><Label htmlFor="quotePrefix">Quote prefix</Label><Input id="quotePrefix" {...register("quotePrefix")} placeholder="QUO-" /></div>
                      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="invoiceFooter">Invoice footer text</Label><Textarea id="invoiceFooter" {...register("invoiceFooter")} placeholder="Thank you for your business!" rows={2} /><p className="text-xs text-muted-foreground">Used on full invoice printouts. Thermal receipt policy text is managed in Receipt content.</p></div>
                    </div>
                  </TabsContent>
                  <TabsContent forceMount value="receipt" className="pt-4">{settings && <ReceiptContentEditor settings={settings} />}</TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent forceMount value="notifications" className="space-y-5 pt-1">
            <NotificationManagement />
          </TabsContent>

          <TabsContent forceMount value="stores" className="space-y-5 pt-1">
            <StoreAdmin />
            <TaxProfileAdmin />
          </TabsContent>

          <TabsContent forceMount value="appearance" className="space-y-5 pt-1">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Type className="h-4 w-4 text-primary" /> App branding</CardTitle><p className="text-xs text-muted-foreground">Branding is shared by the sidebar, mobile header, browser tab, invoices, and printed receipts.</p></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="appName">App name</Label><Input id="appName" {...register("appName")} placeholder="Mobilinq" /></div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {logoPreview ? <div className="group relative"><img src={logoPreview} alt="Business logo preview" className="h-20 max-w-[160px] rounded border bg-muted/20 object-contain p-1" /><button type="button" onClick={removeLogo} aria-label="Remove business logo" className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"><Trash2 className="h-3 w-3" /></button></div> : <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-20 w-36 flex-col items-center justify-center rounded border-2 border-dashed border-muted-foreground/30 text-muted-foreground/60 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ImageIcon className="mb-1 h-6 w-6" /><span className="text-xs">No logo</span></button>}
                  <div className="flex flex-col gap-2"><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} /><Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5" /> {logoPreview ? "Change logo" : "Upload logo"}</Button>{logoPreview && <Button type="button" size="sm" variant="ghost" className="justify-start gap-1.5 text-destructive hover:text-destructive" onClick={removeLogo}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>}<p className="text-xs text-muted-foreground">PNG, JPG, SVG · max 500 KB</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-primary" /> Workspace theme</CardTitle><p className="text-xs text-muted-foreground">Themes change surfaces, navigation, typography, spacing, borders, shadows, and controls—not just the accent color.</p></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Workspace theme">
                  {themes.map((t) => <div key={t.id} role="radio" aria-label={`${t.label} theme`} aria-checked={themeValue === t.id} tabIndex={0} onClick={() => { setValue("theme", t.id, { shouldDirty: true }); setThemeApplied(null); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setValue("theme", t.id, { shouldDirty: true }); setThemeApplied(null); } }} className={`cursor-pointer rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${themeValue === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                    <div className="mb-3 h-14 overflow-hidden rounded-md border border-black/10 p-2" style={{ background: t.surface }}><div className="flex h-full gap-2"><div className="w-1/4 rounded-sm" style={{ background: t.panel }} /><div className="flex-1 space-y-1.5 pt-0.5"><div className="h-1.5 w-2/5 rounded-full" style={{ background: t.color }} /><div className="h-1.5 w-4/5 rounded-full opacity-20" style={{ background: t.color }} /><div className="h-1.5 w-3/5 rounded-full opacity-20" style={{ background: t.color }} /></div></div></div>
                    <div className="mb-1 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-medium"><span className="h-3 w-3 rounded-full border border-black/10" style={{ background: t.color }} />{t.label}</span><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.mode}</span></div><p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>)}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4"><Button type="button" onClick={onApplyTheme} disabled={applyTheme.isPending} className="gap-2"><CheckCircle2 className="h-4 w-4" />{applyTheme.isPending ? "Applying…" : "Apply theme"}</Button><span className="text-xs text-muted-foreground" role="status">{applyTheme.isPending ? "Saving the selected preset…" : themeApplied === themeValue ? "Applied to server and this device." : localTheme && settings?.theme && localTheme !== settings.theme ? `This device is using ${localTheme}; apply theme to reconcile it.` : "Theme changes are separate from Save settings."}</span></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent forceMount value="backup" className="space-y-5 pt-1">
            <DesktopDiagnosticsPanel />
            <Card className="border-primary/20">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Backup &amp; recovery</CardTitle></CardHeader>
              <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Download a versioned, redacted JSON backup of operational data: catalog, customers, sales, quotations, repairs without unlock codes, stores, tax/business settings, and audit metadata.</p><p className="text-xs text-muted-foreground">Never included: employee PINs, sessions, SMTP passwords, device passwords, repair photos, or other credentials. Restore is approval-gated and not available in the browser.</p><Button type="button" variant="outline" className="gap-2" onClick={downloadBackup} disabled={backupLoading}><Download className="h-4 w-4" />{backupLoading ? "Preparing backup…" : "Download redacted backup"}</Button></CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {saveFeedback && <Alert className={saveFeedback.kind === "success" ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/40"} role={saveFeedback.kind === "error" ? "alert" : "status"}><AlertDescription className="flex items-center gap-2">{saveFeedback.kind === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}{saveFeedback.message}</AlertDescription></Alert>}
        <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-lg border border-primary/20 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground" role="status">{isDirty ? "You have unsaved settings changes." : "Settings are saved. Receipt content has its own save action."}</div>
          <Button type="submit" disabled={update.isPending || Boolean(errors.businessEmail)} className="w-full gap-2 sm:w-auto"><Save className="h-4 w-4" />{update.isPending ? "Saving…" : "Save settings"}</Button>
        </div>
      </form>
    </div>
  );
}
