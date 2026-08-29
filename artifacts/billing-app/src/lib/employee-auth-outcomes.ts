import type { EmployeeAuthOutcome } from "./analytics";

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

export function classifySignInError(error: unknown): EmployeeAuthOutcome {
  switch (getHttpStatus(error)) {
    case 400:
      return "invalid_input";
    case 401:
      return "invalid_pin";
    case 403:
      return "inactive_account";
    case 404:
      return "account_not_found";
    case 429:
      return "throttled";
    default:
      return "error";
  }
}

export function classifySetupError(error: unknown): EmployeeAuthOutcome {
  switch (getHttpStatus(error)) {
    case 400:
      return "invalid_input";
    case 409:
      return "setup_already_complete";
    default:
      return "error";
  }
}