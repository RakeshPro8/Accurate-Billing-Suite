export const languages = ["en", "fr"] as const;
export type GuideLanguage = typeof languages[number];

export const provinceCodes = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;
export type ProvinceCode = typeof provinceCodes[number];

export const topics = [
  "authorization-estimates",
  "diagnostics",
  "deposits-payment",
  "parts-warranty",
  "data-passwords",
  "abandoned-pickup",
  "receipts",
  "complaints",
  "escalation",
] as const;
export type GuideTopic = typeof topics[number];

export type Infographic = {
  steps: string[];
  do: string[];
  avoid: string[];
  escalation: string;
};

type LocalizedCopy = {
  title: string;
  summary: string;
  script: string;
  infographic: Infographic;
};

export const sourceByProvince: Record<ProvinceCode, string> = {
  AB: "https://www.alberta.ca/consumer-protection.aspx",
  BC: "https://www.consumerprotectionbc.ca/",
  MB: "https://www.gov.mb.ca/cca/cpo/",
  NB: "https://www.fcnb.ca/en/consumer-protection",
  NL: "https://www.gov.nl.ca/dgsnl/consumer/",
  NS: "https://novascotia.ca/just/regulations/regs/cpcgen.htm",
  NT: "https://www.justice.gov.nt.ca/en/consumer-affairs/",
  NU: "https://www.gov.nu.ca/community-and-government-services/information/consumer-affairs",
  ON: "https://www.ontario.ca/page/consumer-protection-ontario",
  PE: "https://www.princeedwardisland.ca/en/topic/consumer-protection",
  QC: "https://www.opc.gouv.qc.ca/",
  SK: "https://www.saskatchewan.ca/business/consumer-protection",
  YT: "https://yukon.ca/en/consumer-protection",
};

