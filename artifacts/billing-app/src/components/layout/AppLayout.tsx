import { useState, ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Receipt, FileText, Users, PackageSearch,
  BarChart3, Settings, Menu, ShieldCheck, LogIn, Wrench, Cpu, Activity, MonitorCog, Boxes, Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useEmployee, ROLE_COLORS, ROLE_LABELS } from "@/context/EmployeeContext";
import { EmployeePinDialog } from "@/components/EmployeePinDialog";
import { useGetSettings } from "@workspace/api-client-react";
import { ConnectivityStatus } from "@/components/ConnectivityStatus";
import { StoreSwitcher } from "@/components/StoreSwitcher";
import { applyUiPreferencesToDocument, readUiPreferences, UI_PREFERENCES_EVENT, type UiPreferences } from "@/lib/ui-preferences";

const navItems: Array<{ href: string; label: string; icon: typeof LayoutDashboard; roles?: string[] }> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/products", label: "Products & Services", icon: PackageSearch },
  { href: "/repairs", label: "Repairs", icon: Wrench },
  { href: "/customer-rights", label: "Customer Rights Guide", icon: Scale },
  { href: "/operations", label: "Operations", icon: Boxes },
  { href: "/device-diagram", label: "Device Diagram", icon: Cpu },
  { href: "/employees", label: "Employees", icon: ShieldCheck, roles: ["admin"] },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/audit-logs", label: "Audit Trail", icon: Activity, roles: ["manager", "admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
  { href: "/ui-lab", label: "UI Lab", icon: MonitorCog, roles: ["admin"] },
];

function NavLinks({ className = "", onItemClick }: { className?: string; onItemClick?: () => void }) {
  const [location] = useLocation();
  const { activeEmployee } = useEmployee();

  return (
    <nav className={`space-y-0.5 ${className}`}>
      {navItems.filter((item) => !item.roles || item.roles.includes(activeEmployee?.role ?? "")).map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} onClick={onItemClick}>
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium ${
              isActive
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
            }`}>
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function EmployeeBadge({ onOpen }: { onOpen: () => void }) {
  const { activeEmployee } = useEmployee();

  if (!activeEmployee) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpen}
        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sign In</span>
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-secondary transition-colors"
    >
      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
        {activeEmployee.name[0].toUpperCase()}
      </div>
      <div className="hidden sm:block text-left">
        <p className="text-xs font-semibold leading-none">{activeEmployee.name}</p>
        <p className={`text-xs leading-none mt-0.5 ${ROLE_COLORS[activeEmployee.role]}`}>
          {ROLE_LABELS[activeEmployee.role]}
        </p>
      </div>
    </button>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [uiPreferences, setUiPreferences] = useState<UiPreferences>(() => readUiPreferences());
  const { data: settings } = useGetSettings();
  const appName = settings?.appName || "Mobilinq";
  const logoUrl = settings?.logoUrl || "/logo.jpg";

  useEffect(() => {
    const onPreferencesChange = (event: Event) => {
      const next = (event as CustomEvent<UiPreferences>).detail;
      if (next) setUiPreferences(next);
    };
    window.addEventListener(UI_PREFERENCES_EVENT, onPreferencesChange);
    return () => window.removeEventListener(UI_PREFERENCES_EVENT, onPreferencesChange);
  }, []);

  useEffect(() => {
    applyUiPreferencesToDocument(uiPreferences, settings?.theme || "berry");
    document.title = appName;
  }, [uiPreferences, settings?.theme, appName]);

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside className="app-sidebar hidden md:flex w-60 flex-col border-r bg-card no-print">
        <div className="p-4 border-b h-14 flex items-center">
          <h1 className="text-lg font-bold text-primary flex items-center gap-2 font-mono tracking-tight">
            <img src={logoUrl} alt={appName} className="h-8 w-auto max-w-[120px] rounded bg-white object-contain p-0.5" />
            {appName}
          </h1>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <NavLinks />
        </div>
        <div className="border-t p-3">
          <EmployeeBadge onOpen={() => setPinDialogOpen(true)} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="app-header h-14 border-b bg-card flex items-center px-4 md:px-6 justify-between shrink-0 no-print">
          <div className="flex items-center md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-60 p-0 bg-card no-print">
                <div className="p-4 border-b h-14 flex items-center">
                  <h1 className="text-lg font-bold text-primary flex items-center gap-2 font-mono">
                    <img src={logoUrl} alt={appName} className="h-8 w-auto max-w-[120px] rounded bg-white object-contain p-0.5" />
                    {appName}
                  </h1>
                </div>
                <div className="p-3">
                  <NavLinks />
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="ml-2 font-semibold font-mono">{appName}</h1>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <StoreSwitcher />
            <ConnectivityStatus />
            <EmployeeBadge onOpen={() => setPinDialogOpen(true)} />
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="container mx-auto p-4 md:p-6 max-w-6xl">
            {children}
          </div>
        </div>
      </main>

      <EmployeePinDialog open={pinDialogOpen} onClose={() => setPinDialogOpen(false)} />
    </div>
  );
}
