import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Bell, Check, Droplets, Leaf, Pencil, Plus, Sparkles, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorBlock, LoadingBlock, StatusBadge } from "@/components/ui-lite";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Habit = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  weekdays: number[];
  reminder_enabled: boolean;
  reminder_time: string | null;
  sort_order: number;
  is_active: boolean;
};

type HabitLog = { id: string; habit_id: string; log_date: string; completed_at: string };
type GardenSeason = {
  id: string;
  season_month: string;
  score: number;
  stage: string;
  vitality: number;
  status: string;
  final_snapshot: unknown;
};
type GardenEvent = {
  id: string;
  event_date: string;
  source_type: string;
  points: number;
  metadata: unknown;
};

const DAYS = [
  { id: 1, label: "Sen" },
  { id: 2, label: "Sel" },
  { id: 3, label: "Rab" },
  { id: 4, label: "Kam" },
  { id: 5, label: "Jum" },
  { id: 6, label: "Sab" },
  { id: 0, label: "Min" },
];

const STAGES = [
  { key: "seed", min: 0, label: "Benih" },
  { key: "sprout", min: 12, label: "Tunas" },
  { key: "sapling", min: 30, label: "Tanaman muda" },
  { key: "leafy", min: 55, label: "Rimbun" },
  { key: "bud", min: 85, label: "Berkuncup" },
  { key: "bloom", min: 110, label: "Mekar" },
] as const;

function wibDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function monthStart() {
  return `${wibDate().slice(0, 7)}-01`;
}

function stageInfo(score: number) {
  const current = [...STAGES].reverse().find((stage) => score >= stage.min) ?? STAGES[0];
  const index = STAGES.findIndex((stage) => stage.key === current.key);
  const next = STAGES[index + 1] ?? null;
  const progress = next
    ? Math.round(((score - current.min) / (next.min - current.min)) * 100)
    : 100;
  return { current, next, progress: Math.max(0, Math.min(100, progress)), index };
}

export function GrowthPlant({
  score,
  vitality,
  compact = false,
}: {
  score: number;
  vitality: number;
  compact?: boolean;
}) {
  const { current, index } = stageInfo(score);
  const wilt = vitality < 35;
  const muted = vitality < 55;
  const has = (stage: number) => index >= stage;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-b from-sky-950/70 via-emerald-950/40 to-amber-950/40",
        compact && "h-full min-h-20",
      )}
    >
      <svg
        viewBox="0 0 360 260"
        role="img"
        aria-label={`Tanaman tahap ${current.label}, vitalitas ${vitality}%`}
        className={cn(
          compact ? "h-full min-h-20 w-full" : "h-64 w-full",
          wilt && "garden-wilt",
          muted && "garden-muted",
        )}
      >
        <defs>
          <linearGradient id="pot" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#d97745" />
            <stop offset="1" stopColor="#9a4428" />
          </linearGradient>
          <linearGradient id="leaf" x1="0" x2="1">
            <stop offset="0" stopColor="#6ee7a0" />
            <stop offset=".5" stopColor="#2fbf71" />
            <stop offset="1" stopColor="#11643b" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity=".18" />
          </filter>
        </defs>

        <circle cx="302" cy="48" r="25" fill="#fbbf24" className="garden-sun" opacity=".9" />
        <g fill="#fff" opacity=".65" className="garden-cloud">
          <ellipse cx="64" cy="48" rx="35" ry="13" />
          <circle cx="48" cy="39" r="14" />
          <circle cx="72" cy="36" r="18" />
        </g>
        <path d="M0 217 Q80 198 160 215 T360 210 V260 H0Z" fill="#8ccf83" opacity=".8" />
        <ellipse cx="180" cy="226" rx="88" ry="14" fill="#385d37" opacity=".18" />

        <g filter="url(#shadow)">
          <path d="M132 190 H228 L214 245 H146Z" fill="url(#pot)" />
          <path d="M125 183 Q180 170 235 183 V199 Q180 212 125 199Z" fill="#b85c38" />
          <ellipse cx="180" cy="188" rx="48" ry="11" fill="#543925" />
        </g>

        {!has(1) && (
          <g className="garden-seed">
            <ellipse
              cx="180"
              cy="187"
              rx="9"
              ry="5"
              fill="#d8b36c"
              transform="rotate(-18 180 187)"
            />
            <path d="M180 184 Q187 178 193 181" fill="none" stroke="#8b6a37" strokeWidth="2" />
          </g>
        )}

        {has(1) && (
          <g className="garden-grow" style={{ transformOrigin: "180px 190px" }}>
            <path
              d={
                has(4)
                  ? "M180 188 C176 150 186 112 180 63"
                  : has(3)
                    ? "M180 188 C176 154 186 119 180 88"
                    : has(2)
                      ? "M180 188 C178 162 183 140 180 116"
                      : "M180 188 Q179 171 181 158"
              }
              fill="none"
              stroke="#2f8a4c"
              strokeWidth={has(3) ? 7 : 5}
              strokeLinecap="round"
            />

            <g fill="url(#leaf)" className="garden-leaves">
              <ellipse cx="165" cy="158" rx="23" ry="11" transform="rotate(28 165 158)" />
              <ellipse cx="194" cy="143" rx="24" ry="11" transform="rotate(-30 194 143)" />
              {has(2) && (
                <ellipse cx="158" cy="126" rx="27" ry="12" transform="rotate(30 158 126)" />
              )}
              {has(2) && (
                <ellipse cx="202" cy="110" rx="28" ry="12" transform="rotate(-32 202 110)" />
              )}
              {has(3) && <ellipse cx="153" cy="92" rx="29" ry="13" transform="rotate(24 153 92)" />}
              {has(3) && (
                <ellipse cx="206" cy="78" rx="29" ry="13" transform="rotate(-26 206 78)" />
              )}
            </g>

            {has(4) && !has(5) && (
              <g className="garden-bud">
                <path d="M180 68 Q163 53 180 38 Q197 53 180 68Z" fill="#f472b6" />
                <path d="M180 69 Q164 56 160 68 Q169 77 180 69Z" fill="#2f8a4c" />
              </g>
            )}
            {has(5) && (
              <g className="garden-bloom" transform="translate(180 52)">
                {[0, 60, 120, 180, 240, 300].map((angle) => (
                  <ellipse
                    key={angle}
                    rx="12"
                    ry="25"
                    fill="#f472b6"
                    transform={`rotate(${angle}) translate(0 -16)`}
                  />
                ))}
                <circle r="13" fill="#fbbf24" />
              </g>
            )}
          </g>
        )}

        {vitality >= 70 && (
          <g className="garden-sparkles" fill="#fff7ae">
            <circle cx="116" cy="99" r="3" />
            <circle cx="238" cy="129" r="2.5" />
            <circle cx="245" cy="72" r="2" />
          </g>
        )}
        {vitality < 35 && (
          <g className="garden-drops" fill="#60a5fa">
            <path d="M239 151 Q233 160 239 166 Q245 160 239 151Z" />
            <path d="M112 130 Q106 139 112 145 Q118 139 112 130Z" />
          </g>
        )}
      </svg>
    </div>
  );
}

