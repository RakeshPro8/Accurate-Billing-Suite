/**
 * Thermal receipt layout — optimised for Star TSP100 FuturePRNT (80 mm roll).
 */

import { QRCodeSVG } from "qrcode.react";
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
  gstRate?: number;
  qstRate?: number;
  currency?: string;
  taxName?: string;
  taxEnabled?: boolean;
}

interface ReceiptPrintProps {
  data: ReceiptData;
  business: BusinessInfo;
  mode: "invoice" | "receipt";
  /** URL to encode in the QR code — defaults to just the document number */
  qrValue?: string;
}

export function ReceiptPrint({ data, business, qrValue }: ReceiptPrintProps) {
  const docNum = data.invoiceNumber ?? data.quoteNumber ?? "";
  const gstRate = business.gstRate ?? 0;
  const qstRate = business.qstRate ?? 0;
  const taxableBase = data.subtotal - data.discount;

  // Tax breakdown
  const showGstQst = gstRate > 0 || qstRate > 0;
  const gstAmount  = gstRate > 0 ? taxableBase * (gstRate / 100) : 0;
  const qstAmount  = qstRate > 0 ? taxableBase * (qstRate / 100) : 0;
  const genericTax = data.tax; // fallback if no GST/QST configured

  const qrContent = qrValue ?? docNum;

  return (
    <div
      style={{
        width: "72mm",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "11px",
        color: "#000",
        background: "#fff",
        padding: "4mm 2mm",
        margin: "0 auto",
      }}
    >
      {/* LOGO */}
      {business.logoUrl && (
        <div style={{ textAlign: "center", marginBottom: "3mm" }}>
          <img
            src={business.logoUrl}
            alt="logo"
            style={{ maxHeight: "18mm", maxWidth: "62mm", objectFit: "contain" }}
          />
        </div>
      )}

      {/* STORE HEADER */}
      <div style={{ textAlign: "center", marginBottom: "3mm" }}>
        <div style={{ fontWeight: "bold", fontSize: "13px" }}>
          {business.businessName ?? "Your Store"}
        </div>
        {business.businessAddress && (
          <div style={{ fontSize: "9px", marginTop: "0.5mm" }}>{business.businessAddress}</div>
        )}
        {business.businessPhone && (
          <div style={{ fontSize: "9px" }}>Tel: {business.businessPhone}</div>
        )}
        {business.businessEmail && (
          <div style={{ fontSize: "9px" }}>{business.businessEmail}</div>
        )}
      </div>

      <Divider />

      {/* DOCUMENT INFO */}
      <div style={{ marginBottom: "2mm" }}>
        <Row label={data.invoiceNumber ? "INVOICE" : "QUOTATION"} value={docNum} bold />
        <Row label="Date" value={formatDate(data.createdAt)} />
        {data.customerName && <Row label="Customer" value={data.customerName} />}
        {data.paymentMethod && <Row label="Payment" value={data.paymentMethod} />}
      </div>

      <Divider />

      {/* ITEMS */}
      <div style={{ marginBottom: "2mm" }}>
        {data.items.map((item, i) => (
          <div key={i} style={{ marginBottom: "2mm" }}>
            <div style={{ fontWeight: "bold" }}>{item.name}</div>
            {item.description && (
              <div style={{ fontSize: "9px", color: "#555" }}>{item.description}</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "10px" }}>
                {item.quantity} × {formatCurrency(item.unitPrice)}
                {(item.discount ?? 0) > 0 && (
                  <span style={{ color: "#555" }}> − {formatCurrency(item.discount ?? 0)}</span>
                )}
              </span>
              <span style={{ fontWeight: "bold" }}>{formatCurrency(item.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <Divider />

      {/* TOTALS */}
      <div style={{ marginBottom: "2mm" }}>
        <Row label="Subtotal" value={formatCurrency(data.subtotal)} />
        {data.discount > 0 && (
          <Row label="Discount" value={`−${formatCurrency(data.discount)}`} />
        )}

        {/* Tax breakdown: prefer GST/QST if configured */}
        {showGstQst ? (
          <>
            {gstRate > 0 && (
              <Row
                label={`GST (${gstRate}%)`}
                value={formatCurrency(gstAmount)}
              />
            )}
            {qstRate > 0 && (
              <Row
                label={`QST (${qstRate}%)`}
                value={formatCurrency(qstAmount)}
              />
            )}
          </>
        ) : (
          data.taxRate > 0 && (
            <Row label={`${business.taxName ?? "Tax"} (${data.taxRate}%)`} value={formatCurrency(genericTax)} />
          )
        )}
      </div>

      <Divider thick />

      <Row label="TOTAL" value={formatCurrency(data.total)} bold large />

      {showGstQst && (
        <div style={{ fontSize: "9px", color: "#555", textAlign: "right", marginTop: "1mm" }}>
          incl. GST {formatCurrency(gstAmount)} + QST {formatCurrency(qstAmount)}
        </div>
      )}

      <Divider />

      {/* QR CODE */}
      <div style={{ textAlign: "center", margin: "3mm 0 2mm" }}>
        <QRCodeSVG
          value={qrContent}
          size={80}
          level="M"
          includeMargin={false}
        />
        <div style={{ fontSize: "8px", color: "#777", marginTop: "1mm" }}>{docNum}</div>
      </div>

      <Divider />

      {/* FOOTER */}
      <div style={{ textAlign: "center", marginTop: "2mm", fontSize: "10px" }}>
        {business.thankYouMessage && (
          <div style={{ fontWeight: "bold", marginBottom: "1mm" }}>{business.thankYouMessage}</div>
        )}
        {data.notes && <div style={{ marginBottom: "1mm" }}>{data.notes}</div>}
        {business.invoiceFooter && (
          <div style={{ fontSize: "9px", color: "#555" }}>{business.invoiceFooter}</div>
        )}
        <div style={{ marginTop: "2mm", fontSize: "8px", color: "#999" }}>
          {formatDate(data.createdAt)}
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
