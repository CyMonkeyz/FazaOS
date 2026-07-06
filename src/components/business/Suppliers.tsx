import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingBlock } from "@/components/ui-lite";
import { toast } from "sonner";
import { Plus, Trash2, Truck } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

export function SuppliersTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [businessId, setBusinessId] = useState<string>("none");
  const [notes, setNotes] = useState("");

  const { data: businesses } = useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id,name")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*, businesses(name)")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!name.trim()) throw new Error("Nama supplier wajib diisi");
      const { error } = await supabase.from("suppliers").insert({
        user_id: u.user!.id,
        name,
        contact: contact || null,
        business_id: businessId === "none" ? null : businessId,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier ditambahkan");
      setName("");
      setContact("");
      setBusinessId("none");
      setNotes("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("suppliers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Dihapus");
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Supplier
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Tambah Supplier</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Nama</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Kontak</Label>
                <Input
                  placeholder="WA / email / IG"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>
              <div>
                <Label>Toko</Label>
                <Select value={businessId} onValueChange={setBusinessId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Umum —</SelectItem>
                    {(businesses ?? []).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Catatan</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Simpan
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="Belum ada supplier"
          description="Tambahkan pemasok untuk memudahkan restock."
          icon={Truck}
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {data!.map((s: any) => (
            <Card key={s.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  {s.contact && (
                    <div className="text-xs text-muted-foreground mt-0.5">{s.contact}</div>
                  )}
                  {s.businesses?.name && (
                    <div className="text-xs text-muted-foreground">Toko: {s.businesses.name}</div>
                  )}
                  {s.notes && <div className="text-xs mt-1 line-clamp-2">{s.notes}</div>}
                </div>
                <button
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Hapus supplier?",
                        description: `"${s.name}" akan diarsipkan dari daftar supplier.`,
                        confirmText: "Hapus",
                      })
                    )
                      remove.mutate(s.id);
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
