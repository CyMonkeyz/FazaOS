import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const REALTIME_TABLES = [
  "transactions",
  "budgets",
  "debts",
  "debt_payments",
  "receivables",
  "receivable_payments",
  "bills",
  "assets",
  "investments",
  "investment_price_history",
  "businesses",
  "business_sheet_connections",
  "business_sheet_snapshots",
  "scheduled_messages",
  "sora_profile_memories",
  "academic_tasks",
  "activity_events",
  "courses",
  "organizations",
  "competitions",
  "workout_plans",
  "workout_logs",
  "workout_goals",
  "workout_routines",
  "body_metrics",
  "supplement_items",
  "supplement_logs",
  "daily_logs",
  "weekly_reviews",
  "goals",
  "habits",
  "habit_logs",
  "garden_seasons",
  "garden_events",
] as const;

export function useRealtimeRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("faza-os-realtime-refresh");

    for (const table of REALTIME_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryClient.invalidateQueries();
      });
    }

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
