import { apiUrl } from "@/lib/api-config";

export function recordAuditEvent(action: "print" | "payment" | "status_change", entityType: "sale" | "quotation" | "repair" | "backup", entityId?: number) {
  void fetch(apiUrl("/audit-logs"), {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, entityType, entityId: entityId ? String(entityId) : undefined }),
  }).then(async (response) => {
    if (response.ok) return;
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error ?? `Audit event failed (HTTP ${response.status}).`);
  }).catch((error: unknown) => {
    // Audit telemetry must not block the primary sale/repair interaction, but
    // failed writes should remain visible during local troubleshooting.
    console.warn(error instanceof Error ? error.message : "Audit event failed.");
  });
}