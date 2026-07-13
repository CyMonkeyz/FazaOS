import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, ReceiptText, WalletCards, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui-lite";
import { MoneyOverview } from "@/components/money/Overview";
import { TransactionsTab } from "@/components/money/Transactions";
import { BudgetsTab } from "@/components/money/Budgets";
import { DebtsTab } from "@/components/money/Debts";
import { ReceivablesTab } from "@/components/money/Receivables";
import { BillsTab } from "@/components/money/Bills";
import { AssetsTab } from "@/components/money/Assets";
import { InvestmentsTab } from "@/components/money/Investments";
import { AccountsTab } from "@/components/money/Accounts";

export const Route = createFileRoute("/_authenticated/money")({
  head: () => ({ meta: [{ title: "Money Guard — Faza OS" }] }),
  component: MoneyPage,
});

function MoneyPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Money Guard" subtitle="Uang, hutang, piutang, aset, dan investasi Tuan." />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl bg-card/70 p-1.5 md:grid-cols-4">
          <TabsTrigger value="overview" className="gap-2 rounded-xl py-2.5">
            <WalletCards className="h-4 w-4" /> Ringkasan
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-2 rounded-xl py-2.5">
            <Landmark className="h-4 w-4" /> Arus Dana
          </TabsTrigger>
          <TabsTrigger value="commitments" className="gap-2 rounded-xl py-2.5">
            <ReceiptText className="h-4 w-4" /> Kewajiban
          </TabsTrigger>
          <TabsTrigger value="wealth" className="gap-2 rounded-xl py-2.5">
            <TrendingUp className="h-4 w-4" /> Kekayaan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <MoneyOverview />
        </TabsContent>
        <TabsContent value="cashflow" className="mt-4">
          <SectionTabs
            items={[
              ["accounts", "Rekening"],
              ["transactions", "Transaksi"],
              ["budgets", "Budget"],
            ]}
          >
            <TabsContent value="accounts">
              <AccountsTab />
            </TabsContent>
            <TabsContent value="transactions">
              <TransactionsTab />
            </TabsContent>
            <TabsContent value="budgets">
              <BudgetsTab />
            </TabsContent>
          </SectionTabs>
        </TabsContent>
        <TabsContent value="commitments" className="mt-4">
          <SectionTabs
            items={[
              ["bills", "Tagihan"],
              ["debts", "Hutang"],
              ["receivables", "Piutang"],
            ]}
          >
            <TabsContent value="bills">
              <BillsTab />
            </TabsContent>
            <TabsContent value="debts">
              <DebtsTab />
            </TabsContent>
            <TabsContent value="receivables">
              <ReceivablesTab />
            </TabsContent>
          </SectionTabs>
        </TabsContent>
        <TabsContent value="wealth" className="mt-4">
          <SectionTabs
            items={[
              ["assets", "Aset"],
              ["investments", "Investasi"],
            ]}
          >
            <TabsContent value="assets">
              <AssetsTab />
            </TabsContent>
            <TabsContent value="investments">
              <InvestmentsTab />
            </TabsContent>
          </SectionTabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionTabs({ items, children }: { items: string[][]; children: React.ReactNode }) {
  return (
    <Tabs defaultValue={items[0][0]} className="space-y-4">
      <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/40 p-1">
        {items.map(([value, label]) => (
          <TabsTrigger key={value} value={value} className="min-w-24 rounded-lg">
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
