import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/ui-lite";
import { formatIDR, parseAmount } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Package } from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";
import { queryKeys } from "@/lib/queryKeys";
import { useConfirm } from "@/components/ConfirmProvider";

export function ProductsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { selectedBusinessId, businesses, isAllBusinesses } = useBusiness();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [hpp, setHpp] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.business.products(selectedBusinessId),
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("*,businesses(name)")
        .is("deleted_at", null)
        .order("name");
      if (selectedBusinessId) q = q.eq("business_id", selectedBusinessId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!name.trim()) throw new Error("Nama wajib diisi");
      if (!selectedBusinessId) throw new Error("Pilih satu toko dulu di atas.");
      const p = parseAmount(price),
        h = parseAmount(hpp);
      const { error } = await supabase.from("products").insert({
        user_id: u.user!.id,
        business_id: selectedBusinessId,
        name,
        sku: sku || null,
        hpp: h,
        price: p,
        stock: stock ? Number(stock) : 0,
        min_stock: minStock ? Number(minStock) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produk ditambahkan");
      setName("");
      setSku("");
      setHpp("");
      setPrice("");
      setStock("");
      setMinStock("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["business-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-products"] });
      toast.success("Dihapus");
    },
  });

  const canAdd = !!selectedBusinessId && businesses.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {isAllBusinesses ? "Semua bisnis" : "Bisnis terpilih"}
        </div>
        <Sheet
          open={open}
          onOpenChange={(v) => {
            if (v && !canAdd) {
              toast.error("Pilih satu toko dulu.");
              return;
            }
            setOpen(v);
          }}
        >
          <SheetTrigger asChild>
            <Button size="sm" disabled={!canAdd}>
              <Plus className="mr-1 h-4 w-4" /> Produk
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Tambah Produk</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Nama Produk</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>SKU</Label>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>HPP (Rp)</Label>
                  <Input inputMode="numeric" value={hpp} onChange={(e) => setHpp(e.target.value)} />
                </div>
                <div>
                  <Label>Harga Jual (Rp)</Label>
                  <Input
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>
              {parseAmount(price) > 0 && parseAmount(hpp) > 0 && (
                <div className="rounded-lg bg-muted/50 p-3 text-xs">
                  Margin:{" "}
                  <span className="font-semibold text-success">
                    {formatIDR(parseAmount(price) - parseAmount(hpp))}
                  </span>
                  {" · "}
                  <span className="text-muted-foreground">
                    {Math.round(
                      ((parseAmount(price) - parseAmount(hpp)) / parseAmount(price)) * 100,
                    )}
                    %
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Stok</Label>
                  <Input
                    inputMode="numeric"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Min. Stok</Label>
                  <Input
                    inputMode="numeric"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                  />
                </div>
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
          title="Belum ada produk"
          description="Tambah produk untuk mulai mencatat penjualan."
          icon={Package}
        />
      ) : (
        <Card className="divide-y">
          {data!.map((p: any) => {
            const low = p.stock <= p.min_stock;
            return (
              <div key={p.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    HPP {formatIDR(p.hpp)} · Jual {formatIDR(p.price)}
                  </div>
                  {isAllBusinesses && p.businesses?.name && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Bisnis: {p.businesses.name}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-1.5">
                    <StatusBadge tone={low ? "danger" : "default"}>Stok: {p.stock}</StatusBadge>
                    {p.sku && <span className="text-[11px] text-muted-foreground">{p.sku}</span>}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Hapus produk?",
                        description: `"${p.name}" akan diarsipkan dari daftar produk.`,
                        confirmText: "Hapus",
                      })
                    )
                      remove.mutate(p.id);
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
