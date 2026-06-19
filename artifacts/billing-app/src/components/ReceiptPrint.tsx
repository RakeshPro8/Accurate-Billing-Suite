/**
 * Thermal receipt layout — optimised for Star TSP100 FuturePRNT (80 mm roll).
 *
 * HOW TO USE WITH TSP100:
 *  1. Install Star FuturePRNT driver on Windows — printer appears as "Star TSP100".
 *  2. Click "Print Receipt" on any invoice → browser print dialog opens.
 *  3. Select "Star TSP100 Cutter" as the printer.
 *  4. Paper size: choose "Receipt 80mm" (or 3.15in × auto / custom size 80×200mm).
 *  5. Margins: None.  Orientation: Portrait.  Print!
 *
 * The page CSS forces 80 mm width and hides all non-receipt elements.
 */

import { formatCurrency, formatDate } from "@/lib/utils";

interface ReceiptItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
}

interface ReceiptData {
  invoiceNumber?: string;
  quoteNumber?: string;
  createdAt: string;
  customerName?: string;
  customerEmail?: string;
  paymentMethod?: string;
  items: ReceiptItem[];
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  status?: string;
}

interface BusinessInfo {
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  logoUrl?: string;
  thankYouMessage?: string;
  invoiceFooter?: string;
}

interface ReceiptPrintProps {
  data: ReceiptData;
  business: BusinessInfo;
  /** "invoice" = full A4 invoice,  "receipt" = 80mm thermal */
  mode: "invoice" | "receipt";
}

export function ReceiptPrint({ data, business, mode }: ReceiptPrintProps) {
  const docNum = data.invoiceNumber ?? data.quoteNumber ?? "";
  const isReceipt = mode === "receipt";

  return (
    <div
      id="receipt-root"
      style={{
        width: isReceipt ? "72mm" : "100%",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: isReceipt ? "11px" : "13px",
        color: "#000",
        background: "#fff",
        padding: isReceipt ? "4mm 2mm" : "0",
      }}
    >
      {/* ---- LOGO ---- */}
      {business.logoUrl && (
        <div style={{ textAlign: "center", marginBottom: isReceipt ? "4mm" : "6mm" }}>
          <img
            src={business.logoUrl}
            alt="logo"
            style={{
              maxHeight: isReceipt ? "18mm" : "28mm",
              maxWidth: isReceipt ? "60mm" : "120mm",
              objectFit: "contain",
            }}
          />
        </div>
      )}

      {/* ---- STORE HEADER ---- */}
      <div style={{ textAlign: "center", marginBottom: isReceipt ? "3mm" : "5mm" }}>
        <div style={{ fontWeight: "bold", fontSize: isReceipt ? "13px" : "16px" }}>
          {business.businessName ?? "Your Store"}
        </div>
        {business.businessAddress && (
          <div style={{ fontSize: isReceipt ? "9px" : "11px", marginTop: "1mm" }}>
            {business.businessAddress}
          </div>
        )}
        {business.businessPhone && (
          <div style={{ fontSize: isReceipt ? "9px" : "11px" }}>Tel: {business.businessPhone}</div>
        )}
        {business.businessEmail && (
          <div style={{ fontSize: isReceipt ? "9px" : "11px" }}>{business.businessEmail}</div>
        )}
      </div>

      <Divider />

      {/* ---- DOCUMENT INFO ---- */}
      <div style={{ marginBottom: "2mm" }}>
        <Row label={data.invoiceNumber ? "INVOICE" : "QUOTATION"} value={docNum} bold />
        <Row label="Date" value={formatDate(data.createdAt)} />
        {data.customerName && <Row label="Customer" value={data.customerName} />}
        {data.paymentMethod && <Row label="Payment" value={data.paymentMethod} />}
      </div>

      <Divider />

      {/* ---- ITEMS ---- */}
      <div style={{ marginBottom: "2mm" }}>
        {data.items.map((item, i) => (
          <div key={i} style={{ marginBottom: "1.5mm" }}>
            <div style={{ fontWeight: "bold" }}>{item.name}</div>
            {item.description && (
              <div style={{ fontSize: "9px", color: "#555" }}>{item.description}</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "10px" }}>
                {item.quantity} × {formatCurrency(item.unitPrice)}
                {(item.discount ?? 0) > 0 && ` − ${formatCurrency(item.discount ?? 0)}`}
              </span>
              <span style={{ fontWeight: "bold" }}>{formatCurrency(item.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <Divider />

      {/* ---- TOTALS ---- */}
      <div style={{ marginBottom: "2mm" }}>
        <Row label="Subtotal" value={formatCurrency(data.subtotal)} />
        {data.discount > 0 && <Row label="Discount" value={`−${formatCurrency(data.discount)}`} />}
        {data.taxRate > 0 && <Row label={`Tax (${data.taxRate}%)`} value={formatCurrency(data.tax)} />}
      </div>

      <Divider thick />

      <Row label="TOTAL" value={formatCurrency(data.total)} bold large />

      <Divider />

      {/* ---- FOOTER ---- */}
      <div style={{ textAlign: "center", marginTop: "3mm", fontSize: "10px" }}>
        {business.thankYouMessage && (
          <div style={{ fontWeight: "bold", marginBottom: "1mm" }}>{business.thankYouMessage}</div>
        )}
        {data.notes && <div style={{ marginBottom: "1mm" }}>{data.notes}</div>}
        {business.invoiceFooter && (
          <div style={{ fontSize: "9px", color: "#555" }}>{business.invoiceFooter}</div>
        )}
        <div style={{ marginTop: "2mm", fontSize: "9px", color: "#777" }}>
          {docNum} · {formatDate(data.createdAt)}
        </div>
      </div>
    </div>
  );
}

function Divider({ thick = false }: { thick?: boolean }) {
  return (
    <hr
      style={{
        border: "none",
        borderTop: `${thick ? 2 : 1}px ${thick ? "solid" : "dashed"} #000`,
        margin: "2mm 0",
      }}
    />
  );
}

function Row({
  label, value, bold = false, large = false,
}: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: bold ? "bold" : "normal",
        fontSize: large ? "14px" : "inherit",
        marginBottom: "0.5mm",
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
