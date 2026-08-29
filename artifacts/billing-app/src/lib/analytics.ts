type AnalyticsData = Record<string, string | number | boolean>;

type EmployeeAuthFlow = "sign_in" | "setup";

export type EmployeeAuthOutcome =
  | "success"
  | "invalid_input"
  | "invalid_pin"
  | "inactive_account"
  | "account_not_found"
  | "throttled"
  | "setup_already_complete"
  | "error";

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never affect authentication or other app behavior.
  }
}

export function trackEmployeeAuthOutcome(
  flow: EmployeeAuthFlow,
  outcome: EmployeeAuthOutcome,
): void {
  trackEvent("employee_auth_outcome", { flow, outcome });
}