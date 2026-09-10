import { useState } from "react";
import { Check, Copy, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployee } from "@/context/EmployeeContext";
import { useLocale } from "@/context/LocaleContext";

export function RecoveryCodeNotice() {
  const { recoveryCode, dismissRecoveryCode } = useEmployee();
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  if (!recoveryCode) return null;
  const code = recoveryCode;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <Card className="w-full max-w-lg border-primary/30 shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <ShieldAlert className="h-5 w-5" /> {t("Save your administrator recovery code")}
          </CardTitle>
          <CardDescription>{t("This code is shown once. Store it somewhere secure outside Mobilinq. It can recover the administrator account if every administrator is locked out.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/50 p-4 text-center font-mono text-lg tracking-[0.18em] break-all select-all">
            {code}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => void copyCode()}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? t("Copied") : t("Copy code")}
            </Button>
            <Button className="flex-1" onClick={dismissRecoveryCode}>{t("I saved it")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}