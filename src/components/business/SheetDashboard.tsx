import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  ExternalLink,
  FileSpreadsheet,
  PackageCheck,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState, LoadingBlock, StatCard, StatusBadge } from "@/components/ui-lite";
import { formatIDR } from "@/lib/format";
import { toast } from "sonner";

const db = supabase as any;
function sheetId(value: string) {
  return value.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? value.trim();
}

export function BusinessSheetDashboard() {
  const { selectedBusinessId, selectedBusiness } = useBusiness();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const query = useQuery({
    queryKey: ["business-sheet-dashboard", selectedBusinessId],
    enabled: !!selectedBusinessId,
    queryFn: async () => {
      const [{ data: connection }, { data: snapshot }] = await Promise.all([
        db
          .from("business_sheet_connections")
          .select("id,spreadsheet_id,status,last_sync_at,last_error")
          .eq("business_id", selectedBusinessId)
          .maybeSingle(),
        db
          .from("business_sheet_snapshots")
          .select("summary,sales,expenses,products,stock,captured_at")
          .eq("business_id", selectedBusinessId)
          .order("captured_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { connection, snapshot };
    },
    retry: false,
  });
  const connect = useMutation({
    mutationFn: async () => {
      const id = sheetId(url);
      if (!id || !selectedBusinessId) throw new Error("URL atau ID spreadsheet tidak valid");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sesi berakhir");
      const { error } = await db.from("business_sheet_connections").upsert(
        {
          user_id: auth.user.id,
          business_id: selectedBusinessId,
          spreadsheet_id: id,
          status: "active",
          last_error: null,
        },
        { onConflict: "user_id,business_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Spreadsheet terhubung. Sinkronisasi berikutnya maksimal 15 menit.");
      setOpen(false);
      setUrl("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!selectedBusinessId)
    return (
      <EmptyState
        title="Pilih satu bisnis"
        description="Dashboard menampilkan performa setiap toko secara terpisah."
        icon={BarChart3}
      />
    );
  if (query.isLoading) return <LoadingBlock />;
  const connection = query.data?.connection;
  const snap = query.data?.snapshot;
  const summary = snap?.summary ?? {};
  const sales = Array.isArray(snap?.sales) ? snap.sales : [];
  const revenue = Number(
    summary.revenue ??
      sales.reduce((s: number, r: any) => s + Number(r.total ?? r.revenue ?? 0), 0),
  );
  const expenses = Number(summary.expenses ?? 0);
  const profit = Number(summary.profit ?? revenue - expenses);
  const chart = sales.slice(-30).map((r: any) => ({
    date: r.date ?? r.sold_at ?? "",
    omzet: Number(r.total ?? r.revenue ?? 0),
  }));
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/15 via-card to-fuchsia-500/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" /> {selectedBusiness?.name}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Template: Summary, Sales, Expenses, Products, Stock
            </div>
          </div>
          <div className="flex gap-2">
            {connection && (
              <StatusBadge tone={connection.status === "active" ? "success" : "danger"}>
                {connection.status}
              </StatusBadge>
            )}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm" variant="secondary">
                  {connection ? "Ganti Sheet" : "Hubungkan Sheet"}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl">
                <SheetHeader>
                  <SheetTitle>Google Sheets view-only</SheetTitle>
                </SheetHeader>
                <form
                  className="mx-auto mt-4 max-w-xl space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    connect.mutate();
                  }}
                >
                  <div>
                    <Label>URL atau spreadsheet ID</Label>
                    <Input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Spreadsheet harus bisa dibaca oleh akun Google OAuth yang terhubung.
                  </p>
                  <Button className="w-full" disabled={connect.isPending}>
                    Simpan koneksi
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        {connection?.last_sync_at && (
          <div className="mt-3 text-xs text-muted-foreground">
            Terakhir sinkron:{" "}
            {new Date(connection.last_sync_at).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}
          </div>
        )}
        {connection?.last_error && (
          <div className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
            {connection.last_error}
          </div>
        )}
      </Card>
      {!connection ? (
        <EmptyState
          title="Spreadsheet belum terhubung"
          description="Hubungkan template Faza OS untuk membangun dashboard otomatis."
          icon={FileSpreadsheet}
        />
      ) : !snap ? (
        <Card className="p-6 text-center">
          <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
          <div className="font-medium">Menunggu sinkronisasi pertama</div>
          <div className="text-xs text-muted-foreground">
            Snapshot lama tidak akan dihapus jika sync berikutnya gagal.
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatCard label="Omzet" value={formatIDR(revenue)} icon={TrendingUp} tone="success" />
            <StatCard label="Pengeluaran" value={formatIDR(expenses)} />
            <StatCard
              label="Profit"
              value={formatIDR(profit)}
              tone={profit >= 0 ? "success" : "danger"}
            />
            <StatCard
              label="Produk"
              value={String(Array.isArray(snap.products) ? snap.products.length : 0)}
              icon={PackageCheck}
            />
          </div>
          <Card className="p-4">
            <div className="mb-3 font-semibold">Perkembangan omzet</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="bizGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#a78bfa" stopOpacity=".7" />
                      <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip formatter={(v) => formatIDR(Number(v))} />
                  <Area
                    type="monotone"
                    dataKey="omzet"
                    stroke="#a78bfa"
                    fill="url(#bizGlow)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="border-fuchsia-400/20 bg-fuchsia-400/5 p-4">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-fuchsia-300" /> Insight otomatis
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {profit < 0
                ? "Pengeluaran melampaui omzet. Periksa tab Expenses dan biaya terbesar."
                : revenue === 0
                  ? "Belum ada omzet pada snapshot ini."
                  : `Margin bersih sekitar ${Math.round((profit / revenue) * 100)}%. ${profit / revenue >= 0.2 ? "Bisnis sedang sehat, pertahankan produk terlaris." : "Coba evaluasi HPP dan pengeluaran berulang."}`}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
