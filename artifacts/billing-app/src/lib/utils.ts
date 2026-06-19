import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function downloadCSV(filename: string, rows: (string | number)[][], headers: string[]) {
  const content = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function getStatusColor(status: string) {
  switch (status) {
    case "paid":      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    case "invoice":   return "bg-blue-100 text-blue-700 border border-blue-200";
    case "draft":     return "bg-gray-100 text-gray-600 border border-gray-200";
    case "cancelled": return "bg-red-100 text-red-700 border border-red-200";
    case "sent":      return "bg-amber-100 text-amber-700 border border-amber-200";
    case "accepted":  return "bg-teal-100 text-teal-700 border border-teal-200";
    case "converted": return "bg-purple-100 text-purple-700 border border-purple-200";
    case "expired":   return "bg-orange-100 text-orange-700 border border-orange-200";
    default:          return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}
