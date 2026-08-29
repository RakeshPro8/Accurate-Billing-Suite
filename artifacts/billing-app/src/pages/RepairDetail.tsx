import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetRepair, useUpdateRepair, useUpdateRepairStatus, useAddRepairPhoto, useDeleteRepairPhoto,
  useAddRepairPart, useRemoveRepairPart, useGetProducts, useGetSettings,
  getGetRepairQueryKey, getGetRepairsQueryKey, getGetProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatCurrency, formatDate, formatDateTime, getRepairStatusColor, getRepairStatusLabel,
  getPriorityColor, fileToDataUrl, resizeImage, downloadCSV,
} from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useEmployee } from "@/context/EmployeeContext";
import { queueOfflineOperation } from "@/lib/offline-store";
import { recordAuditEvent } from "@/lib/audit-client";
import {
  ArrowLeft, Edit, Printer, Camera, Trash2, Plus, Package, CheckCircle, User, Phone, Mail,
  Wrench, FileText, Download, Send, Lock,
} from "lucide-react";

const STATUS_PIPELINE = [
  { key: "intake", label: "Intake", description: "Device received" },
  { key: "diagnostic", label: "Diagnostic", description: "Issue confirmed" },
  { key: "waiting_parts", label: "Waiting Parts", description: "Parts ordered" },
  { key: "in_progress", label: "In Progress", description: "Repair active" },
  { key: "ready_qa", label: "QA", description: "Quality check" },
  { key: "completed", label: "Ready", description: "Ready for pickup" },
  { key: "picked_up", label: "Picked Up", description: "Customer collected" },
];

