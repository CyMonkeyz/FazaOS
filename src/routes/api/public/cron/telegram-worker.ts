import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "@/lib/env.server";
import { isCronAuthorized } from "@/lib/cron-auth.server";
import { sendMessage } from "@/lib/telegram-bot.server";
import { handleSoraText } from "@/lib/sora-telegram.server";

function admin() {
  return createClient(
    requiredEnv("Supabase URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    requiredEnv("Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as any;
}

function nextRun(row: any) {
  if (row.recurrence === "once") return null;
  const next = new Date(row.next_run_at);
  if (row.recurrence === "daily") next.setUTCDate(next.getUTCDate() + 1);
  if (row.recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  if (row.recurrence === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString();
}

async function work() {
  const sb = admin();
  const now = new Date().toISOString();
  let sent = 0;
  let failed = 0;
  await sb
    .from("telegram_jobs")
    .update({ status: "queued", started_at: null })
    .eq("status", "processing")
    .lt("started_at", new Date(Date.now() - 5 * 60_000).toISOString());
  const { data: due } = await sb
    .from("scheduled_messages")
    .select("*")
    .eq("status", "active")
    .is("deleted_at", null)
    .lte("next_run_at", now)
    .limit(50);
  for (const schedule of due ?? []) {
    const { data: tg } = await sb
      .from("telegram_users")
      .select("chat_id")
      .eq("user_id", schedule.user_id)
      .maybeSingle();
    if (!tg?.chat_id) continue;
    const key = `schedule:${schedule.id}:${schedule.next_run_at}`;
    await sb.from("telegram_jobs").upsert(
      {
        user_id: schedule.user_id,
        chat_id: String(tg.chat_id),
        job_type: "scheduled_message",
        payload: { text: schedule.message },
        scheduled_message_id: schedule.id,
        dedupe_key: key,
        status: "queued",
        scheduled_at: schedule.next_run_at,
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    const next = nextRun(schedule);
    await sb
      .from("scheduled_messages")
      .update({
        last_run_at: now,
        next_run_at: next ?? schedule.next_run_at,
        status: next ? "active" : "completed",
      })
      .eq("id", schedule.id)
      .eq("user_id", schedule.user_id);
  }
  const { data: jobs } = await sb
    .from("telegram_jobs")
    .select("*")
    .in("status", ["queued", "failed"])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("scheduled_at")
    .limit(20);
  for (const job of jobs ?? []) {
    const { data: claimed } = await sb
      .from("telegram_jobs")
      .update({ status: "processing", started_at: now, attempts: Number(job.attempts ?? 0) + 1 })
      .eq("id", job.id)
      .in("status", ["queued", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    try {
      if (job.job_type === "sora_message")
        await handleSoraText(Number(job.chat_id), job.user_id, String(job.payload?.text ?? ""));
      else await sendMessage(Number(job.chat_id), String(job.payload?.text ?? ""));
      await sb
        .from("telegram_jobs")
        .update({ status: "completed", finished_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);
      sent++;
    } catch (error) {
      const attempts = Number(job.attempts ?? 0) + 1;
      const terminal = attempts >= 4;
      await sb
        .from("telegram_jobs")
        .update({
          status: terminal ? "dead" : "failed",
          last_error:
            error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
          next_attempt_at: terminal
            ? null
            : new Date(Date.now() + Math.pow(2, attempts) * 60_000).toISOString(),
        })
        .eq("id", job.id);
      failed++;
    }
  }
  return { sent, failed, checkedAt: now };
}

export const Route = createFileRoute("/api/public/cron/telegram-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
        return Response.json(await work());
      },
    },
  },
});
