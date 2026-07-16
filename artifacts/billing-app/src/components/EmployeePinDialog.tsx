import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployee, ActiveEmployee, ROLE_COLORS, ROLE_LABELS } from "@/context/EmployeeContext";
import { useEmployees, useVerifyPin } from "@/lib/employees-api";
import { ShieldCheck, LogOut, User } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function EmployeePinDialog({ open, onClose }: Props) {
  const { activeEmployee, setActiveEmployee, clearEmployee } = useEmployee();
  const { data: employees } = useEmployees();
  const verifyPin = useVerifyPin();

  const [selectedId, setSelectedId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"select" | "pin">("select");

  function reset() {
    setSelectedId("");
    setPin("");
    setError("");
    setStep("select");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSelectEmployee(id: string) {
    setSelectedId(id);
    setStep("pin");
    setError("");
    setPin("");
  }

  function handlePinInput(val: string) {
    if (/^\d{0,8}$/.test(val)) setPin(val);
  }

  function handleVerify() {
    if (!selectedId || pin.length < 4) {
      setError("Enter your PIN (4-8 digits).");
      return;
    }
    verifyPin.mutate({ employeeId: Number(selectedId), pin }, {
      onSuccess: (data: any) => {
        const emp: ActiveEmployee = {
          id: data.employee.id,
          name: data.employee.name,
          role: data.employee.role,
          maxDiscountPct: data.employee.maxDiscountPct,
        };
        setActiveEmployee(emp);
        handleClose();
      },
      onError: (e: any) => setError(e.message ?? "Incorrect PIN."),
    });
  }

  const activeEmployees = employees?.filter(e => e.active) ?? [];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Employee Sign-In
          </DialogTitle>
          <DialogDescription>Select your name and enter your PIN to start a session.</DialogDescription>
        </DialogHeader>

        {activeEmployee && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {activeEmployee.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{activeEmployee.name}</p>
                <p className={`text-xs font-medium ${ROLE_COLORS[activeEmployee.role]}`}>
                  {ROLE_LABELS[activeEmployee.role]} · Max {activeEmployee.maxDiscountPct}% disc.
                </p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { clearEmployee(); reset(); }} className="text-destructive gap-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        )}

        {step === "select" ? (
          <div className="space-y-3">
            <Label>Select Employee</Label>
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active employees found. Go to Employees to add staff.</p>
            ) : (
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {activeEmployees.map(emp => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectEmployee(String(emp.id))}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                      {emp.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{emp.name}</p>
                      <p className={`text-xs ${ROLE_COLORS[emp.role]}`}>{ROLE_LABELS[emp.role]} · {emp.maxDiscountPct}% max disc.</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" onClick={() => setStep("select")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {employees?.find(e => e.id === Number(selectedId))?.name} — change
            </button>
            <div className="space-y-1.5">
              <Label>PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={e => handlePinInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleVerify()}
                placeholder="Enter PIN"
                className="text-center tracking-widest text-lg"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleVerify} disabled={verifyPin.isPending} className="flex-1">
                {verifyPin.isPending ? "Verifying..." : "Sign In"}
              </Button>
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
