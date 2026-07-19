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

export function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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

export function getRepairStatusColor(status: string) {
  switch (status) {
    case "intake":         return "bg-slate-100 text-slate-700 border border-slate-200";
    case "diagnostic":     return "bg-amber-100 text-amber-700 border border-amber-200";
    case "waiting_parts":  return "bg-orange-100 text-orange-700 border border-orange-200";
    case "in_progress":    return "bg-blue-100 text-blue-700 border border-blue-200";
    case "ready_qa":       return "bg-purple-100 text-purple-700 border border-purple-200";
    case "completed":      return "bg-teal-100 text-teal-700 border border-teal-200";
    case "picked_up":      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    case "cancelled":      return "bg-red-100 text-red-700 border border-red-200";
    default:               return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}

export function getRepairStatusLabel(status: string) {
  switch (status) {
    case "intake":        return "Intake";
    case "diagnostic":    return "Diagnostic";
    case "waiting_parts": return "Waiting Parts";
    case "in_progress":   return "In Progress";
    case "ready_qa":      return "Ready for QA";
    case "completed":     return "Ready for Pickup";
    case "picked_up":     return "Picked Up";
    case "cancelled":     return "Cancelled";
    default:              return status;
  }
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case "low":    return "bg-slate-100 text-slate-700 border border-slate-200";
    case "normal": return "bg-blue-100 text-blue-700 border border-blue-200";
    case "high":   return "bg-amber-100 text-amber-700 border border-amber-200";
    case "urgent": return "bg-red-100 text-red-700 border border-red-200";
    default:       return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function resizeImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context not available"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    const url = URL.createObjectURL(file);
    img.src = url;
  });
}
