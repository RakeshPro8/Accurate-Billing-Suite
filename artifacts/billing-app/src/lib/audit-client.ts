const API = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

export function recordAuditEvent(action: "print" | "payment" | "status_change", entityType: "sale" | "quotation" | "repair" | "backup", entityId?: number) {
  void fetch(`${API}/audit-logs`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, entityType, entityId: entityId ? String(entityId) : undefined }),
  });
}