import { getLastSyncAt } from "@/lib/offline-store";

const basePath = import.meta.env.BASE_URL;

export interface DesktopDiagnostics {
  appVersion: string;
  serviceWorkerVersion: string;
  lastSyncAt: string | null;
}

async function getAppVersion() {
  try {
    const response = await fetch(`${basePath}manifest.webmanifest`, { cache: "no-store" });
    if (!response.ok) return "Unavailable";
    const manifest = await response.json() as { version?: unknown };
    return typeof manifest.version === "string" && manifest.version ? manifest.version : "Unavailable";
  } catch {
    return "Unavailable";
  }
}

async function getServiceWorkerVersion() {
  if (!("serviceWorker" in navigator) || !("MessageChannel" in window)) return "Unsupported";

  try {
    const registration = await navigator.serviceWorker.getRegistration(basePath);
    const worker = registration?.active ?? registration?.waiting ?? registration?.installing ?? navigator.serviceWorker.controller;
    if (!worker) return "Not active";

    return await new Promise<string>((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve("Unknown"), 1500);
      channel.port1.onmessage = (event: MessageEvent<{ version?: unknown }>) => {
        window.clearTimeout(timeout);
        resolve(typeof event.data?.version === "string" ? event.data.version : "Unknown");
      };
      worker.postMessage({ type: "mobilinq:diagnostics" }, [channel.port2]);
    });
  } catch {
    return "Unknown";
  }
}

export async function readDesktopDiagnostics(): Promise<DesktopDiagnostics> {
  const [appVersion, serviceWorkerVersion] = await Promise.all([getAppVersion(), getServiceWorkerVersion()]);
  return {
    appVersion,
    serviceWorkerVersion,
    lastSyncAt: getLastSyncAt(),
  };
}