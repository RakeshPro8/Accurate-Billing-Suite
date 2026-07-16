import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useGetSale, useCreateSale, useUpdateSale, useGetProducts, useGetServices, useGetCustomers, getGetSaleQueryKey, getGetSalesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEmployee, ROLE_COLORS, ROLE_LABELS } from "@/context/EmployeeContext";
import { ArrowLeft, Plus, Trash2, Search, ShieldCheck, Star, AlertTriangle } from "lucide-react";

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

const PAYMENT_METHODS = ["Cash", "Credit Card", "Debit Card", "Bank Transfer", "Check", "Mobile Pay"];

export default function SaleForm({ isQuote = false }: { isQuote?: boolean }) {
  const params = useParams<{ id?: string }>();
  const id = params?.id ? Number(params.id) : undefined;
  const isEdit = Boolean(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeEmployee } = useEmployee();

  const { data: sale, isLoading } = useGetSale(id!, { query: { enabled: isEdit, queryKey: getGetSaleQueryKey(id!) } });
  const { data: products } = useGetProducts();
  const { data: services } = useGetServices();
  const { data: customers } = useGetCustomers();
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerId, setCustomerId] = useState<number | undefined>();
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [saveStatus, setSaveStatus] = useState<"draft" | "invoice">("invoice");
  const [items, setItems] = useState<LineItemForm[]>([{ type: "custom", name: "", description: "", quantity: 1, unitPrice: 0, discount: 0 }]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (sale) {
      setCustomerName(sale.customerName ?? "");
      setCustomerEmail(sale.customerEmail ?? "");
      setCustomerId(sale.customerId ?? undefined);
      setNotes(sale.notes ?? "");
      setPaymentMethod(sale.paymentMethod ?? "Cash");
      setTaxRate(sale.taxRate ?? 0);
      setDiscount(sale.discount ?? 0);
      setDueDate(sale.dueDate ?? "");
      if (sale.items?.length) {
        setItems(sale.items.map(i => ({
          type: i.type as any,
          productId: i.productId ?? undefined,
          serviceId: i.serviceId ?? undefined,
          name: i.name,
          description: i.description ?? "",
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount ?? 0,
        })));
      }
    }
  }, [sale]);

  function addItem(preset?: { type: "product" | "service"; id: number; name: string; price: number; description?: string }) {
    if (preset) {
      setItems(prev => [...prev, {
        type: preset.type,
        [preset.type + "Id"]: preset.id,
        name: preset.name,
        description: preset.description ?? "",
        quantity: 1,
        unitPrice: preset.price,
        discount: 0,
      }]);
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

  const discountPct = subtotal > 0 ? (discount / subtotal) * 100 : 0;
  const maxAllowedDiscount = activeEmployee ? activeEmployee.maxDiscountPct : 100;
  const discountExceedsLimit = activeEmployee && discount > 0 && discountPct > maxAllowedDiscount;

  function applyLoyaltyDiscount() {
    if (!selectedCustomer || !selectedCustomer.isLoyaltyMember) return;
    const loyaltyPct = parseFloat(selectedCustomer.loyaltyDiscountPct) || 0;
    if (loyaltyPct > 0 && subtotal > 0) {
      const loyaltyDiscount = (subtotal * loyaltyPct) / 100;
      setDiscount(Math.round(loyaltyDiscount * 100) / 100);
    }
  }

  function selectCustomer(cid: string) {
    const c = customers?.find(c => c.id === Number(cid));
    if (c) {
      setCustomerId(c.id);
      setCustomerName(c.name);
      setCustomerEmail(c.email ?? "");
      setSelectedCustomer(c);
    }
  }

  function handleSubmit(status: "draft" | "invoice" | "paid") {
    if (!items.length || items.every(i => !i.name)) {
      toast({ title: "Add at least one item", variant: "destructive" }); return;
    }
    if (discountExceedsLimit) {
      toast({ title: `Discount exceeds your limit (${maxAllowedDiscount}%)`, description: "Reduce the discount or ask a manager.", variant: "destructive" });
      return;
    }
    const payload: any = {
      customerId, customerName: customerName || undefined, customerEmail: customerEmail || undefined,
      employeeId: activeEmployee?.id || undefined,
      status, taxRate, discount, notes: notes || undefined,
      paymentMethod: paymentMethod || undefined, dueDate: dueDate || undefined,
      items: items.filter(i => i.name).map(i => ({
        type: i.type, productId: i.productId, serviceId: i.serviceId,
        name: i.name, description: i.description || undefined,
        quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount || 0,
      })),
    };
    const onSuccess = (s: any) => {
      queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() });
      toast({ title: isEdit ? "Invoice updated" : "Invoice created", description: s.invoiceNumber });
      navigate(`/sales/${s.id}`);
    };
    const onError = (e: any) => toast({ title: e?.message ?? "Error saving", variant: "destructive" });
    if (isEdit) updateSale.mutate({ id: id!, data: payload }, { onSuccess, onError });
    else createSale.mutate({ data: payload }, { onSuccess, onError });
  }

  if (isEdit && isLoading) return <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>;

  const filteredProducts = products?.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()));
  const filteredServices = services?.filter(s => !productSearch || s.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sales")} className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{isEdit ? "Edit Invoice" : "New Invoice"}</h1>
        </div>
        {activeEmployee ? (
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-primary/30 bg-primary/5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{activeEmployee.name}</span>
            <span className={`${ROLE_COLORS[activeEmployee.role]}`}>· {ROLE_LABELS[activeEmployee.role]}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded border border-border">
            <ShieldCheck className="h-3.5 w-3.5" />
            No employee signed in
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Customer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Select Existing Customer</Label>
              <Select value={customerId ? String(customerId) : ""} onValueChange={selectCustomer}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Walk-in / New Customer" /></SelectTrigger>
                <SelectContent>
                  {customers?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="flex items-center gap-1.5">
                        {(c as any).isLoyaltyMember && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCustomer?.isLoyaltyMember && (
              <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Loyalty Member — {parseFloat(selectedCustomer.loyaltyDiscountPct)}% discount</span>
                </div>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-amber-400 hover:text-amber-300" onClick={applyLoyaltyDiscount}>
                  Apply
                </Button>
              </div>
            )}
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

        {/* Invoice Settings */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Invoice Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tax Rate (%)</Label>
                <Input className="h-8 text-sm" type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  Discount ($)
                  {activeEmployee && <span className="text-muted-foreground">(max {maxAllowedDiscount}%)</span>}
                </Label>
                <Input
                  className={`h-8 text-sm ${discountExceedsLimit ? "border-destructive" : ""}`}
                  type="number" step="0.01"
                  value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                />
                {discountExceedsLimit && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Exceeds your {maxAllowedDiscount}% limit
                  </p>
                )}
                {activeEmployee && discount > 0 && !discountExceedsLimit && subtotal > 0 && (
                  <p className="text-xs text-muted-foreground">{discountPct.toFixed(1)}% of subtotal</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Due Date</Label>
                <Input className="h-8 text-sm" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Add from Catalog */}
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
                <div className="text-primary font-semibold">{formatCurrency(s.price)}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
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
                <Input className="h-7 text-xs text-muted-foreground" placeholder="Description (optional)" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Input className="h-7 text-xs" type="number" step="0.01" min="0.01" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 1)} />
              </div>
              <div className="col-span-2">
                <Input className="h-7 text-xs" type="number" step="0.01" min="0" placeholder="Price" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-2">
                <Input className="h-7 text-xs" type="number" step="0.01" min="0" placeholder="Disc" value={item.discount} onChange={e => updateItem(i, "discount", parseFloat(e.target.value) || 0)} />
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
        <Textarea rows={2} placeholder="Any notes for this invoice..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => handleSubmit("invoice")} disabled={createSale.isPending || updateSale.isPending || !!discountExceedsLimit}>
          {createSale.isPending || updateSale.isPending ? "Saving..." : isEdit ? "Update Invoice" : "Create Invoice"}
        </Button>
        <Button variant="outline" onClick={() => handleSubmit("paid")} disabled={createSale.isPending || updateSale.isPending || !!discountExceedsLimit}>Mark as Paid</Button>
        <Button variant="ghost" onClick={() => handleSubmit("draft")} disabled={createSale.isPending || updateSale.isPending}>Save as Draft</Button>
        <Button variant="ghost" onClick={() => navigate("/sales")}>Cancel</Button>
      </div>
    </div>
  );
}
