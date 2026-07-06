import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui-lite";
import { ProductsTab } from "@/components/business/Products";
import { SalesTab } from "@/components/business/Sales";
import { BusinessesTab } from "@/components/business/BusinessesTab";
import { SuppliersTab } from "@/components/business/Suppliers";
import { ToolsTab } from "@/components/business/Tools";
import { BusinessExpensesTab } from "@/components/business/Expenses";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { BusinessSelector } from "@/components/business/BusinessSelector";

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({ meta: [{ title: "Business Lab — Faza OS" }] }),
  component: BusinessPage,
});

function BusinessPage() {
  return (
    <BusinessProvider>
      <div className="space-y-4">
        <PageHeader title="Business Lab" subtitle="Kelola beberapa toko dalam satu dashboard." />
        <BusinessSelector />
        <Tabs defaultValue="businesses" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="w-max">
              <TabsTrigger value="businesses">Toko</TabsTrigger>
              <TabsTrigger value="sales">Penjualan</TabsTrigger>
              <TabsTrigger value="expenses">Pengeluaran</TabsTrigger>
              <TabsTrigger value="products">Produk</TabsTrigger>
              <TabsTrigger value="suppliers">Supplier</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="businesses" className="mt-4">
            <BusinessesTab />
          </TabsContent>
          <TabsContent value="sales" className="mt-4">
            <SalesTab />
          </TabsContent>
          <TabsContent value="expenses" className="mt-4">
            <BusinessExpensesTab />
          </TabsContent>
          <TabsContent value="products" className="mt-4">
            <ProductsTab />
          </TabsContent>
          <TabsContent value="suppliers" className="mt-4">
            <SuppliersTab />
          </TabsContent>
          <TabsContent value="tools" className="mt-4">
            <ToolsTab />
          </TabsContent>
        </Tabs>
      </div>
    </BusinessProvider>
  );
}