export default function RepairDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeEmployee } = useEmployee();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const { data: repair, isLoading } = useGetRepair(id, { query: { queryKey: getGetRepairQueryKey(id) } });
  const { data: products } = useGetProducts();
  const { data: settings } = useGetSettings();
  const updateRepair = useUpdateRepair();
  const updateStatus = useUpdateRepairStatus();
  const addPhoto = useAddRepairPhoto();
  const deletePhoto = useDeleteRepairPhoto();
  const addPart = useAddRepairPart();
  const removePart = useRemoveRepairPart();

  const [statusNote, setStatusNote] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [photoCaption, setPhotoCaption] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [partSerial, setPartSerial] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showPartDialog, setShowPartDialog] = useState(false);

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (!repair) return <div className="text-center py-16 text-muted-foreground">Repair ticket not found.</div>;

  const r = repair;
  const parts = r.parts ?? [];
  const photos = r.photos ?? [];

  const currentStageIndex = STATUS_PIPELINE.findIndex(s => s.key === r.status);
  const isCompleted = r.status === "completed" || r.status === "picked_up";

  async function handleStatusChange(newStatus: string) {
    if (!navigator.onLine) {
      await queueOfflineOperation({
        operationId: crypto.randomUUID(), action: "repair_status", method: "POST",
        url: `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/sync/replay`,
        body: { repairId: id, status: newStatus, notes: statusNote },
        expectedVersion: r.updatedAt,
      });
      toast({ title: "Status queued for sync", description: "Customer notifications stay server-side and will not run while offline." });
      return;
    }
    updateStatus.mutate({ id, data: { status: newStatus, notes: statusNote, notify: notifyCustomer && !!r.customerEmail } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetRepairsQueryKey() });
        setStatusNote("");
        toast({ title: `Status updated to ${getRepairStatusLabel(newStatus)}` });
      },
      onError: (err: any) => toast({ title: "Error", description: err?.data?.error || "Failed to update status", variant: "destructive" }),
    });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file, 1200, 1200, 0.8);
      if (!navigator.onLine) {
        await queueOfflineOperation({
          operationId: crypto.randomUUID(), action: "repair_photo", method: "POST",
          url: `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/sync/replay`,
          body: { repairId: id, dataUrl: resized, caption: photoCaption },
        });
        setPhotoCaption("");
        setShowPhotoDialog(false);
        toast({ title: "Photo queued for sync", description: "The attachment will upload when connection returns." });
        return;
      }
      addPhoto.mutate({ id, data: { dataUrl: resized, caption: photoCaption } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey(id) });
          setPhotoCaption("");
          setShowPhotoDialog(false);
          toast({ title: "Photo added" });
        },
      });
    } catch {
      toast({ title: "Failed to process photo", variant: "destructive" });
    }
  }

  function handleAddPart() {
    const product = products?.find(p => p.id === Number(selectedProductId));
    if (!product) return;
    addPart.mutate({ id, data: { productId: product.id, name: product.name, quantity: partQty, unitPrice: product.price, serialNumber: partSerial || undefined } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        setSelectedProductId("");
        setPartQty(1);
        setPartSerial("");
        setShowPartDialog(false);
        toast({ title: "Part added", description: `${product.name} deducted from stock` });
      },
      onError: (err: any) => toast({ title: "Error", description: err?.data?.error || "Failed to add part", variant: "destructive" }),
    });
  }

  function handleRemovePart(partId: number) {
    removePart.mutate({ id, partId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
        toast({ title: "Part removed", description: "Stock restored" });
      },
    });
  }

  function handleDeletePhoto(photoId: number) {
    deletePhoto.mutate({ id, photoId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetRepairQueryKey(id) }),
    });
  }

  function handlePrint() {
    recordAuditEvent("print", "repair", id);
    window.print();
  }

  function handleCSV() {
    const rows = parts.map(p => [p.name, p.serialNumber ?? "", p.quantity, p.unitPrice, p.total]);
    downloadCSV(`${r.ticketNumber}_parts.csv`, rows, ["Part", "Serial", "Qty", "Unit Price", "Total"]);
  }

  return (
    <div className="space-y-4">
      <div className="no-print">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/repairs")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{r.ticketNumber}</h1>
            <p className="text-xs text-muted-foreground">Created {formatDate(r.createdAt)}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ml-2 ${getRepairStatusColor(r.status)}`}>
            {getRepairStatusLabel(r.status)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${getPriorityColor(r.priority)}`}>
            {r.priority}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button size="sm" variant="outline" onClick={handleCSV} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/repairs/${id}/edit`)} className="gap-1.5">
            <Edit className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </div>

      {/* Status Pipeline */}
      <Card className="no-print">
        <CardHeader className="pb-3"><CardTitle className="text-base">Repair Pipeline</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
            {STATUS_PIPELINE.map((stage, idx) => {
              const isActive = idx === currentStageIndex;
              const isPast = idx < currentStageIndex && r.status !== "cancelled";
              const isCancelled = r.status === "cancelled";
              return (
                <button
                  key={stage.key}
                  type="button"
                  disabled={isCancelled || isCompleted}
                  onClick={() => handleStatusChange(stage.key)}
                  className={`flex flex-col items-center min-w-[80px] px-2 py-2 rounded-md transition-colors ${
                    isActive ? "bg-primary/20 text-primary border border-primary/30" :
                    isPast ? "bg-muted text-muted-foreground" :
                    "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mb-1 ${
                    isActive ? "bg-primary text-primary-foreground" :
                    isPast ? "bg-emerald-500 text-white" : "bg-muted-foreground/20"
                  }`}>
                    {isPast ? <CheckCircle className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">{stage.label}</span>
                  <span className="text-[10px] text-muted-foreground text-center hidden sm:block">{stage.description}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <Textarea
              placeholder="Status note (visible to customer if notification enabled)"
              value={statusNote}
              onChange={e => setStatusNote(e.target.value)}
              rows={2}
              className="flex-1"
            />
            <div className="flex flex-col gap-2 shrink-0">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} className="rounded border-input" />
                Notify customer by email
              </label>
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("cancelled")} className="text-destructive hover:text-destructive">
                Cancel Repair
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Device & Customer</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Device</p>
                <p className="text-sm font-medium mt-0.5">{r.deviceType} {r.deviceBrand} {r.deviceModel}</p>
                {r.serialNumber && <p className="text-xs text-muted-foreground mt-1">SN: {r.serialNumber}</p>}
                {r.imei && <p className="text-xs text-muted-foreground mt-0.5">IMEI: {r.imei}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Customer</p>
                <p className="text-sm font-medium mt-0.5">{r.customerName || "Walk-in Customer"}</p>
                {r.customerPhone && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Phone className="h-3 w-3" />{r.customerPhone}</p>}
                {r.customerEmail && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Mail className="h-3 w-3" />{r.customerEmail}</p>}
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Problem</p>
                <p className="text-sm mt-1">{r.problemDescription}</p>
              </div>
              {r.diagnosticNotes && (
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Diagnostic Notes</p>
                  <p className="text-sm mt-1 text-muted-foreground">{r.diagnosticNotes}</p>
                </div>
              )}
              {r.devicePassword && (
                <div className="md:col-span-2 bg-muted/50 rounded p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Lock className="h-3 w-3" /> Device Password</p>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</Button>
                  </div>
                  <p className="text-sm font-mono mt-1">{showPassword ? r.devicePassword : "••••••••"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parts */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Parts Used</CardTitle>
              <Button size="sm" onClick={() => setShowPartDialog(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Part</Button>
            </CardHeader>
            <CardContent>
              {!parts.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">No parts recorded. Add parts to deduct from inventory.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium text-muted-foreground">Part</th>
                        <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Serial</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Qty</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Price</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parts.map(p => (
                        <tr key={p.id} className="hover:bg-muted/20">
                          <td className="p-3 font-medium">{p.name}</td>
                          <td className="p-3 text-muted-foreground hidden md:table-cell font-mono text-xs">{p.serialNumber || "—"}</td>
                          <td className="p-3 text-right">{p.quantity}</td>
                          <td className="p-3 text-right">{formatCurrency(p.unitPrice)}</td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(p.total)}</td>
                          <td className="p-3">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemovePart(p.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Intake Photos</CardTitle>
              <Button size="sm" onClick={() => setShowPhotoDialog(true)} className="gap-1.5"><Camera className="h-3.5 w-3.5" /> Add Photo</Button>
            </CardHeader>
            <CardContent>
              {!photos.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">No intake photos. Document pre-existing damage before r.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photos.map(photo => (
                    <div key={photo.id} className="group relative rounded-lg border overflow-hidden bg-muted">
                      <img src={photo.dataUrl} alt={photo.caption || "Repair photo"} className="w-full aspect-square object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                        <span className="text-xs text-white truncate">{photo.caption}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:text-destructive" onClick={() => handleDeletePhoto(photo.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg"><User className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Technician</p>
                  <p className="text-sm font-semibold">{r.technicianName || "Unassigned"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg"><Wrench className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Estimated Cost</p>
                  <p className="text-sm font-semibold">{r.estimatedCost ? formatCurrency(r.estimatedCost) : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Financials</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Parts Total</span><span className="font-medium">{formatCurrency(parts.reduce((s, p) => s + p.total, 0))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Deposit</span><span className="font-medium">{formatCurrency(r.deposit)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-semibold">Total</span><span className="font-bold">{formatCurrency(r.total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span className={`font-bold ${r.balance > 0 ? "text-amber-400" : "text-emerald-400"}`}>{formatCurrency(r.balance)}</span></div>
            </CardContent>
          </Card>

          {activeEmployee && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-2">Signed in as</p>
                <p className="text-sm font-semibold">{activeEmployee.name}</p>
                <p className="text-xs text-muted-foreground">{activeEmployee.role}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>

      {/* Print invoice area */}
      <div ref={invoiceRef} className="invoice-print-area hidden print:block">
        <div className="bg-white text-black rounded-xl border border-black/20 shadow-sm overflow-hidden p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {settings?.logoUrl && (
                  <div className="bg-white rounded border border-black/20 p-2">
                    <img src={settings.logoUrl} alt="Mobilinq" className="max-h-14 max-w-[140px] object-contain" />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-black">{settings?.businessName ?? "Mobilinq"}</h2>
                  <p className="text-lg font-mono text-black">{r.ticketNumber}</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-black/70">Created: {formatDate(r.createdAt)}</p>
              <p className="text-sm font-medium mt-1 text-black">Status: {getRepairStatusLabel(r.status)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs text-black/60 uppercase">Customer</p>
              <p className="font-medium text-black">{r.customerName || "Walk-in"}</p>
              <p className="text-sm text-black/70">{r.customerPhone}</p>
              <p className="text-sm text-black/70">{r.customerEmail}</p>
            </div>
            <div>
              <p className="text-xs text-black/60 uppercase">Device</p>
              <p className="font-medium text-black">{r.deviceType} {r.deviceBrand} {r.deviceModel}</p>
              <p className="text-sm text-black/70">SN: {r.serialNumber || "—"}</p>
              <p className="text-sm text-black/70">IMEI: {r.imei || "—"}</p>
            </div>
          </div>
          <div className="mb-8">
            <p className="text-xs text-black/60 uppercase">Problem</p>
            <p className="text-sm mt-1 text-black/90">{r.problemDescription}</p>
          </div>
          {parts.length > 0 && (
            <table className="w-full text-sm mb-8">
              <thead className="border-b border-black/20">
                <tr><th className="text-left py-2 text-black/70">Part</th><th className="text-right py-2 text-black/70">Qty</th><th className="text-right py-2 text-black/70">Price</th><th className="text-right py-2 text-black/70">Total</th></tr>
              </thead>
              <tbody>
                {parts.map(p => (
                  <tr key={p.id} className="border-b border-black/10">
                    <td className="py-2 text-black">{p.name}</td>
                    <td className="text-right py-2 text-black">{p.quantity}</td>
                    <td className="text-right py-2 text-black">{formatCurrency(p.unitPrice)}</td>
                    <td className="text-right py-2 font-medium text-black">{formatCurrency(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-end">
            <div className="w-56 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-black/70">Deposit</span><span className="text-black">{formatCurrency(r.deposit)}</span></div>
              <div className="flex justify-between font-bold border-t border-black/20 pt-2 text-black"><span>Balance Due</span><span>{formatCurrency(r.balance)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Photo dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Intake Photo</DialogTitle>
            <DialogDescription>Attach a photo documenting the device condition before repair.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Caption</Label>
              <Input value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} placeholder="e.g. Back glass crack" />
            </div>
            <div className="space-y-1">
              <Label>Photo</Label>
              <Input type="file" accept="image/*" onChange={handlePhotoUpload} />
            </div>
            <p className="text-xs text-muted-foreground">Photos are resized and stored securely for documentation.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Part dialog */}
      <Dialog open={showPartDialog} onOpenChange={setShowPartDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Part</DialogTitle>
            <DialogDescription>Select a product to deduct from stock and attach to this repair.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Product</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                <SelectContent>
                  {products?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.stock} in stock)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input type="number" min={1} value={partQty} onChange={e => setPartQty(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Serial (optional)</Label>
                <Input value={partSerial} onChange={e => setPartSerial(e.target.value)} placeholder="SN/IMEI" />
              </div>
            </div>
            <Button size="sm" onClick={handleAddPart} disabled={!selectedProductId} className="w-full">Add Part & Deduct Stock</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
