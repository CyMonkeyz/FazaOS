import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/ui-lite";
import { formatIDR, parseAmount, formatDateID, deadlineLabel } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, HandCoins } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

export function DebtsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [payFor, setPayFor] = useState<{ id: string; remaining: number; name: string } | null>(
    null,
  );

  const [lender, setLender] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [notes, setNotes] = useState("");
  const db = supabase as any;

  const [payAmt, setPayAmt] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await db
        .from("debts")
        .select("*")
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const amt = parseAmount(amount);
      if (amt <= 0) throw new Error("Jumlah harus lebih dari 0");
      const dueDay = dueDate ? Number(dueDate.slice(8, 10)) : null;
      const { error } = await db.from("debts").insert({
        user_id: u.user!.id,
        lender_name: lender,
        amount: amt,
        remaining_balance: amt,
        due_date: dueDate || null,
        recurrence,
        recurrence_day: recurrence === "none" ? null : dueDay,
        notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hutang tercatat");
      setOpen(false);
      setLender("");
      setAmount("");
      setDueDate("");
      setRecurrence("none");
      setNotes("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!payFor) return;
      const { data: u } = await supabase.auth.getUser();
      const amt = parseAmount(payAmt);
      if (amt <= 0) throw new Error("Nominal pembayaran harus lebih dari 0");
      if (amt > payFor.remaining) throw new Error("Pembayaran melebihi sisa hutang");
      const { error } = await supabase.from("debt_payments").insert({
        user_id: u.user!.id,
        debt_id: payFor.id,
        amount: amt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pembayaran tercatat");
      setPayFor(null);
      setPayAmt("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("debts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Tambah Hutang
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Tambah Hutang</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Kepada</Label>
                <Input value={lender} onChange={(e) => setLender(e.target.value)} required />
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
                <Label>Jatuh tempo</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label>Pengulangan jatuh tempo</Label>
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak diulang</SelectItem>
                    <SelectItem value="monthly">Diulang tiap bulan di tanggal ini</SelectItem>
                    <SelectItem value="yearly">Diulang tiap tahun</SelectItem>
                  </SelectContent>
                </Select>
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

      {data!.length === 0 ? (
        <EmptyState
          title="Belum ada hutang"
          description="Catat hutangmu supaya bisa dilunasi tepat waktu."
          icon={HandCoins}
        />
      ) : (
        <div className="space-y-2">
          {data!.map((d: any) => {
            const overdue = d.due_date && new Date(d.due_date) < new Date() && d.status !== "paid";
            return (
              <Card key={d.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{d.lender_name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Total {formatIDR(d.amount)}</span>
                      {d.due_date && <span>· Jatuh tempo {formatDateID(d.due_date)}</span>}
                      {d.recurrence && d.recurrence !== "none" && (
                        <span>· {d.recurrence === "monthly" ? "Bulanan" : "Tahunan"}</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge
                    tone={d.status === "paid" ? "success" : overdue ? "danger" : "warning"}
                  >
                    {d.status === "paid"
                      ? "Lunas"
                      : overdue
                        ? "Terlambat"
                        : deadlineLabel(d.due_date)}
                  </StatusBadge>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm">
                    Sisa:{" "}
                    <span className="font-semibold tabular-nums">
                      {formatIDR(d.remaining_balance)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.status !== "paid" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setPayFor({
                            id: d.id,
                            remaining: Number(d.remaining_balance),
                            name: d.lender_name,
                          });
                          setPayAmt("");
                        }}
                      >
                        Bayar
                      </Button>
                    )}
                    <button
                      onClick={async () => {
                        if (
                          await confirm({
                            title: "Hapus hutang?",
                            description: `Catatan hutang ke "${d.lender_name}" akan diarsipkan.`,
                            confirmText: "Hapus",
                          })
                        )
                          del.mutate(d.id);
                      }}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Bayar {payFor?.name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pay.mutate();
            }}
            className="space-y-3"
          >
            <div className="text-xs text-muted-foreground">
              Sisa hutang: {formatIDR(payFor?.remaining ?? 0)}
            </div>
            <div>
              <Label>Nominal pembayaran (Rp)</Label>
              <Input
                inputMode="numeric"
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={pay.isPending}>
              Simpan pembayaran
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
