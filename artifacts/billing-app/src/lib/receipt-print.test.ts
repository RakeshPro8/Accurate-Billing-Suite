import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ReceiptPrint } from "../components/ReceiptPrint";

describe("receipt print markup", () => {
  it("renders the stored document values and readable optional-field fallbacks", () => {
    const longName = "Long item name that must wrap on a narrow thermal paper roll";
    const markup = renderToStaticMarkup(
      React.createElement(ReceiptPrint, {
        mode: "receipt",
        data: {
          invoiceNumber: "INV-0042",
          createdAt: "2026-09-01T12:00:00.000Z",
          items: [{
            name: longName,
            description: "Screen replacement",
            quantity: 1,
            unitPrice: 100,
            discount: 5,
            total: 95,
          }],
          subtotal: 95,
          taxRate: 14,
          tax: 13.3,
          taxName: "HST",
          taxProvinceCode: "ON",
          discount: 5,
          total: 108.3,
          notes: "Keep this receipt for your records.",
        },
        business: {
          businessName: "Mobilinq Repair Co.",
          businessAddress: "123 Main Street",
          businessPhone: "555-0100",
          logoUrl: "missing-logo.png",
          thankYouMessage: "Thank you for your business.",
          invoiceFooter: "Returns within 30 days.",
          taxName: "Current settings tax name",
          gstRate: 99,
          qstRate: 99,
        },
      }),
    );

    assert.match(markup, /Mobilinq Repair Co\./);
    assert.match(markup, /INV-0042/);
    assert.match(markup, new RegExp(longName));
    assert.match(markup, /Subtotal/);
    assert.match(markup, /HST/);
    assert.match(markup, /\$13\.30/);
    assert.match(markup, /Tax profile/);
    assert.match(markup, /Thank you for your business\./);
    assert.match(markup, /Keep this receipt for your records\./);
    assert.match(markup, /Returns within 30 days\./);
    assert.match(markup, /<svg/);
    assert.match(markup, /overflow-wrap:anywhere/);
    assert.doesNotMatch(markup, /GST \(99%\)/);
    assert.doesNotMatch(markup, /QST \(99%\)/);
  });

  it("prints a walk-in customer and omits a zero-tax line without inventing tax", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReceiptPrint, {
        mode: "receipt",
        data: {
          quoteNumber: "QUO-0010",
          createdAt: "2026-09-01T12:00:00.000Z",
          items: [],
          subtotal: 0,
          taxRate: 0,
          tax: 0,
          discount: 0,
          total: 0,
        },
        business: { businessName: "Mobilinq" },
      }),
    );

    assert.match(markup, /Walk-in Customer/);
    assert.match(markup, /TOTAL/);
    assert.doesNotMatch(markup, /Tax \(0%\)/);
    assert.match(markup, /<svg/);
  });

  it("honors saved visibility choices and allows saved copy to be cleared", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReceiptPrint, {
        mode: "receipt",
        data: {
          invoiceNumber: "INV-0099",
          createdAt: "2026-09-01T12:00:00.000Z",
          customerName: "Private Customer",
          paymentMethod: "Card",
          items: [],
          subtotal: 100,
          taxRate: 13,
          tax: 13,
          taxProvinceCode: "ON",
          discount: 0,
          total: 113,
        },
        business: {
          businessName: "Mobilinq",
          businessAddress: "Private address",
          businessPhone: "555-0100",
          businessEmail: "hello@example.com",
          thankYouMessage: "Legacy thank-you",
          invoiceFooter: "Legacy footer",
          receiptContent: {
            thankYouMessage: null,
            footerText: null,
            showBusinessContact: false,
            showCustomerDetails: false,
            showPaymentMethod: false,
            showTaxBreakdown: false,
            showQrCode: false,
          },
        },
      }),
    );

    assert.match(markup, /Mobilinq/);
    assert.match(markup, /INV-0099/);
    assert.doesNotMatch(markup, /Private address/);
    assert.doesNotMatch(markup, /Private Customer/);
    assert.doesNotMatch(markup, /Payment/);
    assert.doesNotMatch(markup, /Tax profile/);
    assert.doesNotMatch(markup, /Tax \(13%\)/);
    assert.doesNotMatch(markup, /Legacy thank-you/);
    assert.doesNotMatch(markup, /Legacy footer/);
    assert.doesNotMatch(markup, /<svg/);
  });
});