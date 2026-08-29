import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  bootstrapAdmin,
  getAuthSession,
  getAuthSetupStatus,
  getSignInEmployees,
  logoutEmployee,
  signInEmployee,
  setOfflineCacheScope,
  clearOfflineCache,
} from "@workspace/api-client-react";
import { clearOfflineData, setOfflineScope } from "@/lib/offline-store";
import { useQueryClient } from "@tanstack/react-query";
import {
  trackEmployeeAuthOutcome,
} from "@/lib/analytics";
import {
  classifySetupError,
  classifySignInError,
} from "@/lib/employee-auth-outcomes";

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
  publicStateError: string | null;
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
  publicStateError: null,
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

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeEmployee, setActiveEmployee] = useState<ActiveEmployee | null>(null);
  const [signInEmployees, setSignInEmployees] = useState<SignInEmployee[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [publicStateError, setPublicStateError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadPublicState() {
    try {
      const setup = await getAuthSetupStatus();
      setNeedsSetup(Boolean(setup.needsSetup));
      if (setup.needsSetup) {
        setSignInEmployees([]);
        setPublicStateError(null);
        return;
      }
      const employees = await getSignInEmployees();
      setSignInEmployees(employees);
      setPublicStateError(null);
    } catch (error) {
      setPublicStateError("Unable to reach the employee service. Check the connection and try again.");
      throw error;
    }
  }

  async function refresh() {
    setIsLoading(true);
    try {
      const session = await getAuthSession();
      if (session.authenticated && session.employee) {
        const employee = asActiveEmployee(session.employee);
        const storeId = Number(localStorage.getItem(`mobilinq.storeId:${employee.id}`)) || null;
        setActiveEmployee(employee);
        setOfflineScope({ employeeId: employee.id, storeId });
        setOfflineCacheScope(`${employee.id}:${storeId ?? "all"}`);
        setNeedsSetup(false);
        setPublicStateError(null);
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
        setPublicStateError("Unable to reach the employee service. Check the connection and try again.");
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
      const storeId = Number(localStorage.getItem("mobilinq.storeId")) || null;
      setOfflineScope({ employeeId: result.employee.id, storeId });
      setOfflineCacheScope(`${result.employee.id}:${storeId ?? "all"}`);
      setNeedsSetup(false);
      setPublicStateError(null);
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
      setOfflineScope({ employeeId: result.employee.id, storeId: null });
      setOfflineCacheScope(`${result.employee.id}:all`);
      setNeedsSetup(false);
      setPublicStateError(null);
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
      await clearOfflineData();
      await clearOfflineCache();
      setOfflineScope(null);
      setOfflineCacheScope(null);
      setActiveEmployee(null);
      await loadPublicState().catch(() => {});
    }
  }

  useEffect(() => {
    void refresh();
    const handleExpired = () => {
      void clearOfflineData();
      void clearOfflineCache();
      setOfflineScope(null);
      setOfflineCacheScope(null);
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
      publicStateError,
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