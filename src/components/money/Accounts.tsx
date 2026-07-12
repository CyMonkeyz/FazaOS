import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Landmark, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState, LoadingBlock } from "@/components/ui-lite";
import { formatIDR } from "@/lib/format";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmProvider";

const db = supabase as any;
type Account = {
  id: string;
  name: string;
  account_type: string;
  initial_balance: number;
  currency: string;
  is_active: boolean;
};

export function AccountsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({
    name: "",
    account_type: "bank",
    initial_balance: "0",
    currency: "IDR",
  });
  const [transfer, setTransfer] = useState({ from: "", to: "", amount: "", note: "" });

  const query = useQuery({
    queryKey: ["money-accounts-full"],
    queryFn: async () => {
      const [{ data: accounts, error }, { data: tx }] = await Promise.all([
        db
          .from("money_accounts")
          .select("id,name,account_type,initial_balance,currency,is_active")
          .is("deleted_at", null)
          .order("name"),
        db.from("transactions").select("account_id,type,amount").is("deleted_at", null),
      ]);
      if (error) throw error;
      return (accounts ?? []).map((a: Account) => ({
        ...a,
        balance:
          Number(a.initial_balance ?? 0) +
          (tx ?? [])
            .filter((t: any) => t.account_id === a.id)
            .reduce(
              (sum: number, t: any) => sum + Number(t.amount) * (t.type === "income" ? 1 : -1),
              0,
            ),
      }));
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sesi berakhir");
      const payload = {
        user_id: auth.user.id,
        name: form.name.trim(),
        account_type: form.account_type,
        initial_balance: Number(form.initial_balance),
        currency: form.currency,
        is_active: true,
      };
      const result = editing
        ? await db
            .from("money_accounts")
            .update(payload)
            .eq("id", editing.id)
            .eq("user_id", auth.user.id)
        : await db.from("money_accounts").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success(editing ? "Rekening diperbarui" : "Rekening ditambahkan");
      setOpen(false);
      setEditing(null);
      setForm({ name: "", account_type: "bank", initial_balance: "0", currency: "IDR" });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("transfer_money", {
        p_from_account: transfer.from,
        p_to_account: transfer.to,
        p_amount: Number(transfer.amount),
        p_note: transfer.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transfer antarrekening tercatat");
      setTransfer({ from: "", to: "", amount: "", note: "" });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = async (account: Account) => {
    if (
      !(await confirm({
        title: "Arsipkan rekening?",
        description: `Rekening ${account.name} disembunyikan, transaksi historis tetap aman.`,
        confirmText: "Arsipkan",
      }))
    )
      return;
    const { error } = await db
      .from("money_accounts")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", account.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Rekening diarsipkan");
      qc.invalidateQueries();
    }
  };

  if (query.isLoading) return <LoadingBlock />;
  const accounts = query.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Rekening
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit rekening" : "Tambah rekening"}</SheetTitle>
            </SheetHeader>
            <form
              className="mx-auto mt-4 max-w-xl space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div>
                <Label>Nama rekening</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="BCA, GoPay, Tunai"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipe</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.account_type}
                    onChange={(e) => setForm({ ...form, account_type: e.target.value })}
                  >
                    <option value="bank">Bank</option>
                    <option value="cash">Tunai</option>
                    <option value="ewallet">E-wallet</option>
                    <option value="investment">Investasi</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
                <div>
                  <Label>Saldo awal</Label>
                  <Input
                    inputMode="numeric"
                    value={form.initial_balance}
                    onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
                  />
                </div>
              </div>
              <Button className="w-full" disabled={save.isPending}>
                Simpan rekening
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>
      {!accounts.length ? (
        <EmptyState
          title="Belum ada rekening"
          description="Pisahkan bank, tunai, dan e-wallet agar arus uang terbaca jelas."
          icon={WalletCards}
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {accounts.map((a: any) => (
            <Card key={a.id} className="group p-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="rounded-xl bg-primary/15 p-2 text-primary">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs capitalize text-muted-foreground">{a.account_type}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(a);
                      setForm({
                        name: a.name,
                        account_type: a.account_type,
                        initial_balance: String(a.initial_balance),
                        currency: a.currency,
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(a)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 text-2xl font-bold tabular-nums">{formatIDR(a.balance)}</div>
            </Card>
          ))}
        </div>
      )}
      {accounts.length >= 2 && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <ArrowRightLeft className="h-4 w-4 text-primary" /> Transfer antarrekening
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={transfer.from}
              onChange={(e) => setTransfer({ ...transfer, from: e.target.value })}
            >
              <option value="">Dari rekening</option>
              {accounts.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={transfer.to}
              onChange={(e) => setTransfer({ ...transfer, to: e.target.value })}
            >
              <option value="">Ke rekening</option>
              {accounts
                .filter((a: any) => a.id !== transfer.from)
                .map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
            <Input
              inputMode="numeric"
              placeholder="Nominal"
              value={transfer.amount}
              onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })}
            />
          </div>
          <Button
            onClick={() => move.mutate()}
            disabled={
              !transfer.from || !transfer.to || !(Number(transfer.amount) > 0) || move.isPending
            }
          >
            Catat transfer
          </Button>
        </Card>
      )}
    </div>
  );
}
