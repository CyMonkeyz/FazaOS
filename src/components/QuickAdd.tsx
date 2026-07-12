import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseAmount } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  HandCoins,
  Coins,
  StickyNote,
  Dumbbell,
  Weight,
  Moon,
  Droplet,
  ListTodo,
  CalendarPlus,
  CheckCircle2,
  Leaf,
} from "lucide-react";

type Kind =
  | "expense"
  | "income"
  | "debt"
  | "receivable"
  | "note"
  | "task"
  | "event"
  | "workout_done"
  | "workout_plan"
  | "body_weight"
  | "body_sleep"
  | "body_water"
  | "habit";

type Option = { kind: Kind; label: string; icon: typeof ArrowDownCircle; tone: string };

const OPTIONS: Option[] = [
  { kind: "expense", label: "Pengeluaran", icon: ArrowDownCircle, tone: "text-destructive" },
  { kind: "income", label: "Pemasukan", icon: ArrowUpCircle, tone: "text-success" },
  { kind: "debt", label: "Hutang", icon: HandCoins, tone: "text-warning" },
  { kind: "receivable", label: "Piutang", icon: Coins, tone: "text-accent" },
  { kind: "task", label: "Tugas", icon: ListTodo, tone: "text-primary" },
  { kind: "event", label: "Agenda", icon: CalendarPlus, tone: "text-primary" },
  { kind: "habit", label: "Habit", icon: Leaf, tone: "text-success" },
  { kind: "workout_done", label: "Workout ✓", icon: CheckCircle2, tone: "text-success" },
  { kind: "workout_plan", label: "Rencana WO", icon: Dumbbell, tone: "text-primary" },
  { kind: "body_weight", label: "Berat", icon: Weight, tone: "text-accent" },
  { kind: "body_sleep", label: "Tidur", icon: Moon, tone: "text-accent" },
  { kind: "body_water", label: "Air", icon: Droplet, tone: "text-accent" },
  { kind: "note", label: "Catatan", icon: StickyNote, tone: "text-muted-foreground" },
];

const INVALIDATE: Record<Kind, string[]> = {
  expense: ["transactions", "home-summary", "money-summary"],
  income: ["transactions", "home-summary", "money-summary"],
  debt: ["debts", "home-summary"],
  receivable: ["receivables", "home-summary"],
  note: ["notes"],
  task: ["academic_tasks"],
  event: ["activity_events"],
  workout_done: ["workout_logs", "home-workout"],
  workout_plan: ["workout_plans", "home-workout"],
  body_weight: ["body_metrics"],
  body_sleep: ["body_metrics"],
  body_water: ["body_metrics"],
  habit: ["habits-garden", "home-garden"],
};

