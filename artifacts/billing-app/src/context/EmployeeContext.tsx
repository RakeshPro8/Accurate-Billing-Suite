import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  bootstrapAdmin,
  getAuthSession,
  getAuthSetupStatus,
  getSignInEmployees,
  logoutEmployee,
  signInEmployee,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  trackEmployeeAuthOutcome,
  type EmployeeAuthOutcome,
} from "@/lib/analytics";

export type EmployeeRole = "admin" | "manager" | "staff";

export interface ActiveEmployee {
  id: number;
  name: string;
  email?: string | null;
  role: EmployeeRole;
  maxDiscountPct: number;
  active: boolean;
}

export interface SignInEmployee {
  id: number;
  name: string;
  role: EmployeeRole;
  maxDiscountPct: number;
}

interface EmployeeContextValue {
  activeEmployee: ActiveEmployee | null;
  signInEmployees: SignInEmployee[];
  needsSetup: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  signIn: (employeeId: number, pin: string) => Promise<void>;
  bootstrap: (data: { name: string; email?: string; pin: string }) => Promise<void>;
  clearEmployee: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextValue>({
  activeEmployee: null,
  signInEmployees: [],
  needsSetup: false,
  isLoading: true,
  refresh: async () => {},
  signIn: async () => {},
  bootstrap: async () => {},
  clearEmployee: async () => {},
});

function asActiveEmployee(employee: any): ActiveEmployee {
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email ?? null,
    role: employee.role,
    maxDiscountPct: Number(employee.maxDiscountPct ?? 0),
    active: employee.active !== false,
  };
}

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function classifySignInError(error: unknown): EmployeeAuthOutcome {
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

function classifySetupError(error: unknown): EmployeeAuthOutcome {
  switch (getHttpStatus(error)) {
    case 400:
      return "invalid_input";
    case 409:
      return "setup_already_complete";
    default:
      return "error";
  }
}

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeEmployee, setActiveEmployee] = useState<ActiveEmployee | null>(null);
  const [signInEmployees, setSignInEmployees] = useState<SignInEmployee[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function loadPublicState() {
    const setup = await getAuthSetupStatus();
    setNeedsSetup(Boolean(setup.needsSetup));
    if (setup.needsSetup) {
      setSignInEmployees([]);
      return;
    }
    const employees = await getSignInEmployees();
    setSignInEmployees(employees);
  }

  async function refresh() {
    setIsLoading(true);
    try {
      const session = await getAuthSession();
      if (session.authenticated && session.employee) {
        setActiveEmployee(asActiveEmployee(session.employee));
        setNeedsSetup(false);
      } else {
        setActiveEmployee(null);
        await loadPublicState();
      }
    } catch {
      setActiveEmployee(null);
      try {
        await loadPublicState();
      } catch {
        setNeedsSetup(false);
        setSignInEmployees([]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(employeeId: number, pin: string) {
    try {
      const result = await signInEmployee({ employeeId, pin });
      queryClient.clear();
      setActiveEmployee(asActiveEmployee(result.employee));
      setNeedsSetup(false);
      trackEmployeeAuthOutcome("sign_in", "success");
    } catch (error) {
      trackEmployeeAuthOutcome("sign_in", classifySignInError(error));
      throw error;
    }
  }

  async function bootstrap(data: { name: string; email?: string; pin: string }) {
    try {
      const result = await bootstrapAdmin(data);
      queryClient.clear();
      setActiveEmployee(asActiveEmployee(result.employee));
      setNeedsSetup(false);
      trackEmployeeAuthOutcome("setup", "success");
    } catch (error) {
      trackEmployeeAuthOutcome("setup", classifySetupError(error));
      throw error;
    }
  }

  async function clearEmployee() {
    try {
      await logoutEmployee();
    } finally {
      queryClient.clear();
      setActiveEmployee(null);
      await loadPublicState().catch(() => {});
    }
  }

  useEffect(() => {
    void refresh();
    const handleExpired = () => {
      setActiveEmployee(null);
      void loadPublicState().catch(() => {});
    };
    window.addEventListener("mobilinq:auth-expired", handleExpired);
    return () => window.removeEventListener("mobilinq:auth-expired", handleExpired);
  }, []);

  return (
    <EmployeeContext.Provider value={{
      activeEmployee,
      signInEmployees,
      needsSetup,
      isLoading,
      refresh,
      signIn,
      bootstrap,
      clearEmployee,
    }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  return useContext(EmployeeContext);
}

export const ROLE_HIERARCHY: Record<string, number> = {
  admin: 3,
  manager: 2,
  staff: 1,
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

export const ROLE_COLORS: Record<string, string> = {
  admin: "text-red-400",
  manager: "text-amber-400",
  staff: "text-emerald-400",
};