async function fetchGardenData() {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sesi berakhir. Silakan masuk kembali.");
  const today = wibDate();
  const start = monthStart();
  await supabase.rpc("ensure_garden_season", { p_user_id: userId, p_date: today });
  const [habits, logs, seasons, events] = await Promise.all([
    supabase
      .from("habits")
      .select(
        "id,name,description,icon,color,weekdays,reminder_enabled,reminder_time,sort_order,is_active",
      )
      .is("deleted_at", null)
      .order("sort_order")
      .order("created_at"),
    supabase.from("habit_logs").select("id,habit_id,log_date,completed_at").gte("log_date", start),
    supabase
      .from("garden_seasons")
      .select("id,season_month,score,stage,vitality,status,final_snapshot")
      .order("season_month", { ascending: false })
      .limit(12),
    supabase
      .from("garden_events")
      .select("id,event_date,source_type,points,metadata")
      .gte("event_date", start)
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(80),
  ]);
  const error = habits.error ?? logs.error ?? seasons.error ?? events.error;
  if (error) throw error;
  return {
    userId,
    today,
    habits: (habits.data ?? []) as Habit[],
    logs: (logs.data ?? []) as HabitLog[],
    seasons: (seasons.data ?? []) as GardenSeason[],
    events: (events.data ?? []) as GardenEvent[],
  };
}

