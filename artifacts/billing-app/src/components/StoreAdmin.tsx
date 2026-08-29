import { useState } from "react";
import {
  getGetStoresQueryKey,
  useCreateStore,
  useGetStores,
  useUpdateStore,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Plus, Save, Power } from "lucide-react";

export function StoreAdmin() {
  const { data: stores = [] } = useGetStores();
  const create = useCreateStore();
  const update = useUpdateStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getGetStoresQueryKey() });
  }

  function addStore() {
    if (!name.trim()) return;
    create.mutate({ data: { name: name.trim(), address: address || null, phone: phone || null, email: email || null, isDefault: stores.length === 0 } }, {
      onSuccess: () => {
        setName(""); setAddress(""); setPhone(""); setEmail(""); refresh();
        toast({ title: "Location added" });
      },
      onError: () => toast({ title: "Could not add location", variant: "destructive" }),
    });
  }

  function saveStore(store: typeof stores[number]) {
    update.mutate({ id: store.id, data: { name: editName.trim() || store.name, address: store.address, phone: store.phone, email: store.email, isDefault: store.isDefault, active: store.active } }, {
      onSuccess: () => { setEditingId(null); refresh(); toast({ title: "Location updated" }); },
      onError: () => toast({ title: "Could not update location", variant: "destructive" }),
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Locations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">Locations scope lists, reports, numbering, and new records. Existing single-store records remain available when no location is selected.</p>
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
          <div className="space-y-1.5"><Label>New location</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Downtown" /></div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Optional" /></div>
          <Button type="button" className="col-span-2 gap-2" onClick={addStore} disabled={create.isPending}><Plus className="h-4 w-4" /> Add location</Button>
        </div>
        <div className="space-y-2">
          {stores.map((store) => <div key={store.id} className="rounded-md border border-border p-3 space-y-2">
            {editingId === store.id ? <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus /> : <div className="font-medium">{store.name}{store.isDefault && <span className="ml-2 text-xs text-primary">DEFAULT</span>}</div>}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>{store.address || "No address"}</span><span>{store.phone || "No phone"}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(editingId === store.id ? null : store.id); setEditName(store.name); }}>{editingId === store.id ? "Cancel" : "Edit"}</Button>
              {editingId === store.id && <Button type="button" size="sm" className="gap-1" onClick={() => saveStore(store)}><Save className="h-3 w-3" /> Save</Button>}
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => update.mutate({ id: store.id, data: { name: store.name, address: store.address, phone: store.phone, email: store.email, isDefault: !store.isDefault, active: store.active } }, { onSuccess: refresh })}><Power className="h-3 w-3" /> {store.isDefault ? "Default" : "Make default"}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => update.mutate({ id: store.id, data: { name: store.name, address: store.address, phone: store.phone, email: store.email, isDefault: store.isDefault, active: !store.active } }, { onSuccess: refresh })}>{store.active ? "Disable" : "Enable"}</Button>
            </div>
          </div>)}
          {stores.length === 0 && <p className="text-sm text-muted-foreground">No locations configured yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}