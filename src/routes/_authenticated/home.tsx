import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  PageHeader,
  StatCard,
  WarningCard,
  EmptyState,
  SectionTitle,
  LoadingBlock,
} from "@/components/ui-lite";
import { formatIDR, deadlineLabel, daysUntil } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUpcomingCalendarEvents } from "@/lib/gcal.functions";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  HandCoins,
  Coins,
  CalendarClock,
  Target,
  Gauge,
  MapPin,
  Brain,
  Dumbbell,
  CheckCircle2,
  SkipForward,
  AlertTriangle,
  Send,
  ListTodo,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card as ChartCard } from "@/components/ui/card";
import { GardenMiniCard } from "@/components/review/HabitsGarden";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — Faza OS" }] }),
  component: HomePage,
});

function useHomeData() {
  return useQuery({
    queryKey: ["home-summary"],
    queryFn: async () => {
      const today = new Date();
      const startMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const start30 = new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10);
      const todayIso = new Date().toISOString().slice(0, 10);
      const in5 = new Date(today.getTime() + 5 * 86400000).toISOString().slice(0, 10);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      const [txn30, debts, receivables, bills, urgentTasks, tgPrefs, tgUser] = await Promise.all([
        supabase
          .from("transactions")
          .select("type,amount,date")
          .is("deleted_at", null)
          .gte("date", start30),
        supabase
          .from("debts")
          .select("id,lender_name,amount,remaining_balance,due_date,status")
          .is("deleted_at", null)
          .neq("status", "paid")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(5),
        supabase
          .from("receivables")
          .select("id,borrower_name,amount,remaining_amount,promised_payment_date,status")
          .is("deleted_at", null)
          .neq("status", "paid")
          .order("promised_payment_date", { ascending: true, nullsFirst: false })
          .limit(5),
        supabase
          .from("bills")
          .select("id,name,amount,due_date,status")
          .is("deleted_at", null)
          .eq("status", "upcoming")
          .order("due_date", { ascending: true })
          .limit(5),
        supabase
          .from("academic_tasks")
          .select("id,title,due_date,priority,status")
          .is("deleted_at", null)
          .neq("status", "done")
          .not("due_date", "is", null)
          .lte("due_date", in5)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(6),
        supabase
          .from("user_preferences")
          .select("telegram_enabled,notify_morning_brief")
          .maybeSingle(),
        userId
          ? supabase
              .from("telegram_users")
              .select("chat_id,linked_at")
              .eq("user_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      const all = txn30.data ?? [];
      const monthTxn = all.filter((t) => t.date >= startMonth);
      const income = monthTxn
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0);
      const expense = monthTxn
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0);
      const series: { date: string; label: string; in: number; out: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        const iso = d.toISOString().slice(0, 10);
        const rows = all.filter((t) => t.date === iso);
        series.push({
          date: iso,
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          in: rows.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
          out: rows.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
        });
      }
      const tasks = urgentTasks.data ?? [];
      const focusToday = tasks.slice(0, 5);
      return {
        income,
        expense,
        remaining: income - expense,
        series,
        debts: debts.data ?? [],
        receivables: receivables.data ?? [],
        bills: bills.data ?? [],
        urgentTasks: tasks,
        focusToday,
        todayIso,
        telegram: {
          ...(tgPrefs.data ?? {}),
          chat_id: tgUser.data?.chat_id ?? null,
          linked_at: tgUser.data?.linked_at ?? null,
        },
      };
    },
  });
}

