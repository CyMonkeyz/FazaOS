import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-lite";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { BusinessSelector } from "@/components/business/BusinessSelector";
import { BusinessSheetDashboard } from "@/components/business/SheetDashboard";
import { BusinessesTab } from "@/components/business/BusinessesTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SheetUsageGuide } from "@/components/business/SheetUsageGuide";

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({ meta: [{ title: "Business Lab — Faza OS" }] }),
  component: BusinessPage,
});

function BusinessPage() {
  return (
    <BusinessProvider>
      <div className="space-y-4">
        <PageHeader
          title="Business Studio"
          subtitle="Dashboard toko otomatis dari Google Sheets, aman dalam mode view-only."
          action={<SheetUsageGuide />}
        />
        <BusinessSelector />
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="stores">Kelola Toko</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4">
            <BusinessSheetDashboard />
          </TabsContent>
          <TabsContent value="stores" className="mt-4">
            <BusinessesTab />
          </TabsContent>
        </Tabs>
      </div>
    </BusinessProvider>
  );
}
