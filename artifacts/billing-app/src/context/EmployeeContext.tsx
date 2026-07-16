import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface ActiveEmployee {
  id: number;
  name: string;
  role: "admin" | "manager" | "staff";
  maxDiscountPct: number;
}

interface EmployeeContextValue {
  activeEmployee: ActiveEmployee | null;
  setActiveEmployee: (emp: ActiveEmployee | null) => void;
  clearEmployee: () => void;
}

const EmployeeContext = createContext<EmployeeContextValue>({
  activeEmployee: null,
  setActiveEmployee: () => {},
  clearEmployee: () => {},
});

const STORAGE_KEY = "billpro_active_employee";

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const [activeEmployee, setActiveEmployeeState] = useState<ActiveEmployee | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  function setActiveEmployee(emp: ActiveEmployee | null) {
    setActiveEmployeeState(emp);
    if (emp) localStorage.setItem(STORAGE_KEY, JSON.stringify(emp));
    else localStorage.removeItem(STORAGE_KEY);
  }

  function clearEmployee() {
    setActiveEmployee(null);
  }

  return (
    <EmployeeContext.Provider value={{ activeEmployee, setActiveEmployee, clearEmployee }}>
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
