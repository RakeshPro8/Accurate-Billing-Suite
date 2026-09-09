import assert from "node:assert/strict";
import test from "node:test";
import { recyclingReceiptInput, recyclingReceiptUpdate } from "./recycling";

const valid = {
  saleId: 42,
  customerId: 7,
  customerName: "Client",
  customerPhone: "555-0100",
  customerEmail: "client@example.test",
  deviceType: "Téléphone",
  deviceBrand: "Example",
  deviceModel: "Model 1",
  deviceColour: "Noir",
  declaredCondition: "damaged",
  accessories: "Chargeur",
  serialOrImei: "OPTIONAL-ID",
  handoffDate: "2026-09-09",
} as const;

test("accepts the complete recycling template field set", () => {
  assert.equal(recyclingReceiptInput.parse(valid).customerName, "Client");
});

test("rejects missing required contact or device details", () => {
  const { customerPhone: _phone, ...missingPhone } = valid;
  assert.equal(recyclingReceiptInput.safeParse(missingPhone).success, false);
  assert.equal(recyclingReceiptInput.safeParse({ ...valid, declaredCondition: "resale" }).success, false);
});

test("rejects financial values so recycling cannot affect a sale", () => {
  assert.equal(recyclingReceiptInput.safeParse({ ...valid, compensation: 10 }).success, false);
  assert.equal(recyclingReceiptInput.safeParse({ ...valid, tax: 1.50 }).success, false);
});

test("keeps the sale association immutable and minimizes identifiers", () => {
  assert.equal(recyclingReceiptUpdate.safeParse({ saleId: 99 }).success, false);
  assert.equal(recyclingReceiptUpdate.safeParse({ serialOrImei: "x".repeat(151) }).success, false);
  assert.equal(recyclingReceiptUpdate.safeParse({ serialOrImei: null }).success, true);
});
