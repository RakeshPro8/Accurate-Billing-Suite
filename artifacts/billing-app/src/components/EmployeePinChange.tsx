import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmployee } from "@/context/EmployeeContext";
import { useLocale } from "@/context/LocaleContext";

export function EmployeePinChange() {
  const { changePin, clearEmployee } = useEmployee();
  const { t } = useLocale();
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!/^\d{4,8}$/.test(newPin)) {
      setError(t("Choose a 4-8 digit PIN."));
      return;
    }
    if (newPin !== confirmPin) {
      setError(t("PINs do not match."));
      return;
    }
    setPending(true);
    setError("");
    try {
      await changePin(newPin);
    } catch (err: any) {
      setError(err?.message ?? t("Unable to change the PIN. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-2xl font-mono text-primary">Mobilinq</CardTitle>
            <CardDescription className="mt-2">{t("Choose a new PIN to continue")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            <ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />
            {t("Your temporary PIN expires shortly. Choose a permanent PIN before continuing.")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pin">{t("New PIN")}</Label>
            <Input id="new-pin" type="password" inputMode="numeric" autoComplete="new-password" value={newPin} onChange={(e) => /^\d{0,8}$/.test(e.target.value) && setNewPin(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-new-pin">{t("Confirm new PIN")}</Label>
            <Input id="confirm-new-pin" type="password" inputMode="numeric" autoComplete="new-password" value={confirmPin} onChange={(e) => /^\d{0,8}$/.test(e.target.value) && setConfirmPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={pending} onClick={() => void submit()}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pending ? t("Saving...") : t("Save new PIN")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => void clearEmployee()}>
            {t("Sign out")}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}