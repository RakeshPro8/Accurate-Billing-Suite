import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api-config";
import { MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployee } from "@/context/EmployeeContext";
import { setOfflineScope } from "@/lib/offline-store";

interface Store { id: number; name: string; active: boolean; isDefault?: boolean; }
export function StoreSwitcher() {
  const { activeEmployee } = useEmployee();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeEmployee) return;
    const saved = localStorage.getItem(`mobilinq.storeId:${activeEmployee.id}`);
    setStoreId(saved ?? "all");
    void fetch(apiUrl("/stores"), { credentials: "include" })
      .then(async (response) => {
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(value?.error ?? `Unable to load stores (HTTP ${response.status}).`);
        return value;
      })
      .then(async (value: Store[]) => {
        setError(null);
        const activeStores = value.filter((store) => store.active);
        setStores(activeStores);
        const savedIsValid = saved && saved !== "all" && activeStores.some((store) => String(store.id) === saved);
        if (!savedIsValid && activeStores.length > 0) {
          const preferred = activeStores.find((store) => store.isDefault) ?? activeStores[0];
          const response = await fetch(apiUrl("/stores/current"), {
            method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storeId: preferred.id }),
          });
          if (response.ok) {
            localStorage.setItem(`mobilinq.storeId:${activeEmployee.id}`, String(preferred.id));
            setStoreId(String(preferred.id));
            setOfflineScope({ employeeId: activeEmployee.id, storeId: preferred.id });
            window.dispatchEvent(new CustomEvent("mobilinq:store-changed", { detail: preferred.id }));
          } else {
            const value = await response.json().catch(() => ({}));
            throw new Error(value?.error ?? `Unable to select a store (HTTP ${response.status}).`);
          }
        }
      })
      .catch((reason: unknown) => {
        setStores([]);
        setError(reason instanceof Error ? reason.message : "Unable to load stores.");
      });
  }, [activeEmployee?.id]);

  if (!activeEmployee || stores.length === 0) return null;

  async function selectStore(value: string) {
    const employee = activeEmployee;
    if (!employee) return;
    const id = value === "all" ? null : Number(value);
    try {
    const response = await fetch(apiUrl("/stores/current"), {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: id }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.error ?? `Unable to select a store (HTTP ${response.status}).`);
      return;
    }
    setError(null);
    localStorage.setItem(`mobilinq.storeId:${employee.id}`, value);
    setStoreId(value);
    setOfflineScope({ employeeId: employee.id, storeId: id });
    window.dispatchEvent(new CustomEvent("mobilinq:store-changed", { detail: id }));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to select a store.");
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <Select value={storeId} onValueChange={(value) => void selectStore(value)}>
        <SelectTrigger className="h-8 w-[142px] text-xs" aria-label="Current store">
          <SelectValue placeholder="All locations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All locations</SelectItem>
          {stores.map((store) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {error && <span role="status" className="sr-only">{error}</span>}
    </div>
  );
}