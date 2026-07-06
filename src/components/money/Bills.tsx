import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/ui-lite";
import { formatIDR, parseAmount, deadlineLabel, daysUntil } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, ReceiptText, Check } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

const BILL_TYPES = [
  { v: "subscription", l: "Langganan" },
  { v: "credit_card", l: "Kartu kredit" },
  { v: "installment", l: "Cicilan" },
  { v: "internet", l: "Internet" },
  { v: "software", l: "Software" },
  { v: "hosting", l: "Hosting" },
  { v: "domain", l: "Domain" },
  { v: "annual_fee", l: "Iuran tahunan" },
  { v: "other", l: "Lainnya" },
] as const;

export function BillsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState<string>("subscription");
  const [recurrence, setRecurrence] = useState("monthly");
  const db = supabase as any;

  const { data, isLoading } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await db
        .from("bills")
        .select("*")
        .is("deleted_at", null)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const amt = parseAmount(amount);
      if (amt < 0) throw new Error("Nominal tidak valid");
      if (!dueDate) throw new Error("Tanggal jatuh tempo wajib diisi");
      const { error } = await db.from("bills").insert({
        user_id: u.user!.id,
        name,
        amount: amt,
        due_date: dueDate,
        bill_type: type as never,
        recurrence,
        recurrence_day: Number(dueDate.slice(8, 10)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tagihan tercatat");
      setOpen(false);
      setName("");
      setAmount("");
      setDueDate("");
      setRecurrence("monthly");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").update({ status: "paid" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tagihan ditandai lunas");
      qc.invalidateQueries();
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bills")
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
              <Plus className="mr-1 h-4 w-4" /> Tambah Tagihan
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Tambah Tagihan</SheetTitle>
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
                <Label>Nominal (Rp)</Label>
                <Input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Jatuh tempo</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Tipe</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILL_TYPES.map((t) => (
                      <SelectItem key={t.v} value={t.v}>
                        {t.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pengulangan tagihan</Label>
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
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Simpan
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {data!.length === 0 ? (
        <EmptyState
          title="Belum ada tagihan"
          description="Simpan tagihan rutin supaya tidak terlewat."
          icon={ReceiptText}
        />
      ) : (
        <Card className="divide-y">
          {data!.map((b: any) => {
            const d = daysUntil(b.due_date);
            const overdue = b.status === "upcoming" && d !== null && d < 0;
            return (
              <div key={b.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="text-sm font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatIDR(b.amount)}
                    {b.recurrence && b.recurrence !== "none"
                      ? ` - ${b.recurrence === "monthly" ? "Bulanan" : "Tahunan"}`
                      : " - Sekali"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    tone={
                      b.status === "paid"
                        ? "success"
                        : overdue
                          ? "danger"
                          : d !== null && d <= 3
                            ? "warning"
                            : "default"
                    }
                  >
                    {b.status === "paid" ? "Lunas" : deadlineLabel(b.due_date)}
                  </StatusBadge>
                  {b.status !== "paid" && (
                    <button
                      onClick={() => markPaid.mutate(b.id)}
                      className="p-1 text-muted-foreground hover:text-success"
                      title="Tandai lunas"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Hapus tagihan?",
                          description: `"${b.name}" akan diarsipkan dari tagihan aktif.`,
                          confirmText: "Hapus",
                        })
                      )
                        del.mutate(b.id);
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
