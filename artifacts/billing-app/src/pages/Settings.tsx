import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Building2, Mail, Percent, FileText } from "lucide-react";

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { register, handleSubmit, reset } = useForm<any>();

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  function onSubmit(data: any) {
    update.mutate({ data }, {
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
                <Label>Thank You Message</Label>
                <Input {...register("thankYouMessage")} placeholder="Thank you for choosing us!" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email (SMTP) */}
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
