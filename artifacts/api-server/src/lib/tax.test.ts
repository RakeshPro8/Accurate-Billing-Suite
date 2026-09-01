import test from "node:test";
import assert from "node:assert/strict";
import { calculateTotals, taxConfigFromSnapshot, snapshotTaxConfig, type TaxConfig } from "./tax";

const config: TaxConfig = {
  profileId: 7, enabled: true, name: "Ontario 2026", provinceCode: "ON", currency: "CAD",
  gstRate: 0, hstRate: 13, pstRate: 0, qstRate: 0, roundingMode: "subtotal",
  partsTaxable: true, labourTaxable: true, depositsTaxable: false, accessoriesTaxable: true, effectiveFrom: "2026-01-01",
};

test("calculates component tax and keeps exempt lines out of the base", () => {
  const result = calculateTotals([
    { type: "part", quantity: 1, unitPrice: 10 },
    { type: "labour", quantity: 1, unitPrice: 20, taxExempt: true },
  ], config);
  assert.equal(result.subtotal, 30);
  assert.equal(result.taxableBase, 10);
  assert.equal(result.tax, 1.3);
  assert.equal(result.taxComponents.hst, 1.3);
  assert.equal(result.total, 31.3);
});

test("rounds per line when the profile requires it", () => {
  const result = calculateTotals([
    { type: "part", quantity: 1, unitPrice: 0.05 },
    { type: "part", quantity: 1, unitPrice: 0.05 },
  ], { ...config, roundingMode: "line", hstRate: 13 });
  assert.equal(result.tax, 0.02);
  assert.equal(calculateTotals([
    { type: "part", quantity: 1, unitPrice: 0.05 },
    { type: "part", quantity: 1, unitPrice: 0.05 },
  ], { ...config, roundingMode: "subtotal", hstRate: 13 }).tax, 0.01);
});

test("disabled profiles do not add tax", () => {
  const result = calculateTotals([{ type: "part", quantity: 1, unitPrice: 100 }], { ...config, enabled: false });
  assert.equal(result.tax, 0);
  assert.equal(result.total, 100);
  assert.equal(result.taxRate, 0);
});

test("snapshots can be used without repricing after a profile changes", () => {
  const snapshot = snapshotTaxConfig(config);
  const restored = taxConfigFromSnapshot(snapshot);
  assert.equal(restored?.profileId, 7);
  assert.equal(restored?.hstRate, 13);
  assert.equal(restored?.provinceCode, "ON");
});