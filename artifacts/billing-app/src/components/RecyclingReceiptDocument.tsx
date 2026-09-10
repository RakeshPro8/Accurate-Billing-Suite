import type { RecyclingReceipt } from "@workspace/api-client-react";
import { formatDate } from "@/lib/utils";
import { A4DocumentFrame, A4Section, type A4BusinessInfo } from "./A4DocumentFrame";
import { useOptionalLocale } from "@/context/LocaleContext";

const CONDITIONS: Record<RecyclingReceipt["declaredCondition"], string> = {
  working: "Working",
  damaged: "Damaged",
  bricked: "Bricked / unusable",
  unknown: "Unknown",
};

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[minmax(130px,0.8fr)_1.6fr] gap-3 py-1.5 border-b border-slate-100 last:border-0 text-sm">
      <dt className="font-semibold text-slate-600">{label}</dt>
      <dd className="whitespace-pre-wrap break-words">{value || "—"}</dd>
    </div>
  );
}

export function RecyclingReceiptDocument({ receipt, business }: { receipt: RecyclingReceipt; business: A4BusinessInfo }) {
  const { t, formatDate } = useOptionalLocale();
  const number = receipt.documentNumber ?? `BROUILLON #${receipt.id}`;
  return (
    <A4DocumentFrame
      business={business}
      title={t("Device recycling receipt")}
      documentNumber={number}
      dateLabel={t("Date")}
      dateValue={formatDate(receipt.handoffDate)}
      className="recycling-document"
      footer={t("Responsible recycling. A sustainable future.")}
    >
      <A4Section title={t("Customer information")}>
        <dl>
          <Detail label={t("Customer name")} value={receipt.customerName} />
          <Detail label={t("Phone")} value={receipt.customerPhone} />
          <Detail label={t("Email")} value={receipt.customerEmail} />
        </dl>
      </A4Section>

      <A4Section title={t("Device handoff details")}>
        <dl>
          <Detail label={t("Device type")} value={receipt.deviceType} />
          <Detail label={t("Brand / Model")} value={`${receipt.deviceBrand} ${receipt.deviceModel}`.trim()} />
          <Detail label={t("Colour")} value={receipt.deviceColour} />
          <Detail label={t("Declared condition")} value={t(CONDITIONS[receipt.declaredCondition])} />
          <Detail label={t("Included accessories")} value={receipt.accessories} />
          <Detail label={t("Serial number / IMEI")} value={receipt.serialOrImei} />
          <Detail label={t("Handed over by customer on")} value={formatDate(receipt.handoffDate)} />
        </dl>
      </A4Section>

      <A4Section title={t("Value / Transaction")}>
        <div className="ml-auto max-w-sm text-sm">
          <Detail label={t("Value / compensation")} value="0,00 $" />
          <Detail label="TPS" value="0,00 $" />
          <Detail label="TVQ" value="0,00 $" />
        </div>
        <p className="mt-2 text-xs font-semibold text-[#103f3c]">{t("This handoff has no impact on the invoice, taxes, payments, or customer balance.")}</p>
      </A4Section>

      <A4Section title={t("Declaration")}>
        <div className="space-y-2 text-[13px] leading-relaxed text-slate-700">
          <p>{t("The customer confirms that they voluntarily handed the device identified above to Mobilinq for recycling.")}</p>
          <p>{t("No payment, credit, discount, or other monetary compensation was provided to the customer, and no amount is owed for this handoff.")}</p>
          <p>{t("The customer authorizes Mobilinq to take possession of the device and process it according to its electronic-device management procedures and applicable environmental requirements.")}</p>
          <p>{t("The device will be sent to an appropriate processing stream based on its condition and available options.")}</p>
        </div>
      </A4Section>

      <div className="recycling-message my-6 rounded-md border border-teal-200 bg-teal-50 px-5 py-4 text-center break-inside-avoid">
        <div className="text-2xl" aria-hidden="true">♻</div>
         <p className="font-semibold text-[#103f3c]">{t("Thank you for choosing Mobilinq for responsible recycling of your device.")}</p>
         <p className="text-xs text-slate-600 mt-1">{t("Your action helps reduce environmental impact and supports material recovery.")}</p>
      </div>

       <A4Section title={t("Signature and acceptance")}>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
           <div>{t("Received by (Mobilinq)")} : <span className="inline-block min-w-32 border-b border-slate-700">&nbsp;</span></div>
           <div>{t("Printed name")} : <span className="inline-block min-w-28 border-b border-slate-700">&nbsp;</span></div>
           <div>{t("Customer signature (optional)")} : <span className="inline-block min-w-24 border-b border-slate-700">&nbsp;</span></div>
           <div>{t("Employee who received the device")} : <strong>{receipt.receivedByEmployeeName ?? t("To be confirmed")}</strong></div>
        </div>
      </A4Section>

       <A4Section title={t("Terms and conditions")} className="mb-0">
        <ol className="list-decimal pl-5 space-y-1.5 text-[11px] leading-relaxed text-slate-600">
           <li>{t("This document is proof that the device was handed over for recycling; it is not proof of purchase.")}</li>
           <li>{t("No payment or credit was made. The transaction value is $0.00.")}</li>
           <li>{t("After handoff, the device may be dismantled and its components and materials may be recovered or processed through an appropriate stream.")}</li>
           <li>{t("Mobilinq processes or arranges processing according to applicable environmental requirements and the procedures of the stream used.")}</li>
        </ol>
      </A4Section>
    </A4DocumentFrame>
  );
}
