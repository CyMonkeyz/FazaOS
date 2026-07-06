import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/ui-lite";
import { formatIDR, parseAmount } from "@/lib/format";
import { toast } from "sonner";
import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { useConfirm } from "@/components/ConfirmProvider";

type Period = "daily" | "weekly" | "monthly" | "custom";

const db = supabase as any;

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthEndIso(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function defaultStart(period: Period) {
  if (period === "daily") return isoToday();
  if (period === "weekly") {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d.toISOString().slice(0, 10);
  }
  return startOfMonthIso();
}

function defaultEnd(period: Period, start: string) {
  if (period === "daily") return start;
  if (period === "weekly") return addDaysIso(start, 6);
  if (period === "monthly") return monthEndIso(start);
  return "";
}

function labelForPct(pct: number) {
  if (pct > 100) return { label: "lewat", tone: "danger" as const };
  if (pct >= 100) return { label: "habis", tone: "danger" as const };
  if (pct >= 80) return { label: "waspada", tone: "warning" as const };
  return { label: "aman", tone: "success" as const };
}

export function BudgetsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<Period>("monthly");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [startDate, setStartDate] = useState(defaultStart("monthly"));
  const [endDate, setEndDate] = useState(defaultEnd("monthly", defaultStart("monthly")));
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.money.budgets,
    queryFn: async () => {
      const [budgets, transactions, categories] = await Promise.all([
        db
          .from("budgets")
          .select("*,money_categories(name,kind)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("id,amount,type,date,category_id,note")
          .is("deleted_at", null)
          .eq("type", "expense")
          .limit(1000),
        supabase
          .from("money_categories")
          .select("id,name,kind")
          .is("deleted_at", null)
          .eq("kind", "expense")
          .order("name"),
      ]);
      if (budgets.error) throw budgets.error;
      if (transactions.error) throw transactions.error;
      if (categories.error) throw categories.error;
      return {
        budgets: budgets.data ?? [],
        transactions: transactions.data ?? [],
        categories: categories.data ?? [],
      };
    },
  });

  const enriched = useMemo(() => {
    if (!data) return [];
    return data.budgets.map((budget: any) => {
      const start = budget.start_date ?? startOfMonthIso();
      const end = budget.end_date ?? defaultEnd(budget.period_type, start);
      const related = data.transactions.filter(
        (tx) =>
          tx.date >= start &&
          tx.date <= end &&
          (!budget.category_id || tx.category_id === budget.category_id),
      );
      const used = related.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const planned = Number(budget.planned_amount);
      const pct = planned > 0 ? (used / planned) * 100 : 0;
      const status = labelForPct(pct);
      return {
        ...budget,
        rangeStart: start,
        rangeEnd: end,
        used,
        remaining: planned - used,
        pct,
        statusLabel: status.label,
        statusTone: status.tone,
        related,
      };
    });
  }, [data]);

  const onPeriodChange = (value: Period) => {
    setPeriod(value);
    const start = defaultStart(value);
    setStartDate(start);
    setEndDate(defaultEnd(value, start));
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const amt = parseAmount(amount);
      if (!name.trim()) throw new Error("Nama budget wajib diisi");
      if (amt <= 0) throw new Error("Nominal harus lebih dari 0");
      const { error } = await db.from("budgets").insert({
        user_id: u.user!.id,
        name,
        category_id: categoryId === "all" ? null : categoryId,
        planned_amount: amt,
        period_type: period,
        start_date: startDate,
        end_date: endDate || null,
        status: "active",
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Budget dibuat");
      setOpen(false);
      setName("");
      setAmount("");
      setNotes("");
      qc.invalidateQueries({ queryKey: queryKeys.money.budgets });
      qc.invalidateQueries({ queryKey: queryKeys.money.overview });
      qc.invalidateQueries({ queryKey: queryKeys.home.summary });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("budgets")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.money.budgets }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" }) => {
      const { error } = await db.from("budgets").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.money.budgets }),
    onError: (e: Error) => toast.error(e.message),
  });

  const editAmount = useMutation({
    mutationFn: async ({ id, plannedAmount }: { id: string; plannedAmount: number }) => {
      const { error } = await db
        .from("budgets")
        .update({ planned_amount: plannedAmount })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.money.budgets }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-3">
      <Card className="p-3 text-xs text-muted-foreground">
        Budget adalah amplop batas belanja. Pilih kategori untuk menghitung hanya transaksi kategori
        itu, atau pilih Semua Pengeluaran untuk menghitung semua expense dalam rentang tanggal.
      </Card>

      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Tambah Budget
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Buat Budget</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Nama</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Kategori</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Pengeluaran</SelectItem>
                    {(data?.categories ?? []).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Jumlah (Rp)</Label>
                <Input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Periode</Label>
                <Select value={period} onValueChange={(v) => onPeriodChange(v as Period)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Harian</SelectItem>
                    <SelectItem value="weekly">Mingguan</SelectItem>
                    <SelectItem value="monthly">Bulanan</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Mulai</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (period !== "custom") setEndDate(defaultEnd(period, e.target.value));
                    }}
                    required
                  />
                </div>
                <div>
                  <Label>Selesai</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required={period === "custom"}
                  />
                </div>
              </div>
              <div>
                <Label>Catatan</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Simpan
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {enriched.length === 0 ? (
        <EmptyState
          title="Belum ada budget"
          description="Buat budget kategori supaya Sora bisa menilai aman, waspada, habis, atau lewat."
        />
      ) : (
        <div className="space-y-2">
          {enriched.map((budget: any) => (
            <Card key={budget.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{budget.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {budget.money_categories?.name ?? "Semua Pengeluaran"} · {budget.rangeStart} -{" "}
                    {budget.rangeEnd}
                  </div>
                  {budget.status && budget.status !== "active" && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Status: {budget.status}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={budget.statusTone}>{budget.statusLabel}</StatusBadge>
                  <StatusBadge tone={budget.statusTone}>{Math.round(budget.pct)}%</StatusBadge>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${budget.statusTone === "danger" ? "bg-destructive" : budget.statusTone === "warning" ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${Math.min(100, Math.round(budget.pct))}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Terpakai {formatIDR(budget.used)}</span>
                <span>Sisa {formatIDR(budget.remaining)}</span>
              </div>
              {budget.related.length > 0 && (
                <div className="mt-3 rounded-lg bg-muted/40 p-2">
                  <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                    Transaksi terkait
                  </div>
                  <div className="space-y-1">
                    {budget.related.slice(0, 5).map((tx: any) => (
                      <div key={tx.id} className="flex justify-between gap-2 text-[11px]">
                        <span className="truncate">{tx.note || tx.date}</span>
                        <span className="tabular-nums">{formatIDR(tx.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => {
                    const next = prompt("Nominal budget baru:", String(budget.planned_amount));
                    if (!next) return;
                    const parsed = parseAmount(next);
                    if (parsed > 0) editAmount.mutate({ id: budget.id, plannedAmount: parsed });
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() =>
                    setStatus.mutate({
                      id: budget.id,
                      status: budget.status === "paused" ? "active" : "paused",
                    })
                  }
                >
                  {budget.status === "paused" ? (
                    <Play className="h-3.5 w-3.5" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-destructive"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Hapus budget?",
                        description: `"${budget.name}" akan diarsipkan dari budget aktif.`,
                        confirmText: "Hapus",
                      })
                    )
                      softDelete.mutate(budget.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
