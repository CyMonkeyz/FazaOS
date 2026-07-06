import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, LoadingBlock, WarningCard, SectionTitle } from "@/components/ui-lite";
import { formatIDR } from "@/lib/format";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  HandCoins,
  Coins,
  ReceiptText,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

export function MoneyOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["money-overview"],
    queryFn: async () => {
      const today = new Date();
      const startMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const start90 = new Date(today.getTime() - 89 * 86400000).toISOString().slice(0, 10);
      const [txn, txn90, debts, recv, bills, assets] = await Promise.all([
        supabase
          .from("transactions")
          .select("type,amount,note,category_id")
          .is("deleted_at", null)
          .gte("date", startMonth),
        supabase
          .from("transactions")
          .select("type,amount,date")
          .is("deleted_at", null)
          .gte("date", start90),
        supabase
          .from("debts")
          .select("remaining_balance,due_date,status")
          .is("deleted_at", null)
          .neq("status", "paid"),
        supabase
          .from("receivables")
          .select("remaining_amount")
          .is("deleted_at", null)
          .neq("status", "paid"),
        supabase
          .from("bills")
          .select("amount,due_date")
          .is("deleted_at", null)
          .eq("status", "upcoming"),
        supabase.from("money_accounts").select("initial_balance").is("deleted_at", null),
      ]);

      const income = (txn.data ?? [])
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0);
      const expense = (txn.data ?? [])
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0);
      const debtTotal = (debts.data ?? []).reduce((s, x) => s + Number(x.remaining_balance), 0);
      const recvTotal = (recv.data ?? []).reduce((s, x) => s + Number(x.remaining_amount), 0);
      const billTotal = (bills.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const initialCash = (assets.data ?? []).reduce(
        (s, a) => s + Number(a.initial_balance ?? 0),
        0,
      );
      const net90 = (txn90.data ?? []).reduce(
        (s, t) => s + Number(t.amount) * (t.type === "income" ? 1 : t.type === "expense" ? -1 : 0),
        0,
      );
      const cashTotal = initialCash + net90;

      // Debt Safety Score
      const monthIncomeSafe = Math.max(1, income);
      const dti = debtTotal / monthIncomeSafe; // debt to monthly income
      const todayIso = today.toISOString().slice(0, 10);
      const overdueDebts = (debts.data ?? []).filter(
        (d) => d.due_date && d.due_date < todayIso,
      ).length;
      const rawScore = 100 - dti * 35 - overdueDebts * 15;
      const debtScore = Math.max(0, Math.min(100, Math.round(rawScore)));
      const debtLabel =
        debtScore >= 80
          ? "Aman"
          : debtScore >= 60
            ? "Waspada"
            : debtScore >= 40
              ? "Berisiko"
              : "Kritis";
      const debtTone: "success" | "warning" | "danger" =
        debtScore >= 80 ? "success" : debtScore >= 50 ? "warning" : "danger";

      // 90-day daily net
      const daily: Record<string, number> = {};
      for (const t of txn90.data ?? []) {
        const amt = Number(t.amount) * (t.type === "income" ? 1 : t.type === "expense" ? -1 : 0);
        daily[t.date] = (daily[t.date] ?? 0) + amt;
      }
      const netVals = Object.values(daily);
      const avgDailyNet = netVals.length ? netVals.reduce((a, b) => a + b, 0) / netVals.length : 0;

      // 30-day forward projection series (starting from today's cash)
      const projection: { day: number; label: string; saldo: number }[] = [];
      let running = cashTotal;
      for (let i = 0; i <= 30; i++) {
        const d = new Date(today.getTime() + i * 86400000);
        projection.push({
          day: i,
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          saldo: Math.round(running),
        });
        running += avgDailyNet;
      }
      const projEnd = projection[projection.length - 1].saldo;

      const biggest = [...(txn.data ?? [])]
        .filter((t) => t.type === "expense")
        .sort((a, b) => Number(b.amount) - Number(a.amount))[0];

      return {
        income,
        expense,
        remaining: income - expense,
        debtTotal,
        recvTotal,
        billTotal,
        cashTotal,
        biggest,
        debtScore,
        debtLabel,
        debtTone,
        overdueDebts,
        avgDailyNet,
        projection,
        projEnd,
      };
    },
  });

  if (isLoading) return <LoadingBlock />;
  const d = data!;
  const pct = d.income > 0 ? Math.round((d.expense / d.income) * 100) : 0;

  return (
    <div className="space-y-4">
      <SectionTitle>Bulan ini</SectionTitle>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard
          label="Pemasukan"
          value={formatIDR(d.income)}
          icon={ArrowUpCircle}
          tone="success"
        />
        <StatCard
          label="Pengeluaran"
          value={formatIDR(d.expense)}
          icon={ArrowDownCircle}
          tone="danger"
        />
        <StatCard
          label="Sisa"
          value={formatIDR(d.remaining)}
          icon={Wallet}
          tone={d.remaining < 0 ? "danger" : "default"}
        />
        <StatCard label="Tagihan" value={formatIDR(d.billTotal)} icon={ReceiptText} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Hutang aktif"
          value={formatIDR(d.debtTotal)}
          icon={HandCoins}
          tone={d.debtTotal > 0 ? "warning" : "default"}
        />
        <StatCard label="Piutang aktif" value={formatIDR(d.recvTotal)} icon={Coins} />
      </div>

      {/* Debt Safety Score */}
      <div>
        <SectionTitle>Debt Safety Score</SectionTitle>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-medium">{d.debtLabel}</span>
              {d.overdueDebts > 0 && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  {d.overdueDebts} lewat tempo
                </span>
              )}
            </div>
            <span
              className={`text-2xl font-bold tabular-nums ${d.debtTone === "danger" ? "text-destructive" : d.debtTone === "warning" ? "text-warning" : "text-success"}`}
            >
              {d.debtScore}
              <span className="text-xs text-muted-foreground">/100</span>
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${d.debtTone === "danger" ? "bg-destructive" : d.debtTone === "warning" ? "bg-warning" : "bg-success"}`}
              style={{ width: `${d.debtScore}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Rasio hutang / pemasukan bulanan:{" "}
            <span className="font-medium">
              {d.income > 0 ? Math.round((d.debtTotal / d.income) * 100) : 0}%
            </span>
            {d.debtScore < 60 && " — pertimbangkan mempercepat pelunasan atau menahan hutang baru."}
          </p>
        </Card>
      </div>

      {/* Cashflow Projection */}
      <div>
        <SectionTitle>Proyeksi Kas 30 Hari</SectionTitle>
        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between px-1 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>
                Rata-rata harian:{" "}
                <span
                  className={`font-medium ${d.avgDailyNet < 0 ? "text-destructive" : "text-success"}`}
                >
                  {formatIDR(Math.round(d.avgDailyNet))}
                </span>
              </span>
            </div>
            <div className="text-muted-foreground">
              Proyeksi 30h:{" "}
              <span
                className={`font-semibold ${d.projEnd < 0 ? "text-destructive" : "text-foreground"}`}
              >
                {formatIDR(d.projEnd)}
              </span>
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.projection} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
                <defs>
                  <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(0)}jt`
                      : v >= 1000
                        ? `${(v / 1000).toFixed(0)}rb`
                        : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => [formatIDR(Number(v)), "Saldo"]}
                />
                <ReferenceLine y={0} stroke="hsl(0 70% 55%)" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke="hsl(var(--primary))"
                  fill="url(#projFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {d.projEnd < 0 && (
            <p className="mt-2 px-1 text-xs text-destructive">
              ⚠️ Dengan tren saat ini, saldo akan minus dalam 30 hari, Tuan.
            </p>
          )}
        </Card>
      </div>

      {d.biggest && (
        <StatCard
          label="Pengeluaran terbesar bulan ini"
          value={formatIDR(d.biggest.amount)}
          hint={d.biggest.note || "Tanpa catatan"}
        />
      )}

      {pct >= 80 && d.income > 0 && (
        <WarningCard
          title={`Pengeluaran sudah ${pct}% dari pemasukan bulan ini`}
          tone={pct >= 100 ? "danger" : "warning"}
        >
          Sisa bulan ini perlu diperlambat pengeluarannya.
        </WarningCard>
      )}
    </div>
  );
}
