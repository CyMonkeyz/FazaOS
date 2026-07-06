import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingBlock, StatCard, StatusBadge } from "@/components/ui-lite";
import { formatIDR, parseAmount } from "@/lib/format";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  LineChart as LineChartIcon,
  RefreshCw,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useConfirm } from "@/components/ConfirmProvider";

type InvType =
  "saham" | "crypto" | "obligasi" | "reksadana" | "p2p" | "emas" | "deposito" | "forex" | "other";

type Investment = {
  id: string;
  type: InvType;
  ticker: string | null;
  name: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  currency: string;
  notes: string | null;
  last_updated_at: string;
  auto_update_enabled?: boolean;
  provider_symbol?: string | null;
  last_price_error?: string | null;
};

const db = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      is: (
        k: string,
        v: null,
      ) => {
        order: (c: string) => Promise<{ data: unknown[] | null; error: Error | null }>;
      };
    };
    insert: (v: Record<string, unknown>) => Promise<{ error: Error | null }>;
    update: (v: Record<string, unknown>) => {
      eq: (c: string, v: string) => Promise<{ error: Error | null }>;
    };
  };
};

const TYPE_LABEL: Record<InvType, string> = {
  saham: "Saham",
  crypto: "Crypto",
  obligasi: "Obligasi",
  reksadana: "Reksa Dana",
  p2p: "P2P Lending",
  emas: "Emas",
  deposito: "Deposito",
  forex: "Forex",
  other: "Lainnya",
};

