const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const configuredOrigin = import.meta.env.VITE_API_ORIGIN?.trim() ?? "";

export interface ApiEndpointStatus {
  origin: string;
  configuredOrigin: string | null;
  warning: string | null;
  secure: boolean;
}

function currentOrigin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

function isAllowedProtocol(protocol: string) {
  return protocol === "https:" || (import.meta.env.DEV && protocol === "http:");
}

function resolveApiOrigin() {
  const fallback = currentOrigin();
  if (!configuredOrigin) return { origin: fallback, warning: null };

  try {
    const parsed = new URL(configuredOrigin);
    if (!isAllowedProtocol(parsed.protocol)) {
      return {
        origin: fallback,
        warning: "The configured API endpoint must use HTTPS outside local development.",
      };
    }
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return {
        origin: fallback,
        warning: "The configured API endpoint must be an origin only, without credentials or a path.",
      };
    }
    if (fallback && parsed.origin !== fallback) {
      return {
        origin: fallback,
        warning: "The configured API endpoint was rejected because it is not the app's same origin.",
      };
    }
    return { origin: parsed.origin, warning: null };
  } catch {
    return {
      origin: fallback,
      warning: "The configured API endpoint is not a valid URL; using the app origin.",
    };
  }
}

const resolved = resolveApiOrigin();

export function getApiOrigin() {
  return resolved.origin;
}

export function getApiBaseUrl() {
  return `${resolved.origin}${basePath}`;
}

export function apiUrl(path: string) {
  return `${getApiBaseUrl()}/api/${path.replace(/^\/+/, "")}`;
}

export function getApiEndpointStatus(): ApiEndpointStatus {
  return {
    origin: resolved.origin || "Unavailable",
    configuredOrigin: configuredOrigin || null,
    warning: resolved.warning,
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  };
}