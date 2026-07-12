import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-lite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoalsTab } from "@/components/review/Goals";
import { GardenMiniCard, HabitsGardenTab } from "@/components/review/HabitsGarden";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/growth")({ component: GrowthPage });
function GrowthPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Growth Garden"
        subtitle="Goal memberi cahaya, habit memberi nutrisi, dan konsistensi membuat kebunmu hidup."
      />
      <Tabs defaultValue="habits">
        <TabsList className="w-full">
          <TabsTrigger value="goals" className="flex-1">
            Goals
          </TabsTrigger>
          <TabsTrigger value="habits" className="flex-1">
            Habits
          </TabsTrigger>
          <TabsTrigger value="garden" className="flex-1">
            Garden
          </TabsTrigger>
        </TabsList>
        <TabsContent value="goals" className="mt-4">
          <GoalsTab />
        </TabsContent>
        <TabsContent value="habits" className="mt-4">
          <HabitsGardenTab />
        </TabsContent>
        <TabsContent value="garden" className="mt-4">
          <div className="space-y-3">
            <GardenMiniCard />
            <Card className="p-4 text-sm text-muted-foreground">
              Garden lengkap, kalender XP, vitalitas, dan album musim tersedia bersama habit agar
              setiap centang langsung terlihat dampaknya.
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
