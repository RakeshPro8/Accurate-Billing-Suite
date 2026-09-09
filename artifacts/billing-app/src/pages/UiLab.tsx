import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Check, ChevronRight, Eye, FlaskConical, RotateCcw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings } from "@workspace/api-client-react";
import {
  applyUiPreferencesToDocument,
  readUiPreferences,
  saveUiPreferences,
  type BackgroundTreatment,
  type ButtonShape,
  type CardTreatment,
  type Density,
  type ThemePreset,
  type TypographyTreatment,
  type UiPreferences,
} from "@/lib/ui-preferences";

const themes: Array<{
  id: ThemePreset;
  label: string;
  description: string;
  accent: string;
  surface: string;
  panel: string;
  mode: string;
}> = [
  { id: "terminal", label: "Terminal", description: "Dark, technical, and compact", accent: "hsl(173 100% 45%)", surface: "hsl(240 30% 8%)", panel: "hsl(240 40% 4%)", mode: "Dark" },
  { id: "ocean", label: "Ocean", description: "Bright workspace with navy navigation", accent: "hsl(199 89% 43%)", surface: "hsl(210 40% 97%)", panel: "hsl(222 45% 15%)", mode: "Light" },
  { id: "sunset", label: "Sunset", description: "Warm, welcoming, and editorial", accent: "hsl(15 80% 51%)", surface: "hsl(34 60% 96%)", panel: "hsl(20 60% 24%)", mode: "Light" },
  { id: "berry", label: "Burgundy", description: "Deep burgundy with rounded surfaces", accent: "hsl(327 78% 62%)", surface: "hsl(280 30% 8%)", panel: "hsl(280 40% 5%)", mode: "Dark" },
  { id: "forest", label: "Forest", description: "Natural green with calm white panels", accent: "hsl(154 60% 31%)", surface: "hsl(95 28% 96%)", panel: "hsl(150 40% 16%)", mode: "Light" },
  { id: "monochrome", label: "Monochrome", description: "Focused black, white, and gray", accent: "hsl(0 0% 12%)", surface: "hsl(0 0% 97%)", panel: "hsl(0 0% 14%)", mode: "Light" },
];

const labels: Record<keyof UiPreferences, string> = {
  theme: "Theme",
  buttonShape: "Button shape",
  background: "Background",
  card: "Card treatment",
  typography: "Typography",
  density: "Density",
};

function ChoiceButton({
  selected,
  onClick,
  children,
  className = "",
  label,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "secondary" : "outline"}
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={`h-auto min-h-12 justify-between px-3 py-2 text-left ${selected ? "border-primary/50 bg-primary/10" : ""} ${className}`}
    >
      <span className="min-w-0">{children}</span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
    </Button>
  );
}

function ThemePicker({ value, onChange }: { value: ThemePreset; onChange: (value: ThemePreset) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Theme preset">
      {themes.map((theme) => (
        <ChoiceButton key={theme.id} selected={value === theme.id} onClick={() => onChange(theme.id)} label={`${theme.label} theme preset`}>
          <span className="block overflow-hidden rounded-md border border-black/10 p-1.5" style={{ backgroundColor: theme.surface }}>
            <span className="flex h-7 gap-1.5">
              <span className="w-1/4 rounded-sm" style={{ backgroundColor: theme.panel }} />
              <span className="flex flex-1 flex-col justify-center gap-1">
                <span className="h-1 w-2/5 rounded-full" style={{ backgroundColor: theme.accent }} />
                <span className="h-1 w-4/5 rounded-full opacity-20" style={{ backgroundColor: theme.accent }} />
                <span className="h-1 w-3/5 rounded-full opacity-20" style={{ backgroundColor: theme.accent }} />
              </span>
            </span>
          </span>
          <span className="mt-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: theme.accent }} />
            <span className="text-sm font-medium">{theme.label}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{theme.mode}</span>
          </span>
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{theme.description}</span>
        </ChoiceButton>
      ))}
    </div>
  );
}

