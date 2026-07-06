import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/ui-lite";
import { formatIDR, parseAmount, formatDateID, deadlineLabel } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Coins, MessageCircle } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

export function ReceivablesTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [payFor, setPayFor] = useState<{ id: string; remaining: number; name: string } | null>(
    null,
  );
  const [followUp, setFollowUp] = useState<{
    name: string;
    amount: number;
    overdueDays: number;
    promised: string | null;
  } | null>(null);
  const [tone, setTone] = useState<"halus" | "netral" | "tegas">("halus");

  const [borrower, setBorrower] = useState("");
  const [amount, setAmount] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [notes, setNotes] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const db = supabase as any;

  const { data, isLoading } = useQuery({
    queryKey: ["receivables"],
    queryFn: async () => {
      const { data, error } = await db
        .from("receivables")
        .select("*")
        .is("deleted_at", null)
        .order("promised_payment_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const amt = parseAmount(amount);
      if (amt <= 0) throw new Error("Jumlah harus lebih dari 0");
      const promiseDay = promisedDate ? Number(promisedDate.slice(8, 10)) : null;
      const { error } = await db.from("receivables").insert({
        user_id: u.user!.id,
        borrower_name: borrower,
        amount: amt,
        remaining_amount: amt,
        promised_payment_date: promisedDate || null,
        recurrence,
        recurrence_day: recurrence === "none" ? null : promiseDay,
        notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Piutang tercatat");
      setOpen(false);
      setBorrower("");
      setAmount("");
      setPromisedDate("");
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
      if (amt <= 0) throw new Error("Nominal harus lebih dari 0");
      if (amt > payFor.remaining) throw new Error("Nominal melebihi sisa piutang");
      const { error } = await supabase.from("receivable_payments").insert({
        user_id: u.user!.id,
        receivable_id: payFor.id,
        amount: amt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pembayaran diterima");
      setPayFor(null);
      setPayAmt("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("receivables")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const buildMessage = (
    name: string,
    amt: number,
    overdueDays: number,
    promised: string | null,
    t: "halus" | "netral" | "tegas",
  ) => {
    const nominal = formatIDR(amt);
    if (t === "halus") {
      return `Hai ${name}, semoga sehat selalu. Sekedar mengingatkan soal titipan sebesar ${nominal}${promised ? ` yang dijanjikan pada ${formatDateID(promised)}` : ""}. Kalau sudah bisa ditransfer, tolong kabari ya. Terima kasih banyak! 🙏`;
    }
    if (t === "netral") {
      return `Halo ${name}, mau follow-up soal pembayaran ${nominal}${promised ? ` (jatuh tempo ${formatDateID(promised)})` : ""}${overdueDays > 0 ? `. Sudah lewat ${overdueDays} hari` : ""}. Mohon konfirmasi kapan bisa diselesaikan ya. Terima kasih.`;
    }
    return `${name}, ini pengingat ke sekian soal utang ${nominal}${promised ? ` yang seharusnya dibayar tanggal ${formatDateID(promised)}` : ""}${overdueDays > 0 ? ` — sudah telat ${overdueDays} hari` : ""}. Mohon segera diselesaikan atau kabari rencana pembayarannya hari ini. Terima kasih.`;
  };

  const openFollowUp = (name: string, amt: number, promised: string | null) => {
    const overdueDays = promised
      ? Math.max(0, Math.floor((Date.now() - new Date(promised).getTime()) / 86400000))
      : 0;
    setFollowUp({ name, amount: amt, overdueDays, promised });
    setTone(overdueDays > 7 ? "tegas" : overdueDays > 0 ? "netral" : "halus");
  };

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Tambah Piutang
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Tambah Piutang</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Dari</Label>
                <Input value={borrower} onChange={(e) => setBorrower(e.target.value)} required />
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
                <Label>Janji bayar</Label>
                <Input
                  type="date"
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Pengulangan janji bayar</Label>
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
          title="Belum ada piutang"
          description="Catat siapa yang berhutang kepadamu supaya tidak lupa."
          icon={Coins}
        />
      ) : (
        <div className="space-y-2">
          {data!.map((r: any) => {
            const overdue =
              r.promised_payment_date &&
              new Date(r.promised_payment_date) < new Date() &&
              r.status !== "paid";
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.borrower_name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Total {formatIDR(r.amount)}</span>
                      {r.promised_payment_date && (
                        <span>· Janji {formatDateID(r.promised_payment_date)}</span>
                      )}
                      {r.recurrence && r.recurrence !== "none" && (
                        <span>· {r.recurrence === "monthly" ? "Bulanan" : "Tahunan"}</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge tone={r.status === "paid" ? "success" : overdue ? "danger" : "info"}>
                    {r.status === "paid"
                      ? "Lunas"
                      : overdue
                        ? "Terlambat"
                        : deadlineLabel(r.promised_payment_date)}
                  </StatusBadge>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm">
                    Sisa:{" "}
                    <span className="font-semibold tabular-nums">
                      {formatIDR(r.remaining_amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        openFollowUp(
                          r.borrower_name,
                          Number(r.remaining_amount),
                          r.promised_payment_date,
                        )
                      }
                      className="p-1 text-muted-foreground hover:text-primary"
                      title="Follow-up pesan"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    {r.status !== "paid" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setPayFor({
                            id: r.id,
                            remaining: Number(r.remaining_amount),
                            name: r.borrower_name,
                          });
                          setPayAmt("");
                        }}
                      >
                        Terima
                      </Button>
                    )}
                    <button
                      onClick={async () => {
                        if (
                          await confirm({
                            title: "Hapus piutang?",
                            description: `Catatan piutang dari "${r.borrower_name}" akan diarsipkan.`,
                            confirmText: "Hapus",
                          })
                        )
                          del.mutate(r.id);
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
            <DialogTitle>Terima dari {payFor?.name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pay.mutate();
            }}
            className="space-y-3"
          >
            <div className="text-xs text-muted-foreground">
              Sisa piutang: {formatIDR(payFor?.remaining ?? 0)}
            </div>
            <div>
              <Label>Nominal diterima (Rp)</Label>
              <Input
                inputMode="numeric"
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={pay.isPending}>
              Simpan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!followUp} onOpenChange={(o) => !o && setFollowUp(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Follow-up ke {followUp?.name}</DialogTitle>
          </DialogHeader>
          {followUp &&
            (() => {
              const msg = buildMessage(
                followUp.name,
                followUp.amount,
                followUp.overdueDays,
                followUp.promised,
                tone,
              );
              const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
              return (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    <span>
                      Sisa: <b>{formatIDR(followUp.amount)}</b>
                    </span>
                    {followUp.overdueDays > 0 && (
                      <span className="text-destructive">Telat {followUp.overdueDays} hari</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {(["halus", "netral", "tegas"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-xs capitalize ${tone === t ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <Textarea value={msg} readOnly rows={6} className="text-xs" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(msg);
                        toast.success("Pesan disalin");
                      }}
                    >
                      Salin
                    </Button>
                    <Button asChild>
                      <a href={waUrl} target="_blank" rel="noreferrer">
                        Kirim via WA
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
