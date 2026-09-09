import type { RecyclingReceipt } from "@workspace/api-client-react";
import { formatDate } from "@/lib/utils";
import { A4DocumentFrame, A4Section, type A4BusinessInfo } from "./A4DocumentFrame";

const CONDITIONS: Record<RecyclingReceipt["declaredCondition"], string> = {
  working: "Fonctionnel",
  damaged: "Endommagé",
  bricked: "Appareil briqué / hors d’usage",
  unknown: "État inconnu",
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
  const number = receipt.documentNumber ?? `BROUILLON #${receipt.id}`;
  return (
    <A4DocumentFrame
      business={business}
      title="Reçu de recyclage d’appareil"
      documentNumber={number}
      dateLabel="Date"
      dateValue={formatDate(receipt.handoffDate)}
      className="recycling-document"
      footer="Mobilinq — Recyclage responsable. Avenir durable."
    >
      <A4Section title="Informations du client">
        <dl>
          <Detail label="Nom du client" value={receipt.customerName} />
          <Detail label="Téléphone" value={receipt.customerPhone} />
          <Detail label="Courriel" value={receipt.customerEmail} />
        </dl>
      </A4Section>

      <A4Section title="Détails de l’appareil remis">
        <dl>
          <Detail label="Type d’appareil" value={receipt.deviceType} />
          <Detail label="Marque / Modèle" value={`${receipt.deviceBrand} ${receipt.deviceModel}`.trim()} />
          <Detail label="Couleur" value={receipt.deviceColour} />
          <Detail label="État déclaré" value={CONDITIONS[receipt.declaredCondition]} />
          <Detail label="Accessoires inclus" value={receipt.accessories} />
          <Detail label="N° de série / IMEI" value={receipt.serialOrImei} />
          <Detail label="Remis par le client le" value={formatDate(receipt.handoffDate)} />
        </dl>
      </A4Section>

      <A4Section title="Valeur / Transaction">
        <div className="ml-auto max-w-sm text-sm">
          <Detail label="Valeur / compensation" value="0,00 $" />
          <Detail label="TPS" value="0,00 $" />
          <Detail label="TVQ" value="0,00 $" />
        </div>
        <p className="mt-2 text-xs font-semibold text-[#103f3c]">Cette remise n’a aucune incidence sur la facture, les taxes, les paiements ou le solde du client.</p>
      </A4Section>

      <A4Section title="Déclaration">
        <div className="space-y-2 text-[13px] leading-relaxed text-slate-700">
          <p>Le client confirme avoir remis volontairement à Mobilinq l’appareil identifié ci-dessus aux fins de recyclage.</p>
          <p>Aucun paiement, crédit, rabais ou autre compensation monétaire n’a été versé au client et aucun montant n’est dû relativement à cette remise.</p>
          <p>Le client autorise Mobilinq à prendre possession de l’appareil et à le traiter conformément à ses procédures de gestion des appareils électroniques et aux exigences environnementales applicables.</p>
          <p>L’appareil sera acheminé vers une filière de traitement appropriée selon son état et les options disponibles.</p>
        </div>
      </A4Section>

      <div className="recycling-message my-6 rounded-md border border-teal-200 bg-teal-50 px-5 py-4 text-center break-inside-avoid">
        <div className="text-2xl" aria-hidden="true">♻</div>
        <p className="font-semibold text-[#103f3c]">Merci d’avoir choisi Mobilinq pour le recyclage responsable de votre appareil.</p>
        <p className="text-xs text-slate-600 mt-1">Votre geste contribue à réduire l’impact environnemental et à favoriser la valorisation des matières.</p>
      </div>

      <A4Section title="Signature et acceptation">
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
          <div>Reçu par (Mobilinq) : <span className="inline-block min-w-32 border-b border-slate-700">&nbsp;</span></div>
          <div>Nom en lettres moulées : <span className="inline-block min-w-28 border-b border-slate-700">&nbsp;</span></div>
          <div>Signature du client (facultative) : <span className="inline-block min-w-24 border-b border-slate-700">&nbsp;</span></div>
          <div>Employé ayant reçu l’appareil : <strong>{receipt.receivedByEmployeeName ?? "À confirmer"}</strong></div>
        </div>
      </A4Section>

      <A4Section title="Conditions et modalités" className="mb-0">
        <ol className="list-decimal pl-5 space-y-1.5 text-[11px] leading-relaxed text-slate-600">
          <li>Le présent document constitue une preuve de remise de l’appareil à des fins de recyclage; il ne constitue pas une preuve d’achat.</li>
          <li>Aucun paiement ou crédit n’a été effectué. La valeur de la transaction est de 0,00 $.</li>
          <li>Après sa remise, l’appareil peut être démantelé et ses composantes et matières peuvent être récupérées ou traitées dans une filière appropriée.</li>
          <li>Mobilinq effectue ou fait effectuer le traitement conformément aux exigences environnementales applicables et aux procédures de la filière utilisée.</li>
        </ol>
      </A4Section>
    </A4DocumentFrame>
  );
}
