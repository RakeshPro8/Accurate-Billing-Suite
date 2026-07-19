import { useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Receipt, FileText, Users, PackageSearch,
  BarChart3, Settings, Menu, ShieldCheck, UserCircle2, LogIn, Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useEmployee, ROLE_COLORS, ROLE_LABELS } from "@/context/EmployeeContext";
import { EmployeePinDialog } from "@/components/EmployeePinDialog";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/products", label: "Products & Services", icon: PackageSearch },
  { href: "/repairs", label: "Repairs", icon: Wrench },
  { href: "/employees", label: "Employees", icon: ShieldCheck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ className = "", onItemClick }: { className?: string; onItemClick?: () => void }) {
  const [location] = useLocation();

  return (
    <nav className={`space-y-0.5 ${className}`}>
      {navItems.map((item) => {
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

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-card no-print">
        <div className="p-4 border-b h-14 flex items-center">
          <h1 className="text-lg font-bold text-primary flex items-center gap-2 font-mono tracking-tight">
            <img src="/logo.jpg" alt="Mobilinq" className="h-8 w-auto rounded bg-white object-contain p-0.5" />
            Mobilinq
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
        <header className="h-14 border-b bg-card flex items-center px-4 md:px-6 justify-between shrink-0 no-print">
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
                    <img src="/logo.jpg" alt="Mobilinq" className="h-8 w-auto rounded bg-white object-contain p-0.5" />
                    Mobilinq
                  </h1>
                </div>
                <div className="p-3">
                  <NavLinks />
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="ml-2 font-semibold font-mono">Mobilinq</h1>
          </div>

          <div className="flex items-center gap-3 ml-auto">
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
