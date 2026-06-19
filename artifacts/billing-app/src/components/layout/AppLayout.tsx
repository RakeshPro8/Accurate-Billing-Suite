import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Users,
  PackageSearch,
  BarChart3,
  Settings,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/products", label: "Products & Services", icon: PackageSearch },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ className = "", onItemClick }: { className?: string; onItemClick?: () => void }) {
  const [location] = useLocation();

  return (
    <nav className={`space-y-1 ${className}`}>
      {navItems.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        const Icon = item.icon;
        
        return (
          <Link key={item.href} href={item.href} onClick={onItemClick}>
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <div className="p-4 border-b h-16 flex items-center">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <span className="bg-primary text-primary-foreground w-8 h-8 rounded flex items-center justify-center font-bold text-lg">B</span>
            BillPro
          </h1>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <NavLinks />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center px-4 md:px-6 justify-between md:justify-end shrink-0">
          <div className="flex items-center md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="p-4 border-b h-16 flex items-center">
                  <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground w-8 h-8 rounded flex items-center justify-center font-bold text-lg">B</span>
                    BillPro
                  </h1>
                </div>
                <div className="p-3">
                  <NavLinks />
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="ml-2 font-semibold">BillPro</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* User menu or other header actions can go here */}
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium text-secondary-foreground border">
              A
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto p-4 md:p-6 max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
