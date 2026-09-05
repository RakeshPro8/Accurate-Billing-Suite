import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ReceiptPrint } from "@/components/ReceiptPrint";
import {
  startThermalPrint,
  type ThermalPrintSession,
} from "@/lib/thermal-print";
import "@/index.css";

// Headless Chromium can synthesize afterprint immediately after window.print().
// Keep the dialog stub inert so the test can explicitly drive both browser
// completion and cancellation events in every engine.
window.print = () => {};

const longItemName =
  "Ultra-long OLED replacement display assembly for Galaxy S25 Ultra 5G";
const saleItems = Array.from({ length: 18 }, (_, index) => ({
  name: index === 0 ? longItemName : `Sale replacement part ${String(index + 1).padStart(2, "0")}`,
  description: index === 0 ? "Long description that must wrap on receipt paper" : undefined,
  quantity: index % 3 === 0 ? 2 : 1,
  unitPrice: 10 + index,
  discount: index === 2 ? 5 : 0,
  total: index % 3 === 0 ? (10 + index) * 2 : 10 + index,
}));
const quotationItems = Array.from({ length: 20 }, (_, index) => ({
  name: index === 19 ? `${longItemName} quotation option` : `Quotation replacement part ${String(index + 1).padStart(2, "0")}`,
  description: index === 19 ? "Long quotation description that must wrap on receipt paper" : undefined,
  quantity: index % 4 === 0 ? 2 : 1,
  unitPrice: 15 + index,
  discount: index === 6 ? 7 : 0,
  total: index % 4 === 0 ? (15 + index) * 2 : 15 + index,
}));

const documentData = {
  createdAt: "2026-09-01T12:00:00.000Z",
  items: saleItems,
  subtotal: 226,
  taxRate: 0,
  tax: 0,
  discount: 5,
  total: 221,
  notes: "Keep this receipt for your records.",
};

const business = {
  businessName: "Mobilinq Repair Co.",
  businessAddress: "123 Main Street",
  businessPhone: "555-0100",
  thankYouMessage: "Thank you for your business.",
  invoiceFooter: "Returns within 30 days.",
  taxName: "GST",
};

declare global {
  interface Window {
    __printHarness?: {
      complete: () => void;
      cancel: () => void;
      isActive: () => boolean;
    };
  }
}

function A4Surface({
  label,
  testId,
}: {
  label: string;
  testId: string;
}) {
  return (
    <div className="invoice-print-area" data-testid={testId}>
      <div className="a4-fixture-surface">
        <h2>{label}</h2>
        <p>{longItemName}</p>
        {saleItems.map((item) => (
          <p key={item.name}>{item.name}</p>
        ))}
      </div>
    </div>
  );
}

function PrintPreviewHarness() {
  const [documentType, setDocumentType] = useState<"sale" | "quotation">("sale");
  const [status, setStatus] = useState("ready");
  const sessionRef = useRef<ThermalPrintSession | null>(null);

  function openReceipt() {
    if (sessionRef.current?.isActive()) return;
    setStatus("printing");
    const session = startThermalPrint({
      onFinished: (reason) => {
        sessionRef.current = null;
        setStatus(reason);
      },
    });
    sessionRef.current = session;
  }

  function completeReceipt() {
    window.dispatchEvent(new Event("afterprint"));
  }

  function cancelReceipt() {
    sessionRef.current?.cancel();
  }

  window.__printHarness = {
    complete: completeReceipt,
    cancel: cancelReceipt,
    isActive: () => sessionRef.current?.isActive() ?? false,
  };

  const receiptData =
    documentType === "sale"
      ? { ...documentData, invoiceNumber: "INV-0042", customerName: undefined }
      : {
          ...documentData,
          items: quotationItems,
          quoteNumber: "QUO-0010",
          customerName: undefined,
        };

  return (
    <main>
      <div className="no-print harness-toolbar">
        <h1>Print preview harness</h1>
        <button type="button" data-testid="sale-tab" onClick={() => setDocumentType("sale")}>
          Sale
        </button>
        <button type="button" data-testid="quotation-tab" onClick={() => setDocumentType("quotation")}>
          Quotation
        </button>
        <button type="button" data-testid="print-receipt" onClick={openReceipt}>
          Print receipt
        </button>
        <button type="button" data-testid="complete-print" onClick={completeReceipt}>
          Complete preview
        </button>
        <button type="button" data-testid="cancel-print" onClick={cancelReceipt}>
          Cancel preview
        </button>
        <output data-testid="print-status">{status}</output>
      </div>

      <div className="receipt-print-area" data-testid="receipt-surface">
        <ReceiptPrint
          data={receiptData}
          business={business}
          mode="receipt"
          qrValue={`https://mobilinq.example/receipt/${"invoiceNumber" in receiptData ? receiptData.invoiceNumber : receiptData.quoteNumber}`}
        />
      </div>

      <A4Surface label="A4 invoice" testId="a4-invoice" />
      <A4Surface label="A4 quotation" testId="a4-quotation" />
      <A4Surface label="A4 repair ticket" testId="a4-repair-ticket" />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<PrintPreviewHarness />);