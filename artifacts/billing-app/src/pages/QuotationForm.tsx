import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetQuotation, useCreateQuotation, useUpdateQuotation,
  useGetProducts, useGetServices, useGetCustomers,
  getGetQuotationQueryKey, getGetQuotationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react";

interface LineItemForm {
  type: "product" | "service" | "custom";
  productId?: number;
  serviceId?: number;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export default function QuotationForm() {
  const params = useParams<{ id?: string }>();
  const id = params?.id ? Number(params.id) : undefined;
  const isEdit = Boolean(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotation, isLoading } = useGetQuotation(id!, { query: { enabled: isEdit, queryKey: getGetQuotationQueryKey(id!) } });
  const { data: products } = useGetProducts();
  const { data: services } = useGetServices();
  const { data: customers } = useGetCustomers();
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerId, setCustomerId] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [items, setItems] = useState<LineItemForm[]>([{ type: "custom", name: "", description: "", quantity: 1, unitPrice: 0, discount: 0 }]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (quotation) {
      setCustomerName(quotation.customerName ?? "");
      setCustomerEmail(quotation.customerEmail ?? "");
      setCustomerId(quotation.customerId ?? undefined);
      setNotes(quotation.notes ?? "");
      setTaxRate(quotation.taxRate ?? 0);
      setDiscount(quotation.discount ?? 0);
      setExpiresAt(quotation.expiresAt ? quotation.expiresAt.split("T")[0] : "");
      if (quotation.items?.length) {
        setItems(quotation.items.map((i: any) => ({
          type: i.type, productId: i.productId ?? undefined, serviceId: i.serviceId ?? undefined,
          name: i.name, description: i.description ?? "", quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount ?? 0,
        })));
      }
    }
  }, [quotation]);

  function addItem(preset?: { type: "product" | "service"; id: number; name: string; price: number; description?: string }) {
    if (preset) {
      setItems(prev => [...prev, { type: preset.type, [preset.type + "Id"]: preset.id, name: preset.name, description: preset.description ?? "", quantity: 1, unitPrice: preset.price, discount: 0 }]);
    } else {
      setItems(prev => [...prev, { type: "custom", name: "", description: "", quantity: 1, unitPrice: 0, discount: 0 }]);
    }
  }

  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof LineItemForm, value: any) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  const lineSubtotals = items.map(i => Math.max(0, i.quantity * i.unitPrice - (i.discount || 0)));
  const subtotal = lineSubtotals.reduce((a, b) => a + b, 0);
  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * (taxRate / 100);
  const total = afterDiscount + tax;

  function selectCustomer(cid: string) {
    const c = customers?.find(c => c.id === Number(cid));
    if (c) { setCustomerId(c.id); setCustomerName(c.name); setCustomerEmail(c.email ?? ""); }
  }

  function handleSubmit(status: "draft" | "sent") {
    if (!items.length || items.every(i => !i.name)) {
      toast({ title: "Add at least one item", variant: "destructive" }); return;
    }
    const payload: any = {
      customerId, customerName: customerName || undefined, customerEmail: customerEmail || undefined,
      status, taxRate, discount, notes: notes || undefined,
      expiresAt: expiresAt || undefined,
      items: items.filter(i => i.name).map(i => ({
        type: i.type, productId: i.productId, serviceId: i.serviceId,
        name: i.name, description: i.description || undefined,
        quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount || 0,
      })),
    };
    const onSuccess = (q: any) => {
      queryClient.invalidateQueries({ queryKey: getGetQuotationsQueryKey() });
      toast({ title: isEdit ? "Quotation updated" : "Quotation created", description: q.quoteNumber });
      navigate(`/quotations/${q.id}`);
    };
    const onError = () => toast({ title: "Error saving", variant: "destructive" });
    if (isEdit) updateQuotation.mutate({ id: id!, data: payload }, { onSuccess, onError });
    else createQuotation.mutate({ data: payload }, { onSuccess, onError });
  }

  if (isEdit && isLoading) return <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>;

  const filteredProducts = products?.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()));
  const filteredServices = services?.filter(s => !productSearch || s.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/quotations")} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Quotation" : "New Quotation"}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Customer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Select Existing Customer</Label>
              <Select value={customerId ? String(customerId) : ""} onValueChange={selectCustomer}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Walk-in / New" /></SelectTrigger>
                <SelectContent>{customers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input className="h-8 text-sm" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input className="h-8 text-sm" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Quote Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tax Rate (%)</Label>
                <Input className="h-8 text-sm" type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Discount ($)</Label>
                <Input className="h-8 text-sm" type="number" step="0.01" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Valid Until</Label>
                <Input className="h-8 text-sm" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Quick Add from Catalog</CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-7 h-7 text-xs w-40" placeholder="Search..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {filteredProducts?.map(p => (
              <button key={`p-${p.id}`} type="button" onClick={() => addItem({ type: "product", id: p.id, name: p.name, price: p.price, description: p.description ?? "" })}
                className="text-left p-2 rounded border hover:border-primary hover:bg-primary/5 transition-colors text-xs">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-primary font-semibold">{formatCurrency(p.price)}</div>
              </button>
            ))}
            {filteredServices?.map(s => (
              <button key={`s-${s.id}`} type="button" onClick={() => addItem({ type: "service", id: s.id, name: s.name, price: s.price, description: s.description ?? "" })}
                className="text-left p-2 rounded border border-dashed hover:border-primary hover:bg-primary/5 transition-colors text-xs">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-teal-600 font-semibold">{formatCurrency(s.price)}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Line Items</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => addItem()} className="h-7 text-xs gap-1"><Plus className="h-3 w-3" /> Add Line</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start p-2 rounded border bg-muted/20">
              <div className="col-span-5 space-y-1">
                <Input className="h-7 text-xs" placeholder="Item name" value={item.name} onChange={e => updateItem(i, "name", e.target.value)} />
                <Input className="h-7 text-xs text-muted-foreground" placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Input className="h-7 text-xs" type="number" step="0.01" min="0.01" value={item.quantity} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 1)} />
              </div>
              <div className="col-span-2">
                <Input className="h-7 text-xs" type="number" step="0.01" min="0" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-2">
                <Input className="h-7 text-xs" type="number" step="0.01" min="0" value={item.discount} onChange={e => updateItem(i, "discount", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-1 flex items-center">
                <div className="text-xs font-semibold text-right w-full">{formatCurrency(lineSubtotals[i] || 0)}</div>
                {items.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive ml-1 shrink-0" onClick={() => removeItem(i)}><Trash2 className="h-3 w-3" /></Button>
                )}
              </div>
            </div>
          ))}
          <div className="mt-4 border-t pt-3 space-y-1 text-sm ml-auto max-w-xs">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>}
            {taxRate > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax ({taxRate}%)</span><span>{formatCurrency(tax)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        <Label className="text-sm">Notes (optional)</Label>
        <Textarea rows={2} placeholder="Terms, conditions, special notes..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => handleSubmit("draft")} disabled={createQuotation.isPending || updateQuotation.isPending}>
          {createQuotation.isPending || updateQuotation.isPending ? "Saving..." : isEdit ? "Update Quotation" : "Save as Draft"}
        </Button>
        <Button variant="outline" onClick={() => handleSubmit("sent")} disabled={createQuotation.isPending || updateQuotation.isPending}>Save & Mark Sent</Button>
        <Button variant="ghost" onClick={() => navigate("/quotations")}>Cancel</Button>
      </div>
    </div>
  );
}
