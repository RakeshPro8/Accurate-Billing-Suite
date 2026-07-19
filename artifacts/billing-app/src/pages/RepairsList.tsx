import { useState } from "react";
import { useGetRepairs, useDeleteRepair, getGetRepairsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { formatCurrency, formatDate, getRepairStatusColor, getRepairStatusLabel, getPriorityColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Wrench, Plus, Search, Trash2, ExternalLink, Phone, User } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "intake", label: "Intake" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "waiting_parts", label: "Waiting Parts" },
  { value: "in_progress", label: "In Progress" },
  { value: "ready_qa", label: "Ready for QA" },
  { value: "completed", label: "Ready for Pickup" },
  { value: "picked_up", label: "Picked Up" },
  { value: "cancelled", label: "Cancelled" },
];

export default function RepairsList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data: repairs, isLoading } = useGetRepairs({ status: status === "all" ? undefined : status });
  const deleteRepair = useDeleteRepair();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const filtered = repairs?.filter(r =>
    [r.ticketNumber, r.customerName, r.deviceModel, r.deviceBrand, r.problemDescription, r.technicianName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function handleDelete(id: number, ticket: string) {
    deleteRepair.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRepairsQueryKey() });
        toast({ title: "Repair deleted", description: `${ticket} has been removed.` });
      },
      onError: () => toast({ title: "Error", description: "Failed to delete repair.", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Repairs</h1>
          <p className="text-muted-foreground text-sm">Track work orders from intake to pickup</p>
        </div>
        <Link href="/repairs/new">
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New Repair</Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search tickets, customers, devices..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : !filtered?.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No repair tickets yet</p>
            <p className="text-muted-foreground text-sm mt-1">Create a work order to start tracking a repair</p>
            <Link href="/repairs/new">
              <Button className="mt-4" size="sm"><Plus className="h-4 w-4 mr-1.5" /> New Repair</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(repair => (
            <Card key={repair.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{repair.ticketNumber}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getRepairStatusColor(repair.status)}`}>
                        {getRepairStatusLabel(repair.status)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getPriorityColor(repair.priority)}`}>
                        {repair.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-sm text-foreground truncate max-w-[200px] sm:max-w-xs">
                        {repair.deviceBrand} {repair.deviceModel}
                      </span>
                      {repair.customerName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />{repair.customerName}
                        </span>
                      )}
                      {repair.customerPhone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />{repair.customerPhone}
                        </span>
                      )}
                      {repair.technicianName && (
                        <span className="text-xs text-muted-foreground">Tech: {repair.technicianName}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-semibold">{formatCurrency(repair.total)}</p>
                    <p className="text-xs text-muted-foreground">Balance {formatCurrency(repair.balance)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/repairs/${repair.id}`)}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Repair?</AlertDialogTitle>
                          <AlertDialogDescription>Delete {repair.ticketNumber}? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(repair.id, repair.ticketNumber)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
