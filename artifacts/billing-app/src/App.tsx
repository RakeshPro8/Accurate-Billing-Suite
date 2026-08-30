import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmployeeProvider, useEmployee } from "@/context/EmployeeContext";
import { EmployeeSignIn } from "@/components/EmployeeSignIn";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/Dashboard";
import SalesList from "@/pages/SalesList";
import SaleForm from "@/pages/SaleForm";
import SaleDetail from "@/pages/SaleDetail";
import QuotationsList from "@/pages/QuotationsList";
import QuotationForm from "@/pages/QuotationForm";
import QuotationDetail from "@/pages/QuotationDetail";
import Customers from "@/pages/Customers";
import CustomerForm from "@/pages/CustomerForm";
import CustomerDetail from "@/pages/CustomerDetail";
import Products from "@/pages/Products";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import DeviceDiagram from "@/pages/DeviceDiagram";
import Employees from "@/pages/Employees";
import RepairsList from "@/pages/RepairsList";
import RepairForm from "@/pages/RepairForm";
import RepairDetail from "@/pages/RepairDetail";
import AuditLogs from "@/pages/AuditLogs";
import UiLab from "@/pages/UiLab";
import Operations from "@/pages/Operations";
import CustomerAccess from "@/pages/CustomerAccess";
import Welcome from "@/pages/Welcome";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  const { activeEmployee } = useEmployee();
  const isAdmin = activeEmployee?.role === "admin";
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />

        <Route path="/sales" component={SalesList} />
        <Route path="/sales/new">{() => <SaleForm />}</Route>
        <Route path="/sales/:id/edit">{(params) => <SaleForm key={params.id} />}</Route>
        <Route path="/sales/:id" component={SaleDetail} />

        <Route path="/quotations" component={QuotationsList} />
        <Route path="/quotations/new">{() => <QuotationForm />}</Route>
        <Route path="/quotations/:id/edit">{(params) => <QuotationForm key={params.id} />}</Route>
        <Route path="/quotations/:id" component={QuotationDetail} />

        <Route path="/customers" component={Customers} />
        <Route path="/customers/new">{() => <CustomerForm />}</Route>
        <Route path="/customers/:id/edit">{(params) => <CustomerForm key={params.id} />}</Route>
        <Route path="/customers/:id" component={CustomerDetail} />

        <Route path="/products" component={Products} />
        <Route path="/operations" component={Operations} />
        <Route path="/employees">{() => isAdmin ? <Employees /> : <AccessDenied />}</Route>
        <Route path="/repairs" component={RepairsList} />
        <Route path="/repairs/new" component={RepairForm} />
        <Route path="/repairs/:id/edit">{(params) => <RepairForm key={params.id} />}</Route>
        <Route path="/repairs/:id" component={RepairDetail} />
        <Route path="/device-diagram" component={DeviceDiagram} />
        <Route path="/reports" component={Reports} />
        <Route path="/audit-logs">{() => activeEmployee?.role === "staff" ? <AccessDenied /> : <AuditLogs />}</Route>
        <Route path="/settings">{() => isAdmin ? <Settings /> : <AccessDenied />}</Route>
        <Route path="/ui-lab">{() => isAdmin ? <UiLab /> : <AccessDenied />}</Route>

        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function AccessDenied() {
  return <div className="py-20 text-center text-muted-foreground">You do not have permission to view this page.</div>;
}

function AuthBoundary() {
  const { activeEmployee, isLoading } = useEmployee();
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Loading secure session…</div>;
  }
  return activeEmployee ? <Router /> : <EmployeeSignIn />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <EmployeeProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              <Route path="/customer-access/:token" component={CustomerAccess} />
              <Route path="/welcome" component={Welcome} />
              <Route component={AuthBoundary} />
            </Switch>
          </WouterRouter>
        </EmployeeProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
