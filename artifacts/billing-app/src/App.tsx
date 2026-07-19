import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmployeeProvider } from "@/context/EmployeeContext";
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
import Employees from "@/pages/Employees";
import RepairsList from "@/pages/RepairsList";
import RepairForm from "@/pages/RepairForm";
import RepairDetail from "@/pages/RepairDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
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
        <Route path="/employees" component={Employees} />
        <Route path="/repairs" component={RepairsList} />
        <Route path="/repairs/new" component={RepairForm} />
        <Route path="/repairs/:id/edit">{(params) => <RepairForm key={params.id} />}</Route>
        <Route path="/repairs/:id" component={RepairDetail} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />

        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <EmployeeProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </EmployeeProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
