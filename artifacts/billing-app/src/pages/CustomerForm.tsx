import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useParams } from "wouter";
import {
  useCreateCustomer, useGetCustomer, useUpdateCustomer,
  getGetCustomersQueryKey, getGetCustomerQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User } from "lucide-react";

interface FormData {
  name: string; email: string; phone: string; address: string; notes: string;
}

export default function CustomerForm() {
  const params = useParams<{ id?: string }>();
  const id = params?.id ? Number(params.id) : undefined;
  const isEdit = Boolean(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useGetCustomer(id!, {
    query: { enabled: isEdit, queryKey: getGetCustomerQueryKey(id!) }
  });
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

  useEffect(() => {
    if (customer) reset({
      name: customer.name,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
    });
  }, [customer, reset]);

  function onSubmit(data: FormData) {
    const payload = {
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      notes: data.notes || undefined,
    };
    if (isEdit) {
      updateCustomer.mutate({ id: id!, data: payload }, {
        onSuccess: (c) => {
          queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id!) });
          toast({ title: "Customer updated" });
          navigate(`/customers/${c.id}`);
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    } else {
      createCustomer.mutate({ data: payload }, {
        onSuccess: (c) => {
          queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
          toast({ title: "Customer created" });
          navigate(`/customers/${c.id}`);
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
    }
  }

  if (isEdit && isLoading) return <div className="space-y-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>;

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/customers")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{isEdit ? "Edit Customer" : "New Customer"}</h1>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input {...register("name", { required: "Name is required" })} placeholder="John Smith" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register("phone")} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...register("email")} type="email" placeholder="john@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea {...register("address")} placeholder="123 Main St, City, State" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register("notes")} placeholder="Any notes about this customer..." rows={2} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
                {createCustomer.isPending || updateCustomer.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Customer"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/customers")}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
