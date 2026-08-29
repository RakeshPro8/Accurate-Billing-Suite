import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useParams } from "wouter";
import {
  useCreateRepair, useUpdateRepair, useGetRepair, useGetCustomers,
  getGetRepairQueryKey, getGetRepairsQueryKey,
} from "@workspace/api-client-react";
import { useEmployees } from "@/lib/employees-api";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Wrench } from "lucide-react";
import { queueOfflineOperation } from "@/lib/offline-store";
import { apiUrl } from "@/lib/api-config";

const STATUS_OPTIONS = ["intake", "diagnostic", "waiting_parts", "in_progress", "ready_qa", "completed", "picked_up", "cancelled"];
const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];
const DEVICE_TYPES = ["Phone", "Tablet", "Laptop", "Desktop", "Watch", "Accessory", "Other"];

export default function RepairForm() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const isEditing = !!id;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const { data: existing, isLoading: loadingExisting } = useGetRepair(id, { query: { enabled: isEditing, queryKey: getGetRepairQueryKey(id) } });
  const { data: customers } = useGetCustomers();
  const { data: employees } = useEmployees();
  const createRepair = useCreateRepair();
  const updateRepair = useUpdateRepair();

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<any>({
    defaultValues: {
      deviceType: "Phone",
      priority: "normal",
      status: "intake",
      deposit: 0,
      total: 0,
      problemDescription: "",
    }
  });

  useEffect(() => {
    if (existing) {
      reset({
        customerId: existing.customerId || undefined,
        customerName: existing.customerName || "",
        customerPhone: existing.customerPhone || "",
        customerEmail: existing.customerEmail || "",
        deviceType: existing.deviceType,
        deviceBrand: existing.deviceBrand || "",
        deviceModel: existing.deviceModel || "",
        serialNumber: existing.serialNumber || "",
        imei: existing.imei || "",
        // Existing credentials are intentionally write-only and are never
        // returned in ordinary repair payloads.
        devicePassword: "",
        problemDescription: existing.problemDescription || "",
        diagnosticNotes: existing.diagnosticNotes || "",
        status: existing.status,
        priority: existing.priority,
        technicianId: existing.technicianId || undefined,
        estimatedCost: existing.estimatedCost ?? "",
        deposit: existing.deposit,
        total: existing.total,
      });
      if (existing.customerId) setSelectedCustomerId(String(existing.customerId));
    }
  }, [existing, reset]);

  const customerId = watch("customerId") || selectedCustomerId;
  useEffect(() => {
    if (customerId) {
      const customer = customers?.find(c => c.id === Number(customerId));
      if (customer) {
        setValue("customerName", customer.name);
        setValue("customerPhone", customer.phone || "");
        setValue("customerEmail", customer.email || "");
      }
    }
  }, [customerId, customers, setValue]);

  function onSubmit(data: any) {
    const {
      total: _serverTotal,
      status: _serverStatus,
      devicePassword,
      ...editable
    } = data;
    const payload = {
      ...editable,
      customerId: data.customerId ? Number(data.customerId) : undefined,
      technicianId: data.technicianId ? Number(data.technicianId) : undefined,
      estimatedCost: data.estimatedCost ? parseFloat(data.estimatedCost) : undefined,
      deposit: parseFloat(data.deposit || 0),
      ...(devicePassword ? { devicePassword } : {}),
    };

    if (isEditing) {
      updateRepair.mutate({ id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetRepairsQueryKey() });
          toast({ title: "Repair updated" });
          navigate(`/repairs/${id}`);
        },
        onError: () => toast({ title: "Error", description: "Failed to update repair.", variant: "destructive" }),
      });
    } else {
      createRepair.mutate({ data: payload }, {
        onSuccess: (repair) => {
          queryClient.invalidateQueries({ queryKey: getGetRepairsQueryKey() });
          toast({ title: "Repair created", description: repair.ticketNumber });
          navigate(`/repairs/${repair.id}`);
        },
        onError: async () => {
          if (!navigator.onLine) {
            await queueOfflineOperation({
              operationId: crypto.randomUUID(), action: "create_repair", method: "POST",
              url: apiUrl("/sync/replay"), body: payload,
            });
            toast({ title: "Repair queued for sync", description: "The server will allocate the ticket number when connection returns." });
            navigate("/repairs");
            return;
          }
          toast({ title: "Error", description: "Failed to create repair.", variant: "destructive" });
        },
      });
    }
  }

  if (isEditing && loadingExisting) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(isEditing ? `/repairs/${id}` : "/repairs")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? "Edit Repair" : "New Repair"}</h1>
          <p className="text-muted-foreground text-sm">{isEditing ? existing?.ticketNumber : "Create a work order"}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" /> Customer & Device</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Existing Customer</Label>
              <Select value={selectedCustomerId || "none"} onValueChange={v => { setSelectedCustomerId(v); setValue("customerId", v === "none" ? undefined : Number(v)); }}>
                <SelectTrigger><SelectValue placeholder="Select a customer (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Walk-in / New</SelectItem>
                  {customers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Customer Name</Label>
              <Input {...register("customerName")} placeholder="John Doe" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input {...register("customerPhone")} placeholder="+1 555 000 0000" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input {...register("customerEmail")} placeholder="customer@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Device Type *</Label>
              <Select value={watch("deviceType")} onValueChange={v => setValue("deviceType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Brand</Label>
              <Input {...register("deviceBrand")} placeholder="Apple, Samsung, etc." />
            </div>
            <div className="space-y-1">
              <Label>Model</Label>
              <Input {...register("deviceModel")} placeholder="iPhone 15 Pro" />
            </div>
            <div className="space-y-1">
              <Label>Serial Number</Label>
              <Input {...register("serialNumber")} placeholder="SN / IMEI" />
            </div>
            <div className="space-y-1">
              <Label>IMEI</Label>
              <Input {...register("imei")} placeholder="15-digit IMEI" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Device Password / Passcode</Label>
              <Input type="password" autoComplete="new-password" {...register("devicePassword")} placeholder="Stored securely for technician access" />
              <p className="text-xs text-muted-foreground">Only visible to signed-in staff. Do not share with customers.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Issue & Assignment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Problem Description *</Label>
              <Textarea {...register("problemDescription", { required: true })} rows={3} placeholder="Describe the issue and customer reported symptoms" />
              {errors.problemDescription && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Diagnostic Notes</Label>
              <Textarea {...register("diagnosticNotes")} rows={2} placeholder="Technician findings" />
            </div>
            <div className="space-y-1">
              <Label>Technician</Label>
              <Select value={watch("technicianId") ? String(watch("technicianId")) : "none"} onValueChange={v => setValue("technicianId", v === "none" ? undefined : Number(v))}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {employees?.filter(e => e.active).map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={watch("priority")} onValueChange={v => setValue("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={v => setValue("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Estimated Cost</Label>
              <Input {...register("estimatedCost")} type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Deposit</Label>
              <Input {...register("deposit")} type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Total</Label>
              <Input {...register("total")} type="number" step="0.01" placeholder="0.00" />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={createRepair.isPending || updateRepair.isPending} className="gap-1.5">
            <Save className="h-4 w-4" /> {isEditing ? "Save Changes" : "Create Repair"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(isEditing ? `/repairs/${id}` : "/repairs")}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
