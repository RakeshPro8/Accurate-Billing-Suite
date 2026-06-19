import { useEffect, useRef, useState } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, Percent, ImageIcon, Trash2, Upload } from "lucide-react";

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue } = useForm<any>();

  useEffect(() => {
    if (settings) {
      reset(settings);
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
    update.mutate({ data: { ...data, logoUrl: logoPreview ?? "" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved", description: "Your business settings have been updated." });
      },
      onError: () => toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" }),
    });
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input {...register("currency")} placeholder="USD" />
              </div>
              <div className="space-y-1.5">
                <Label>Default Tax Rate (%)</Label>
                <Input {...register("taxRate", { valueAsNumber: true })} type="number" step="0.01" placeholder="0" />
              </div>
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
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Thank You Message (shown on receipts)</Label>
                <Input {...register("thankYouMessage")} placeholder="Thank you for choosing us!" />
              </div>
            </div>
          </CardContent>
        </Card>

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
