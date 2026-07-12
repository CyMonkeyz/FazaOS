import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requiredEnv } from "@/lib/env.server";

const resetSchema = z.object({
  confirmation: z.literal("RESET FAZA OS"),
});

const USER_DATA_TABLES: Array<{ table: string; userColumn?: string }> = [
  { table: "sora_memory_audit" },
  { table: "sora_conversation_messages" },
  { table: "sora_profile_memories" },
  { table: "business_sheet_snapshots" },
  { table: "business_sheet_connections" },
  { table: "scheduled_messages" },
  { table: "journal_retention_logs" },
  { table: "google_sheets_sync_logs" },
  { table: "google_sheets_connections" },
  { table: "telegram_message_logs" },
  { table: "telegram_jobs" },
  { table: "sora_telegram_sessions" },
  { table: "sora_pending_actions" },
  { table: "sora_action_logs" },
  { table: "notifications" },
  { table: "telegram_users" },
  { table: "investment_price_history" },
  { table: "investment_price_update_logs" },
  { table: "businesses" },
  { table: "supplement_logs" },
  { table: "supplement_purchases" },
  { table: "supplement_items" },
  { table: "recovery_logs" },
  { table: "workout_sets" },
  { table: "workout_logs" },
  { table: "workout_plans" },
  { table: "exercise_library" },
  { table: "workout_goals" },
  { table: "workout_routines" },
  { table: "body_metrics" },
  { table: "monthly_reviews" },
  { table: "weekly_reviews" },
  { table: "daily_logs" },
  { table: "goals" },
  { table: "garden_events" },
  { table: "garden_seasons" },
  { table: "habit_logs" },
  { table: "habits" },
  { table: "org_meetings" },
  { table: "activity_events" },
  { table: "academic_tasks" },
  { table: "courses" },
  { table: "organizations" },
  { table: "competitions" },
  { table: "portfolio_items" },
  { table: "debt_payments" },
  { table: "receivable_payments" },
  { table: "transactions" },
  { table: "budgets" },
  { table: "debts" },
  { table: "receivables" },
  { table: "bills" },
  { table: "assets" },
  { table: "investments" },
  { table: "money_categories" },
  { table: "money_accounts" },
  { table: "files" },
  { table: "notes" },
  { table: "tags" },
  { table: "user_preferences" },
  { table: "user_roles" },
  { table: "profiles", userColumn: "id" },
];

function admin() {
  return createClient<Database>(
    requiredEnv("Supabase URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    requiredEnv("Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function isMissingTableError(message: string) {
  return /schema cache|does not exist|not found|relation .* does not exist/i.test(message);
}

export const resetAllAccountData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ context }) => {
    const userId = context.userId;
    const sb = admin() as any;
    const deleted: Array<{ table: string; count: number | null }> = [];
    const skipped: Array<{ table: string; reason: string }> = [];

    for (const item of USER_DATA_TABLES) {
      const userColumn = item.userColumn ?? "user_id";
      const { count, error } = await sb
        .from(item.table)
        .delete({ count: "exact" })
        .eq(userColumn, userId);

      if (error) {
        if (isMissingTableError(error.message)) {
          skipped.push({ table: item.table, reason: "missing_table" });
          continue;
        }
        throw new Error(`Gagal reset tabel ${item.table}: ${error.message}`);
      }
      deleted.push({ table: item.table, count: count ?? null });
    }

    const now = new Date().toISOString();
    const { error: profileError } = await sb.from("profiles").upsert(
      {
        id: userId,
        display_name: null,
        timezone: "Asia/Jakarta",
        currency: "IDR",
        onboarded: false,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (profileError) throw new Error(`Gagal membuat ulang profile: ${profileError.message}`);

    const { error: prefsError } = await sb.from("user_preferences").upsert(
      {
        user_id: userId,
        locale: "id",
        theme: "dark",
        hide_amounts: false,
        show_amounts_in_telegram: false,
        telegram_enabled: false,
        notify_morning_brief: true,
        notify_daily_digest: true,
        notify_bill_due: true,
        notify_task_due: true,
        notify_midday_check: false,
        notify_night_review: true,
        notify_workout: true,
        notify_debt_due: true,
        notify_receivable_due: true,
        notify_deadline: true,
        quiet_hours_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
        selected_business_id: null,
        telegram_chat_id: null,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );
    if (prefsError) throw new Error(`Gagal membuat ulang preferensi: ${prefsError.message}`);

    return { ok: true, deleted, skipped };
  });
