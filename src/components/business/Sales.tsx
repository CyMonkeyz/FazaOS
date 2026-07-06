import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingBlock, StatCard } from "@/components/ui-lite";
import { formatIDR, parseAmount, formatDateID } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";
import { queryKeys } from "@/lib/queryKeys";
import { useConfirm } from "@/components/ConfirmProvider";

export function SalesTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { selectedBusinessId, isAllBusinesses, businesses } = useBusiness();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string>("manual");
  const [productName, setProductName] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitHpp, setUnitHpp] = useState("");
  const [channel, setChannel] = useState("");
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10));

  const { data: products } = useQuery({
    queryKey: ["products-mini", selectedBusinessId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id,name,price,hpp,business_id")
        .is("deleted_at", null)
        .order("name");
      if (selectedBusinessId) q = q.eq("business_id", selectedBusinessId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.business.sales(selectedBusinessId),
    queryFn: async () => {
      let q = supabase.from("sales").select("*,businesses(name)").is("deleted_at", null);
      if (selectedBusinessId) q = q.eq("business_id", selectedBusinessId);
      const { data, error } = await q
        .order("sold_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthSales = (data ?? []).filter((s) => new Date(s.sold_at) >= monthStart);
  const revenue = monthSales.reduce((s, r) => s + Number(r.total), 0);
  const profit = monthSales.reduce((s, r) => s + Number(r.profit), 0);

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!productName.trim()) throw new Error("Nama produk wajib");
      if (!selectedBusinessId)
        throw new Error("Pilih satu bisnis dulu sebelum mencatat penjualan.");
      const q = Number(qty),
        up = parseAmount(unitPrice),
        uh = parseAmount(unitHpp);
      if (q <= 0) throw new Error("Jumlah harus > 0");
      const total = q * up,
        prof = q * (up - uh);
      const { error } = await supabase.from("sales").insert({
        user_id: u.user!.id,
        business_id: selectedBusinessId,
        product_id: productId === "manual" ? null : productId,
        product_name: productName,
        quantity: q,
        unit_price: up,
        unit_hpp: uh,
        total,
        profit: prof,
        channel: channel || null,
        sold_at: soldAt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Penjualan tercatat");
      setProductId("manual");
      setProductName("");
      setQty("1");
      setUnitPrice("");
      setUnitHpp("");
      setChannel("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["business-sales"] });
      qc.invalidateQueries({ queryKey: queryKeys.business.overview(selectedBusinessId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sales")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-sales"] });
      toast.success("Dihapus");
    },
  });

  const onProductChange = (v: string) => {
    setProductId(v);
    if (v !== "manual") {
      const p = (products ?? []).find((x) => x.id === v);
      if (p) {
        setProductName(p.name);
        setUnitPrice(String(p.price));
        setUnitHpp(String(p.hpp));
      }
    }
  };

  return (
    <div className="space-y-3">
      {isAllBusinesses && (
        <Card className="p-3 text-xs text-muted-foreground">
          Menampilkan agregat semua bisnis. Pilih satu bisnis di atas untuk mencatat penjualan baru.
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Omzet bulan ini"
          value={formatIDR(revenue)}
          icon={TrendingUp}
          tone="default"
        />
        <StatCard
          label="Profit bulan ini"
          value={formatIDR(profit)}
          tone={profit >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="flex justify-end">
        <Sheet
          open={open}
          onOpenChange={(v) => {
            if (v && !selectedBusinessId) {
              toast.error("Pilih satu bisnis dulu.");
              return;
            }
            setOpen(v);
          }}
        >
          <SheetTrigger asChild>
            <Button size="sm" disabled={!selectedBusinessId || businesses.length === 0}>
              <Plus className="mr-1 h-4 w-4" /> Penjualan
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Catat Penjualan</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Produk</Label>
                <Select value={productId} onValueChange={onProductChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">— Manual —</SelectItem>
                    {(products ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nama Produk</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Jumlah</Label>
                  <Input
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Harga</Label>
                  <Input
                    inputMode="numeric"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>HPP</Label>
                  <Input
                    inputMode="numeric"
                    value={unitHpp}
                    onChange={(e) => setUnitHpp(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Channel</Label>
                  <Input
                    placeholder="Shopee, WA…"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Tanggal</Label>
                  <Input
                    type="date"
                    value={soldAt}
                    onChange={(e) => setSoldAt(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs">
                Total:{" "}
                <span className="font-semibold">
                  {formatIDR(Number(qty || 0) * parseAmount(unitPrice))}
                </span>
                {" · "}Profit:{" "}
                <span className="font-semibold text-success">
                  {formatIDR(Number(qty || 0) * (parseAmount(unitPrice) - parseAmount(unitHpp)))}
                </span>
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
        <EmptyState title="Belum ada penjualan" description="Catat penjualan pertama kamu." />
      ) : (
        <Card className="divide-y">
          {data!.map((s: any) => (
            <div key={s.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {s.product_name}{" "}
                  <span className="text-xs text-muted-foreground">× {s.quantity}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateID(s.sold_at)}
                  {s.channel && ` · ${s.channel}`}
                  {isAllBusinesses && s.businesses?.name ? ` · ${s.businesses.name}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">{formatIDR(s.total)}</div>
                <div
                  className={`text-xs tabular-nums ${Number(s.profit) >= 0 ? "text-success" : "text-destructive"}`}
                >
                  +{formatIDR(s.profit)}
                </div>
              </div>
              <button
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Hapus penjualan?",
                      description: `Penjualan "${s.product_name}" akan diarsipkan dari laporan aktif.`,
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
          ))}
        </Card>
      )}
    </div>
  );
}
