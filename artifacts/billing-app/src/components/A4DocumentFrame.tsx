import type { ReactNode } from "react";
import { useOptionalLocale } from "@/context/LocaleContext";

export interface A4BusinessInfo {
  businessName?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  logoUrl?: string | null;
  invoiceFooter?: string | null;
  thankYouMessage?: string | null;
}

export function A4DocumentFrame({
  business,
  title,
  documentNumber,
  dateLabel,
  dateValue,
  secondaryDate,
  children,
  footer,
  className = "",
}: {
  business: A4BusinessInfo;
  title: string;
  documentNumber: string;
  dateLabel: string;
  dateValue: string;
  secondaryDate?: { label: string; value: string } | null;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const { translateText, t } = useOptionalLocale();
  return (
    <article className={`a4-document bg-white text-slate-900 rounded-lg border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <header className="a4-document-header bg-[#103f3c] text-white px-6 sm:px-8 py-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-3">
              {business.logoUrl && (
                <div className="bg-white rounded-md p-1.5 shrink-0">
                  <img src={business.logoUrl} alt="" className="max-h-12 max-w-[120px] object-contain" />
                </div>
              )}
              <div className="text-xl sm:text-2xl font-bold">{business.businessName ?? "Mobilinq"}</div>
            </div>
            <div className="text-xs sm:text-sm text-teal-100 space-y-0.5">
              {business.businessAddress && <div>{business.businessAddress}</div>}
              {business.businessPhone && <div>{business.businessPhone}</div>}
              {business.businessEmail && <div>{business.businessEmail}</div>}
            </div>
          </div>
          <div className="text-right shrink-0">
             <div className="text-xl sm:text-3xl font-bold text-teal-200 uppercase tracking-tight">{translateText(title)}</div>
            <div className="text-sm sm:text-lg font-mono mt-1">{documentNumber}</div>
             <div className="text-xs sm:text-sm text-teal-100 mt-1">{translateText(dateLabel)} : {dateValue}</div>
             {secondaryDate && <div className="text-xs sm:text-sm text-teal-100">{translateText(secondaryDate.label)} : {secondaryDate.value}</div>}
          </div>
        </div>
      </header>
      <div className="a4-document-body p-6 sm:p-8">{children}</div>
      <footer className="a4-document-footer px-6 sm:px-8 py-4 border-t border-slate-200 text-xs text-slate-600">
         {footer ?? business.invoiceFooter ?? t("Service responsible. Avenir durable.")}
      </footer>
    </article>
  );
}

export function A4Section({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`a4-section mb-6 break-inside-avoid ${className}`}>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#103f3c] border-b-2 border-[#103f3c] pb-1.5 mb-3">{title}</h2>
      {children}
    </section>
  );
}