const TYPE_COLOR: Record<InvType, string> = {
  saham: "hsl(210 80% 55%)",
  crypto: "hsl(35 90% 55%)",
  obligasi: "hsl(150 55% 45%)",
  reksadana: "hsl(280 60% 60%)",
  p2p: "hsl(15 75% 60%)",
  emas: "hsl(45 90% 55%)",
  deposito: "hsl(180 55% 45%)",
  forex: "hsl(340 65% 55%)",
  other: "hsl(220 10% 60%)",
};
export function InvestmentsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<InvType>("saham");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [avg, setAvg] = useState("");
  const [current, setCurrent] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [notes, setNotes] = useState("");
  const [sellFor, setSellFor] = useState<Investment | null>(null);
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellDate, setSellDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await db
        .from("investments")
        .select(
          "id,type,ticker,name,quantity,avg_buy_price,current_price,currency,notes,last_updated_at,auto_update_enabled,provider_symbol,last_price_error",
        )
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Investment[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nama aset wajib");
      const { data: u } = await supabase.auth.getUser();
      const q = Number(qty || "0"),
        a = parseAmount(avg),
        c = parseAmount(current);
      if (q <= 0) throw new Error("Jumlah harus > 0");
      const { error } = await db.from("investments").insert({
        user_id: u.user!.id,
        type,
        ticker: ticker || null,
        name: name.trim(),
        quantity: q,
        avg_buy_price: a,
        current_price: c || a,
        currency,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aset ditambahkan");
      setTicker("");
      setName("");
      setQty("");
      setAvg("");
      setCurrent("");
      setNotes("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["investments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("investments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Dihapus");
    },
  });

  const sell = useMutation({
    mutationFn: async () => {
      if (!sellFor) return;
      const qty = Number(sellQty || "0");
      const price = parseAmount(sellPrice);
      if (qty <= 0) throw new Error("Qty jual harus lebih dari 0");
      if (qty > Number(sellFor.quantity)) throw new Error("Qty jual melebihi kepemilikan");
      if (price <= 0) throw new Error("Harga jual wajib lebih dari 0");
      const { data: u } = await supabase.auth.getUser();
      const remaining = Number(sellFor.quantity) - qty;
      const total = qty * price;
      const { error: txError } = await (supabase as any).from("transactions").insert({
        user_id: u.user!.id,
        type: "income",
        amount: total,
        date: sellDate,
        name: `Jual ${sellFor.name}`,
        note: `${qty} ${sellFor.ticker ?? sellFor.name} @ ${price}`,
        affects_budget: false,
        tags: ["investment", "sell"],
      });
      if (txError) throw txError;
      const { error } = await db
        .from("investments")
        .update({
          quantity: remaining,
          current_price: price,
          last_updated_at: new Date().toISOString(),
          deleted_at: remaining <= 0 ? new Date().toISOString() : null,
        })
        .eq("id", sellFor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Penjualan aset tercatat");
      setSellFor(null);
      setSellQty("");
      setSellPrice("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePrice = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const { error } = await db
        .from("investments")
        .update({
          current_price: price,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Harga diperbarui");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => data ?? [], [data]);
  const enriched = rows.map((r) => {
    const cost = Number(r.quantity) * Number(r.avg_buy_price);
    const value = Number(r.quantity) * Number(r.current_price);
    return {
      ...r,
      cost,
      value,
      pnl: value - cost,
      pnl_pct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
    };
  });
  const totalCost = enriched.reduce((s, r) => s + r.cost, 0);
  const totalValue = enriched.reduce((s, r) => s + r.value, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const byType = enriched.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + r.value;
    return acc;
  }, {});
  const pieData = Object.entries(byType).map(([k, v]) => ({
    name: TYPE_LABEL[k as InvType] ?? k,
    value: v,
    key: k,
  }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Nilai portofolio"
          value={formatIDR(totalValue)}
          icon={LineChartIcon}
          tone="default"
        />
        <StatCard
          label={`P/L (${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%)`}
          value={formatIDR(totalPnl)}
          icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
          tone={totalPnl >= 0 ? "success" : "danger"}
        />
      </div>

      {pieData.length > 0 && (
        <Card className="p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Alokasi per jenis</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={TYPE_COLOR[d.key as InvType] ?? "hsl(220 10% 60%)"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatIDR(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled
          title="Harga investasi di-refresh otomatis oleh cron server setiap 09:00 WIB."
        >
          <RefreshCw className="mr-1 h-4 w-4" /> Auto 09:00 WIB
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Investasi
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Tambah Aset Investasi</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Jenis</Label>
                  <Select value={type} onValueChange={(v) => setType(v as InvType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABEL) as InvType[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {TYPE_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IDR">IDR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Ticker</Label>
                  <Input
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    placeholder="BBCA, BTC, dll."
                  />
                </div>
                <div>
                  <Label>Nama</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Bank Central Asia"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Qty</Label>
                  <Input
                    inputMode="decimal"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Avg Buy</Label>
                  <Input
                    inputMode="decimal"
                    value={avg}
                    onChange={(e) => setAvg(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Harga Now</Label>
                  <Input
                    inputMode="decimal"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Catatan</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
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
      ) : enriched.length === 0 ? (
        <EmptyState
          title="Belum ada investasi"
          description="Catat saham, crypto, obligasi, reksadana, emas, dsb. untuk lihat P/L otomatis."
          icon={LineChartIcon}
        />
      ) : (
        <div className="space-y-2">
          {enriched.map((r) => (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone="info">{TYPE_LABEL[r.type]}</StatusBadge>
                    {r.ticker && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {r.ticker}
                      </span>
                    )}
                    <span className="text-sm font-semibold">{r.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {Number(r.quantity)} @ {formatIDR(Number(r.avg_buy_price))} →{" "}
                    {formatIDR(Number(r.current_price))}
                  </div>
                  {r.last_price_error && (
                    <div className="mt-1 text-xs text-destructive">
                      Alpha Vantage: {r.last_price_error}
                    </div>
                  )}
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Modal</div>
                      <div className="tabular-nums">{formatIDR(r.cost)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Nilai</div>
                      <div className="tabular-nums font-medium">{formatIDR(r.value)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">P/L</div>
                      <div
                        className={`tabular-nums font-medium ${r.pnl >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {r.pnl >= 0 ? "+" : ""}
                        {r.pnl_pct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setSellFor(r);
                      setSellQty("");
                      setSellPrice(String(r.current_price));
                      setSellDate(new Date().toISOString().slice(0, 10));
                    }}
                    className="text-muted-foreground hover:text-primary p-1 text-xs"
                    title="Jual aset"
                  >
                    Jual
                  </button>
                  <button
                    onClick={() => {
                      const p = prompt(
                        `Update harga sekarang untuk ${r.name}:`,
                        String(r.current_price),
                      );
                      if (p != null) {
                        const v = parseAmount(p);
                        if (v > 0) updatePrice.mutate({ id: r.id, price: v });
                      }
                    }}
                    className="text-muted-foreground hover:text-primary p-1"
                    title="Update harga"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Hapus investasi?",
                          description: `"${r.name}" akan diarsipkan dari portofolio aktif.`,
                          confirmText: "Hapus",
                        })
                      )
                        remove.mutate(r.id);
                    }}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!sellFor} onOpenChange={(open) => !open && setSellFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Jual {sellFor?.name}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              sell.mutate();
            }}
          >
            <div className="text-xs text-muted-foreground">
              Kepemilikan: {sellFor ? Number(sellFor.quantity) : 0}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Qty jual</Label>
                <Input
                  inputMode="decimal"
                  value={sellQty}
                  onChange={(e) => setSellQty(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Harga jual</Label>
                <Input
                  inputMode="decimal"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={sell.isPending}>
              Catat penjualan
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