export function QuickAddModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [num1, setNum1] = useState(""); // sleep hours, water liters, workout minutes
  const [num2, setNum2] = useState(""); // sleep quality
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const reset = () => {
    setAmount("");
    setNote("");
    setName("");
    setNum1("");
    setNum2("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error("Sesi habis. Silakan masuk lagi.");
      setLoading(false);
      return;
    }

    let error: { message: string } | null = null;
    try {
      if (kind === "expense" || kind === "income") {
        const amt = parseAmount(amount);
        if (amt <= 0) throw new Error("Nominal harus lebih dari 0");
        ({ error } = await supabase
          .from("transactions")
          .insert({ user_id: uid, type: kind, amount: amt, note, date }));
      } else if (kind === "debt") {
        const amt = parseAmount(amount);
        if (!name || amt <= 0) throw new Error("Nama pemberi & nominal wajib");
        ({ error } = await supabase.from("debts").insert({
          user_id: uid,
          lender_name: name,
          amount: amt,
          remaining_balance: amt,
          notes: note,
        }));
      } else if (kind === "receivable") {
        const amt = parseAmount(amount);
        if (!name || amt <= 0) throw new Error("Nama peminjam & nominal wajib");
        ({ error } = await supabase.from("receivables").insert({
          user_id: uid,
          borrower_name: name,
          amount: amt,
          remaining_amount: amt,
          notes: note,
        }));
      } else if (kind === "note") {
        ({ error } = await supabase
          .from("notes")
          .insert({ user_id: uid, title: name || null, body: note }));
      } else if (kind === "task") {
        if (!name) throw new Error("Judul tugas wajib");
        ({ error } = await supabase.from("academic_tasks").insert({
          user_id: uid,
          title: name,
          due_date: date || null,
          description: note || null,
          status: "todo",
          priority: "medium",
        }));
      } else if (kind === "event") {
        if (!name) throw new Error("Judul agenda wajib");
        ({ error } = await supabase.from("activity_events").insert({
          user_id: uid,
          title: name,
          starts_at: new Date(date).toISOString(),
          notes: note || null,
        }));
      } else if (kind === "habit") {
        if (!name) throw new Error("Nama habit wajib");
        ({ error } = await supabase.from("habits").insert({
          user_id: uid,
          name,
          description: note || null,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
        }));
      } else if (kind === "workout_done") {
        if (!name) throw new Error("Jenis workout wajib (mis. strength)");
        const dur = num1 ? Math.max(0, parseInt(num1)) : null;
        ({ error } = await supabase.from("workout_logs").insert({
          user_id: uid,
          workout_date: date,
          workout_type: name,
          duration_minutes: dur,
          notes: note || null,
        }));
      } else if (kind === "workout_plan") {
        if (!name) throw new Error("Judul rencana wajib");
        const dur = num1 ? Math.max(0, parseInt(num1)) : null;
        ({ error } = await supabase.from("workout_plans").insert({
          user_id: uid,
          title: name,
          workout_date: date,
          workout_type: "other",
          target_duration_minutes: dur,
          notes: note || null,
        }));
      } else if (kind === "body_weight") {
        const w = num1 ? Number(num1) : NaN;
        if (!Number.isFinite(w) || w <= 0) throw new Error("Berat tidak valid");
        ({ error } = await supabase
          .from("body_metrics")
          .upsert(
            { user_id: uid, metric_date: date, weight_kg: w, notes: note || null },
            { onConflict: "user_id,metric_date" },
          ));
      } else if (kind === "body_sleep") {
        const h = num1 ? Number(num1) : NaN;
        if (!Number.isFinite(h) || h < 0) throw new Error("Jam tidur tidak valid");
        const q = num2 ? Math.max(1, Math.min(5, parseInt(num2))) : null;
        ({ error } = await supabase.from("body_metrics").upsert(
          {
            user_id: uid,
            metric_date: date,
            sleep_hours: h,
            sleep_quality: q,
            notes: note || null,
          },
          { onConflict: "user_id,metric_date" },
        ));
      } else if (kind === "body_water") {
        const l = num1 ? Number(num1) : NaN;
        if (!Number.isFinite(l) || l < 0) throw new Error("Air tidak valid");
        ({ error } = await supabase
          .from("body_metrics")
          .upsert(
            { user_id: uid, metric_date: date, water_liters: l, notes: note || null },
            { onConflict: "user_id,metric_date" },
          ));
      }
    } catch (err) {
      setLoading(false);
      toast.error((err as Error).message);
      return;
    }

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tercatat");
    reset();
    onOpenChange(false);
    for (const key of INVALIDATE[kind]) qc.invalidateQueries({ queryKey: [key] });
  };

  // dynamic field flags
  const needsName =
    ["debt", "receivable", "task", "event", "habit", "workout_done", "workout_plan"].includes(
      kind,
    ) || kind === "note";
  const needsAmount =
    kind === "expense" || kind === "income" || kind === "debt" || kind === "receivable";
  const needsDate = [
    "task",
    "event",
    "workout_done",
    "workout_plan",
    "body_weight",
    "body_sleep",
    "body_water",
    "expense",
    "income",
  ].includes(kind);
  const needsNum1 = [
    "workout_done",
    "workout_plan",
    "body_weight",
    "body_sleep",
    "body_water",
  ].includes(kind);
  const needsNum2 = kind === "body_sleep";

  const num1Label =
    kind === "body_weight"
      ? "Berat (kg)"
      : kind === "body_sleep"
        ? "Jam tidur"
        : kind === "body_water"
          ? "Air (L)"
          : "Durasi (menit)";
  const nameLabel =
    kind === "debt"
      ? "Kepada"
      : kind === "receivable"
        ? "Dari"
        : kind === "task"
          ? "Judul tugas"
          : kind === "event"
            ? "Judul agenda"
            : kind === "habit"
              ? "Nama habit"
              : kind === "workout_done"
                ? "Jenis (strength/cardio…)"
                : kind === "workout_plan"
                  ? "Judul rencana"
                  : "Judul";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Add</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-1.5">
          {OPTIONS.map((o) => (
            <button
              key={o.kind}
              type="button"
              onClick={() => setKind(o.kind)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] ${kind === o.kind ? "border-primary bg-primary/5" : ""}`}
            >
              <o.icon className={`h-4 w-4 ${o.tone}`} />
              {o.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {needsName && (
            <div>
              <Label htmlFor="qa-name">{nameLabel}</Label>
              <Input
                id="qa-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={kind !== "note"}
              />
            </div>
          )}
          {needsAmount && (
            <div>
              <Label htmlFor="qa-amount">Nominal (Rp)</Label>
              <Input
                id="qa-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          )}
          {needsNum1 && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{num1Label}</Label>
                <Input
                  inputMode="decimal"
                  value={num1}
                  onChange={(e) => setNum1(e.target.value.replace(/[^\d.]/g, ""))}
                  required
                />
              </div>
              {needsNum2 && (
                <div>
                  <Label>Kualitas 1–5</Label>
                  <Input
                    inputMode="numeric"
                    value={num2}
                    onChange={(e) => setNum2(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              )}
            </div>
          )}
          {needsDate && (
            <div>
              <Label htmlFor="qa-date">Tanggal</Label>
              <Input
                id="qa-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          )}
          <div>
            <Label htmlFor="qa-note">Catatan {kind !== "note" ? "(opsional)" : ""}</Label>
            <Textarea
              id="qa-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required={kind === "note"}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            Simpan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
