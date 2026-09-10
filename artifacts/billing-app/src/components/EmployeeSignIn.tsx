import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEmployee, ROLE_COLORS, ROLE_LABELS } from "@/context/EmployeeContext";
import { trackEmployeeAuthOutcome } from "@/lib/analytics";
import { useLocale } from "@/context/LocaleContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createPinResetRequest } from "@workspace/api-client-react";

export function EmployeeSignIn() {
  const { needsSetup, signInEmployees, publicStateError, signIn, bootstrap, refresh, recoverAdmin } = useEmployee();
  const { t } = useLocale();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<"request" | "admin">("request");
  const [recoveryNote, setRecoveryNote] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPin, setRecoveryPin] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryPending, setRecoveryPending] = useState(false);

  async function handleSignIn() {
    if (!selectedId) {
      trackEmployeeAuthOutcome("sign_in", "invalid_input");
      setError(t("Choose your employee account."));
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      trackEmployeeAuthOutcome("sign_in", "invalid_pin");
      setError(t("Enter a 4-8 digit PIN."));
      return;
    }
    setError("");
    setPending(true);
    try {
      await signIn(selectedId, pin);
    } catch (err: any) {
      setError(err?.message ?? t("Unable to sign in. Try again."));
      setPin("");
    } finally {
      setPending(false);
    }
  }

  async function handleBootstrap() {
    if (!name.trim()) {
      trackEmployeeAuthOutcome("setup", "invalid_input");
      setError(t("Enter your full name."));
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      trackEmployeeAuthOutcome("setup", "invalid_pin");
      setError(t("Choose a 4-8 digit PIN."));
      return;
    }
    if (pin !== confirmPin) {
      trackEmployeeAuthOutcome("setup", "invalid_input");
      setError(t("PINs do not match."));
      return;
    }
    setError("");
    setPending(true);
    try {
      await bootstrap({ name: name.trim(), email: email.trim() || undefined, pin });
    } catch (err: any) {
      setError(err?.message ?? t("Setup could not be completed. Try again."));
    } finally {
      setPending(false);
    }
  }

  const handlePin = (value: string, setter: (value: string) => void) => {
    if (/^\d{0,8}$/.test(value)) setter(value);
  };

  function openRecovery(mode: "request" | "admin") {
    setRecoveryMode(mode);
    setRecoveryMessage("");
    setRecoveryError("");
    setRecoveryOpen(true);
  }

  async function submitResetRequest() {
    if (!selectedId) {
      setRecoveryError(t("Select your employee account first."));
      return;
    }
    setRecoveryPending(true);
    setRecoveryError("");
    try {
      await createPinResetRequest({ employeeId: selectedId, note: recoveryNote.trim() || undefined });
      setRecoveryMessage(t("Your request was sent. Ask an administrator to review it in Employee management."));
      setRecoveryNote("");
    } catch (err: any) {
      setRecoveryError(err?.message ?? t("Unable to submit the request. Try again later."));
    } finally {
      setRecoveryPending(false);
    }
  }

  async function submitAdminRecovery() {
    if (!/^\d{4,8}$/.test(recoveryPin)) {
      setRecoveryError(t("Choose a 4-8 digit PIN."));
      return;
    }
    setRecoveryPending(true);
    setRecoveryError("");
    try {
      await recoverAdmin(recoveryCode, recoveryPin);
      setRecoveryOpen(false);
    } catch (err: any) {
      setRecoveryError(err?.message ?? t("Unable to complete admin recovery."));
    } finally {
      setRecoveryPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-end">
            <LanguageSwitcher />
          </div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {needsSetup ? <UserPlus className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-mono text-primary">Mobilinq</CardTitle>
            <CardDescription className="mt-2">
              {needsSetup ? t("Create the first administrator account") : t("Select your account to start a session")}
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
                {t("This is a new installation. The first account receives administrator access.")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setup-name">{t("Full name")}</Label>
                <Input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setup-email">{t("Email")} <span className="text-muted-foreground">{t("(optional)")}</span></Label>
                <Input id="setup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@store.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="setup-pin">{t("PIN")}</Label>
                  <Input id="setup-pin" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => handlePin(e.target.value, setPin)} placeholder="4-8 digits" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="setup-confirm">{t("Confirm PIN")}</Label>
                  <Input id="setup-confirm" type="password" inputMode="numeric" autoComplete="new-password" value={confirmPin} onChange={(e) => handlePin(e.target.value, setConfirmPin)} placeholder={t("Repeat PIN")} onKeyDown={(e) => e.key === "Enter" && void handleBootstrap()} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pending ? t("Creating account...") : t("Create admin account")}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                 <Label>{t("Employee account")}</Label>
                {publicStateError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
                    <p className="text-destructive">{publicStateError}</p>
                    <Button type="button" variant="link" className="h-auto px-0 pt-2" onClick={() => void refresh()}>
                       {t("Retry connection")}
                    </Button>
                  </div>
                ) : signInEmployees.length > 0 ? (
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
                     {t("No active employee accounts are available.")}
                     <Button type="button" variant="link" className="h-auto px-1" onClick={() => void refresh()}>{t("Retry")}</Button>
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
                   placeholder={selectedId ? t("Enter your 4-8 digit PIN") : t("Select an account first")}
                  disabled={!selectedId}
                  className="text-center tracking-[0.35em]"
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending || !selectedId}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 {pending ? t("Signing in...") : t("Sign In")}
              </Button>
              {selectedId && (
                <Button type="button" variant="link" className="w-full" onClick={() => openRecovery("request")}>
                  {t("Forgot your PIN?")}
                </Button>
              )}
            </>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
           <p className="text-center text-xs text-muted-foreground">{t("Your session is secured on this device and expires automatically.")}</p>
          </form>
        </CardContent>
      </Card>
      <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("PIN recovery")}</DialogTitle>
            <DialogDescription>
              {recoveryMode === "request"
                ? t("Ask an administrator to review a reset request for the selected employee.")
                : t("Use the one-time recovery code saved during administrator setup or generated by an administrator.")}
            </DialogDescription>
          </DialogHeader>
          {recoveryMode === "request" ? (
            <div className="space-y-4">
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                {t("The administrator will issue a temporary PIN. It expires after 15 minutes and must be replaced after sign-in.")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recovery-note">{t("Note (optional)")}</Label>
                <Textarea id="recovery-note" rows={3} maxLength={500} value={recoveryNote} onChange={(e) => setRecoveryNote(e.target.value)} placeholder={t("For example: I am at the front counter.")} />
              </div>
              {recoveryMessage && <p role="status" className="text-sm text-primary">{recoveryMessage}</p>}
              {recoveryError && <p role="alert" className="text-sm text-destructive">{recoveryError}</p>}
              <Button className="w-full" disabled={recoveryPending || Boolean(recoveryMessage)} onClick={() => void submitResetRequest()}>
                {recoveryPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Ask admin for a temporary PIN")}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => { setRecoveryMode("admin"); setRecoveryMessage(""); setRecoveryError(""); }}>
                {t("Administrator locked out? Use recovery code")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                {t("There is no hidden bypass. This requires the one-time recovery code saved during setup or rotated by a signed-in administrator.")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recovery-code">{t("Administrator recovery code")}</Label>
                <Input id="recovery-code" autoComplete="off" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} placeholder={t("Enter the recovery code")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recovery-new-pin">{t("New administrator PIN")}</Label>
                <Input id="recovery-new-pin" type="password" inputMode="numeric" autoComplete="new-password" value={recoveryPin} onChange={(e) => handlePin(e.target.value, setRecoveryPin)} />
              </div>
              {recoveryError && <p role="alert" className="text-sm text-destructive">{recoveryError}</p>}
              <Button className="w-full" disabled={recoveryPending} onClick={() => void submitAdminRecovery()}>
                {recoveryPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Recover administrator account")}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setRecoveryMode("request"); setRecoveryError(""); }}>
                {t("Back to PIN request")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}