export default function UiLab() {
  const { data: settings, isLoading } = useGetSettings();
  const { toast } = useToast();
  const initialApplied = useMemo(() => readUiPreferences(), []);
  const [applied, setApplied] = useState<UiPreferences>(initialApplied);
  const [draft, setDraft] = useState<UiPreferences>(initialApplied);
  const [previewToggle, setPreviewToggle] = useState(true);
  const baselineRef = useRef(initialApplied);
  const serverTheme = (settings?.theme as ThemePreset | undefined) || "berry";
  const effectiveDraft = useMemo(() => ({ ...draft, theme: draft.theme ?? serverTheme }), [draft, serverTheme]);
  const effectiveApplied = useMemo(() => ({ ...applied, theme: applied.theme ?? serverTheme }), [applied, serverTheme]);
  const isDirty = JSON.stringify(effectiveDraft) !== JSON.stringify(effectiveApplied);

  useEffect(() => {
    if (baselineRef.current.theme === null && settings?.theme) {
      baselineRef.current = { ...baselineRef.current, theme: serverTheme };
    }
  }, [serverTheme, settings?.theme]);

  useEffect(() => {
    applyUiPreferencesToDocument(effectiveDraft, serverTheme);
  }, [effectiveDraft, serverTheme]);

  useEffect(() => {
    return () => applyUiPreferencesToDocument(baselineRef.current, serverTheme);
  }, [serverTheme]);

  function updatePreference<Key extends keyof UiPreferences>(key: Key, value: UiPreferences[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetDraft() {
    setDraft(effectiveApplied);
  }

  function applyChanges() {
    const next = { ...effectiveDraft };
    saveUiPreferences(next);
    setApplied(next);
    baselineRef.current = next;
    toast({ title: "Visual language applied", description: "Your UI preferences are saved on this device." });
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <Skeleton className="h-[32rem] w-full" />
          <Skeleton className="h-[32rem] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/settings" className="transition-colors hover:text-foreground">Settings</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground">UI Lab</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">UI Lab</h1>
              <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                Tune the operating surface without touching billing data. Changes stay local to this device until you apply them.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Admin-only workspace
        </div>
      </div>

      <Card className={`border-primary/25 ${isDirty ? "bg-primary/[0.06]" : ""}`}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${isDirty ? "bg-amber-500" : "bg-emerald-500"}`} />
            <div>
              <p className="text-sm font-semibold">{isDirty ? "Unsaved changes" : "All changes saved"}</p>
              <p className="text-xs text-muted-foreground">
                {isDirty ? "The workspace preview is live. Apply when the controls look right." : "This device is using the applied visual language."}
              </p>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button type="button" variant="outline" onClick={resetDraft} disabled={!isDirty} className="flex-1 sm:flex-none">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button type="button" onClick={applyChanges} disabled={!isDirty} className="flex-1 sm:flex-none">
              <Save className="h-4 w-4" /> Apply changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-5">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Visual controls
            </CardTitle>
            <CardDescription>Preview every change before it becomes part of the daily workspace.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="theme" className="w-full">
              <TabsList className="mx-4 mt-4 grid h-auto grid-cols-3">
                <TabsTrigger value="theme" className="px-2 py-2 text-xs">Theme</TabsTrigger>
                <TabsTrigger value="surfaces" className="px-2 py-2 text-xs">Surfaces</TabsTrigger>
                <TabsTrigger value="type" className="px-2 py-2 text-xs">Type</TabsTrigger>
              </TabsList>
              <TabsContent value="theme" className="space-y-4 px-4 pb-5 pt-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{labels.theme}</Label>
                  <p className="mb-3 mt-1 text-xs text-muted-foreground">Start with an existing Mobilinq workspace preset.</p>
                  <ThemePicker value={effectiveDraft.theme} onChange={(value) => updatePreference("theme", value)} />
                </div>
              </TabsContent>
              <TabsContent value="surfaces" className="space-y-5 px-4 pb-5 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="button-shape">Button shape</Label>
                  <Select value={draft.buttonShape} onValueChange={(value) => updatePreference("buttonShape", value as ButtonShape)}>
                    <SelectTrigger id="button-shape"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Theme default</SelectItem>
                      <SelectItem value="sharp">Sharp and focused</SelectItem>
                      <SelectItem value="soft">Soft corners</SelectItem>
                      <SelectItem value="pill">Pill controls</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Applies to buttons, fields, and other controls.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="background-treatment">Background treatment</Label>
                  <Select value={draft.background} onValueChange={(value) => updatePreference("background", value as BackgroundTreatment)}>
                    <SelectTrigger id="background-treatment"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="theme">Theme default</SelectItem>
                      <SelectItem value="plain">Plain workspace</SelectItem>
                      <SelectItem value="grid">Technical grid</SelectItem>
                      <SelectItem value="wash">Soft ambient wash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="card-treatment">Card treatment</Label>
                  <Select value={draft.card} onValueChange={(value) => updatePreference("card", value as CardTreatment)}>
                    <SelectTrigger id="card-treatment"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="theme">Theme default</SelectItem>
                      <SelectItem value="flat">Flat and quiet</SelectItem>
                      <SelectItem value="outlined">Accent outlines</SelectItem>
                      <SelectItem value="lifted">Lifted panels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="density">Density</Label>
                  <Select value={draft.density} onValueChange={(value) => updatePreference("density", value as Density)}>
                    <SelectTrigger id="density"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="theme">Theme default</SelectItem>
                      <SelectItem value="compact">Compact control room</SelectItem>
                      <SelectItem value="comfortable">Comfortable spacing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              <TabsContent value="type" className="space-y-4 px-4 pb-5 pt-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Typography</Label>
                  <p className="mb-3 mt-1 text-xs text-muted-foreground">Choose the reading rhythm for long billing sessions.</p>
                  <div className="space-y-2">
                    <ChoiceButton selected={draft.typography === "theme"} onClick={() => updatePreference("typography", "theme")} label="Theme default typography">
                      <span className="text-sm font-medium">Theme default</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">The preset’s recommended type system</span>
                    </ChoiceButton>
                    <ChoiceButton selected={draft.typography === "inter"} onClick={() => updatePreference("typography", "inter")} label="Inter Google Font typography">
                      <span className="text-sm font-medium">Inter</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Neutral, familiar, and highly legible</span>
                    </ChoiceButton>
                    <ChoiceButton selected={draft.typography === "space-grotesk"} onClick={() => updatePreference("typography", "space-grotesk")} label="Space Grotesk Google Font typography">
                      <span className="text-sm font-medium">Space Grotesk</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Distinctive, modern, and open</span>
                    </ChoiceButton>
                    <ChoiceButton selected={draft.typography === "dm-sans"} onClick={() => updatePreference("typography", "dm-sans")} label="DM Sans Google Font typography">
                      <span className="text-sm font-medium">DM Sans</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Warm, clear, and approachable</span>
                    </ChoiceButton>
                    <ChoiceButton selected={draft.typography === "ibm-plex-mono"} onClick={() => updatePreference("typography", "ibm-plex-mono")} label="IBM Plex Mono Google Font typography">
                      <span className="font-mono text-sm font-medium">IBM Plex Mono</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Precise with a technical voice</span>
                    </ChoiceButton>
                    <ChoiceButton selected={draft.typography === "jetbrains-mono"} onClick={() => updatePreference("typography", "jetbrains-mono")} label="JetBrains Mono Google Font typography">
                      <span className="font-mono text-sm font-medium">JetBrains Mono</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Dense, focused, and operational</span>
                    </ChoiceButton>
                    <ChoiceButton selected={draft.typography === "plus-jakarta"} onClick={() => updatePreference("typography", "plus-jakarta")} label="Plus Jakarta Sans Google Font typography">
                      <span className="text-sm font-medium">Plus Jakarta Sans</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Polished and friendly for daily work</span>
                    </ChoiceButton>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-card/80 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4 text-primary" /> Live specimen</CardTitle>
                <CardDescription className="mt-1">A small billing moment, rendered with the current draft.</CardDescription>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">Preview only</span>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5">
            <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
              <div className="grid min-h-[27rem] grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[9rem_minmax(0,1fr)]">
                <aside className="border-r bg-sidebar p-2 text-sidebar-foreground sm:p-3">
                  <div className="mb-5 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-primary">
                    <span className="h-2 w-2 rounded-full bg-sidebar-primary" /> Mobilinq
                  </div>
                  <div className="space-y-1 text-[10px] sm:text-xs">
                    {["Dashboard", "Sales", "Repairs", "Customers"].map((item, index) => (
                      <div key={item} className={`rounded-md px-2 py-2 ${index === 1 ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70"}`}>
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 hidden border-t border-sidebar-border pt-3 text-[10px] text-sidebar-foreground/50 sm:block">Admin tools</div>
                </aside>
                <main className={`ui-lab-preview-main min-w-0 p-3 sm:p-5 ${effectiveDraft.density === "compact" ? "ui-lab-density-compact" : effectiveDraft.density === "comfortable" ? "ui-lab-density-comfortable" : ""}`}>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tuesday, 14 May</p>
                      <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">Sales overview</h2>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => toast({ title: "Preview action", description: "This button is a live specimen, not a transaction." })}>Export</Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
                    <Card className="shadow-none">
                      <CardHeader className="p-4 pb-2">
                        <CardDescription>Open repair tickets</CardDescription>
                        <CardTitle className="text-2xl">18</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-1">
                        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" /> 4 ready for pickup
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-primary text-primary-foreground shadow-none">
                      <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-primary-foreground/70">Today’s sales</CardDescription>
                        <CardTitle className="text-2xl">$2,418.60</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-1 text-xs text-primary-foreground/75">12 completed invoices</CardContent>
                    </Card>
                  </div>
                  <Card className="mt-3">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-sm">Repair queue</CardTitle>
                          <CardDescription className="mt-1 text-xs">Latest work orders requiring attention</CardDescription>
                        </div>
                        <Switch checked={previewToggle} onCheckedChange={setPreviewToggle} aria-label="Show ready for pickup repairs" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 p-4 pt-2">
                      <div className="flex items-center justify-between gap-3 border-b pb-2 text-xs">
                        <div className="min-w-0"><p className="truncate font-medium">RQ-1048 · iPhone 13</p><p className="text-muted-foreground">Screen replacement</p></div>
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300">In progress</span>
                      </div>
                      <div className={`flex items-center justify-between gap-3 text-xs transition-opacity ${previewToggle ? "opacity-100" : "opacity-40"}`}>
                        <div className="min-w-0"><p className="truncate font-medium">RQ-1042 · Pixel 7</p><p className="text-muted-foreground">Battery service</p></div>
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] text-emerald-700 dark:text-emerald-300">Ready</span>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" onClick={() => toast({ title: "New sale", description: "The live specimen does not create a sale." })}>New sale</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setPreviewToggle((value) => !value)}>Toggle queue</Button>
                    <Input aria-label="Preview search" placeholder="Search repairs" className="h-8 max-w-[10rem] text-xs" />
                  </div>
                </main>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}