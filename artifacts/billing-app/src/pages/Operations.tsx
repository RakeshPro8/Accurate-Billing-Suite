import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetInventoryMovementsQueryKey,
  getGetInventorySummaryQueryKey,
  getGetPurchaseOrdersQueryKey,
  getGetSuppliersQueryKey,
  getSearchOperationProductsQueryKey,
  useAdjustInventory,
  useCreatePurchaseOrder,
  useCreateSupplier,
  useGetInventoryMovements,
  useGetInventorySummary,
  useGetPurchaseOrders,
  useGetSuppliers,
  useReceivePurchaseOrder,
  useReleaseInventoryReservation,
  useReserveInventory,
  useSearchOperationProducts,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Database,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Undo2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type UnknownRecord = Record<string, unknown>;

type ProductOption = {
  id: number;
  name: string;
  sku: string;
  category: string;
  stock: number;
  reorderPoint: number;
  cost: number;
  unit: string;
};

type PurchaseLine = {
  id: number;
  productId: number;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  name: string;
  sku: string;
};

type LocalReservation = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  referenceId: string;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};

const stringValue = (value: unknown, fallback = "—") =>
  typeof value === "string" && value.trim() ? value : typeof value === "number" ? String(value) : fallback;

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const idValue = (value: unknown, fallback: number) => Math.max(0, Math.round(numberValue(value, fallback)));

const dateValue = (value: unknown) => {
  if (!value) return "No timestamp";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "No timestamp"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
};

