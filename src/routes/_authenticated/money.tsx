import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transaksi</TabsTrigger>
            <TabsTrigger value="accounts">Rekening</TabsTrigger>
            <TabsTrigger value="budgets">Budget</TabsTrigger>
            <TabsTrigger value="debts">Hutang</TabsTrigger>
            <TabsTrigger value="receivables">Piutang</TabsTrigger>
            <TabsTrigger value="bills">Tagihan</TabsTrigger>
            <TabsTrigger value="assets">Aset</TabsTrigger>
            <TabsTrigger value="investments">Investasi</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4">
          <MoneyOverview />
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="budgets" className="mt-4">
          <BudgetsTab />
        </TabsContent>
        <TabsContent value="debts" className="mt-4">
          <DebtsTab />
        </TabsContent>
        <TabsContent value="receivables" className="mt-4">
          <ReceivablesTab />
        </TabsContent>
        <TabsContent value="bills" className="mt-4">
          <BillsTab />
        </TabsContent>
        <TabsContent value="assets" className="mt-4">
          <AssetsTab />
        </TabsContent>
        <TabsContent value="investments" className="mt-4">
          <InvestmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
