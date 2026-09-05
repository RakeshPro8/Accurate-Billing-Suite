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
import { Building2, Mail, Percent, ImageIcon, Trash2, Upload, Type, Download, ShieldCheck, MonitorCog, RefreshCw, Printer, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiUrl, getApiEndpointStatus } from "@/lib/api-config";
import { readDesktopDiagnostics, type DesktopDiagnostics } from "@/lib/desktop-diagnostics";
import { getLastSyncAt } from "@/lib/offline-store";
import { readUiPreferences, saveUiPreferences, UI_PREFERENCES_EVENT } from "@/lib/ui-preferences";
import { NotificationManagement } from "@/components/NotificationManagement";
import { TaxProfileAdmin } from "@/components/TaxProfileAdmin";
import { ReceiptContentEditor } from "@/components/ReceiptContentEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const { register, handleSubmit, reset, setValue, watch } = useForm<any>();
  const themeValue = (watch("theme") || settings?.theme || "terminal") as ThemePreset;
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
      label: "Berry",
      desc: "Expressive plum with rounded surfaces",
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
        toast({ title: "Settings saved", description: "Your business settings have been updated." });
      },
      onError: (error) => toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save settings.", variant: "destructive" }),
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Configure your business profile and billing preferences</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <DesktopDiagnosticsPanel />

        <NotificationManagement />

        {/* Logo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" /> Business Logo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Logo appears on invoices, quotations, and printed receipts. PNG or JPG under 500 KB recommended.
            </p>
            <div className="flex items-start gap-4">
              {logoPreview ? (
                <div className="relative group">
                  <img
                    src={logoPreview}
                    alt="Business logo"
                    className="h-20 max-w-[160px] object-contain rounded border bg-muted/20 p-1"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  className="h-20 w-36 border-2 border-dashed border-muted-foreground/30 rounded flex flex-col items-center justify-center text-muted-foreground/50 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-6 w-6 mb-1" />
                  <span className="text-xs">No logo</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> {logoPreview ? "Change Logo" : "Upload Logo"}
                </Button>
                {logoPreview && (
                  <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={removeLogo}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG, JPG, SVG · max 500 KB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Branding */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" /> App Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="appName">App Name</Label>
              <Input id="appName" {...register("appName")} placeholder="Mobilinq" />
              <p className="text-xs text-muted-foreground">Shown in the sidebar, mobile header, and browser tab.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Workspace Theme</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Choose a complete visual style for this location. Themes change surfaces, navigation, typography, spacing, borders, shadows, and controls—not just the accent color.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="radiogroup" aria-label="Workspace theme">
                {themes.map((t) => (
                  <div
                    key={t.id}
                    role="radio"
                    aria-label={`${t.label} theme`}
                    aria-checked={themeValue === t.id}
                    tabIndex={0}
                    onClick={() => setValue("theme", t.id, { shouldDirty: true })}
                     onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setValue("theme", t.id, { shouldDirty: true }); setThemeApplied(null); } }}
                    className={`cursor-pointer rounded-lg border p-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      themeValue === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div
                      className="h-14 rounded-md border border-black/10 p-2 mb-3 overflow-hidden"
                      style={{ background: t.surface }}
                    >
                      <div className="flex h-full gap-2">
                        <div className="w-1/4 rounded-sm" style={{ background: t.panel }} />
                        <div className="flex-1 space-y-1.5 pt-0.5">
                          <div className="h-1.5 w-2/5 rounded-full" style={{ background: t.color }} />
                          <div className="h-1.5 w-4/5 rounded-full opacity-20" style={{ background: t.color }} />
                          <div className="h-1.5 w-3/5 rounded-full opacity-20" style={{ background: t.color }} />
                        </div>
               <div className="mt-4 flex flex-wrap items-center gap-3">
                 <Button type="button" onClick={onApplyTheme} disabled={applyTheme.isPending} className="gap-2">
                   <CheckCircle2 className="h-4 w-4" /> {applyTheme.isPending ? "Applying…" : "Apply Theme"}
                 </Button>
                 <span className="text-xs text-muted-foreground" role="status">
                   {applyTheme.isPending ? "Saving the selected preset…" : themeApplied === themeValue ? "Applied to server and this device." : localTheme && settings?.theme && localTheme !== settings.theme ? `This device is using ${localTheme}; Apply Theme will reconcile it.` : "Theme changes are separate from Save Settings."}
                 </span>
               </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-black/10" style={{ background: t.color }} />
                        <span className="text-sm font-medium">{t.label}</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.mode}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Business Name</Label>
                <Input {...register("businessName")} placeholder="My Store" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Address</Label>
                <Textarea {...register("businessAddress")} placeholder="123 Main St, City, State, ZIP" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register("businessPhone")} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...register("businessEmail")} type="email" placeholder="hello@mystore.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" /> Billing Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="invoice" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit sm:grid-cols-2">
                <TabsTrigger value="invoice">Invoice &amp; Tax</TabsTrigger>
                <TabsTrigger value="receipt">Receipt Content</TabsTrigger>
              </TabsList>
              <TabsContent value="invoice" className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Currency</Label>
                    <Input {...register("currency")} placeholder="USD" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Default Tax Rate (%)</Label>
                    <Input {...register("taxRate", { valueAsNumber: true, min: 0, max: 100 })} type="number" step="0.01" min="0" max="100" placeholder="0" disabled={!taxEnabled} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tax display name</Label>
                    <Input {...register("taxName")} placeholder="Tax, GST, VAT…" />
                  </div>
                  <label className="flex items-center gap-2 text-sm col-span-2">
                    <input {...register("taxEnabled")} type="checkbox" className="h-4 w-4 accent-primary" />
                    <span>Apply tax to new sales and quotations</span>
                  </label>
                  <div className="space-y-1.5">
                    <Label>GST Rate (%) <span className="text-muted-foreground text-xs">e.g. 5 for Canada federal</span></Label>
                    <Input {...register("gstRate", { valueAsNumber: true })} type="number" step="0.001" placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>QST Rate (%) <span className="text-muted-foreground text-xs">e.g. 9.975 for Quebec</span></Label>
                    <Input {...register("qstRate", { valueAsNumber: true })} type="number" step="0.0001" placeholder="0" />
                  </div>
                  <p className="text-xs text-muted-foreground col-span-2">
                    {taxEnabled ? "The server applies this rate to new sales and quotations; saved invoices keep their original totals." : "Tax is disabled for new transactions. Existing GST/QST records remain unchanged."}
                  </p>
                  <div className="space-y-1.5">
                    <Label>Invoice Prefix</Label>
                    <Input {...register("invoicePrefix")} placeholder="INV-" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quote Prefix</Label>
                    <Input {...register("quotePrefix")} placeholder="QUO-" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Invoice Footer Text</Label>
                    <Textarea {...register("invoiceFooter")} placeholder="Thank you for your business!" rows={2} />
                    <p className="text-xs text-muted-foreground">Appears on full invoice printouts. Thermal receipt footer policy text is managed in Receipt Content.</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="receipt" className="pt-4">
                {settings && <ReceiptContentEditor settings={settings} />}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Backup &amp; recovery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Download a versioned, redacted JSON backup of operational data: catalog, customers, sales, quotations, repairs (without unlock codes), stores, tax/business settings, and audit metadata.
            </p>
            <p className="text-xs text-muted-foreground">
              Never included: employee PINs or hashes, sessions, SMTP passwords, device passwords, repair photos, or other credentials. Backups are for operators; restore is intentionally approval-gated and not available in the browser.
            </p>
            <Button type="button" variant="outline" className="gap-2" onClick={downloadBackup} disabled={backupLoading}>
              <Download className="h-4 w-4" /> {backupLoading ? "Preparing backup…" : "Download redacted backup"}
            </Button>
          </CardContent>
        </Card>

        <StoreAdmin />
        <TaxProfileAdmin />

        {/* SMTP */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Email Configuration (SMTP)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Configure your SMTP server to send invoices by email.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>SMTP Host</Label>
                <Input {...register("smtpHost")} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-1.5">
                <Label>SMTP Port</Label>
                <Input {...register("smtpPort", { valueAsNumber: true })} type="number" placeholder="587" />
              </div>
              <div className="space-y-1.5">
                <Label>SMTP Username</Label>
                <Input {...register("smtpUser")} placeholder="user@gmail.com" />
              </div>
              <div className="space-y-1.5">
                <Label>SMTP Password</Label>
                <Input {...register("smtpPass")} type="password" placeholder="••••••••" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={update.isPending} className="w-full sm:w-auto">
          {update.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
