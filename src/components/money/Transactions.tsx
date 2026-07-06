import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingBlock } from "@/components/ui-lite";
import { formatIDR, parseAmount, formatDateID } from "@/lib/format";
import { toast } from "sonner";
import { Plus, ArrowUpCircle, ArrowDownCircle, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

export function TransactionsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [budgetMode, setBudgetMode] = useState("none");
  const db = supabase as any;

  const { data, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await db
        .from("transactions")
        .select("*,budgets(name)")
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: budgets } = useQuery({
    queryKey: ["budgets", "transaction-options"],
    queryFn: async () => {
      const { data, error } = await db
        .from("budgets")
        .select("id,name,planned_amount,status")
        .is("deleted_at", null)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const amt = parseAmount(amount);
      if (amt <= 0) throw new Error("Nominal harus lebih dari 0");
      const budgetId = type === "expense" && budgetMode !== "none" ? budgetMode : null;
      const { error } = await db.from("transactions").insert({
        user_id: u.user!.id,
        type,
        amount: amt,
        name: name || (type === "income" ? "Pemasukan" : "Pengeluaran"),
        note,
        date,
        budget_id: budgetId,
        affects_budget: type === "expense" ? !!budgetId : false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaksi tercatat");
      setAmount("");
      setName("");
      setNote("");
      setBudgetMode("none");
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Transaksi dihapus");
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Tambah
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Tambah Transaksi</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as "expense" | "income")}
                className="grid grid-cols-2 gap-2"
              >
                <label
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 text-sm ${type === "expense" ? "border-primary bg-primary/5" : ""}`}
                >
                  <RadioGroupItem value="expense" className="sr-only" />
                  <ArrowDownCircle className="h-4 w-4 text-destructive" /> Pengeluaran
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 text-sm ${type === "income" ? "border-primary bg-primary/5" : ""}`}
                >
                  <RadioGroupItem value="income" className="sr-only" />
                  <ArrowUpCircle className="h-4 w-4 text-success" /> Pemasukan
                </label>
              </RadioGroup>
              <div>
                <Label>Nama transaksi</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Makan siang, gaji, bayar hosting..."
                  required
                />
              </div>
              <div>
                <Label>Nominal (Rp)</Label>
                <Input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              {type === "expense" && (
                <div>
                  <Label>Ambil dari budget?</Label>
                  <Select value={budgetMode} onValueChange={setBudgetMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak ambil budget</SelectItem>
                      {(budgets ?? []).map((budget: any) => (
                        <SelectItem key={budget.id} value={budget.id}>
                          {budget.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Catatan detail</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
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
          title="Belum ada transaksi"
          description="Catat pemasukan atau pengeluaran pertama kamu."
        />
      ) : (
        <Card className="divide-y">
          {data!.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                {t.type === "income" ? (
                  <ArrowUpCircle className="h-5 w-5 text-success" />
                ) : (
                  <ArrowDownCircle className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <div className="text-sm font-medium">
                    {t.name || t.note || (t.type === "income" ? "Pemasukan" : "Pengeluaran")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateID(t.date)}
                    {t.type === "expense" &&
                      (t.affects_budget && t.budgets?.name
                        ? ` - Budget: ${t.budgets.name}`
                        : " - Non-budget")}
                  </div>
                  {t.note && t.name && (
                    <div className="text-xs text-muted-foreground line-clamp-1">{t.note}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`text-sm font-semibold tabular-nums ${t.type === "income" ? "text-success" : "text-destructive"}`}
                >
                  {t.type === "income" ? "+" : "−"}
                  {formatIDR(t.amount)}
                </div>
                <button
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Hapus transaksi?",
                        description: `"${t.name || t.note || "Transaksi"}" akan dihapus dari laporan aktif.`,
                        confirmText: "Hapus",
                      })
                    )
                      softDelete.mutate(t.id);
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
