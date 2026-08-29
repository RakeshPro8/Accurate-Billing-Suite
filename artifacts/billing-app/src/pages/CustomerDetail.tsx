import { useParams, useLocation } from "wouter";
import { useGetCustomer, useGetSales, getGetCustomerQueryKey, getGetSalesQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Phone, Mail, MapPin, Edit, FileText, DollarSign, ShoppingCart } from "lucide-react";

export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();

  const { data: customer, isLoading } = useGetCustomer(id, {
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) }
  });
  const { data: salesPage } = useGetSales({ customerId: id }, {
    query: { enabled: !!id, queryKey: getGetSalesQueryKey({ customerId: id }) }
  });
  const sales = salesPage?.items ?? [];

  if (isLoading) return <div className="space-y-4">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-24 w-full"/>)}</div>;
  if (!customer) return <div className="text-center py-16 text-muted-foreground">Customer not found.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customers")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{customer.name}</h1>
            <p className="text-sm text-muted-foreground">Customer since {formatDate(customer.createdAt)}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate(`/customers/${id}/edit`)} className="gap-1.5">
          <Edit className="h-3.5 w-3.5" /> Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="text-primary hover:underline">{customer.email}</a>
              </div>
            )}
            {customer.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">{customer.address}</span>
              </div>
            )}
            {customer.notes && (
              <div className="bg-muted rounded p-3 mt-2 text-sm text-muted-foreground">{customer.notes}</div>
            )}
            {!customer.phone && !customer.email && !customer.address && (
              <p className="text-sm text-muted-foreground">No contact information recorded.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="text-lg font-bold">{formatCurrency(customer.totalSpent ?? 0)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg"><ShoppingCart className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="text-lg font-bold">{customer.totalOrders}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Purchase History */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Purchase History</CardTitle>
          <Button size="sm" onClick={() => navigate(`/sales/new`)} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> New Invoice
          </Button>
        </CardHeader>
        <CardContent>
          {!sales?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No purchases recorded yet.</p>
          ) : (
            <div className="divide-y">
              {sales.map(sale => (
                <div key={sale.id} className="py-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 -mx-4 px-4 rounded transition-colors"
                  onClick={() => navigate(`/sales/${sale.id}`)}>
                  <div>
                    <p className="text-sm font-medium">{sale.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(sale.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusColor(sale.status)}`}>{sale.status}</span>
                    <span className="text-sm font-semibold">{formatCurrency(sale.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