function HomePage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useHomeData();
  const gcalFn = useServerFn(getUpcomingCalendarEvents);
  const { data: gcal } = useQuery({
    queryKey: ["gcal-upcoming"],
    queryFn: () => gcalFn(),
    staleTime: 5 * 60 * 1000,
  });
  const now = new Date();
  const greeting =
    now.getHours() < 11
      ? "Selamat pagi"
      : now.getHours() < 15
        ? "Selamat siang"
        : now.getHours() < 18
          ? "Selamat sore"
          : "Selamat malam";

  if (isLoading) return <LoadingBlock />;
  if (error)
    return <div className="text-sm text-destructive">Gagal memuat: {(error as Error).message}</div>;

  const d = data!;
  const budgetPct = d.income > 0 ? Math.round((d.expense / d.income) * 100) : 0;
  const activityLoad = Math.min(
    100,
    d.debts.length * 8 + d.receivables.length * 6 + d.bills.length * 5,
  );
  const loadLabel =
    activityLoad <= 40
      ? "Ringan"
      : activityLoad <= 70
        ? "Normal"
        : activityLoad <= 85
          ? "Padat"
          : "Terlalu padat";
  const loadTone: "success" | "default" | "warning" | "danger" =
    activityLoad <= 40
      ? "success"
      : activityLoad <= 70
        ? "default"
        : activityLoad <= 85
          ? "warning"
          : "danger";
  const events = gcal?.events ?? [];
  const fmtTime = (e: { start?: { dateTime?: string; date?: string } }) => {
    const iso = e.start?.dateTime ?? e.start?.date;
    if (!iso) return "";
    const dt = new Date(iso);
    const dayLabel = dt.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    if (e.start?.date) return dayLabel;
    return `${dayLabel} · ${dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title={`${greeting}, Tuan.`} subtitle="Ringkasan hari ini." />
        <Link to="/assistant">
          <Button size="sm" variant="secondary" className="gap-1">
            <Brain className="h-4 w-4 text-primary" /> Tanya Sora
          </Button>
        </Link>
      </div>

      {/* Today Focus */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Today Focus</h2>
          </div>
          <Link to="/activity" className="text-xs text-primary">
            Semua tugas →
          </Link>
        </div>
        <div className="mt-3">
          {d.focusToday.length === 0 ? (
            <EmptyState
              title="Tidak ada deadline H-5"
              description="Selamat, Tuan. Fokus bisa dipakai untuk deep work atau nyicil tugas jauh."
            />
          ) : (
            <ul className="space-y-2">
              {d.focusToday.map((t, i) => (
                <li key={t.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.priority === "urgent" ? "Urgent" : t.priority}
                      {t.due_date ? ` · ${deadlineLabel(t.due_date)}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <GardenMiniCard />

      {/* Money Status */}
      <div>
        <SectionTitle
          action={
            <Link to="/money" className="text-xs text-primary">
              Detail →
            </Link>
          }
        >
          Money Status
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Masuk" value={formatIDR(d.income)} icon={ArrowUpCircle} tone="success" />
          <StatCard
            label="Keluar"
            value={formatIDR(d.expense)}
            icon={ArrowDownCircle}
            tone="danger"
          />
          <StatCard
            label="Sisa"
            value={formatIDR(d.remaining)}
            tone={d.remaining < 0 ? "danger" : "default"}
          />
        </div>
        {budgetPct >= 80 && d.income > 0 && (
          <div className="mt-2">
            <WarningCard
              title={`Pengeluaran sudah ${budgetPct}% dari pemasukan`}
              tone={budgetPct >= 100 ? "danger" : "warning"}
            >
              Perlu direm sebelum akhir bulan.
            </WarningCard>
          </div>
        )}
      </div>

      {/* Cashflow chart 30 hari */}
      <div>
        <SectionTitle>Arus Kas 30 Hari</SectionTitle>
        <ChartCard className="p-3">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.series} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
                <defs>
                  <linearGradient id="cfIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(150 55% 45%)" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="hsl(150 55% 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cfOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0 70% 55%)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(0 70% 55%)" stopOpacity={0} />
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
                  formatter={(v, k) => [formatIDR(Number(v)), k === "in" ? "Masuk" : "Keluar"]}
                  labelFormatter={(l) => `Tanggal ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="in"
                  stroke="hsl(150 55% 45%)"
                  fill="url(#cfIn)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="out"
                  stroke="hsl(0 70% 55%)"
                  fill="url(#cfOut)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Workout Hari Ini */}
      <WorkoutHomeCard />

      {/* Agenda from Google Calendar */}
      <div>
        <SectionTitle>Agenda Mendatang</SectionTitle>
        {events.length === 0 ? (
          <Card className="p-4">
            <EmptyState
              title="Tidak ada agenda"
              description="Belum ada acara dari Google Calendar dalam 30 hari ke depan."
              icon={CalendarClock}
            />
          </Card>
        ) : (
          <Card className="divide-y">
            {events.slice(0, 5).map((e) => (
              <a
                key={e.id}
                href={e.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-start justify-between gap-2 p-3 text-sm hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.summary ?? "(Tanpa judul)"}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{fmtTime(e)}</div>
                  {e.location && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {e.location}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </Card>
        )}
      </div>

      {/* Deadline Terdekat */}
      <div>
        <SectionTitle>Deadline Terdekat</SectionTitle>
        {d.bills.length === 0 ? (
          <Card className="p-4">
            <EmptyState title="Tidak ada tagihan mendekat" />
          </Card>
        ) : (
          <Card className="divide-y">
            {d.bills.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">{formatIDR(b.amount)}</div>
                </div>
                <span
                  className={`text-xs font-medium ${(daysUntil(b.due_date) ?? 99) <= 3 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {deadlineLabel(b.due_date)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Hutang & Piutang Alert */}
      <div>
        <SectionTitle
          action={
            <Link to="/money" className="text-xs text-primary">
              Kelola →
            </Link>
          }
        >
          Hutang & Piutang
        </SectionTitle>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HandCoins className="h-4 w-4" /> Hutang aktif
            </div>
            {d.debts.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">Tidak ada hutang aktif.</div>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {d.debts.slice(0, 3).map((x) => (
                  <li key={x.id} className="flex justify-between">
                    <span className="truncate">{x.lender_name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatIDR(x.remaining_balance)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Coins className="h-4 w-4" /> Piutang aktif
            </div>
            {d.receivables.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">Tidak ada piutang aktif.</div>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {d.receivables.slice(0, 3).map((x) => (
                  <li key={x.id} className="flex justify-between">
                    <span className="truncate">{x.borrower_name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatIDR(x.remaining_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Urgent Tasks */}
      <div>
        <SectionTitle
          action={
            <Link to="/activity" className="text-xs text-primary">
              Semua →
            </Link>
          }
        >
          Tugas Mendesak
        </SectionTitle>
        {d.urgentTasks.length === 0 ? (
          <Card className="p-4">
            <EmptyState
              title="Tidak ada deadline H-5"
              description="Belum ada tugas dengan deadline sangat dekat."
              icon={ListTodo}
            />
          </Card>
        ) : (
          <Card className="divide-y">
            {d.urgentTasks.slice(0, 5).map((t) => {
              const du = t.due_date ? daysUntil(t.due_date) : null;
              const overdue = du !== null && du < 0;
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {t.priority === "urgent" && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      )}
                      <span className="truncate font-medium">{t.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.priority === "urgent" ? "Urgent" : t.priority}
                      {t.due_date ? ` · ${deadlineLabel(t.due_date)}` : ""}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium ${overdue ? "text-destructive" : du !== null && du <= 3 ? "text-warning" : "text-muted-foreground"}`}
                  >
                    {du === null
                      ? "—"
                      : overdue
                        ? `+${Math.abs(du)}h lewat`
                        : du === 0
                          ? "Hari ini"
                          : `${du}h lagi`}
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {/* Telegram Status */}
      <div>
        <SectionTitle
          action={
            <Link to="/more" className="text-xs text-primary">
              Kelola →
            </Link>
          }
        >
          Status Telegram
        </SectionTitle>
        <Card className="p-4">
          {d.telegram?.chat_id ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-success" />
                <div>
                  <div className="text-sm font-medium">Terhubung</div>
                  <div className="text-xs text-muted-foreground">
                    Morning brief {d.telegram?.notify_morning_brief ? "aktif" : "nonaktif"} · Chat
                    ID {String(d.telegram.chat_id).slice(0, 6)}…
                  </div>
                </div>
              </div>
              <Send className="h-4 w-4 text-primary" />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
                <div>
                  <div className="text-sm font-medium">Belum terhubung</div>
                  <div className="text-xs text-muted-foreground">
                    Aktifkan notifikasi Telegram di menu More.
                  </div>
                </div>
              </div>
              <Link to="/more">
                <Button size="sm" variant="secondary">
                  Hubungkan
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Activity Load */}
      <div>
        <SectionTitle>Activity Load</SectionTitle>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4 text-primary" />
              <span className="font-medium">{loadLabel}</span>
            </div>
            <span
              className={`text-lg font-semibold tabular-nums ${loadTone === "danger" ? "text-destructive" : loadTone === "warning" ? "text-warning" : loadTone === "success" ? "text-success" : ""}`}
            >
              {activityLoad}
              <span className="text-xs text-muted-foreground">/100</span>
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${loadTone === "danger" ? "bg-destructive" : loadTone === "warning" ? "bg-warning" : "bg-success"}`}
              style={{ width: `${activityLoad}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {activityLoad > 70
              ? "Pertimbangkan menunda satu komitmen minggu ini."
              : "Beban aktivitas masih terkendali."}
          </p>
        </Card>
      </div>

      <div className="pt-2">
        <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/money" })}>
          Buka Money Guard
        </Button>
      </div>
    </div>
  );
}

function WorkoutHomeCard() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: plans } = useQuery({
    queryKey: ["home-workout", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_plans")
        .select("id,title,workout_type,workout_time,target_duration_minutes,status")
        .eq("workout_date", today)
        .is("deleted_at", null)
        .order("workout_time", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("workout_plans").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["home-workout"] });
      qc.invalidateQueries({ queryKey: ["workout_plans"] });
      toast.success("Diperbarui");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <SectionTitle
        action={
          <Link to="/health" className="text-xs text-primary">
            Detail →
          </Link>
        }
      >
        Workout Hari Ini
      </SectionTitle>
      {(plans ?? []).length === 0 ? (
        <Card className="p-4">
          <EmptyState
            title="Belum ada rencana workout"
            description="Atur rencana workout di tab Health → Workout."
            icon={Dumbbell}
          />
        </Card>
      ) : (
        <Card className="divide-y">
          {plans!.map((p) => (
            <div key={p.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.workout_type}
                    {p.workout_time ? ` · ${p.workout_time.slice(0, 5)}` : ""}
                    {p.target_duration_minutes ? ` · ${p.target_duration_minutes} mnt` : ""}
                  </div>
                </div>
                <span
                  className={`text-[11px] font-medium ${p.status === "completed" ? "text-success" : p.status === "skipped" ? "text-warning" : "text-muted-foreground"}`}
                >
                  {p.status}
                </span>
              </div>
              {p.status !== "completed" && p.status !== "skipped" && (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => update.mutate({ id: p.id, status: "completed" })}
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Selesai
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => update.mutate({ id: p.id, status: "skipped" })}
                  >
                    <SkipForward className="mr-1 h-3 w-3" /> Skip
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
