import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, LoadingBlock, PageHeader, StatCard } from "@/components/ui-lite";
import { Card } from "@/components/ui/card";
import { DailyLogTab } from "@/components/review/DailyLog";
import { WeeklyTab } from "@/components/review/Weekly";
import { GoalsTab } from "@/components/review/Goals";
import { supabase } from "@/integrations/supabase/client";
import { Flower2, History, Sprout } from "lucide-react";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [{ title: "Review - Faza OS" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Review"
        subtitle="Daily journal, weekly review otomatis, goals, dan history view-only."
      />
      <Tabs defaultValue="dashboard" className="w-full">
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="dashboard">Dashboard Review</TabsTrigger>
            <TabsTrigger value="daily">Daily Journal</TabsTrigger>
            <TabsTrigger value="weekly">Weekly Review</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="history">Journal History</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="dashboard" className="mt-4">
          <ReviewDashboard />
        </TabsContent>
        <TabsContent value="daily" className="mt-4">
          <DailyLogTab />
        </TabsContent>
        <TabsContent value="weekly" className="mt-4">
          <WeeklyTab />
        </TabsContent>
        <TabsContent value="goals" className="mt-4">
          <GoalsTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <JournalHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useReviewSummary() {
  return useQuery({
    queryKey: ["review-dashboard"],
    queryFn: async () => {
      const [daily, weekly, goals] = await Promise.all([
        supabase
          .from("daily_logs")
          .select("log_date,mood,energy,focus,wins,struggles,gratitude,tomorrow_focus")
          .is("deleted_at", null)
          .order("log_date", { ascending: false })
          .limit(14),
        supabase
          .from("weekly_reviews")
          .select(
            "week_start,highlights,lessons,next_week_focus,score_money,score_academic,score_business,score_health",
          )
          .is("deleted_at", null)
          .order("week_start", { ascending: false })
          .limit(8),
        supabase.from("goals").select("title,progress,status").is("deleted_at", null).limit(20),
      ]);
      if (daily.error) throw daily.error;
      if (weekly.error) throw weekly.error;
      if (goals.error) throw goals.error;
      const logs = daily.data ?? [];
      const activeGoals = (goals.data ?? []).filter((g) => g.status !== "done");
      const avg = (key: "mood" | "energy" | "focus") => {
        const nums = logs
          .slice(0, 7)
          .map((log) => Number(log[key]))
          .filter(Number.isFinite);
        return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      };
      let streak = 0;
      const dates = new Set(logs.map((log) => log.log_date));
      const cursor = new Date();
      for (let i = 0; i < 14; i++) {
        const iso = cursor.toISOString().slice(0, 10);
        if (!dates.has(iso)) break;
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
      return {
        logs,
        weekly: weekly.data ?? [],
        activeGoals,
        avgMood: avg("mood"),
        avgEnergy: avg("energy"),
        avgFocus: avg("focus"),
        streak,
        goalAverage: activeGoals.length
          ? activeGoals.reduce((sum, g) => sum + Number(g.progress), 0) / activeGoals.length
          : 0,
      };
    },
  });
}

function plantLabel(streak: number) {
  if (streak <= 0) return "seed";
  if (streak <= 2) return "sprout";
  if (streak <= 5) return "small plant";
  return "flower";
}

function ReviewDashboard() {
  const { data, isLoading } = useReviewSummary();
  if (isLoading) return <LoadingBlock />;
  const d = data!;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard
          label="Journal streak"
          value={`${d.streak} hari`}
          icon={Sprout}
          tone={d.streak > 0 ? "success" : "default"}
        />
        <StatCard label="Mood avg" value={d.avgMood ? d.avgMood.toFixed(1) : "-"} />
        <StatCard label="Energy avg" value={d.avgEnergy ? d.avgEnergy.toFixed(1) : "-"} />
        <StatCard label="Focus avg" value={d.avgFocus ? d.avgFocus.toFixed(1) : "-"} />
      </div>
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Flower2 className="h-4 w-4 text-primary" /> Progress plant: {plantLabel(d.streak)}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Weekly tersimpan: {d.weekly.length}. Goal aktif: {d.activeGoals.length}. Rata-rata
          progress goal {Math.round(d.goalAverage)}%.
        </div>
      </Card>
    </div>
  );
}

function JournalHistory() {
  const { data, isLoading } = useReviewSummary();
  const [selected, setSelected] = useState<any>(null);
  if (isLoading) return <LoadingBlock />;
  const logs = data!.logs;
  const weekly = data!.weekly;
  const history = [
    ...logs.map((log) => ({ ...log, kind: "daily" as const, sortDate: log.log_date })),
    ...weekly.map((row) => ({ ...row, kind: "weekly" as const, sortDate: row.week_start })),
  ].sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)));
  return (
    <div className="space-y-3">
      <Card className="p-4 text-xs text-muted-foreground">
        Riwayat ini hanya view. Daily dan weekly bisa dibuka untuk melihat detail, tidak diedit dari
        sini.
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selected?.kind === "weekly" ? `Weekly ${selected.week_start}` : selected?.log_date}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              {selected.kind === "weekly" ? (
                <>
                  <div>
                    <b>Highlights:</b> {selected.highlights ?? "-"}
                  </div>
                  <div>
                    <b>Lessons:</b> {selected.lessons ?? "-"}
                  </div>
                  <div>
                    <b>Next focus:</b> {selected.next_week_focus ?? "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Money {selected.score_money ?? "-"} · Academic {selected.score_academic ?? "-"}{" "}
                    · Business {selected.score_business ?? "-"} · Health{" "}
                    {selected.score_health ?? "-"}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <b>Wins:</b> {selected.wins ?? "-"}
                  </div>
                  <div>
                    <b>Struggles:</b> {selected.struggles ?? "-"}
                  </div>
                  <div>
                    <b>Gratitude:</b> {selected.gratitude ?? "-"}
                  </div>
                  <div>
                    <b>Fokus besok:</b> {selected.tomorrow_focus ?? "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mood {selected.mood ?? "-"} · Energy {selected.energy ?? "-"} · Focus{" "}
                    {selected.focus ?? "-"}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {logs.length === 0 && weekly.length === 0 ? (
        <EmptyState title="Belum ada riwayat jurnal" icon={History} />
      ) : (
        <Card className="divide-y overflow-hidden">
          {history.map((row: any) => (
            <button
              key={`${row.kind}-${row.sortDate}`}
              onClick={() => setSelected(row)}
              className="block w-full p-3 text-left text-sm transition-colors hover:bg-muted/50 active:bg-muted"
            >
              <div className="font-medium">
                {row.kind === "weekly" ? `Weekly · ${row.week_start}` : `Daily · ${row.log_date}`}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {row.kind === "weekly"
                  ? row.highlights || row.lessons || "Belum ada ringkasan"
                  : `Mood ${row.mood ?? "-"} · Energy ${row.energy ?? "-"} · Focus ${row.focus ?? "-"}`}
              </div>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
