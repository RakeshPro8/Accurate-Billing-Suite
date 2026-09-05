/**
 * Thermal receipt layout — optimised for Star TSP100 FuturePRNT (80 mm roll).
 */

import React from "react";
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
  taxName?: string;
  taxProvinceCode?: string;
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
  const qrContent = qrValue ?? docNum;
  const showTax = data.taxRate > 0 || data.tax !== 0;
  const taxLabel = data.taxName ?? business.taxName ?? "Tax";

  return (
    <div
      style={{
        width: "72mm",
        boxSizing: "border-box",
        maxWidth: "100%",
        overflowWrap: "anywhere",
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
            onError={(event) => { event.currentTarget.style.display = "none"; }}
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
        <Row label="Customer" value={data.customerName || "Walk-in Customer"} />
        {data.paymentMethod && <Row label="Payment" value={data.paymentMethod} />}
      </div>

      <Divider />

      {/* ITEMS */}
      <div style={{ marginBottom: "2mm" }}>
        {data.items.map((item, i) => (
          <div
            key={i}
            className="thermal-receipt-item"
            data-receipt-item-index={i}
            data-receipt-item-name={item.name}
            style={{ marginBottom: "2mm" }}
          >
            <div style={{ fontWeight: "bold", overflowWrap: "anywhere" }}>{item.name}</div>
            {item.description && (
              <div style={{ fontSize: "9px", color: "#555", overflowWrap: "anywhere" }}>{item.description}</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ minWidth: 0, fontSize: "10px", overflowWrap: "anywhere" }}>
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

        {/* Tax values are captured on the document; never recalculate from current settings. */}
        {showTax && (
          <Row label={`${taxLabel} (${data.taxRate}%)`} value={formatCurrency(data.tax)} />
        )}
        {data.taxProvinceCode && (
          <Row label="Tax profile" value={data.taxProvinceCode} />
        )}
      </div>

      <Divider thick />

      <Row label="TOTAL" value={formatCurrency(data.total)} bold large />

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
        gap: "2mm",
      }}
    >
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{label}</span>
      <span style={{ minWidth: 0, textAlign: "right", overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}