export function HabitsGardenTab() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["habits-garden"], queryFn: fetchGardenData });
  const [editing, setEditing] = useState<Habit | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("07:00");

  const resetForm = () => {
    setEditing(null);
    setFormOpen(false);
    setName("");
    setDescription("");
    setWeekdays([0, 1, 2, 3, 4, 5, 6]);
    setReminderEnabled(false);
    setReminderTime("07:00");
  };
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["habits-garden"] }),
      qc.invalidateQueries({ queryKey: ["home-garden"] }),
      qc.invalidateQueries({ queryKey: ["review-dashboard"] }),
    ]);
  };

  const save = useMutation({
    mutationFn: async () => {
      const data = query.data;
      if (!data) throw new Error("Data belum siap.");
      if (!name.trim()) throw new Error("Nama habit wajib diisi.");
      if (!weekdays.length) throw new Error("Pilih minimal satu hari.");
      const values = {
        user_id: data.userId,
        name: name.trim(),
        description: description.trim() || null,
        weekdays,
        reminder_enabled: reminderEnabled,
        reminder_time: reminderEnabled ? reminderTime : null,
      };
      const result = editing
        ? await supabase.from("habits").update(values).eq("id", editing.id)
        : await supabase.from("habits").insert(values);
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      toast.success(editing ? "Habit diperbarui" : "Habit ditanam 🌱");
      resetForm();
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (habit: Habit) => {
      const data = query.data!;
      const current = data.logs.find(
        (log) => log.habit_id === habit.id && log.log_date === data.today,
      );
      const result = current
        ? await supabase.from("habit_logs").delete().eq("id", current.id)
        : await supabase.from("habit_logs").insert({
            user_id: data.userId,
            habit_id: habit.id,
            log_date: data.today,
          });
      if (result.error) throw result.error;
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const archive = useMutation({
    mutationFn: async (habit: Habit) => {
      if (!window.confirm(`Arsipkan habit “${habit.name}”? Riwayatnya tetap tersimpan.`)) return;
      const { error } = await supabase
        .from("habits")
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq("id", habit.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <LoadingBlock label="Menyiapkan kebun…" />;
  if (query.error)
    return (
      <ErrorBlock
        message={`Garden belum dapat dimuat. Terapkan migration Habit & Growth Garden di Supabase lalu coba lagi. ${(query.error as Error).message}`}
      />
    );

  const data = query.data!;
  const active = data.seasons.find((season) => season.status === "active") ?? data.seasons[0];
  const score = active?.score ?? 0;
  const vitality = active?.vitality ?? 0;
  const info = stageInfo(score);
  const completedToday = new Set(
    data.logs.filter((log) => log.log_date === data.today).map((log) => log.habit_id),
  );
  const dow = new Date(`${data.today}T12:00:00+07:00`).getDay();
  const dueToday = data.habits.filter((habit) => habit.is_active && habit.weekdays.includes(dow));
  const monthDays = new Date(
    Number(data.today.slice(0, 4)),
    Number(data.today.slice(5, 7)),
    0,
  ).getDate();
  const pointsByDay = new Map<string, number>();
  for (const event of data.events) {
    pointsByDay.set(event.event_date, (pointsByDay.get(event.event_date) ?? 0) + event.points);
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-3 sm:p-4">
        <GrowthPlant score={score} vitality={vitality} />
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {info.next ? `${info.next.label} berikutnya` : "Tanaman sudah mekar penuh"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {score}
                {info.next ? ` / ${info.next.min}` : " XP"}
              </span>
            </div>
            <Progress value={info.progress} className="mt-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              Jurnal memberi air, habit memberi nutrisi, dan progres goal memberi cahaya. Hari
              kosong membuat tanaman perlahan layu.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-1 text-sky-700">
              <Droplets className="h-3 w-3" /> +2 jurnal
            </span>
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-amber-700">
              <Sun className="h-3 w-3" /> +1 goal
            </span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Hari ini</h3>
            <p className="text-xs text-muted-foreground">
              {completedToday.size}/{dueToday.length} habit terjadwal selesai
            </p>
          </div>
          <StatusBadge
            tone={
              dueToday.length > 0 && completedToday.size >= dueToday.length ? "success" : "default"
            }
          >
            {dueToday.length > 0 && completedToday.size >= dueToday.length
              ? "Lengkap"
              : "Bertumbuh"}
          </StatusBadge>
        </div>
        {dueToday.length === 0 ? (
          <EmptyState
            title="Tidak ada habit terjadwal hari ini"
            description="Tambahkan habit atau pilih hari aktifnya."
            icon={Leaf}
          />
        ) : (
          <div className="space-y-2">
            {dueToday.map((habit) => {
              const done = completedToday.has(habit.id);
              return (
                <div
                  key={habit.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                    done && "border-success/30 bg-success/5",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle.mutate(habit)}
                    disabled={toggle.isPending}
                    aria-label={done ? `Batalkan ${habit.name}` : `Selesaikan ${habit.name}`}
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      done
                        ? "border-success bg-success text-white"
                        : "border-muted-foreground/25 hover:border-primary",
                    )}
                  >
                    {done ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Leaf className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm font-medium", done && "line-through opacity-70")}>
                      {habit.name}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {habit.reminder_enabled && (
                        <span className="flex items-center gap-1">
                          <Bell className="h-3 w-3" /> {habit.reminder_time?.slice(0, 5)}
                        </span>
                      )}
                      <span>{habit.description || "Satu langkah kecil hari ini"}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(habit);
                      setFormOpen(true);
                      setName(habit.name);
                      setDescription(habit.description ?? "");
                      setWeekdays(habit.weekdays);
                      setReminderEnabled(habit.reminder_enabled);
                      setReminderTime(habit.reminder_time?.slice(0, 5) ?? "07:00");
                    }}
                    aria-label={`Edit ${habit.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => archive.mutate(habit)}
                    aria-label={`Arsipkan ${habit.name}`}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {!formOpen ? (
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Tambah habit
        </Button>
      ) : (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{editing ? "Edit habit" : "Tanam habit baru"}</h3>
          </div>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="habit-name">Nama habit</Label>
                <Input
                  id="habit-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Contoh: Baca 20 menit"
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="habit-desc">Catatan singkat</Label>
                <Input
                  id="habit-desc"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Kenapa habit ini penting?"
                />
              </div>
            </div>
            <div>
              <Label>Hari aktif</Label>
              <div className="mt-1.5 grid grid-cols-7 gap-1">
                {DAYS.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() =>
                      setWeekdays((current) =>
                        current.includes(day.id)
                          ? current.filter((value) => value !== day.id)
                          : [...current, day.id],
                      )
                    }
                    className={cn(
                      "rounded-lg border px-1 py-2 text-xs",
                      weekdays.includes(day.id) &&
                        "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <Switch
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
                aria-label="Aktifkan reminder habit"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Reminder Telegram</div>
                <div className="text-xs text-muted-foreground">
                  Dikirim hanya pada hari habit aktif.
                </div>
              </div>
              {reminderEnabled && (
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  className="w-32"
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              {editing && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    resetForm();
                    setFormOpen(false);
                  }}
                >
                  Batal
                </Button>
              )}
              <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
                {editing ? "Simpan perubahan" : "Tambah habit"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Jejak pertumbuhan bulan ini</h3>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: monthDays }, (_, index) => {
              const date = `${data.today.slice(0, 8)}${String(index + 1).padStart(2, "0")}`;
              const points = Math.max(-3, Math.min(5, pointsByDay.get(date) ?? 0));
              return (
                <div
                  key={date}
                  title={`${date}: ${points > 0 ? "+" : ""}${points} XP`}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-[10px] tabular-nums",
                    points > 0
                      ? "bg-success/20 text-success"
                      : points < 0
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </div>
              );
            })}
          </div>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {data.events.slice(0, 5).map((event) => (
              <div key={event.id} className="flex justify-between">
                <span>
                  {event.event_date} · {event.source_type.replace("_", " ")}
                </span>
                <b className={event.points >= 0 ? "text-success" : "text-destructive"}>
                  {event.points > 0 ? "+" : ""}
                  {event.points} XP
                </b>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Leaf className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Album musim</h3>
          </div>
          {data.seasons.filter((season) => season.status === "archived").length === 0 ? (
            <EmptyState
              title="Belum ada musim yang selesai"
              description="Tanaman pertamamu akan masuk album saat bulan berganti."
              icon={Leaf}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {data.seasons
                .filter((season) => season.status === "archived")
                .map((season) => (
                  <div key={season.id} className="rounded-xl border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">
                      {new Date(`${season.season_month}T00:00:00`).toLocaleDateString("id-ID", {
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                    <div className="mt-1 font-medium capitalize">
                      {stageInfo(season.score).current.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {season.score} XP · vitalitas {season.vitality}%
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function GardenMiniCard() {
  const query = useQuery({
    queryKey: ["home-garden"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Unauthorized");
      const today = wibDate();
      await supabase.rpc("ensure_garden_season", { p_user_id: auth.user.id, p_date: today });
      const { data, error } = await supabase
        .from("garden_seasons")
        .select("score,stage,vitality")
        .eq("status", "active")
        .order("season_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
    retry: false,
  });
  if (query.isLoading || query.error || !query.data) return null;
  const info = stageInfo(query.data.score);
  return (
    <Link to="/review" className="block">
      <Card className="group overflow-hidden p-3 transition-all hover:border-primary/40 hover:shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl">
            <GrowthPlant score={query.data.score} vitality={query.data.vitality} compact />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold">Growth Garden</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {query.data.score} XP bulan ini · kebun terus bertumbuh
            </div>
            <Progress value={info.progress} className="mt-2 h-1.5" />
            <div className="mt-1 text-[11px] text-muted-foreground">
              Rawat habit dan jurnal hari ini →
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
