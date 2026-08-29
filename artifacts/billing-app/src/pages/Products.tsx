import { useState } from "react";
import {
  useGetProducts, useGetServices,
  useCreateProduct, useUpdateProduct, useDeleteProduct,
  useCreateService, useUpdateService, useDeleteService,
  getGetProductsQueryKey, getGetServicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Package, Wrench, Search } from "lucide-react";

const PRODUCT_CATEGORIES = ["Phone Cases", "Screen Protectors", "Chargers & Cables", "Power Banks", "Earphones", "Tablet Accessories", "Memory Cards", "Other Accessories"];
const SERVICE_CATEGORIES = ["Screen Repair", "Battery Replacement", "Charging Port Repair", "Water Damage", "Software Fix", "Data Recovery", "Unlocking", "Other Repairs"];

function ProductModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: any }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>({
    defaultValues: editing || { unit: "pcs", stock: 0 }
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const create = useCreateProduct();
  const update = useUpdateProduct();

  function onSubmit(data: any) {
    const payload = {
      ...data,
      price: parseFloat(data.price),
      cost: data.cost ? parseFloat(data.cost) : undefined,
      ...(editing ? {} : { stock: parseInt(data.stock ?? "0") }),
    };
    if (editing) {
      update.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); toast({ title: "Product updated" }); onClose(); reset(); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); toast({ title: "Product added" }); onClose(); reset(); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Name *</Label>
              <Input {...register("name", { required: true })} defaultValue={editing?.name} />
            </div>
            <div className="space-y-1">
              <Label>SKU *</Label>
              <Input {...register("sku", { required: true })} defaultValue={editing?.sku} placeholder="SKU-001" />
            </div>
            <div className="space-y-1">
              <Label>Category *</Label>
              <Input {...register("category", { required: true })} defaultValue={editing?.category} list="prod-cats" />
              <datalist id="prod-cats">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1">
              <Label>Selling Price *</Label>
              <Input {...register("price", { required: true })} type="number" step="0.01" defaultValue={editing?.price} />
            </div>
            <div className="space-y-1">
              <Label>Cost Price</Label>
              <Input {...register("cost")} type="number" step="0.01" defaultValue={editing?.cost ?? ""} />
            </div>
            <div className="space-y-1">
              <Label>Stock Qty</Label>
              <Input {...register("stock")} type="number" defaultValue={editing?.stock ?? 0} />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Input {...register("unit")} defaultValue={editing?.unit ?? "pcs"} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Textarea {...register("description")} defaultValue={editing?.description ?? ""} rows={2} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={create.isPending || update.isPending} size="sm">
              {create.isPending || update.isPending ? "Saving..." : editing ? "Save" : "Add Product"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: any }) {
  const { register, handleSubmit } = useForm<any>({ defaultValues: editing });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const create = useCreateService();
  const update = useUpdateService();

  function onSubmit(data: any) {
    const payload = { ...data, price: parseFloat(data.price) };
    if (editing) {
      update.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetServicesQueryKey() }); toast({ title: "Service updated" }); onClose(); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetServicesQueryKey() }); toast({ title: "Service added" }); onClose(); },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit Service" : "Add Service"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Service Name *</Label>
              <Input {...register("name", { required: true })} defaultValue={editing?.name} placeholder="Screen Replacement" />
            </div>
            <div className="space-y-1">
              <Label>Category *</Label>
              <Input {...register("category", { required: true })} defaultValue={editing?.category} list="svc-cats" />
              <datalist id="svc-cats">{SERVICE_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1">
              <Label>Price *</Label>
              <Input {...register("price", { required: true })} type="number" step="0.01" defaultValue={editing?.price} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Duration</Label>
              <Input {...register("duration")} defaultValue={editing?.duration ?? ""} placeholder="1-2 hours" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Textarea {...register("description")} defaultValue={editing?.description ?? ""} rows={2} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={create.isPending || update.isPending} size="sm">
              {create.isPending || update.isPending ? "Saving..." : editing ? "Save" : "Add Service"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Products() {
  const [productModal, setProductModal] = useState<any>(null);
  const [serviceModal, setServiceModal] = useState<any>(null);
  const [search, setSearch] = useState("");
  const { data: products, isLoading: loadingP } = useGetProducts({ search: search || undefined });
  const { data: services, isLoading: loadingS } = useGetServices();
  const deleteProduct = useDeleteProduct();
  const deleteService = useDeleteService();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function handleDeleteProduct(id: number) {
    deleteProduct.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() }); toast({ title: "Deleted" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }
  function handleDeleteService(id: number) {
    deleteService.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetServicesQueryKey() }); toast({ title: "Deleted" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-5">
      {productModal !== null && (
        <ProductModal open={true} onClose={() => setProductModal(null)} editing={productModal === "new" ? null : productModal} />
      )}
      {serviceModal !== null && (
        <ServiceModal open={true} onClose={() => setServiceModal(null)} editing={serviceModal === "new" ? null : serviceModal} />
      )}

      <div>
        <h1 className="text-2xl font-bold">Products & Services</h1>
        <p className="text-muted-foreground text-sm">Manage your catalog</p>
      </div>

      <Tabs defaultValue="products">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="products" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Products</TabsTrigger>
            <TabsTrigger value="services" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Repair Services</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-sm w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <TabsContent value="products" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setProductModal("new")} className="gap-1.5"><Plus className="h-4 w-4" /> Add Product</Button>
          </div>
          {loadingP ? (
            <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-14 w-full"/>)}</div>
          ) : !products?.length ? (
            <Card><CardContent className="py-12 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No products yet. Add your first product.</p>
            </CardContent></Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">SKU</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Price</th>
                    <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">Stock</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-muted-foreground hidden md:table-cell font-mono text-xs">{p.sku}</td>
                      <td className="p-3 hidden sm:table-cell"><span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">{p.category}</span></td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(p.price)}</td>
                      <td className="p-3 text-right hidden sm:table-cell">
                        <span className={`text-xs font-medium ${p.stock <= 0 ? "text-red-500" : p.stock < 5 ? "text-amber-600" : "text-emerald-600"}`}>{p.stock} {p.unit}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setProductModal(p)}><Pencil className="h-3 w-3" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Product?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteProduct(p.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setServiceModal("new")} className="gap-1.5"><Plus className="h-4 w-4" /> Add Service</Button>
          </div>
          {loadingS ? (
            <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-14 w-full"/>)}</div>
          ) : !services?.length ? (
            <Card><CardContent className="py-12 text-center">
              <Wrench className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No services yet. Add your first repair service.</p>
            </CardContent></Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">Service</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Duration</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Price</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {services.map(s => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-medium">{s.name}</td>
                      <td className="p-3 hidden sm:table-cell"><span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">{s.category}</span></td>
                      <td className="p-3 text-muted-foreground hidden md:table-cell">{s.duration || "—"}</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(s.price)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setServiceModal(s)}><Pencil className="h-3 w-3" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Service?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteService(s.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
