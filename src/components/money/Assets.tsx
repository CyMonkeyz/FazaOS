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
import { EmptyState, LoadingBlock, StatCard } from "@/components/ui-lite";
import { formatIDR, parseAmount } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Wallet } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

const TYPES = [
  { v: "cash", l: "Kas" },
  { v: "savings", l: "Tabungan" },
  { v: "gold", l: "Emas" },
  { v: "investment", l: "Investasi" },
  { v: "business_equipment", l: "Alat bisnis" },
  { v: "productive_asset", l: "Aset produktif" },
  { v: "other", l: "Lainnya" },
] as const;

export function AssetsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState("cash");

  const { data, isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const [a, d] = await Promise.all([
        supabase
          .from("assets")
          .select("*")
          .is("deleted_at", null)
          .order("current_value", { ascending: false }),
        supabase
          .from("debts")
          .select("remaining_balance")
          .is("deleted_at", null)
          .neq("status", "paid"),
      ]);
      if (a.error) throw a.error;
      const total = (a.data ?? []).reduce((s, x) => s + Number(x.current_value), 0);
      const debt = (d.data ?? []).reduce((s, x) => s + Number(x.remaining_balance), 0);
      return { list: a.data ?? [], total, debt, net: total - debt };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const v = parseAmount(value);
      if (v < 0) throw new Error("Nilai tidak valid");
      const { error } = await supabase.from("assets").insert({
        user_id: u.user!.id,
        name,
        current_value: v,
        asset_type: type as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aset tercatat");
      setOpen(false);
      setName("");
      setValue("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("assets")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total Aset" value={formatIDR(data!.total)} tone="success" />
        <StatCard label="Total Hutang" value={formatIDR(data!.debt)} tone="warning" />
        <StatCard
          label="Net Worth"
          value={formatIDR(data!.net)}
          tone={data!.net < 0 ? "danger" : "default"}
        />
      </div>

      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Tambah Aset
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Tambah Aset</SheetTitle>
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
                <Label>Nilai saat ini (Rp)</Label>
                <Input
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
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
                    {TYPES.map((t) => (
                      <SelectItem key={t.v} value={t.v}>
                        {t.l}
                      </SelectItem>
                    ))}
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

      {data!.list.length === 0 ? (
        <EmptyState
          title="Belum ada aset"
          description="Catat tabungan, emas, atau investasi kamu."
          icon={Wallet}
        />
      ) : (
        <Card className="divide-y">
          {data!.list.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3">
              <div>
                <div className="text-sm font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {a.asset_type.replace(/_/g, " ")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold tabular-nums">
                  {formatIDR(a.current_value)}
                </div>
                <button
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Hapus aset?",
                        description: `"${a.name}" akan diarsipkan dari daftar aset.`,
                        confirmText: "Hapus",
                      })
                    )
                      del.mutate(a.id);
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
