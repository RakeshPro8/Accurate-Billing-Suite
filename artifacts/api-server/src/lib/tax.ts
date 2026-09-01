import { db, settingsTable, storesTable, taxProfilesTable, type TaxProfileSnapshot } from "@workspace/db";
import { and, desc, eq, lte } from "drizzle-orm";

export type TaxableItemType = "product" | "service" | "part" | "labour" | "accessory" | "deposit" | "custom";

export interface TaxConfig {
  profileId: number | null;
  enabled: boolean;
  name: string;
  provinceCode: string;
  currency: string;
  gstRate: number;
  hstRate: number;
  pstRate: number;
  qstRate: number;
  roundingMode: "line" | "subtotal";
  partsTaxable: boolean;
  labourTaxable: boolean;
  depositsTaxable: boolean;
  accessoriesTaxable: boolean;
  effectiveFrom: string | null;
}

type TaxSource = typeof db;

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function numberValue(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function snapshotTaxConfig(tax: TaxConfig): TaxProfileSnapshot {
  return {
    profileId: tax.profileId,
    name: tax.name,
    provinceCode: tax.provinceCode,
    currency: tax.currency,
    gstRate: tax.gstRate,
    hstRate: tax.hstRate,
    pstRate: tax.pstRate,
    qstRate: tax.qstRate,
    effectiveFrom: tax.effectiveFrom,
    enabled: tax.enabled,
    roundingMode: tax.roundingMode,
    partsTaxable: tax.partsTaxable,
    labourTaxable: tax.labourTaxable,
    depositsTaxable: tax.depositsTaxable,
    accessoriesTaxable: tax.accessoriesTaxable,
    capturedAt: new Date().toISOString(),
  };
}

export function taxConfigFromSnapshot(snapshot: unknown): TaxConfig | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const value = snapshot as Record<string, unknown>;
  const roundingMode = value.roundingMode === "line" ? "line" : "subtotal";
  return {
    profileId: typeof value.profileId === "number" ? value.profileId : null,
    enabled: value.enabled !== false,
    name: typeof value.name === "string" && value.name ? value.name : "Tax",
    provinceCode: typeof value.provinceCode === "string" && value.provinceCode ? value.provinceCode : "ON",
    currency: typeof value.currency === "string" && value.currency ? value.currency : "CAD",
    gstRate: numberValue(value.gstRate),
    hstRate: numberValue(value.hstRate),
    pstRate: numberValue(value.pstRate),
    qstRate: numberValue(value.qstRate),
    roundingMode,
    partsTaxable: value.partsTaxable !== false,
    labourTaxable: value.labourTaxable !== false,
    depositsTaxable: value.depositsTaxable === true,
    accessoriesTaxable: value.accessoriesTaxable !== false,
    effectiveFrom: typeof value.effectiveFrom === "string" ? value.effectiveFrom : null,
  };
}

function fromProfile(profile: typeof taxProfilesTable.$inferSelect): TaxConfig {
  return {
    profileId: profile.id,
    enabled: profile.enabled,
    name: profile.name,
    provinceCode: profile.provinceCode,
    currency: profile.currency,
    gstRate: numberValue(profile.gstRate),
    hstRate: numberValue(profile.hstRate),
    pstRate: numberValue(profile.pstRate),
    qstRate: numberValue(profile.qstRate),
    roundingMode: profile.roundingMode === "line" ? "line" : "subtotal",
    partsTaxable: profile.partsTaxable,
    labourTaxable: profile.labourTaxable,
    depositsTaxable: profile.depositsTaxable,
    accessoriesTaxable: profile.accessoriesTaxable,
    effectiveFrom: profile.effectiveFrom,
  };
}

