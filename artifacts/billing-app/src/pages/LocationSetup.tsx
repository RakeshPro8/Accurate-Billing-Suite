import { useMemo } from "react";
import { useLocation } from "wouter";
import {
  getGetCurrentStoreQueryKey,
  getGetStoresQueryKey,
  setCurrentStore,
  useGetStores,
  useUpdateStore,
  type Store,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { StoreAdmin } from "@/components/StoreAdmin";
import { useEmployee } from "@/context/EmployeeContext";

function activeStorePayload(store: Store) {
  return {
    name: store.name,
    address: store.address,
    phone: store.phone,
    email: store.email,
    isDefault: true as const,
    active: true,
    provinceCode: store.provinceCode,
    currency: "CAD" as const,
  };
}

export default function LocationSetup() {
  const [, navigate] = useLocation();
  const { activeEmployee } = useEmployee();
  const { data: stores = [] } = useGetStores();
  const update = useUpdateStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const activeStores = useMemo(() => stores.filter((store) => store.active), [stores]);

  async function finish(store: Store) {
    if (!activeEmployee) return;
    await setCurrentStore({ storeId: store.id });
    localStorage.setItem(`mobilinq.storeId:${activeEmployee.id}`, String(store.id));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetStoresQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCurrentStoreQueryKey() }),
    ]);
    navigate("/");
  }

  function chooseExisting(store: Store) {
    update.mutate({ id: store.id, data: activeStorePayload(store) }, {
      onSuccess: (updated) => {
        void finish(updated).catch(() => {
          toast({ title: "Location saved, but could not select it", variant: "destructive" });
        });
      },
      onError: () => toast({ title: "Could not set the default location", variant: "destructive" }),
    });
  }

  if (activeEmployee?.role !== "admin") {
    return (
      <Card className="mx-auto max-w-2xl border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-400" /> Administrator setup required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>This installation does not have an active default location yet. Ask an administrator to sign in and create the first location before using store-scoped pages.</p>
          <p className="text-xs">Your account does not have permission to complete this setup.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><MapPin className="h-4 w-4" /> First-run setup</p>
        <h1 className="text-2xl font-bold">Create your first location</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mobilinq uses a default active location to scope sales, inventory, repairs, reports, and settings safely.</p>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <AlertTitle>Complete this step before continuing</AlertTitle>
        <AlertDescription>Create a location below, or choose an existing active location if one was already imported. It will become the default for this session.</AlertDescription>
      </Alert>

      <StoreAdmin onStoreCreated={(store) => { void finish(store).catch(() => toast({ title: "Location added, but could not select it", variant: "destructive" })); }} />

      {activeStores.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Choose an existing active location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeStores.map((store) => (
              <div key={store.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <p className="font-medium">{store.name}</p>
                  <p className="text-xs text-muted-foreground">{store.address || `${store.provinceCode} · ${store.currency}`}</p>
                </div>
                <Button type="button" size="sm" className="gap-1.5" onClick={() => chooseExisting(store)} disabled={update.isPending}>
                  Use as default <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}