import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/context/LocaleContext";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, toggleLocale, t } = useLocale();
  const nextLocale = locale === "en" ? "fr" : "en";
  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "sm"}
      onClick={toggleLocale}
      className={compact ? "h-8 w-8" : "h-8 gap-1.5 px-2 text-xs"}
      aria-label={nextLocale === "fr" ? t("Passer au français") : t("Switch to English")}
      title={nextLocale === "fr" ? t("Passer au français") : t("Switch to English")}
    >
      <Languages className="h-3.5 w-3.5" aria-hidden="true" />
      {!compact && <span>{locale === "en" ? "FR" : "EN"}</span>}
    </Button>
  );
}