import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState, LoadingBlock, StatCard } from "@/components/ui-lite";
import { formatIDR } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Store, TrendingUp } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

type Biz = { id: string; name: string; description: string | null; created_at: string };
type Sale = { business_id: string | null; total: number; profit: number; sold_at: string };

const db = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      is: (
        k: string,
        v: null,
      ) => {
        order: (
          c: string,
          o?: { ascending?: boolean },
        ) => Promise<{ data: unknown[] | null; error: Error | null }>;
      } & Promise<{ data: unknown[] | null; error: Error | null }>;
    };
    insert: (v: Record<string, unknown>) => Promise<{ error: Error | null }>;
    update: (v: Record<string, unknown>) => {
      eq: (c: string, v: string) => Promise<{ error: Error | null }>;
    };
  };
};

export function BusinessesTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: businesses, isLoading } = useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const { data, error } = await db
        .from("businesses")
        .select("id,name,description,created_at")
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Biz[];
    },
  });

  const { data: sales } = useQuery({
    queryKey: ["sales-for-businesses"],
    queryFn: async () => {
      const { data, error } = await db
        .from("sales")
        .select("business_id,total,profit,sold_at")
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nama toko wajib diisi");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from("businesses").insert({
        user_id: u.user!.id,
        name: name.trim(),
        description: description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Toko/bisnis ditambahkan");
      setName("");
      setDescription("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("businesses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Toko dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthSales = (sales ?? []).filter((s) => new Date(s.sold_at) >= monthStart);
  const totalRevenue = monthSales.reduce((s, r) => s + Number(r.total), 0);
  const totalProfit = monthSales.reduce((s, r) => s + Number(r.profit), 0);
  const bizStats = (businesses ?? []).map((b) => {
    const rows = monthSales.filter((s) => s.business_id === b.id);
    return {
      ...b,
      revenue: rows.reduce((s, r) => s + Number(r.total), 0),
      profit: rows.reduce((s, r) => s + Number(r.profit), 0),
      count: rows.length,
    };
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Total omzet bulan ini"
          value={formatIDR(totalRevenue)}
          icon={TrendingUp}
          tone="default"
        />
        <StatCard
          label="Total profit bulan ini"
          value={formatIDR(totalProfit)}
          tone={totalProfit >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Toko/Bisnis
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Tambah Toko / Bisnis</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Nama Toko/Bisnis</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Toko Kopi Sora"
                  required
                />
              </div>
              <div>
                <Label>Deskripsi (opsional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Jenis usaha, lokasi, dll."
                />
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
      ) : bizStats.length === 0 ? (
        <EmptyState
          title="Belum ada toko"
          description="Tambah minimal satu toko/bisnis untuk mulai mencatat produk & penjualan."
          icon={Store}
        />
      ) : (
        <div className="space-y-2">
          {bizStats.map((b) => (
            <Card key={b.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary" />
                    <div className="text-sm font-semibold">{b.name}</div>
                  </div>
                  {b.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{b.description}</div>
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Omzet</div>
                      <div className="font-semibold tabular-nums">{formatIDR(b.revenue)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Profit</div>
                      <div
                        className={`font-semibold tabular-nums ${b.profit >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {formatIDR(b.profit)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Transaksi</div>
                      <div className="font-semibold tabular-nums">{b.count}</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Hapus bisnis?",
                        description: `"${b.name}" akan diarsipkan. Data produk/penjualan terkait tetap aman sebagai data historis.`,
                        confirmText: "Hapus",
                      })
                    )
                      remove.mutate(b.id);
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
