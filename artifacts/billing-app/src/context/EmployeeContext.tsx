import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface ActiveEmployee {
  id: number;
  name: string;
  role: "admin" | "manager" | "staff";
  maxDiscountPct: number;
}

interface EmployeeContextValue {
  activeEmployee: ActiveEmployee | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  clearEmployee: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextValue>({
  activeEmployee: null,
  isLoading: true,
  refresh: async () => {},
  clearEmployee: async () => {},
});

async function fetchSession(): Promise<ActiveEmployee | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/auth/session`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.authenticated || !data.employee) return null;
  return {
    id: data.employee.id,
    name: data.employee.name,
    role: data.employee.role,
    maxDiscountPct: data.employee.maxDiscountPct,
  };
}

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const [activeEmployee, setActiveEmployee] = useState<ActiveEmployee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    try {
      const emp = await fetchSession();
      setActiveEmployee(emp);
    } catch {
      setActiveEmployee(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function clearEmployee() {
    await fetch(`${import.meta.env.BASE_URL}api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setActiveEmployee(null);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <EmployeeContext.Provider value={{ activeEmployee, isLoading, refresh, clearEmployee }}>
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