export const topicCopy: Record<GuideTopic, Record<GuideLanguage, LocalizedCopy>> = {
  "authorization-estimates": {
    en: {
      title: "Authorization and estimates",
      summary: "Confirm the requested work, the estimate, and how changes will be handled before proceeding. Keep the written record with the repair ticket.",
      script: "Before we start, let’s review the work you’re authorizing and the estimate. If the scope or price changes, we’ll pause and explain the change before continuing.",
      infographic: {
        steps: ["Restate the requested work and estimate.", "Record the customer’s approval and any limits.", "Pause and explain before changing the scope or amount."],
        do: ["Use the approved estimate and repair record.", "Ask the customer to confirm unclear details.", "Record changes before continuing."],
        avoid: ["Do not treat silence as approval.", "Do not promise a final price before the approved process is complete.", "Do not add work because it seems helpful."],
        escalation: "Ask a manager to review a disputed authorization, a material change, or a request outside the approved process.",
      },
    },
    fr: {
      title: "Autorisation et estimations",
      summary: "Confirmez le travail demandé, l’estimation et la façon de traiter les changements avant de commencer. Gardez la trace écrite au dossier de réparation.",
      script: "Avant de commencer, revoyons le travail que vous autorisez et l’estimation. Si la portée ou le prix change, nous ferons une pause pour vous l’expliquer avant de poursuivre.",
      infographic: {
        steps: ["Reformulez le travail demandé et l’estimation.", "Notez l’accord du client et ses limites.", "Faites une pause et expliquez tout changement avant de poursuivre."],
        do: ["Utilisez l’estimation et le dossier de réparation approuvés.", "Demandez au client de préciser tout détail incertain.", "Notez les changements avant de continuer."],
        avoid: ["Ne considérez pas le silence comme une autorisation.", "Ne promettez pas le prix final avant la procédure approuvée.", "N’ajoutez pas de travail simplement parce qu’il semble utile."],
        escalation: "Demandez à un gestionnaire d’examiner une autorisation contestée, un changement important ou une demande hors procédure.",
      },
    },
  },
  diagnostics: {
    en: {
      title: "Diagnostics",
      summary: "Explain what diagnostic work is needed, whether it has a charge, and what the customer will receive after the diagnosis. Do not promise a repair result before inspection.",
      script: "We’ll inspect the device and explain what we find. A diagnosis helps us recommend next steps; it does not guarantee that the device can be repaired.",
      infographic: {
        steps: ["Explain the purpose and any approved diagnostic charge.", "Inspect and record observable findings.", "Share the findings and available next steps without promising a result."],
        do: ["Describe what the inspection can and cannot show.", "Keep findings with the repair record.", "Give the customer time to decide on next steps."],
        avoid: ["Do not guarantee that a device can be repaired.", "Do not call an estimate a diagnosis.", "Do not hide a charge or create a new service without approval."],
        escalation: "Ask a manager about safety concerns, uncertain findings, a disputed diagnostic charge, or a request for a guaranteed result.",
      },
    },
    fr: {
      title: "Diagnostic",
      summary: "Expliquez le diagnostic nécessaire, ses frais approuvés s’il y en a et ce que le client recevra ensuite. Ne promettez pas un résultat de réparation avant l’inspection.",
      script: "Nous allons inspecter l’appareil et vous expliquer ce que nous trouvons. Le diagnostic aide à recommander la suite; il ne garantit pas que l’appareil pourra être réparé.",
      infographic: {
        steps: ["Expliquez le but et les frais de diagnostic approuvés, s’il y en a.", "Inspectez l’appareil et notez les constatations observables.", "Présentez les constatations et les prochaines étapes sans promettre de résultat."],
        do: ["Expliquez ce que l’inspection peut montrer ou non.", "Gardez les constatations au dossier de réparation.", "Laissez au client le temps de choisir la suite."],
        avoid: ["Ne garantissez pas qu’un appareil peut être réparé.", "Ne présentez pas une estimation comme un diagnostic.", "Ne cachez pas de frais et ne créez pas un service sans autorisation."],
        escalation: "Demandez à un gestionnaire d’examiner un enjeu de sécurité, une constatation incertaine, des frais contestés ou une demande de garantie.",
      },
    },
  },
  "deposits-payment": {
    en: {
      title: "Deposits and payment",
      summary: "Record deposits and payment terms clearly, provide a receipt, and follow the store’s approved process for refunds or disputed amounts.",
      script: "Here is the amount being paid today and what it applies to. I’ll give you a receipt, and we can explain the store’s process if you have a payment question.",
      infographic: {
        steps: ["State the amount, purpose, and payment method.", "Record the payment and provide the receipt.", "Use the approved process for changes, disputes, or refunds."],
        do: ["Match the payment to the correct repair or invoice.", "Check the receipt before handing it over.", "Ask a manager before making an exception."],
        avoid: ["Do not promise a refund or credit.", "Do not take payment without recording it.", "Do not store passwords, card details, or unnecessary payment data."],
        escalation: "Escalate a disputed amount, chargeback, suspected duplicate payment, or refund request to a manager.",
      },
    },
    fr: {
      title: "Dépôts et paiements",
      summary: "Notez clairement les dépôts et les modalités de paiement, remettez un reçu et suivez la procédure approuvée pour les remboursements ou les montants contestés.",
      script: "Voici le montant payé aujourd’hui et ce à quoi il s’applique. Je vais vous remettre un reçu et expliquer la procédure du commerce si vous avez une question sur le paiement.",
      infographic: {
        steps: ["Indiquez le montant, le motif et le mode de paiement.", "Enregistrez le paiement et remettez le reçu.", "Utilisez la procédure approuvée pour les changements, contestations ou remboursements."],
        do: ["Associez le paiement à la bonne réparation ou facture.", "Vérifiez le reçu avant de le remettre.", "Demandez à un gestionnaire avant toute exception."],
        avoid: ["Ne promettez pas de remboursement ou de crédit.", "N’acceptez pas un paiement sans l’enregistrer.", "Ne conservez pas de mots de passe, données de carte ou données de paiement inutiles."],
        escalation: "Faites remonter un montant contesté, une rétrofacturation, un paiement possiblement doublé ou une demande de remboursement.",
      },
    },
  },
  "parts-warranty": {
    en: {
      title: "Parts and warranty",
      summary: "Tell the customer which parts or services are included, use approved warranty wording, and point to the official terms. Never promise coverage beyond the written terms.",
      script: "I can explain the approved warranty terms for this work. I don’t want to promise an outcome that is not written, so let’s review the terms together.",
      infographic: {
        steps: ["Identify the part or service and the approved terms.", "Show the written warranty information.", "Record questions and explain the review path for an uncertain claim."],
        do: ["Use the current store wording.", "Keep the part and service details on the repair record.", "Separate a warranty question from a new repair estimate."],
        avoid: ["Do not promise coverage beyond written terms.", "Do not promise a replacement, refund, or deadline.", "Do not describe a manufacturer policy from memory."],
        escalation: "Ask a manager to review a coverage dispute, safety concern, manufacturer question, or request for an exception.",
      },
    },
    fr: {
      title: "Pièces et garantie",
      summary: "Indiquez les pièces ou services inclus, utilisez le texte de garantie approuvé et montrez les modalités officielles. Ne promettez jamais une couverture qui dépasse les modalités écrites.",
      script: "Je peux vous expliquer les modalités de garantie approuvées pour ce travail. Je ne veux pas promettre un résultat qui n’est pas écrit; examinons les modalités ensemble.",
      infographic: {
        steps: ["Identifiez la pièce ou le service et les modalités approuvées.", "Montrez les renseignements de garantie écrits.", "Notez les questions et expliquez la voie d’examen pour une demande incertaine."],
        do: ["Utilisez le texte actuel du commerce.", "Gardez les détails de la pièce et du service au dossier.", "Distinguez une question de garantie d’une nouvelle estimation."],
        avoid: ["Ne promettez pas une couverture supérieure aux modalités écrites.", "Ne promettez ni remplacement, ni remboursement, ni délai.", "Ne décrivez pas de mémoire une politique du fabricant."],
        escalation: "Demandez à un gestionnaire d’examiner une contestation de couverture, un enjeu de sécurité, une question du fabricant ou une exception.",
      },
    },
  },
  "data-passwords": {
    en: {
      title: "Personal data and device passwords",
      summary: "Ask only for access needed for the authorized work, avoid recording unnecessary personal information, and follow the store’s secure device-credential process.",
      script: "We only need access that is necessary for the authorized diagnostic or repair. You can ask what we need and how any access information is protected.",
      infographic: {
        steps: ["Explain what access is needed and why.", "Use the approved secure credential process.", "Remove or return access information when the work is complete."],
        do: ["Minimize access and personal information.", "Keep the device and records secure.", "Stop and report unexpected sensitive content or access."],
        avoid: ["Do not ask for an unrelated password.", "Do not copy personal data for convenience.", "Do not write credentials in ordinary notes or share them."],
        escalation: "Escalate a privacy incident, lost device, unexpected personal data, access request you cannot justify, or customer concern.",
      },
    },
    fr: {
      title: "Données personnelles et mots de passe",
      summary: "Demandez seulement l’accès nécessaire au travail autorisé, évitez de noter des renseignements personnels inutiles et suivez la procédure sécurisée du commerce.",
      script: "Nous avons seulement besoin de l’accès nécessaire au diagnostic ou à la réparation autorisée. Vous pouvez demander ce dont nous avons besoin et comment l’accès est protégé.",
      infographic: {
        steps: ["Expliquez quel accès est nécessaire et pourquoi.", "Utilisez la procédure sécurisée approuvée pour les identifiants.", "Supprimez ou retournez les informations d’accès une fois le travail terminé."],
        do: ["Limitez l’accès et les renseignements personnels.", "Gardez l’appareil et les dossiers en sécurité.", "Arrêtez-vous et signalez tout contenu ou accès sensible inattendu."],
        avoid: ["Ne demandez pas un mot de passe sans lien avec le travail.", "Ne copiez pas de données personnelles par commodité.", "N’écrivez pas et ne partagez pas les identifiants dans des notes ordinaires."],
        escalation: "Faites remonter un incident de confidentialité, un appareil perdu, des données inattendues ou une demande d’accès injustifiable.",
      },
    },
  },
  "abandoned-pickup": {
    en: {
      title: "Abandoned devices and pickup",
      summary: "Give clear pickup information and use the approved notice and escalation process for devices left after the stated pickup period. Do not dispose of a device based on an informal promise.",
      script: "We’ll tell you when the device is ready and how to pick it up. If plans change, please contact us so we can explain the next steps under our approved policy.",
      infographic: {
        steps: ["Confirm the pickup contact, location, and approved information.", "Record notices and attempted contact.", "Ask a manager before any action involving an uncollected device."],
        do: ["Use the approved notice schedule and wording.", "Keep the device identified and secured.", "Document customer contact without unnecessary detail."],
        avoid: ["Do not treat an informal promise as authorization to dispose of a device.", "Do not move or release a device without verification.", "Do not promise a final outcome or deadline."],
        escalation: "Ask a manager about an uncollected device, unreachable customer, disputed pickup, or any proposed disposal or transfer.",
      },
    },
    fr: {
      title: "Appareils non récupérés et collecte",
      summary: "Donnez des informations claires sur la collecte et utilisez la procédure approuvée d’avis et d’escalade pour un appareil laissé après la période indiquée. Ne jetez pas un appareil sur la base d’une promesse informelle.",
      script: "Nous vous indiquerons quand l’appareil sera prêt et comment le récupérer. Si vos plans changent, communiquez avec nous afin que nous puissions expliquer la suite selon la politique approuvée.",
      infographic: {
        steps: ["Confirmez le contact, le lieu et les renseignements approuvés pour la collecte.", "Notez les avis et les tentatives de contact.", "Demandez à un gestionnaire avant toute mesure concernant un appareil non récupéré."],
        do: ["Utilisez le calendrier et le texte d’avis approuvés.", "Identifiez et sécurisez l’appareil.", "Notez les communications sans détails inutiles."],
        avoid: ["Ne considérez pas une promesse informelle comme une autorisation de jeter l’appareil.", "Ne déplacez pas et ne remettez pas un appareil sans vérification.", "Ne promettez pas de résultat final ou de délai."],
        escalation: "Demandez à un gestionnaire d’examiner un appareil non récupéré, un client injoignable, une collecte contestée ou un projet de disposition.",
      },
    },
  },
  receipts: {
    en: {
      title: "Receipts and records",
      summary: "Provide a receipt or repair record showing the work, amounts, taxes where applicable, payments, and contact details for questions.",
      script: "Here is your receipt and repair record, including the amounts and payment recorded today. Please keep it in case you need to contact us.",
      infographic: {
        steps: ["Review the work, amounts, and payment recorded.", "Provide the receipt and repair record.", "Correct or escalate a record question through the approved process."],
        do: ["Use the customer’s repair or invoice record.", "Check names, amounts, and payment status.", "Offer the official contact path for questions."],
        avoid: ["Do not alter a record to make it look complete.", "Do not omit a payment or charge.", "Do not promise that a record proves a legal outcome."],
        escalation: "Ask a manager to review a missing, incorrect, disputed, or privacy-sensitive record.",
      },
    },
    fr: {
      title: "Reçus et dossiers",
      summary: "Remettez un reçu ou un dossier de réparation indiquant le travail, les montants, les taxes applicables, les paiements et la façon de poser des questions.",
      script: "Voici votre reçu et votre dossier de réparation, y compris les montants et le paiement enregistré aujourd’hui. Gardez-les si vous devez communiquer avec nous.",
      infographic: {
        steps: ["Revoyez le travail, les montants et le paiement enregistré.", "Remettez le reçu et le dossier de réparation.", "Corrigez ou faites remonter une question au moyen de la procédure approuvée."],
        do: ["Utilisez le dossier de réparation ou la facture du client.", "Vérifiez les noms, les montants et l’état du paiement.", "Indiquez la voie de contact officielle pour les questions."],
        avoid: ["Ne modifiez pas un dossier pour le rendre artificiellement complet.", "N’omettez pas un paiement ou des frais.", "Ne promettez pas qu’un dossier prouve un résultat juridique."],
        escalation: "Demandez à un gestionnaire d’examiner un dossier manquant, incorrect, contesté ou sensible.",
      },
    },
  },
  complaints: {
    en: {
      title: "Complaints",
      summary: "Listen without arguing, document the concern without unnecessary personal details, and explain the store’s approved review path. Do not retaliate or promise a specific result.",
      script: "I’m sorry this has been frustrating. I’ll record your concern and explain the next review step. I can’t promise the outcome, but I can make sure it is handled through the approved process.",
      infographic: {
        steps: ["Listen and restate the concern calmly.", "Record relevant facts and the customer’s requested follow-up.", "Explain the approved review path and next contact."],
        do: ["Stay respectful and factual.", "Protect personal information in the record.", "Offer a manager review when appropriate."],
        avoid: ["Do not argue, retaliate, or dismiss the concern.", "Do not promise a refund, warranty result, or deadline.", "Do not speculate about legal rights."],
        escalation: "Escalate threats, discrimination, safety or privacy concerns, disputed charges, repeated unresolved complaints, or any outcome you cannot approve.",
      },
    },
    fr: {
      title: "Plaintes",
      summary: "Écoutez sans discuter, notez la préoccupation sans renseignements personnels inutiles et expliquez la voie d’examen approuvée. N’exercez pas de représailles et ne promettez pas de résultat précis.",
      script: "Je suis désolé que cette situation soit frustrante. Je vais noter votre préoccupation et expliquer la prochaine étape d’examen. Je ne peux pas promettre le résultat, mais je peux m’assurer que la procédure approuvée est suivie.",
      infographic: {
        steps: ["Écoutez et reformulez calmement la préoccupation.", "Notez les faits pertinents et le suivi demandé.", "Expliquez la voie d’examen approuvée et le prochain contact."],
        do: ["Restez respectueux et factuel.", "Protégez les renseignements personnels dans le dossier.", "Proposez l’examen par un gestionnaire au besoin."],
        avoid: ["Ne discutez pas, n’exercez pas de représailles et ne rejetez pas la préoccupation.", "Ne promettez ni remboursement, ni garantie, ni délai.", "Ne spéculez pas sur les droits juridiques."],
        escalation: "Faites remonter les menaces, la discrimination, les enjeux de sécurité ou de confidentialité, les frais contestés et les plaintes répétées.",
      },
    },
  },
  escalation: {
    en: {
      title: "Escalation",
      summary: "Escalate questions about legal rights, safety, privacy, disputed charges, or an outcome you cannot approve to a manager and the official source listed here.",
      script: "This question needs a manager or an official source rather than a guess from me. I’ll escalate it and make sure you know what happens next.",
      infographic: {
        steps: ["Pause when the question is outside your authority or the guide.", "Capture only the facts needed for review.", "Connect the customer with a manager and the official source."],
        do: ["Say when you are unsure.", "Keep the customer’s information private.", "Record the escalation and agreed follow-up."],
        avoid: ["Do not give legal conclusions.", "Do not promise an exception or outcome.", "Do not send a customer to an unverified website."],
        escalation: "Always involve a manager for safety, privacy, legal-rights, threats, disputed money, media contact, or a decision outside your authority.",
      },
    },
    fr: {
      title: "Escalade",
      summary: "Faites remonter au gestionnaire les questions sur les droits juridiques, la sécurité, la confidentialité, les frais contestés ou un résultat que vous ne pouvez pas approuver, et indiquez la source officielle.",
      script: "Cette question nécessite un gestionnaire ou une source officielle plutôt qu’une supposition de ma part. Je vais la faire remonter et vous expliquer la prochaine étape.",
      infographic: {
        steps: ["Faites une pause si la question dépasse votre autorité ou le guide.", "Notez seulement les faits nécessaires à l’examen.", "Mettez le client en contact avec un gestionnaire et la source officielle."],
        do: ["Dites lorsque vous n’êtes pas certain.", "Gardez les renseignements du client confidentiels.", "Notez l’escalade et le suivi convenu."],
        avoid: ["Ne tirez pas de conclusion juridique.", "Ne promettez pas d’exception ou de résultat.", "N’envoyez pas le client vers un site non vérifié."],
        escalation: "Impliquez toujours un gestionnaire pour la sécurité, la confidentialité, les droits juridiques, les menaces, l’argent contesté ou une décision hors de votre autorité.",
      },
    },
  },
};