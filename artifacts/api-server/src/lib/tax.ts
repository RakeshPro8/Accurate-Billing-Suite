import { db, settingsTable } from "@workspace/db";

export interface TaxConfig {
  enabled: boolean;
  name: string;
  rate: number;
}

export async function getTaxConfig(): Promise<TaxConfig> {
  const [settings] = await db.select({
    taxEnabled: settingsTable.taxEnabled,
    taxName: settingsTable.taxName,
    taxRate: settingsTable.taxRate,
  }).from(settingsTable).limit(1);

  return {
    enabled: settings?.taxEnabled ?? true,
    name: settings?.taxName || "Tax",
    rate: settings ? Number(settings.taxRate) || 0 : 0,
  };
}

export function calculateTotals(
  items: Array<{ quantity: number; unitPrice: number; discount?: number }>,
  tax: TaxConfig,
  discount = 0,
) {
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const subtotal = round(items.reduce((sum, item) => (
    sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0)
      - Math.max(0, Number(item.discount) || 0)
  ), 0));
  const totalDiscount = round(Math.max(0, Number(discount) || 0));
  const taxable = round(Math.max(0, subtotal - totalDiscount));
  const taxAmount = tax.enabled ? round(taxable * (tax.rate / 100)) : 0;
  return {
    subtotal,
    taxRate: tax.enabled ? tax.rate : 0,
    tax: taxAmount,
    total: round(taxable + taxAmount),
  };
}

export function assertMoney(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000) {
    throw new Error(`${label} must be a finite non-negative amount.`);
  }
  return number;
}