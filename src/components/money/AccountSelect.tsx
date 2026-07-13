import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/format";

export type MoneyAccountOption = { id: string; name: string; balance: number; currency: string };

function useMoneyAccountOptions() {
  return useQuery({
    queryKey: ["money-accounts", "selector"],
    queryFn: async () => {
      const db = supabase as any;
      const [{ data: accounts, error }, { data: transactions, error: txError }] = await Promise.all(
        [
          db
            .from("money_accounts")
            .select("id,name,currency,initial_balance,is_active")
            .is("deleted_at", null)
            .eq("is_active", true)
            .order("created_at"),
          db.from("transactions").select("account_id,type,amount").is("deleted_at", null),
        ],
      );
      if (error) throw error;
      if (txError) throw txError;
      return (accounts ?? []).map((account: any) => ({
        id: account.id,
        name: account.name,
        currency: account.currency ?? "IDR",
        balance:
          Number(account.initial_balance ?? 0) +
          (transactions ?? [])
            .filter((tx: any) => tx.account_id === account.id)
            .reduce(
              (sum: number, tx: any) =>
                sum + (tx.type === "income" ? Number(tx.amount) : -Number(tx.amount)),
              0,
            ),
      })) as MoneyAccountOption[];
    },
  });
}

export function AccountSelect({
  value,
  onChange,
  label = "Rekening",
  direction = "source",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  direction?: "source" | "destination";
}) {
  const query = useMoneyAccountOptions();
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} required>
        <SelectTrigger aria-label={label}>
          <SelectValue
            placeholder={
              query.isLoading
                ? "Memuat rekening..."
                : direction === "source"
                  ? "Pilih sumber dana"
                  : "Pilih rekening tujuan"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {(query.data ?? []).map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name} · {formatIDR(account.balance)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!query.isLoading && !query.data?.length && (
        <p className="mt-1 text-xs text-destructive">Buat rekening aktif terlebih dahulu.</p>
      )}
    </div>
  );
}
