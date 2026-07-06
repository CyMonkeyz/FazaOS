import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  LoadingBlock,
  SectionTitle,
  StatCard,
  StatusBadge,
} from "@/components/ui-lite";
import { toast } from "sonner";
import { formatDateID } from "@/lib/format";
import { Dumbbell, CheckCircle2, SkipForward, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

const TYPES = [
  "strength",
  "cardio",
  "running",
  "walking",
  "mobility",
  "stretching",
  "sport",
  "martial_art",
  "home_workout",
  "gym",
  "recovery",
  "other",
] as const;
const INTENSITIES = ["light", "moderate", "hard", "max"] as const;
const STATUSES = ["planned", "in_progress", "completed", "skipped", "cancelled"] as const;

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
const monthAgo = () => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
const db = supabase as any;

export function WorkoutTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showPlan, setShowPlan] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("4");
  const [goalProgress, setGoalProgress] = useState("0");
  const [routineTitle, setRoutineTitle] = useState("");
  const [routineDays, setRoutineDays] = useState<number[]>([]);
  const [routineType, setRoutineType] = useState("strength");

  const { data: todayPlans, isLoading } = useQuery({
    queryKey: ["workout_plans", "today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("workout_date", today())
        .is("deleted_at", null)
        .order("workout_time", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: weekStats } = useQuery({
    queryKey: ["workout_logs", "week"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("workout_date,workout_type,duration_minutes")
        .gte("workout_date", weekAgo())
        .is("deleted_at", null);
      if (error) throw error;
      const rows = data ?? [];
      const total = rows.length;
      const duration = rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
      const byType: Record<string, number> = {};
      for (const r of rows) byType[r.workout_type] = (byType[r.workout_type] ?? 0) + 1;
      const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      const consistency = Math.round((total / 7) * 100);
      return { total, duration, topType, consistency };
    },
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["workout_logs", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id,workout_date,workout_type,duration_minutes,intensity,notes")
        .is("deleted_at", null)
        .order("workout_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: workoutGoals } = useQuery({
    queryKey: ["workout_goals"],
    queryFn: async () => {
      const { data, error } = await db
        .from("workout_goals")
        .select("*")
        .is("deleted_at", null)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: routines } = useQuery({
    queryKey: ["workout_routines"],
    queryFn: async () => {
      const { data, error } = await db
        .from("workout_routines")
        .select("*")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createGoal = useMutation({
    mutationFn: async () => {
      if (!goalTitle.trim()) throw new Error("Judul goal wajib diisi");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from("workout_goals").insert({
        user_id: u.user!.id,
        title: goalTitle.trim(),
        target_type: "manual",
        target_value: Number(goalTarget || "0"),
        current_value: Number(goalProgress || "0"),
        period: "custom",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setGoalTitle("");
      setGoalTarget("4");
      setGoalProgress("0");
      qc.invalidateQueries({ queryKey: ["workout_goals"] });
      toast.success("Workout goal ditambahkan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await db
        .from("workout_goals")
        .update({ current_value: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_goals"] });
      toast.success("Progress goal diperbarui");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("workout_goals")
        .update({ deleted_at: new Date().toISOString(), status: "archived" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout_goals"] }),
  });

  const createRoutine = useMutation({
    mutationFn: async () => {
      if (!routineTitle.trim()) throw new Error("Judul routine wajib diisi");
      if (!routineDays.length) throw new Error("Pilih minimal satu hari");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from("workout_routines").insert({
        user_id: u.user!.id,
        title: routineTitle.trim(),
        workout_type: routineType,
        weekdays: routineDays,
        target_intensity: "moderate",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRoutineTitle("");
      setRoutineDays([]);
      qc.invalidateQueries({ queryKey: ["workout_routines"] });
      toast.success("Routine ditambahkan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("workout_plans").update({ status }).eq("id", id);
      if (error) throw error;
      // Auto-create log on completion
      if (status === "completed") {
        const plan = (todayPlans ?? []).find((p) => p.id === id);
        if (plan) {
          const { data: u } = await supabase.auth.getUser();
          await supabase.from("workout_logs").insert({
            user_id: u.user!.id,
            workout_plan_id: id,
            workout_date: plan.workout_date,
            workout_type: plan.workout_type,
            duration_minutes: plan.target_duration_minutes,
            intensity: plan.target_intensity,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout_plans"] });
      qc.invalidateQueries({ queryKey: ["workout_logs"] });
      qc.invalidateQueries({ queryKey: ["home-workout"] });
      toast.success("Diperbarui");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Weekly summary */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Sesi minggu ini" value={weekStats?.total ?? 0} icon={Dumbbell} />
        <StatCard label="Total durasi" value={`${weekStats?.duration ?? 0} mnt`} />
        <StatCard
          label="Konsistensi"
          value={`${weekStats?.consistency ?? 0}%`}
          tone={(weekStats?.consistency ?? 0) >= 60 ? "success" : "default"}
        />
        <StatCard label="Jenis favorit" value={weekStats?.topType ?? "—"} />
      </div>

      <Tabs defaultValue="activities" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activities">Fitness Activities</TabsTrigger>
          <TabsTrigger value="goals">Fitness Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="mt-4 space-y-3">
          <Card className="space-y-3 p-4">
            <SectionTitle>Workout Goals</SectionTitle>
            {(workoutGoals ?? []).length > 0 && (
              <div className="space-y-2">
                {workoutGoals!.map((goal: any) => {
                  const pct =
                    Number(goal.target_value) > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (Number(goal.current_value ?? 0) / Number(goal.target_value)) * 100,
                          ),
                        )
                      : 0;
                  return (
                    <div key={goal.id} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{goal.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {Number(goal.current_value ?? 0)} / {Number(goal.target_value ?? 0)} (
                          {pct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => {
                            const next = prompt(
                              "Progress manual sekarang:",
                              String(goal.current_value ?? 0),
                            );
                            if (next != null)
                              updateGoal.mutate({ id: goal.id, value: Number(next) });
                          }}
                        >
                          Update progress
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={async () => {
                            if (
                              await confirm({
                                title: "Hapus fitness goal?",
                                description: `"${goal.title}" akan diarsipkan dari fitness goals.`,
                                confirmText: "Hapus",
                              })
                            )
                              deleteGoal.mutate(goal.id);
                          }}
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Hapus
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid gap-2 md:grid-cols-[1fr_90px_90px_auto]">
              <Input
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="Naik 5 kg bench press, turun 3 kg..."
              />
              <Input
                inputMode="decimal"
                value={goalProgress}
                onChange={(e) => setGoalProgress(e.target.value)}
                placeholder="Progress"
              />
              <Input
                inputMode="numeric"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                placeholder="Target"
              />
              <Button size="sm" onClick={() => createGoal.mutate()} disabled={createGoal.isPending}>
                Tambah goal
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="mt-4 space-y-4">
          <Card className="space-y-3 p-4">
            <SectionTitle>Jadwal Rutin</SectionTitle>
            {(routines ?? []).length > 0 && (
              <div className="space-y-1 text-sm">
                {routines!.map((routine: any) => (
                  <details key={routine.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{routine.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {(routine.weekdays ?? [])
                            .map(
                              (d: number) => ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d],
                            )
                            .join(", ")}
                        </span>
                      </div>
                    </summary>
                    <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                      Type: {routine.workout_type ?? "-"} · Intensitas:{" "}
                      {routine.target_intensity ?? "moderate"}
                      {routine.notes ? ` · ${routine.notes}` : ""}
                    </div>
                  </details>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Input
                value={routineTitle}
                onChange={(e) => setRoutineTitle(e.target.value)}
                placeholder="Push day, pull day, rest day..."
              />
              <div className="flex flex-wrap gap-1">
                {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setRoutineDays((days) =>
                        days.includes(idx) ? days.filter((d) => d !== idx) : [...days, idx].sort(),
                      )
                    }
                    className={`rounded-md border px-2 py-1 text-xs ${
                      routineDays.includes(idx)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Select value={routineType} onValueChange={setRoutineType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => createRoutine.mutate()}
                  disabled={createRoutine.isPending}
                >
                  Tambah routine
                </Button>
              </div>
            </div>
          </Card>

          {/* Today */}
          <div>
            <SectionTitle
              action={
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowLog((s) => !s)}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Catat
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowPlan((s) => !s)}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Rencana
                  </Button>
                </div>
              }
            >
              Workout Hari Ini
            </SectionTitle>

            {isLoading ? (
              <LoadingBlock />
            ) : (todayPlans ?? []).length === 0 ? (
              <Card className="p-4">
                <EmptyState
                  title="Belum ada rencana workout"
                  description="Tekan Rencana untuk menambah."
                  icon={Dumbbell}
                />
              </Card>
            ) : (
              <Card className="divide-y">
                {todayPlans!.map((p) => (
                  <div key={p.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{p.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{p.workout_type}</span>
                          {p.workout_time && <span>· {p.workout_time.slice(0, 5)}</span>}
                          {p.target_duration_minutes ? (
                            <span>· {p.target_duration_minutes} mnt</span>
                          ) : null}
                        </div>
                        {(p.notes || p.target_intensity) && (
                          <details className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                            <summary className="cursor-pointer font-medium text-foreground">
                              Notes / Details
                            </summary>
                            <div className="mt-1">
                              Intensitas: {p.target_intensity ?? "-"}
                              {p.notes ? ` · ${p.notes}` : ""}
                            </div>
                          </details>
                        )}
                      </div>
                      <StatusBadge
                        tone={
                          p.status === "completed"
                            ? "success"
                            : p.status === "skipped"
                              ? "warning"
                              : "default"
                        }
                      >
                        {p.status}
                      </StatusBadge>
                    </div>
                    {p.status !== "completed" && p.status !== "skipped" && (
                      <div className="mt-2 flex gap-2">
                        {p.status === "planned" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            onClick={() => setStatus.mutate({ id: p.id, status: "in_progress" })}
                          >
                            Mulai
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setStatus.mutate({ id: p.id, status: "completed" })}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Selesai
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setStatus.mutate({ id: p.id, status: "skipped" })}
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

          {showPlan && (
            <PlanForm
              onDone={() => {
                setShowPlan(false);
                qc.invalidateQueries({ queryKey: ["workout_plans"] });
                qc.invalidateQueries({ queryKey: ["home-workout"] });
              }}
            />
          )}
          {showLog && (
            <LogForm
              onDone={() => {
                setShowLog(false);
                qc.invalidateQueries({ queryKey: ["workout_logs"] });
              }}
            />
          )}

          {/* Recent logs */}
          <div>
            <SectionTitle>Riwayat</SectionTitle>
            {(recentLogs ?? []).length === 0 ? (
              <Card className="p-4">
                <EmptyState title="Belum ada riwayat workout" />
              </Card>
            ) : (
              <Card className="divide-y">
                {recentLogs!.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <div className="font-medium">
                        {l.workout_type} · {l.duration_minutes ?? 0} mnt
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateID(l.workout_date)}
                        {l.intensity ? ` · ${l.intensity}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlanForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [type, setType] = useState<string>("strength");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState<string>("moderate");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return toast.error("Judul wajib diisi");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const dur = duration ? Math.max(0, parseInt(duration)) : null;
    const { error } = await supabase.from("workout_plans").insert({
      user_id: u.user!.id,
      title: title.trim(),
      workout_date: date,
      workout_time: time || null,
      workout_type: type,
      target_duration_minutes: dur,
      target_intensity: intensity,
      notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Rencana tersimpan");
    onDone();
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Rencana Workout
      </div>
      <div>
        <Label>Judul</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Push day, lari pagi…"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Tanggal</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Jam</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Jenis</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Intensitas</Label>
          <Select value={intensity} onValueChange={setIntensity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTENSITIES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Target durasi (menit)</Label>
        <Input
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div>
        <Label>Catatan</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button onClick={submit} disabled={saving} className="w-full">
        Simpan
      </Button>
    </Card>
  );
}

function LogForm({ onDone }: { onDone: () => void }) {
  const [date, setDate] = useState(today());
  const [type, setType] = useState<string>("strength");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState<string>("moderate");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("workout_logs").insert({
      user_id: u.user!.id,
      workout_date: date,
      workout_type: type,
      duration_minutes: duration ? Math.max(0, parseInt(duration)) : null,
      intensity,
      notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Log tersimpan");
    onDone();
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Catat Workout Manual
      </div>
      <div>
        <Label>Tanggal</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Jenis</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Intensitas</Label>
          <Select value={intensity} onValueChange={setIntensity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTENSITIES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Durasi (menit)</Label>
        <Input
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div>
        <Label>Catatan</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button onClick={submit} disabled={saving} className="w-full">
        Simpan
      </Button>
    </Card>
  );
}

// Re-export unused helper to avoid TS warning for imports
export { monthAgo };