const currency = (value: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(value);

const makeIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `ops-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeProduct = (value: unknown, index: number): ProductOption => {
  const row = asRecord(value);
  return {
    id: idValue(row.id ?? row.productId, index + 1),
    name: stringValue(row.name ?? row.productName, "Unnamed product"),
    sku: stringValue(row.sku, "No SKU"),
    category: stringValue(row.category, "Accessory"),
    stock: numberValue(row.stock ?? row.onHand),
    reorderPoint: numberValue(row.reorderPoint ?? row.reorder_level),
    cost: numberValue(row.cost ?? row.unitCost),
    unit: stringValue(row.unit, "pcs"),
  };
};

const normalizeMovement = (value: unknown, index: number) => {
  const row = asRecord(value);
  return {
    id: idValue(row.id, index + 1),
    productId: idValue(row.productId, 0),
    productName: stringValue(row.productName ?? row.name, "Inventory item"),
    quantity: numberValue(row.quantity),
    reason: stringValue(row.reason, "Unspecified"),
    employeeName: stringValue(row.employeeName ?? row.employee, "Team member"),
    createdAt: row.createdAt ?? row.timestamp,
  };
};

const normalizeSupplier = (value: unknown, index: number) => {
  const row = asRecord(value);
  return {
    id: idValue(row.id, index + 1),
    name: stringValue(row.name, "Unnamed supplier"),
    email: stringValue(row.email, "No email"),
    phone: stringValue(row.phone, "No phone"),
  };
};

const normalizeOrder = (value: unknown, index: number) => {
  const row = asRecord(value);
  const lines = Array.isArray(row.lines)
    ? row.lines.map((line, lineIndex) => {
        const item = asRecord(line);
        return {
          id: idValue(item.id ?? item.purchaseOrderLineId, lineIndex + 1),
          productId: idValue(item.productId, 0),
          quantity: numberValue(item.quantity),
          receivedQuantity: numberValue(item.receivedQuantity),
          unitCost: numberValue(item.unitCost),
          name: stringValue(item.productName ?? item.name, "Product line"),
          sku: stringValue(item.sku, "No SKU"),
        } satisfies PurchaseLine;
      })
    : [];
  return {
    id: idValue(row.id, index + 1),
    orderNumber: stringValue(row.orderNumber ?? row.number, `PO-${String(index + 1).padStart(5, "0")}`),
    supplierId: idValue(row.supplierId, 0),
    status: stringValue(row.status, "open"),
    createdAt: row.createdAt,
    lines,
  };
};

function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{detail}</p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Package;
  tone?: "cyan" | "amber" | "red" | "slate";
}) {
  const toneClass = {
    cyan: "border-primary/25 bg-primary/[0.06] text-primary",
    amber: "border-amber-400/25 bg-amber-400/[0.06] text-amber-300",
    red: "border-destructive/30 bg-destructive/[0.07] text-red-300",
    slate: "border-border bg-secondary/35 text-foreground",
  }[tone];
  return (
    <Card className={`relative overflow-hidden border transition-transform duration-200 hover:-translate-y-0.5 ${toneClass}`} data-testid={`card-metric-${label.toLowerCase().replaceAll(" ", "-")}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground" data-testid={`text-metric-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className="rounded-md border border-current/20 bg-background/25 p-2"><Icon className="h-4 w-4" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Operations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [poProductId, setPoProductId] = useState("");
  const [poQuantity, setPoQuantity] = useState("1");
  const [poUnitCost, setPoUnitCost] = useState("");
  const [poLines, setPoLines] = useState<PurchaseLine[]>([]);
  const [localOrderLines, setLocalOrderLines] = useState<Record<number, PurchaseLine[]>>({});
  const [receiveLineId, setReceiveLineId] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState("1");
  const [receiveUnitCost, setReceiveUnitCost] = useState("");
  const [localReservations, setLocalReservations] = useState<LocalReservation[]>([]);

  const productQuery = useSearchOperationProducts(
    { q: searchTerm.trim() || undefined },
    { query: { queryKey: getSearchOperationProductsQueryKey({ q: searchTerm.trim() || undefined }) } },
  );
  const summaryQuery = useGetInventorySummary();
  const movementsQuery = useGetInventoryMovements();
  const suppliersQuery = useGetSuppliers();
  const ordersQuery = useGetPurchaseOrders();

  const adjustInventory = useAdjustInventory();
  const createSupplier = useCreateSupplier();
  const createPurchaseOrder = useCreatePurchaseOrder();
  const receivePurchaseOrder = useReceivePurchaseOrder();
  const reserveInventory = useReserveInventory();
  const releaseReservation = useReleaseInventoryReservation();

  const adjustmentForm = useForm({ defaultValues: { productId: "", quantity: "", reason: "" } });
  const supplierForm = useForm({ defaultValues: { name: "", email: "" } });
  const [adjustmentIdempotencyKey] = useState(makeIdempotencyKey);
  const [supplierId, setSupplierId] = useState("");
  const [reserveProductId, setReserveProductId] = useState("");
  const [reserveQuantity, setReserveQuantity] = useState("1");
  const [reserveReference, setReserveReference] = useState("");
  const [receiveIdempotencyKey] = useState(makeIdempotencyKey);

  const inventoryItems = useMemo(() => {
    const raw = asRecord(summaryQuery.data).items;
    return Array.isArray(raw) ? raw.map(normalizeProduct) : [];
  }, [summaryQuery.data]);
  const searchedItems = useMemo(() => (productQuery.data ?? []).map(normalizeProduct), [productQuery.data]);
  const productOptions = searchTerm.trim() ? searchedItems : (searchedItems.length ? searchedItems : inventoryItems);
  const lowStockItems = inventoryItems.filter((item) => item.stock <= item.reorderPoint);
  const movementItems = useMemo(() => (movementsQuery.data ?? []).map(normalizeMovement), [movementsQuery.data]);
  const supplierItems = useMemo(() => (suppliersQuery.data ?? []).map(normalizeSupplier), [suppliersQuery.data]);
  const orderItems = useMemo(() => (ordersQuery.data ?? []).map(normalizeOrder), [ordersQuery.data]);
  const selectedOrder = orderItems.find((order) => order.id === selectedOrderId);
  const selectedOrderLines = selectedOrder?.lines.length ? selectedOrder.lines : (selectedOrderId ? localOrderLines[selectedOrderId] ?? [] : []);

  const invalidateInventory = () => {
    queryClient.invalidateQueries({ queryKey: getGetInventorySummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetInventoryMovementsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getSearchOperationProductsQueryKey() });
  };

  const handleError = (error: unknown, fallback: string) => {
    toast({ title: stringValue(asRecord(error).message, fallback), description: "The server kept the operation unchanged.", variant: "destructive" });
  };

  const submitAdjustment = adjustmentForm.handleSubmit((values) => {
    const productId = Number(values.productId);
    const quantity = Number(values.quantity);
    if (!productId || !Number.isFinite(quantity) || quantity === 0 || !values.reason.trim()) {
      toast({ title: "Complete the adjustment", description: "Choose a product, enter a non-zero quantity, and give a reason.", variant: "destructive" });
      return;
    }
    adjustInventory.mutate(
      { data: { productId, quantity, reason: values.reason.trim(), idempotencyKey: adjustmentIdempotencyKey } },
      {
        onSuccess: () => {
          invalidateInventory();
          setAdjustOpen(false);
          adjustmentForm.reset();
          toast({ title: "Inventory adjustment recorded", description: "The movement is now part of the append-only trail." });
        },
        onError: (error) => handleError(error, "Adjustment was not recorded"),
      },
    );
  });

  const submitSupplier = supplierForm.handleSubmit((values) => {
    if (!values.name.trim()) {
      toast({ title: "Supplier name required", variant: "destructive" });
      return;
    }
    createSupplier.mutate(
      { data: { name: values.name.trim(), ...(values.email.trim() ? { email: values.email.trim() } : {}) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
          setSupplierOpen(false);
          supplierForm.reset();
          toast({ title: "Supplier added", description: values.name.trim() });
        },
        onError: (error) => handleError(error, "Supplier could not be added"),
      },
    );
  });

  const addPoLine = () => {
    const product = productOptions.find((item) => item.id === Number(poProductId));
    const quantity = Number(poQuantity);
    const unitCost = Number(poUnitCost);
    if (!product || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      toast({ title: "Line needs attention", description: "Select a product and enter positive quantity and cost.", variant: "destructive" });
      return;
    }
    setPoLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) return current.map((line) => line.productId === product.id ? { ...line, quantity: line.quantity + quantity, unitCost } : line);
      return [...current, { id: Date.now(), productId: product.id, quantity, receivedQuantity: 0, unitCost, name: product.name, sku: product.sku }];
    });
    setPoProductId("");
    setPoQuantity("1");
    setPoUnitCost("");
  };

  const submitOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supplierId || !poLines.length) {
      toast({ title: "Add a supplier and at least one line", variant: "destructive" });
      return;
    }
    createPurchaseOrder.mutate(
      { data: { supplierId: Number(supplierId), lines: poLines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitCost: line.unitCost })) } },
      {
        onSuccess: (result) => {
          const orderId = idValue(asRecord(result).id, 0);
          const returnedLines = normalizeOrder(result, 0).lines;
          if (orderId && returnedLines.length) setLocalOrderLines((current) => ({ ...current, [orderId]: returnedLines }));
          queryClient.invalidateQueries({ queryKey: getGetPurchaseOrdersQueryKey() });
          setOrderOpen(false);
          setSupplierId("");
          setPoLines([]);
          toast({ title: "Purchase order created", description: "It is ready for receiving at the counter." });
        },
        onError: (error) => handleError(error, "Purchase order could not be created"),
      },
    );
  };

  const openReceive = (orderId: number) => {
    setSelectedOrderId(orderId);
    const lines = orderItems.find((order) => order.id === orderId)?.lines ?? localOrderLines[orderId] ?? [];
    setReceiveLineId(lines[0] ? String(lines[0].id) : "");
    setReceiveQuantity("1");
    setReceiveUnitCost(lines[0]?.unitCost ? String(lines[0].unitCost) : "");
    setReceiveOpen(true);
  };

  const submitReceipt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = Number(selectedOrderId);
    const lineId = Number(receiveLineId);
    const quantity = Number(receiveQuantity);
    const unitCost = receiveUnitCost === "" ? undefined : Number(receiveUnitCost);
    if (!id || !lineId || !Number.isFinite(quantity) || quantity <= 0 || (unitCost !== undefined && (!Number.isFinite(unitCost) || unitCost < 0))) {
      toast({ title: "Complete the receipt", description: "Enter an order line, quantity, and optional non-negative supplier cost.", variant: "destructive" });
      return;
    }
    receivePurchaseOrder.mutate(
      { id, data: { idempotencyKey: receiveIdempotencyKey, lines: [{ purchaseOrderLineId: lineId, quantity, ...(unitCost === undefined ? {} : { unitCost }) }] } },
      {
        onSuccess: () => {
          invalidateInventory();
          queryClient.invalidateQueries({ queryKey: getGetPurchaseOrdersQueryKey() });
          setReceiveOpen(false);
          toast({ title: "Shipment received", description: "Stock and the movement trail were updated by the server." });
        },
        onError: (error) => handleError(error, "Shipment could not be received"),
      },
    );
  };

  const submitReservation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const productId = Number(reserveProductId);
    const quantity = Number(reserveQuantity);
    const referenceId = reserveReference.trim();
    if (!productId || !Number.isFinite(quantity) || quantity <= 0 || !referenceId) {
      toast({ title: "Reservation needs a repair reference", description: "Choose a product, quantity, and repair reference.", variant: "destructive" });
      return;
    }
    reserveInventory.mutate(
      { data: { productId, quantity, referenceType: "repair", referenceId } as never },
      {
        onSuccess: (result) => {
          const reservationId = idValue(asRecord(result).id, 0);
          if (reservationId) {
            const product = productOptions.find((item) => item.id === productId);
            setLocalReservations((current) => [...current, { id: reservationId, productId, productName: product?.name ?? "Inventory item", quantity, referenceId }]);
          }
          invalidateInventory();
          setReserveOpen(false);
          setReserveReference("");
          toast({ title: "Stock reserved", description: `Held against repair ${referenceId}.` });
        },
        onError: (error) => handleError(error, "Stock could not be reserved"),
      },
    );
  };

  const release = (reservation: LocalReservation) => {
    releaseReservation.mutate(
      { id: reservation.id },
      {
        onSuccess: () => {
          setLocalReservations((current) => current.filter((item) => item.id !== reservation.id));
          invalidateInventory();
          toast({ title: "Reservation released", description: `Repair ${reservation.referenceId} can be re-planned.` });
        },
        onError: (error) => handleError(error, "Reservation could not be released"),
      },
    );
  };

  const isInitialLoading = summaryQuery.isLoading || suppliersQuery.isLoading || ordersQuery.isLoading;

  return (
    <div className="space-y-7 pb-10">
      <section className="relative overflow-hidden rounded-lg border border-primary/20 bg-card px-5 py-6 shadow-md shadow-black/10 sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[28px] border-primary/10" />
        <div className="pointer-events-none absolute bottom-[-70px] right-24 h-44 w-44 rounded-full border border-amber-300/15" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-primary">
              <div className="rounded-md border border-primary/25 bg-primary/10 p-1.5"><Database className="h-4 w-4" /></div>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em]">Store operations / live ledger</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">Keep the counter moving.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">One view for stock health, supplier receipts, and the parts your repair bench needs next. Server authority stays intact; every change leaves a trace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button data-testid="button-open-adjustment" onClick={() => setAdjustOpen(true)} className="gap-2">
              <ArrowUpRight className="h-4 w-4" /> Adjust stock
            </Button>
            <Button data-testid="button-open-order" variant="outline" onClick={() => setOrderOpen(true)} className="gap-2 border-primary/30">
              <Truck className="h-4 w-4" /> New purchase order
            </Button>
          </div>
        </div>
      </section>

      {isInitialLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Tracked SKUs" value={String(inventoryItems.length)} detail="Active in this store" icon={Package} />
          <MetricCard label="Units on hand" value={String(inventoryItems.reduce((sum, item) => sum + item.stock, 0))} detail="Server-reported quantity" icon={Database} tone="slate" />
          <MetricCard label="Needs attention" value={String(lowStockItems.length)} detail="At or below reorder point" icon={AlertTriangle} tone={lowStockItems.length ? "amber" : "cyan"} />
          <MetricCard label="Open orders" value={String(orderItems.filter((item) => item.status !== "received" && item.status !== "closed").length)} detail="Waiting on a receipt" icon={ClipboardList} tone="slate" />
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 pb-4">
            <SectionHeading eyebrow="01 / stock desk" title="Find an active product" detail="Search by product name or SKU, then send it directly into an operational action." />
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input data-testid="input-product-search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search name or SKU" className="h-10 pl-9" />
              {productQuery.isFetching && <RefreshCw className="absolute right-3 top-3 h-4 w-4 animate-spin text-primary" />}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {productQuery.isError ? (
              <div className="flex items-center gap-3 p-6 text-sm text-destructive" data-testid="status-product-error"><AlertTriangle className="h-4 w-4" /> Product search is unavailable. Try again shortly.</div>
            ) : productQuery.isLoading ? (
              <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div>
            ) : productOptions.length ? (
              <div className="divide-y divide-border/60">
                {productOptions.slice(0, 8).map((product) => (
                  <div key={product.id} className="flex flex-col gap-3 px-5 py-3 transition-colors hover:bg-secondary/35 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-operation-product-${product.id}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" data-testid={`text-operation-product-${product.id}`}>{product.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{product.sku} · {product.category}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right">
                        <p className={`font-mono text-sm font-semibold ${product.stock <= product.reorderPoint ? "text-amber-300" : "text-foreground"}`}>{product.stock} {product.unit}</p>
                        <p className="text-[10px] text-muted-foreground">reorder at {product.reorderPoint}</p>
                      </div>
                      <Button data-testid={`button-adjust-product-${product.id}`} size="sm" variant="ghost" className="gap-1 text-primary" onClick={() => { adjustmentForm.setValue("productId", String(product.id)); setAdjustOpen(true); }}>
                        Adjust <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center" data-testid="empty-operation-products"><Package className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-2 text-sm font-medium">No active products found</p><p className="mt-1 text-xs text-muted-foreground">Try a different name or SKU.</p></div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 pb-4">
            <SectionHeading eyebrow="02 / exception queue" title="Low stock first" detail="Resolve the items most likely to stall a repair or a sale." />
          </CardHeader>
          <CardContent className="p-0">
            {lowStockItems.length ? lowStockItems.slice(0, 6).map((product) => (
              <button type="button" key={product.id} data-testid={`button-low-stock-${product.id}`} onClick={() => { adjustmentForm.setValue("productId", String(product.id)); setAdjustOpen(true); }} className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-5 py-3 text-left transition-colors hover:bg-amber-300/[0.06]">
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{product.name}</span><span className="font-mono text-[10px] text-muted-foreground">{product.sku}</span></span>
                <span className="shrink-0 text-right"><span className="block font-mono text-sm font-semibold text-amber-300">{product.stock} / {product.reorderPoint}</span><span className="text-[10px] text-muted-foreground">on hand / floor</span></span>
              </button>
            )) : <div className="p-8 text-center" data-testid="empty-low-stock"><Check className="mx-auto h-7 w-7 text-primary" /><p className="mt-2 text-sm font-medium">Counter is covered</p><p className="mt-1 text-xs text-muted-foreground">Nothing is below its reorder point.</p></div>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><SectionHeading eyebrow="03 / suppliers" title="Supplier directory" detail="Keep the trusted buying list close to the replenishment work." action={<Button data-testid="button-open-supplier" size="sm" variant="outline" onClick={() => setSupplierOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add supplier</Button>} /></CardHeader>
          <CardContent className="p-0">
            {suppliersQuery.isError ? <div className="p-6 text-sm text-destructive" data-testid="status-supplier-error">Supplier directory could not be loaded.</div> : supplierItems.length ? <div className="divide-y divide-border/60">{supplierItems.slice(0, 7).map((supplier) => <div key={supplier.id} className="flex items-center justify-between gap-3 px-5 py-3" data-testid={`row-supplier-${supplier.id}`}><div className="flex min-w-0 items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary font-mono text-xs text-primary">{supplier.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{supplier.name}</p><p className="truncate text-xs text-muted-foreground">{supplier.email}</p></div></div><span className="font-mono text-[10px] text-muted-foreground">SUP-{String(supplier.id).padStart(3, "0")}</span></div>)}</div> : <div className="p-8 text-center" data-testid="empty-suppliers"><Truck className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-2 text-sm font-medium">No suppliers yet</p><p className="mt-1 text-xs text-muted-foreground">Add the first buying contact to start a purchase order.</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><SectionHeading eyebrow="04 / buying" title="Purchase orders" detail="Create orders here, then receive only what arrived." action={<Button data-testid="button-open-order-secondary" size="sm" variant="outline" onClick={() => setOrderOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New order</Button>} /></CardHeader>
          <CardContent className="p-0">
            {ordersQuery.isError ? <div className="p-6 text-sm text-destructive" data-testid="status-order-error">Purchase orders could not be loaded.</div> : orderItems.length ? <div className="divide-y divide-border/60">{orderItems.slice(0, 7).map((order) => <div key={order.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-purchase-order-${order.id}`}><div><p className="font-mono text-sm font-semibold text-primary">{order.orderNumber}</p><p className="mt-0.5 text-xs text-muted-foreground">{dateValue(order.createdAt)} · {order.lines.length ? `${order.lines.length} line${order.lines.length === 1 ? "" : "s"}` : "line detail on receipt"}</p></div><div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{order.status.replaceAll("_", " ")}</Badge><Button data-testid={`button-receive-order-${order.id}`} size="sm" variant="ghost" className="gap-1 text-primary" onClick={() => openReceive(order.id)}>Receive <ArrowDownToLine className="h-3.5 w-3.5" /></Button></div></div>)}</div> : <div className="p-8 text-center" data-testid="empty-purchase-orders"><ClipboardList className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-2 text-sm font-medium">No purchase orders</p><p className="mt-1 text-xs text-muted-foreground">A new order will appear here for receiving.</p></div>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader><SectionHeading eyebrow="05 / repair bench" title="Reserve parts" detail="Hold stock against a repair reference without hand-editing totals." action={<Button data-testid="button-open-reservation" size="sm" variant="outline" onClick={() => setReserveOpen(true)} className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Reserve part</Button>} /></CardHeader>
          <CardContent className="p-0">
            {localReservations.length ? <div className="divide-y divide-border/60">{localReservations.map((reservation) => <div key={reservation.id} className="flex items-center justify-between gap-3 px-5 py-3" data-testid={`row-reservation-${reservation.id}`}><div className="min-w-0"><p className="truncate text-sm font-medium">{reservation.productName}</p><p className="font-mono text-[10px] uppercase tracking-wider text-primary">{reservation.quantity} held · {reservation.referenceId}</p></div><Button data-testid={`button-release-reservation-${reservation.id}`} size="sm" variant="ghost" className="shrink-0 gap-1 text-muted-foreground hover:text-destructive" disabled={releaseReservation.isPending} onClick={() => release(reservation)}><Undo2 className="h-3.5 w-3.5" /> Release</Button></div>)}</div> : <div className="p-8 text-center" data-testid="empty-reservations"><Wrench className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-2 text-sm font-medium">No active holds in this session</p><p className="mt-1 text-xs text-muted-foreground">Reserve a part when a repair is ready for the bench.</p></div>}
            <div className="border-t border-border/60 bg-secondary/20 px-5 py-3 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-primary" /> Reservation identity and stock authority stay on the server.</div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader><SectionHeading eyebrow="06 / audit feed" title="Latest inventory movements" detail="An append-only view of who moved what, when, and why." action={<span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> newest first</span>} /></CardHeader>
          <CardContent className="p-0">
            {movementsQuery.isError ? <div className="p-6 text-sm text-destructive" data-testid="status-movement-error">Movement feed could not be loaded.</div> : movementItems.length ? <div className="max-h-[400px] divide-y divide-border/60 overflow-auto">{movementItems.slice(0, 30).map((movement) => <div key={movement.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3" data-testid={`row-movement-${movement.id}`}><div className={`rounded-md p-2 ${movement.quantity < 0 ? "bg-destructive/10 text-red-300" : "bg-primary/10 text-primary"}`}>{movement.quantity < 0 ? <ArrowUpRight className="h-3.5 w-3.5 rotate-90" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{movement.productName}</p><p className="truncate text-xs text-muted-foreground">{movement.reason} · {movement.employeeName}</p></div><div className="text-right"><p className={`font-mono text-sm font-semibold ${movement.quantity < 0 ? "text-red-300" : "text-primary"}`}>{movement.quantity > 0 ? "+" : ""}{movement.quantity}</p><p className="whitespace-nowrap text-[10px] text-muted-foreground">{dateValue(movement.createdAt)}</p></div></div>)}</div> : <div className="p-8 text-center" data-testid="empty-movements"><Clock3 className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-2 text-sm font-medium">No movements recorded</p><p className="mt-1 text-xs text-muted-foreground">Adjustments and receipts will appear here.</p></div>}
          </CardContent>
        </Card>
      </section>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record stock adjustment</DialogTitle><DialogDescription>Manager authorization is enforced by the API. Use a reason that will still make sense during a stocktake.</DialogDescription></DialogHeader>
          <form onSubmit={submitAdjustment} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="adjust-product">Product</Label><select id="adjust-product" data-testid="select-adjust-product" {...adjustmentForm.register("productId")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Choose a product</option>{productOptions.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="adjust-quantity">Change in units</Label><Input id="adjust-quantity" data-testid="input-adjust-quantity" {...adjustmentForm.register("quantity")} type="number" step="1" placeholder="+10 or -1" /></div><div className="rounded-md border border-amber-400/20 bg-amber-400/[0.05] p-3 text-xs text-muted-foreground"><span className="font-mono text-[10px] uppercase tracking-wider text-amber-300">Ledger rule</span><p className="mt-1">No direct total editing. Only a signed movement is accepted.</p></div></div>
            <div className="space-y-1.5"><Label htmlFor="adjust-reason">Reason <span className="text-destructive">*</span></Label><Textarea id="adjust-reason" data-testid="input-adjust-reason" {...adjustmentForm.register("reason")} placeholder="Cycle count, damaged packaging, found in back stock…" rows={3} /></div>
            <p className="font-mono text-[10px] text-muted-foreground">IDEMPOTENCY KEY · {adjustmentIdempotencyKey.slice(0, 18)}…</p>
            <DialogFooter><Button data-testid="button-cancel-adjustment" type="button" variant="ghost" onClick={() => setAdjustOpen(false)}>Cancel</Button><Button data-testid="button-submit-adjustment" type="submit" disabled={adjustInventory.isPending}>{adjustInventory.isPending ? "Recording…" : "Record movement"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add supplier</DialogTitle><DialogDescription>Keep the buying contact concise. More supplier fields can be maintained by the operations API.</DialogDescription></DialogHeader>
          <form onSubmit={submitSupplier} className="space-y-4"><div className="space-y-1.5"><Label htmlFor="supplier-name">Supplier name</Label><Input id="supplier-name" data-testid="input-supplier-name" {...supplierForm.register("name")} placeholder="Northline Distribution" /></div><div className="space-y-1.5"><Label htmlFor="supplier-email">Email <span className="text-muted-foreground">(optional)</span></Label><Input id="supplier-email" data-testid="input-supplier-email" {...supplierForm.register("email")} type="email" placeholder="buying@northline.example" /></div><DialogFooter><Button data-testid="button-cancel-supplier" type="button" variant="ghost" onClick={() => setSupplierOpen(false)}>Cancel</Button><Button data-testid="button-submit-supplier" type="submit" disabled={createSupplier.isPending}>{createSupplier.isPending ? "Adding…" : "Add supplier"}</Button></DialogFooter></form>
        </DialogContent>
      </Dialog>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New purchase order</DialogTitle><DialogDescription>Build a server-authorized order from selected product lines. Costs are supplier costs, not selling prices.</DialogDescription></DialogHeader>
          <form onSubmit={submitOrder} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="po-supplier">Supplier</Label><select id="po-supplier" data-testid="select-po-supplier" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Choose a supplier</option>{supplierItems.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
            <div className="grid gap-2 sm:grid-cols-[1.4fr_0.55fr_0.7fr_auto]"><select data-testid="select-po-product" value={poProductId} onChange={(event) => { setPoProductId(event.target.value); const product = productOptions.find((item) => item.id === Number(event.target.value)); if (product && !poUnitCost) setPoUnitCost(String(product.cost || "")); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Add a product line</option>{productOptions.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select><Input data-testid="input-po-quantity" value={poQuantity} onChange={(event) => setPoQuantity(event.target.value)} type="number" min="1" step="1" placeholder="Qty" /><Input data-testid="input-po-cost" value={poUnitCost} onChange={(event) => setPoUnitCost(event.target.value)} type="number" min="0" step="0.01" placeholder="Unit cost" /><Button data-testid="button-add-po-line" type="button" variant="outline" onClick={addPoLine}><Plus className="h-4 w-4" /></Button></div>
            <div className="rounded-md border border-border/70">{poLines.length ? <div className="divide-y divide-border/60">{poLines.map((line) => <div key={line.productId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm" data-testid={`row-po-line-${line.productId}`}><div><span className="font-medium">{line.name}</span><span className="ml-2 font-mono text-[10px] text-muted-foreground">{line.sku}</span></div><div className="flex items-center gap-3"><span className="font-mono text-xs">{line.quantity} × {currency(line.unitCost)}</span><button type="button" data-testid={`button-remove-po-line-${line.productId}`} onClick={() => setPoLines((current) => current.filter((item) => item.productId !== line.productId))} className="text-muted-foreground transition-colors hover:text-destructive"><X className="h-4 w-4" /></button></div></div>)}</div> : <p className="px-3 py-5 text-center text-xs text-muted-foreground">No lines yet. Add products above.</p>}</div>
            <DialogFooter><Button data-testid="button-cancel-order" type="button" variant="ghost" onClick={() => setOrderOpen(false)}>Cancel</Button><Button data-testid="button-submit-order" type="submit" disabled={createPurchaseOrder.isPending}>{createPurchaseOrder.isPending ? "Creating…" : "Create purchase order"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Receive partial shipment</DialogTitle><DialogDescription>Receive only the units that physically arrived. A second receipt can complete the remaining balance.</DialogDescription></DialogHeader>
          <form onSubmit={submitReceipt} className="space-y-4">
            <div className="rounded-md border border-primary/20 bg-primary/[0.05] px-3 py-2 font-mono text-xs text-primary">{selectedOrder?.orderNumber ?? "Purchase order"}</div>
            {selectedOrderLines.length ? <div className="space-y-1.5"><Label htmlFor="receive-line">Purchase order line</Label><select id="receive-line" data-testid="select-receive-line" value={receiveLineId} onChange={(event) => { setReceiveLineId(event.target.value); const line = selectedOrderLines.find((item) => item.id === Number(event.target.value)); if (line) setReceiveUnitCost(String(line.unitCost)); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{selectedOrderLines.map((line) => <option key={line.id} value={line.id}>{line.name} · {line.quantity - line.receivedQuantity} outstanding</option>)}</select></div> : <div className="space-y-1.5"><Label htmlFor="receive-line-id">Purchase order line ID</Label><Input id="receive-line-id" data-testid="input-receive-line-id" value={receiveLineId} onChange={(event) => setReceiveLineId(event.target.value)} type="number" placeholder="Line ID from order" /></div>}
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="receive-quantity">Received quantity</Label><Input id="receive-quantity" data-testid="input-receive-quantity" value={receiveQuantity} onChange={(event) => setReceiveQuantity(event.target.value)} type="number" min="0.01" step="0.01" /></div><div className="space-y-1.5"><Label htmlFor="receive-cost">Supplier cost</Label><Input id="receive-cost" data-testid="input-receive-cost" value={receiveUnitCost} onChange={(event) => setReceiveUnitCost(event.target.value)} type="number" min="0" step="0.01" placeholder="Keep order cost" /></div></div>
            <p className="font-mono text-[10px] text-muted-foreground">RECEIPT KEY · {receiveIdempotencyKey.slice(0, 18)}…</p>
            <DialogFooter><Button data-testid="button-cancel-receive" type="button" variant="ghost" onClick={() => setReceiveOpen(false)}>Cancel</Button><Button data-testid="button-submit-receive" type="submit" disabled={receivePurchaseOrder.isPending}>{receivePurchaseOrder.isPending ? "Receiving…" : "Receive shipment"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reserve stock for repair</DialogTitle><DialogDescription>Stock is held immediately by the server. Use the repair ticket reference so the bench can find it again.</DialogDescription></DialogHeader>
          <form onSubmit={submitReservation} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="reserve-product">Product</Label><select id="reserve-product" data-testid="select-reserve-product" value={reserveProductId} onChange={(event) => setReserveProductId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Choose a product</option>{productOptions.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.stock} on hand</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="reserve-quantity">Quantity</Label><Input id="reserve-quantity" data-testid="input-reserve-quantity" value={reserveQuantity} onChange={(event) => setReserveQuantity(event.target.value)} type="number" min="0.01" step="0.01" /></div><div className="space-y-1.5"><Label htmlFor="reserve-reference">Repair reference</Label><Input id="reserve-reference" data-testid="input-reserve-reference" value={reserveReference} onChange={(event) => setReserveReference(event.target.value)} placeholder="REP-1042" /></div></div>
            <div className="rounded-md border border-border/70 bg-secondary/20 p-3 text-xs text-muted-foreground"><UserRound className="mr-1 inline h-3.5 w-3.5 text-primary" /> The signed-in employee and current store are attached by the API.</div>
            <DialogFooter><Button data-testid="button-cancel-reservation" type="button" variant="ghost" onClick={() => setReserveOpen(false)}>Cancel</Button><Button data-testid="button-submit-reservation" type="submit" disabled={reserveInventory.isPending}>{reserveInventory.isPending ? "Reserving…" : "Reserve stock"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}