import { useState } from "react";
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, Employee } from "@/lib/employees-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ROLE_LABELS, ROLE_COLORS } from "@/context/EmployeeContext";
import { Plus, Pencil, Trash2, ShieldCheck, UserX, UserCheck, KeyRound, Percent } from "lucide-react";

const ROLES: Array<"admin" | "manager" | "staff"> = ["admin", "manager", "staff"];

const ROLE_DISCOUNT_DEFAULTS: Record<string, number> = {
  admin: 100,
  manager: 25,
  staff: 10,
};

interface FormState {
  name: string;
  email: string;
  pin: string;
  role: "admin" | "manager" | "staff";
  maxDiscountPct: number;
  active: boolean;
}

const DEFAULT_FORM: FormState = {
  name: "", email: "", pin: "", role: "staff", maxDiscountPct: 10, active: true,
};

export default function Employees() {
  const { data: employees, isLoading } = useEmployees();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  function openCreate() {
    setEditId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditId(emp.id);
    setForm({
      name: emp.name,
      email: emp.email ?? "",
      pin: "",
      role: emp.role as any,
      maxDiscountPct: emp.maxDiscountPct,
      active: emp.active,
    });
    setDialogOpen(true);
  }

  function handleRoleChange(role: "admin" | "manager" | "staff") {
    setForm(f => ({ ...f, role, maxDiscountPct: ROLE_DISCOUNT_DEFAULTS[role] }));
  }

  function handleSave() {
    if (!form.name.trim()) { toast({ title: "Name is required.", variant: "destructive" }); return; }
    if (!editId && (form.pin.length < 4 || form.pin.length > 8)) {
      toast({ title: "PIN must be 4-8 digits.", variant: "destructive" }); return;
    }
    const data: any = {
      name: form.name.trim(),
      email: form.email || undefined,
      role: form.role,
      maxDiscountPct: form.maxDiscountPct,
      active: form.active,
    };
    if (form.pin) data.pin = form.pin;

    if (editId) {
      updateEmployee.mutate({ id: editId, data }, {
        onSuccess: () => { toast({ title: "Employee updated" }); setDialogOpen(false); },
        onError: (e: any) => toast({ title: e.message ?? "Error", variant: "destructive" }),
      });
    } else {
      data.pin = form.pin;
      createEmployee.mutate(data, {
        onSuccess: () => { toast({ title: "Employee added" }); setDialogOpen(false); },
        onError: (e: any) => toast({ title: e.message ?? "Error", variant: "destructive" }),
      });
    }
  }

  function handleDelete(id: number) {
    deleteEmployee.mutate(id, {
      onSuccess: () => { toast({ title: "Employee removed" }); setDeleteConfirmId(null); },
      onError: (e: any) => toast({ title: e.message ?? "Error", variant: "destructive" }),
    });
  }

  function toggleActive(emp: Employee) {
    updateEmployee.mutate({ id: emp.id, data: { active: !emp.active } }, {
      onSuccess: () => toast({ title: emp.active ? "Employee deactivated" : "Employee activated" }),
      onError: (e: any) => toast({ title: e.message ?? "Error", variant: "destructive" }),
    });
  }

  const byRole = {
    admin: employees?.filter(e => e.role === "admin") ?? [],
    manager: employees?.filter(e => e.role === "manager") ?? [],
    staff: employees?.filter(e => e.role === "staff") ?? [],
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Employees
          </h1>
          <p className="text-muted-foreground text-sm">Manage staff, roles, and discount authorizations</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Add Employee</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(["admin", "manager", "staff"] as const).map(role => (
          <Card key={role} className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-semibold uppercase tracking-wider ${ROLE_COLORS[role]}`}>
                {ROLE_LABELS[role]}s
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {byRole[role].length}
              <span className="text-xs text-muted-foreground font-normal ml-2">
                {byRole[role].filter(e => e.active).length} active
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !employees?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">No employees yet. Add your first team member.</p>
            <Button className="mt-4 gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" /> Add Employee</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {employees.map(emp => (
                <div key={emp.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${emp.active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {emp.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.email ?? "No email"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <Badge variant="outline" className={`text-xs font-medium ${ROLE_COLORS[emp.role]}`}>
                        {ROLE_LABELS[emp.role]}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Percent className="h-3 w-3" /> Max {emp.maxDiscountPct}% discount
                      </span>
                    </div>
                    <Badge variant={emp.active ? "default" : "secondary"} className="text-xs">
                      {emp.active ? "Active" : "Inactive"}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={emp.active ? "Deactivate" : "Activate"} onClick={() => toggleActive(emp)}>
                        {emp.active ? <UserX className="h-3.5 w-3.5 text-muted-foreground" /> : <UserCheck className="h-3.5 w-3.5 text-emerald-400" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(emp)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirmId(emp.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@store.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> {editId ? "New PIN (optional)" : "PIN *"}</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  value={form.pin}
                  onChange={e => /^\d{0,8}$/.test(e.target.value) && setForm(f => ({ ...f, pin: e.target.value }))}
                  placeholder="4-8 digits"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => handleRoleChange(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r}>
                        <span className={ROLE_COLORS[r]}>{ROLE_LABELS[r]}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Percent className="h-3.5 w-3.5" /> Max Discount %</Label>
                <Input
                  type="number" min="0" max="100" step="0.5"
                  value={form.maxDiscountPct}
                  onChange={e => setForm(f => ({ ...f, maxDiscountPct: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="emp-active"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="w-4 h-4 rounded accent-primary"
              />
              <Label htmlFor="emp-active">Active (can sign in)</Label>
            </div>

            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Role permissions:</p>
              <p><span className={ROLE_COLORS.admin}>Admin</span> — full access, unlimited discount override</p>
              <p><span className={ROLE_COLORS.manager}>Manager</span> — approve discounts up to their limit</p>
              <p><span className={ROLE_COLORS.staff}>Staff</span> — restricted to their assigned discount cap</p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={createEmployee.isPending || updateEmployee.isPending} className="flex-1">
                {createEmployee.isPending || updateEmployee.isPending ? "Saving..." : editId ? "Save Changes" : "Add Employee"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Employee?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone. Historical sales records will retain the employee name.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} disabled={deleteEmployee.isPending} className="flex-1">
              {deleteEmployee.isPending ? "Removing..." : "Remove"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
