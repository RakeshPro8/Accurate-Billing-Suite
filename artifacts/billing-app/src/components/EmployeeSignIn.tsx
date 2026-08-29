import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmployee, ROLE_COLORS, ROLE_LABELS } from "@/context/EmployeeContext";

export function EmployeeSignIn() {
  const { needsSetup, signInEmployees, signIn, bootstrap, refresh } = useEmployee();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    if (!selectedId) {
      setError("Choose your employee account.");
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setError("Enter a 4-8 digit PIN.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await signIn(selectedId, pin);
    } catch (err: any) {
      setError(err?.message ?? "Unable to sign in. Try again.");
      setPin("");
    } finally {
      setPending(false);
    }
  }

  async function handleBootstrap() {
    if (!name.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setError("Choose a 4-8 digit PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await bootstrap({ name: name.trim(), email: email.trim() || undefined, pin });
    } catch (err: any) {
      setError(err?.message ?? "Setup could not be completed. Try again.");
    } finally {
      setPending(false);
    }
  }

  const handlePin = (value: string, setter: (value: string) => void) => {
    if (/^\d{0,8}$/.test(value)) setter(value);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {needsSetup ? <UserPlus className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-mono text-primary">Mobilinq</CardTitle>
            <CardDescription className="mt-2">
              {needsSetup ? "Create the first administrator account" : "Select your account to start a session"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={(event) => {
            event.preventDefault();
            void (needsSetup ? handleBootstrap() : handleSignIn());
          }} className="space-y-5">
          <input
            aria-hidden="true"
            tabIndex={-1}
            name="username"
            autoComplete="username"
            value={selectedId ? String(selectedId) : ""}
            readOnly
            className="sr-only"
          />
          {needsSetup ? (
            <>
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                This is a new installation. The first account receives administrator access.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setup-name">Full name</Label>
                <Input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setup-email">Email <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="setup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@store.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="setup-pin">PIN</Label>
                  <Input id="setup-pin" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => handlePin(e.target.value, setPin)} placeholder="4-8 digits" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="setup-confirm">Confirm PIN</Label>
                  <Input id="setup-confirm" type="password" inputMode="numeric" autoComplete="new-password" value={confirmPin} onChange={(e) => handlePin(e.target.value, setConfirmPin)} placeholder="Repeat PIN" onKeyDown={(e) => e.key === "Enter" && void handleBootstrap()} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pending ? "Creating account..." : "Create admin account"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Employee account</Label>
                {signInEmployees.length > 0 ? (
                  <div className="grid gap-2 max-h-64 overflow-y-auto">
                    {signInEmployees.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => { setSelectedId(employee.id); setError(""); setPin(""); }}
                        className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${selectedId === employee.id ? "border-primary bg-primary/10" : "hover:border-primary/60 hover:bg-secondary"}`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-sm">
                          {employee.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{employee.name}</span>
                          <span className={`block text-xs ${ROLE_COLORS[employee.role]}`}>{ROLE_LABELS[employee.role]}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No active employee accounts are available.
                    <Button type="button" variant="link" className="h-auto px-1" onClick={() => void refresh()}>Retry</Button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signin-pin"><KeyRound className="mr-1 inline h-3.5 w-3.5" />PIN</Label>
                <Input
                  id="signin-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => handlePin(e.target.value, setPin)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSignIn()}
                  placeholder={selectedId ? "Enter your 4-8 digit PIN" : "Select an account first"}
                  disabled={!selectedId}
                  className="text-center tracking-[0.35em]"
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending || !selectedId}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pending ? "Signing in..." : "Sign in"}
              </Button>
            </>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p className="text-center text-xs text-muted-foreground">Your session is secured on this device and expires automatically.</p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}