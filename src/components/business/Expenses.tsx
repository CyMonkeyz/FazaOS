import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, LoadingBlock, StatCard } from "@/components/ui-lite";
import { formatIDR, parseAmount, formatDateID } from "@/lib/format";
import { toast } from "sonner";
import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

const db = supabase as any;

export function BusinessExpensesTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { selectedBusinessId, isAllBusinesses, businesses } = useBusiness();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [alsoMoney, setAlsoMoney] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["business-expenses", selectedBusinessId ?? "all"],
    queryFn: async () => {
      let q = db
        .from("business_expenses")
        .select("*,businesses(name)")
        .is("deleted_at", null)
        .order("expense_date", { ascending: false })
        .limit(100);
      if (selectedBusinessId) q = q.eq("business_id", selectedBusinessId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!selectedBusinessId) throw new Error("Pilih satu bisnis dulu.");
      if (!name.trim()) throw new Error("Nama pengeluaran wajib diisi.");
      const amt = parseAmount(amount);
      if (amt <= 0) throw new Error("Nominal harus lebih dari 0.");
      const { data: u } = await supabase.auth.getUser();
      let transactionId: string | null = null;
      if (alsoMoney) {
        const { data: tx, error: txErr } = await db
          .from("transactions")
          .insert({
            user_id: u.user!.id,
            type: "expense",
            amount: amt,
            date,
            name: `Bisnis: ${name.trim()}`,
            note: notes || `Pengeluaran bisnis${category ? ` - ${category}` : ""}`,
            affects_budget: false,
            tags: ["business"],
          })
          .select("id")
          .single();
        if (txErr) throw txErr;
        transactionId = tx.id;
      }
      const { error } = await db.from("business_expenses").insert({
        user_id: u.user!.id,
        business_id: selectedBusinessId,
        name: name.trim(),
        amount: amt,
        expense_date: date,
        category: category || null,
        vendor: vendor || null,
        notes: notes || null,
        transaction_id: transactionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pengeluaran bisnis tercatat");
      setName("");
      setAmount("");
      setCategory("");
      setVendor("");
      setNotes("");
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("business_expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pengeluaran dihapus");
      qc.invalidateQueries();
    },
  });

  const rows = data ?? [];
  const total = rows.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
  const canAdd = !!selectedBusinessId && businesses.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <StatCard label="Total pengeluaran" value={formatIDR(total)} icon={ReceiptText} />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm" disabled={!canAdd}>
              <Plus className="mr-1 h-4 w-4" /> Pengeluaran
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Catat Pengeluaran Bisnis</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Nama transaksi</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Nominal</Label>
                  <Input
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Tanggal</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Kategori</Label>
                  <Input
                    placeholder="Bahan, ads, sewa..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Vendor</Label>
                  <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Catatan</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={alsoMoney}
                  onCheckedChange={(checked) => setAlsoMoney(Boolean(checked))}
                />
                Catat juga di Money, tapi tidak mengambil budget pribadi
              </label>
              <Button className="w-full" type="submit" disabled={create.isPending}>
                Simpan
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {isAllBusinesses && (
        <Card className="p-3 text-xs text-muted-foreground">
          Menampilkan semua bisnis. Pilih satu bisnis di selector atas untuk menambah pengeluaran.
        </Card>
      )}

      {isLoading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Belum ada pengeluaran bisnis"
          description="Catat bahan baku, iklan, sewa, alat, atau biaya operasional lain."
          icon={ReceiptText}
        />
      ) : (
        <Card className="divide-y">
          {rows.map((row: any) => (
            <div key={row.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{row.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateID(row.expense_date)}
                  {row.category ? ` - ${row.category}` : ""}
                  {isAllBusinesses && row.businesses?.name ? ` - ${row.businesses.name}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold tabular-nums">{formatIDR(row.amount)}</div>
                <button
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Hapus pengeluaran bisnis?",
                        description: `"${row.name}" akan diarsipkan dari laporan aktif.`,
                        confirmText: "Hapus",
                      })
                    )
                      remove.mutate(row.id);
                  }}
                  className="p-1 text-muted-foreground hover:text-destructive"
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
