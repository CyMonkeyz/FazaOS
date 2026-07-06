import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui-lite";
import { TasksTab } from "@/components/activity/Tasks";
import { EventsTab } from "@/components/activity/Events";
import { OrgsTab } from "@/components/activity/Orgs";
import { CoursesTab } from "@/components/activity/Courses";
import { CompetitionsTab } from "@/components/activity/Competitions";
import { PortfolioTab } from "@/components/activity/Portfolio";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity — Faza OS" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Activity Center"
        subtitle="Kuliah, tugas, agenda, lomba, organisasi & portfolio."
      />
      <Tabs defaultValue="tasks" className="w-full">
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="tasks">Tugas</TabsTrigger>
            <TabsTrigger value="events">Agenda</TabsTrigger>
            <TabsTrigger value="competitions">Lomba</TabsTrigger>
            <TabsTrigger value="courses">Kuliah</TabsTrigger>
            <TabsTrigger value="orgs">Organisasi</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsTab />
        </TabsContent>
        <TabsContent value="competitions" className="mt-4">
          <CompetitionsTab />
        </TabsContent>
        <TabsContent value="courses" className="mt-4">
          <CoursesTab />
        </TabsContent>
        <TabsContent value="orgs" className="mt-4">
          <OrgsTab />
        </TabsContent>
        <TabsContent value="portfolio" className="mt-4">
          <PortfolioTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