/** Resolve the latest enabled profile on or before a transaction date. */
export async function getTaxConfig(storeId: number, at = new Date(), source: TaxSource = db): Promise<TaxConfig> {
  const effectiveDate = at.toISOString().slice(0, 10);
  const [profile] = await source.select().from(taxProfilesTable)
    .where(and(eq(taxProfilesTable.storeId, storeId), eq(taxProfilesTable.enabled, true), lte(taxProfilesTable.effectiveFrom, effectiveDate)))
    .orderBy(desc(taxProfilesTable.effectiveFrom), desc(taxProfilesTable.id))
    .limit(1);
  if (profile) return fromProfile(profile);

  // Existing installations only have the original settings row. This keeps their
  // historical behavior while giving every new transaction a traceable snapshot.
  const [[settings], [store]] = await Promise.all([
    source.select().from(settingsTable).limit(1),
    source.select({ provinceCode: storesTable.provinceCode, currency: storesTable.currency }).from(storesTable).where(eq(storesTable.id, storeId)).limit(1),
  ]);
  const legacyRate = numberValue(settings?.taxRate);
  const gstRate = numberValue(settings?.gstRate);
  const qstRate = numberValue(settings?.qstRate);
  return {
    profileId: null,
    enabled: settings?.taxEnabled !== false,
    name: settings?.taxName || "Tax",
    provinceCode: store?.provinceCode || "ON",
    currency: store?.currency || "CAD",
    gstRate: legacyRate > 0 ? 0 : gstRate,
    hstRate: legacyRate,
    pstRate: 0,
    qstRate,
    roundingMode: "subtotal",
    partsTaxable: true,
    labourTaxable: true,
    depositsTaxable: false,
    accessoriesTaxable: true,
    effectiveFrom: null,
  };
}

function isItemTaxable(item: { type?: string; taxExempt?: boolean }, tax: TaxConfig) {
  if (item.taxExempt || !tax.enabled) return false;
  switch ((item.type || "custom").toLowerCase() as TaxableItemType) {
    case "part":
    case "product":
      return tax.partsTaxable;
    case "accessory":
      return tax.accessoriesTaxable;
    case "service":
    case "labour":
      return tax.labourTaxable;
    case "deposit":
      return tax.depositsTaxable;
    default:
      return tax.labourTaxable;
  }
}

export function calculateTotals(
  items: Array<{ type?: string; quantity: number; unitPrice: number; discount?: number; taxExempt?: boolean }>,
  tax: TaxConfig,
  discount = 0,
) {
  const normalized = items.map((item) => ({
    ...item,
    net: round(Math.max(0, numberValue(item.quantity)) * Math.max(0, numberValue(item.unitPrice)) - Math.max(0, numberValue(item.discount))),
  }));
  const subtotal = round(normalized.reduce((sum, item) => sum + item.net, 0));
  const totalDiscount = round(Math.min(Math.max(0, numberValue(discount)), subtotal));
  const taxableAfterDiscount = round(Math.max(0, subtotal - totalDiscount));
  const discountRatio = subtotal > 0 ? taxableAfterDiscount / subtotal : 0;
  const taxableLines = normalized.map((item) => ({
    ...item,
    taxable: isItemTaxable(item, tax),
    adjustedNet: round(item.net * discountRatio),
  }));
  const taxableBase = round(taxableLines.filter((item) => item.taxable).reduce((sum, item) => sum + item.adjustedNet, 0));
  const rates = { gst: tax.gstRate, hst: tax.hstRate, pst: tax.pstRate, qst: tax.qstRate };
  const components = tax.roundingMode === "line"
    ? Object.fromEntries(Object.entries(rates).map(([key, rate]) => [
      key,
      round(taxableLines.filter((item) => item.taxable).reduce((sum, item) => sum + round(item.adjustedNet * rate / 100), 0)),
    ]))
    : Object.fromEntries(Object.entries(rates).map(([key, rate]) => [key, round(taxableBase * rate / 100)]));
  const taxAmount = round(Object.values(components).reduce((sum, value) => sum + Number(value), 0));
  const taxRate = tax.enabled ? round(Object.values(rates).reduce((sum, value) => sum + value, 0)) : 0;
  return {
    subtotal,
    taxRate,
    tax: tax.enabled ? taxAmount : 0,
    total: round(taxableAfterDiscount + (tax.enabled ? taxAmount : 0)),
    taxableBase,
    taxComponents: tax.enabled ? components : { gst: 0, hst: 0, pst: 0, qst: 0 },
    taxProfileId: tax.profileId,
    taxProfileSnapshot: snapshotTaxConfig(tax),
  };
}

export function assertMoney(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000) {
    throw new Error(`${label} must be a finite non-negative amount.`);
  }
  return number;
}