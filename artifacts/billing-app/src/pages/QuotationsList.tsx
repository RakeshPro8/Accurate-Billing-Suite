import { useState } from "react";
import { useGetQuotations, useDeleteQuotation, getGetQuotationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Trash2, Eye } from "lucide-react";

const STATUSES = ["all", "draft", "sent", "accepted", "expired", "converted"];

export default function QuotationsList() {
  const [status, setStatus] = useState("all");
  const { data: quotations, isLoading } = useGetQuotations({ status: status === "all" ? undefined : status });
  const deleteQuotation = useDeleteQuotation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  function handleDelete(id: number, num: string) {
    deleteQuotation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationsQueryKey() });
        toast({ title: "Quotation deleted", description: `${num} removed.` });
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className="text-muted-foreground text-sm">Price quotes for customers</p>
        </div>
        <Link href="/quotations/new">
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New Quote</Button>
        </Link>
      </div>

      <div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => (
              <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : !quotations?.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium text-muted-foreground">No quotations found</p>
            <p className="text-sm text-muted-foreground mt-1">Create a price quote for a customer</p>
            <Link href="/quotations/new">
              <Button className="mt-4" size="sm"><Plus className="h-4 w-4 mr-1.5" /> New Quote</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Quote #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Expires</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotations.map(q => (
                <tr key={q.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                  <td className="p-3 font-mono text-xs font-medium">{q.quoteNumber}</td>
                  <td className="p-3 max-w-[150px] truncate">{q.customerName || <span className="text-muted-foreground italic">No name</span>}</td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{formatDate(q.createdAt)}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{q.expiresAt ? formatDate(q.expiresAt) : "—"}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${getStatusColor(q.status)}`}>{q.status}</span>
                  </td>
                  <td className="p-3 text-right font-semibold">{formatCurrency(q.total)}</td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/quotations/${q.id}`)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Quotation?</AlertDialogTitle>
                            <AlertDialogDescription>Delete {q.quoteNumber}? This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(q.id, q.quoteNumber)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
