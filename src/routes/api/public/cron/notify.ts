import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendMessage, fmtRp, fmtDate } from "@/lib/telegram-bot.server";
import { requiredEnv } from "@/lib/env.server";
import { isCronAuthorized } from "@/lib/cron-auth.server";

function admin() {
  return createClient<Database>(
    requiredEnv("Supabase URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    requiredEnv("Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

// ============ WIB (Asia/Jakarta) time helpers ============
// Server tz is UTC. WIB = UTC+7.
function wibNow() {
  const now = new Date();
  return new Date(now.getTime() + 7 * 3600 * 1000);
}
function wibDateISO(offsetDays = 0) {
  const d = wibNow();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function wibHour() {
  return wibNow().getUTCHours();
}
function wibMinute() {
  return wibNow().getUTCMinutes();
}

// dedupe key includes date so daily notifs re-send each day
function dkey(userId: string, type: string, extra = "") {
  return `${type}:${wibDateISO()}${extra ? ":" + extra : ""}`;
}

async function tryOnce(
  sb: ReturnType<typeof admin>,
  userId: string,
  chatId: number,
  type: string,
  extra: string,
  build: () => Promise<string | null>,
) {
  const key = dkey(userId, type, extra);
  // Reserve slot via unique(user_id, dedupe_key). If exists → skip.
  const { error: insErr } = await sb.from("notifications").insert({
    user_id: userId,
    type,
    dedupe_key: key,
    channel: "telegram",
    status: "sending",
    title: type,
  });
  if (insErr) return false; // duplicate → already sent today
  try {
    const text = await build();
    if (!text) {
      await sb
        .from("notifications")
        .update({ status: "skipped" })
        .eq("user_id", userId)
        .eq("dedupe_key", key);
      return false;
    }
    await sendMessage(chatId, text);
    await sb
      .from("notifications")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        message: text.slice(0, 500),
      })
      .eq("user_id", userId)
      .eq("dedupe_key", key);
    await sb.from("telegram_message_logs").insert({
      user_id: userId,
      chat_id: chatId,
      direction: "out",
      message_text: text.slice(0, 1000),
      status: "sent",
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb
      .from("notifications")
      .update({ status: "failed", error_message: msg })
      .eq("user_id", userId)
      .eq("dedupe_key", key);
    return false;
  }
}

function inQuietHours(nowH: number, nowM: number, start?: string | null, end?: string | null) {
  if (!start || !end) return false;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const cur = nowH * 60 + nowM;
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  // quiet across midnight (e.g. 22:00 → 05:30)
  if (s > e) return cur >= s || cur < e;
  return cur >= s && cur < e;
}

async function buildMorningBrief(sb: ReturnType<typeof admin>, userId: string, showAmt: boolean) {
  const today = wibDateISO();
  const in3 = wibDateISO(3);
  const in5 = wibDateISO(5);
  const [{ data: tasks }, { data: events }, { data: bills }, { data: workout }] = await Promise.all(
    [
      sb
        .from("academic_tasks")
        .select("title,due_date,priority")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .neq("status", "done")
        .not("due_date", "is", null)
        .lte("due_date", in5)
        .order("due_date")
        .limit(5),
      sb
        .from("activity_events")
        .select("title,starts_at,location")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .gte("starts_at", today + "T00:00:00")
        .lte("starts_at", today + "T23:59:59")
        .order("starts_at")
        .limit(6),
      sb
        .from("bills")
        .select("name,amount,due_date")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("status", "upcoming")
        .lte("due_date", in3)
        .order("due_date")
        .limit(5),
      sb
        .from("workout_plans")
        .select("title,workout_time,workout_type,target_duration_minutes,status")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("workout_date", today)
        .maybeSingle(),
    ],
  );

  let msg = `🌅 <b>Faza OS - Brief Pagi</b>\nTuan, selamat pagi. Aku rapikan fokus hari ini dulu ya.\n`;

  // Focus top 3
  const focus: string[] = [];
  if (workout?.status && workout.status !== "completed" && workout.status !== "skipped") {
    focus.push(
      `💪 Workout: ${workout.title}${workout.workout_time ? " (" + workout.workout_time.slice(0, 5) + ")" : ""}`,
    );
  }
  for (const t of (tasks ?? [])
    .filter((t) => t.priority === "urgent" || t.priority === "high")
    .slice(0, 2)) {
    focus.push(`📚 ${t.title}`);
  }
  for (const e of (events ?? []).slice(0, 3 - focus.length)) {
    focus.push(
      `📅 ${new Date(e.starts_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} ${e.title}`,
    );
  }
  if (focus.length > 0) {
    msg +=
      `\n<b>Fokus hari ini:</b>\n` +
      focus
        .slice(0, 3)
        .map((f) => `• ${f}`)
        .join("\n") +
      "\n";
  }

  if (events && events.length > 0) {
    msg += `\n<b>Agenda:</b>\n`;
    for (const e of events) {
      const t = new Date(e.starts_at).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      });
      msg += `• ${t} ${e.title}${e.location ? " @ " + e.location : ""}\n`;
    }
  }

  if (tasks && tasks.length > 0) {
    msg += `\n<b>Deadline H-5:</b>\n`;
    for (const t of tasks) {
      msg += `• ${t.title} - ${fmtDate(t.due_date)} (${t.priority})\n`;
    }
  }

  if (bills && bills.length > 0) {
    msg += `\n<b>Tagihan dekat:</b>\n`;
    for (const b of bills)
      msg += `• ${b.name} — ${fmtDate(b.due_date)}${showAmt ? " (" + fmtRp(Number(b.amount)) + ")" : ""}\n`;
  }

  if (workout) {
    msg += `\n<b>Workout hari ini:</b> ${workout.title} — ${workout.workout_type} (${workout.target_duration_minutes ?? 30}m) — <i>${workout.status}</i>\n`;
  }

  // Gentle encouragement line
  const encouragements = [
    "Pelan-pelan tapi tetap jalan ya, Tuan. Menang satu langkah kecil hari ini sudah cukup. 🌿",
    "Tidak harus sempurna, Tuan. Cukup hadir dan konsisten. ☕",
    "Satu tugas selesai, satu janji ditepati — itu sudah kemenangan. ✨",
    "Napas dulu, Tuan. Hari ini bukan lomba, tapi latihan. 🌱",
    "Tuan sudah lebih jauh dari kemarin. Lanjut pelan-pelan. 🌸",
  ];
  msg += `\n<i>${encouragements[new Date().getUTCDate() % encouragements.length]}</i>`;

  return msg;
}

async function buildBodyWeeklyReminder(sb: ReturnType<typeof admin>, userId: string) {
  const lastWeek = wibDateISO(-7);
  const { data: latest } = await sb
    .from("body_metrics")
    .select("metric_date,weight_kg,sleep_hours,water_liters,steps")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("metric_date", lastWeek)
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let msg = `📏 <b>Body check mingguan</b>\nTuan, waktunya isi tab Body biar progress badan kebaca rapi.`;
  if (latest) {
    msg += `\n\nTerakhir: ${fmtDate(latest.metric_date)}`;
    if (latest.weight_kg) msg += `\n• Berat: ${latest.weight_kg} kg`;
    if (latest.sleep_hours) msg += `\n• Tidur: ${latest.sleep_hours} jam`;
    if (latest.water_liters) msg += `\n• Air: ${latest.water_liters} L`;
    if (latest.steps) msg += `\n• Langkah: ${latest.steps}`;
  } else {
    msg += `\n\nBelum ada data 7 hari terakhir. Isi berat, tidur, air, dan catatan singkat ya.`;
  }
  msg += `\n\nBuka Health → Body. Dua menit saja, Tuan.`;
  return msg;
}

async function buildNightReview(sb: ReturnType<typeof admin>, userId: string) {
  const tomorrow = wibDateISO(1);
  const [{ data: tasks }, { data: workout }, { data: log }] = await Promise.all([
    sb
      .from("academic_tasks")
      .select("title,due_date")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .neq("status", "done")
      .eq("due_date", tomorrow)
      .limit(6),
    sb
      .from("workout_plans")
      .select("title,status")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("workout_date", wibDateISO())
      .maybeSingle(),
    sb
      .from("daily_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("log_date", wibDateISO())
      .maybeSingle(),
  ]);
  let msg = `🌙 <b>Review Malam</b>\nTuan, waktunya menutup hari.\n`;
  if (workout) msg += `\nWorkout: <i>${workout.status}</i>\n`;
  if (!log) msg += `\n📝 Belum isi <b>Daily Log</b> hari ini — buka Review → Daily.\n`;
  if (tasks && tasks.length > 0) {
    msg += `\n<b>Persiapan besok:</b>\n`;
    for (const t of tasks) msg += `• ${t.title}\n`;
  }
  return msg;
}

async function buildMidday(sb: ReturnType<typeof admin>, userId: string) {
  const today = wibDateISO();
  const [{ data: tasks }, { data: events }, { data: workout }] = await Promise.all([
    sb
      .from("academic_tasks")
      .select("title")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .neq("status", "done")
      .in("priority", ["urgent", "high"])
      .lte("due_date", today)
      .limit(3),
    sb
      .from("activity_events")
      .select("title,starts_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("starts_at", new Date().toISOString())
      .lte("starts_at", today + "T23:59:59")
      .order("starts_at")
      .limit(3),
    sb
      .from("workout_plans")
      .select("title,status")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("workout_date", today)
      .in("status", ["planned", "in_progress"])
      .maybeSingle(),
  ]);
  const parts: string[] = [];
  if (tasks && tasks.length > 0) parts.push(`📚 ${tasks.length} tugas mendesak belum selesai`);
  if (events && events.length > 0) parts.push(`📅 ${events.length} agenda menunggu`);
  if (workout) parts.push(`💪 Workout "${workout.title}" belum dilakukan`);
  if (parts.length === 0) return null;
  return `☀️ <b>Cek Siang</b>\nTuan:\n• ` + parts.join("\n• ");
}

async function runNotifications() {
  const sb = admin();
  const { data: gardenDecay, error: gardenError } = await sb.rpc("run_garden_maintenance", {});
  if (gardenError) console.error("[cron/garden]", gardenError.message);
  const H = wibHour();
  const M = wibMinute();
  const today = wibDateISO();
  const in1 = wibDateISO(1);
  const in3 = wibDateISO(3);
  const in5 = wibDateISO(5);

  const { data: linked } = await sb
    .from("telegram_users")
    .select("user_id,chat_id")
    .not("chat_id", "is", null);
  if (!linked) return { sent: 0, gardenDecay, hour: H, minute: M };

  let sent = 0;
  for (const row of linked) {
    if (!row.chat_id) continue;
    const chatId = Number(row.chat_id);
    const { data: p } = await sb
      .from("user_preferences")
      .select("*")
      .eq("user_id", row.user_id)
      .maybeSingle();
    const P = (p ?? {}) as Record<string, unknown>;
    const showAmt = !!P.show_amounts_in_telegram;

    // Quiet hours (skip all except we let scheduled critical items through)
    if (
      P.quiet_hours_enabled &&
      inQuietHours(H, M, P.quiet_hours_start as string, P.quiet_hours_end as string)
    ) {
      continue;
    }

    // Habit reminders are opt-in per user and per habit. Cron runs every 5 minutes.
    if (P.notify_habits !== false) {
      const weekday = wibNow().getUTCDay();
      const { data: habits } = await sb
        .from("habits")
        .select("id,name,icon,reminder_time")
        .eq("user_id", row.user_id)
        .is("deleted_at", null)
        .eq("is_active", true)
        .eq("reminder_enabled", true)
        .contains("weekdays", [weekday]);
      for (const habit of habits ?? []) {
        if (!habit.reminder_time) continue;
        const [hh, mm] = habit.reminder_time.split(":").map(Number);
        if (H !== hh || M < mm || M >= mm + 5) continue;
        const { data: completion } = await sb
          .from("habit_logs")
          .select("id")
          .eq("user_id", row.user_id)
          .eq("habit_id", habit.id)
          .eq("log_date", today)
          .maybeSingle();
        if (completion) continue;
        if (
          await tryOnce(
            sb,
            row.user_id,
            chatId,
            "habit_reminder",
            habit.id,
            async () =>
              `${habit.icon || "🌱"} <b>Waktunya ${habit.name}</b>\nSatu centang kecil bisa bikin kebun Tuan makin rimbun. Tanamannya sudah siap tepuk tangan pakai daun.`,
          )
        )
          sent++;
      }
    }

    // Morning Brief — 06:30 WIB
    if (H === 6 && M >= 25 && M <= 45 && P.notify_morning_brief !== false) {
      if (
        await tryOnce(sb, row.user_id, chatId, "morning_brief", "", () =>
          buildMorningBrief(sb, row.user_id, showAmt),
        )
      )
        sent++;
    }
    if (P.notify_body_weekly !== false) {
      const reminderDay = Number(P.body_weekly_reminder_day ?? 1);
      const reminderTime = String(P.body_weekly_reminder_time ?? "07:30");
      const [rh, rm] = reminderTime.split(":").map(Number);
      if (wibNow().getUTCDay() === reminderDay && H === rh && M >= rm && M <= rm + 20) {
        if (
          await tryOnce(sb, row.user_id, chatId, "body_weekly", "", () =>
            buildBodyWeeklyReminder(sb, row.user_id),
          )
        )
          sent++;
      }
    }
    // Midday Check — 12:30 WIB
    if (H === 12 && M >= 25 && M <= 45 && P.notify_midday_check === true) {
      if (
        await tryOnce(sb, row.user_id, chatId, "midday_check", "", () =>
          buildMidday(sb, row.user_id),
        )
      )
        sent++;
    }
    // Night Review — 20:30 WIB
    if (H === 20 && M >= 25 && M <= 45 && P.notify_night_review !== false) {
      if (
        await tryOnce(sb, row.user_id, chatId, "night_review", "", () =>
          buildNightReview(sb, row.user_id),
        )
      )
        sent++;
    }

    // Workout reminder — 1h before workout_time OR 17:00 if no time
    if (P.notify_workout !== false) {
      const { data: wo } = await sb
        .from("workout_plans")
        .select("id,title,workout_type,workout_time,target_duration_minutes,status")
        .eq("user_id", row.user_id)
        .is("deleted_at", null)
        .eq("workout_date", today)
        .in("status", ["planned", "in_progress"])
        .maybeSingle();
      if (wo) {
        let due = false;
        if (wo.workout_time) {
          const [wh, wm] = wo.workout_time.split(":").map(Number);
          const dueMin = wh * 60 + wm - 60; // 1h before
          const nowMin = H * 60 + M;
          due = nowMin >= dueMin && nowMin <= dueMin + 20;
        } else if (H === 17 && M <= 20) {
          due = true;
        }
        if (due) {
          if (
            await tryOnce(
              sb,
              row.user_id,
              chatId,
              "workout_reminder",
              wo.id,
              async () =>
                `💪 <b>Workout hari ini</b>\nTuan, saatnya <b>${wo.title}</b> (${wo.workout_type}, ${wo.target_duration_minutes ?? 30} menit).\n\nKirim /workout_done kalau sudah, /workout_skip kalau lewati.`,
            )
          )
            sent++;
        }
      }
    }

    // Debt reminder — H-3, H-1, hari-H (jam 9)
    if (P.notify_debt_due !== false && H === 9 && M < 20) {
      const { data: debts } = await sb
        .from("debts")
        .select("id,lender_name,remaining_balance,due_date")
        .eq("user_id", row.user_id)
        .is("deleted_at", null)
        .eq("status", "active")
        .in("due_date", [today, in1, in3]);
      for (const d of debts ?? []) {
        if (!d.due_date) continue;
        const label = d.due_date === today ? "HARI INI" : d.due_date === in1 ? "BESOK" : "H-3";
        if (
          await tryOnce(
            sb,
            row.user_id,
            chatId,
            "debt_due",
            d.id + ":" + d.due_date,
            async () =>
              `💳 <b>Hutang jatuh tempo ${label}</b>\nKe: ${d.lender_name}\nSisa: ${showAmt ? fmtRp(Number(d.remaining_balance)) : "(nominal disembunyikan)"}\nTanggal: ${fmtDate(d.due_date)}`,
          )
        )
          sent++;
      }
    }

    // Receivable reminder — H-3, H-1, hari-H, H+1 overdue
    if (P.notify_receivable_due !== false && H === 9 && M < 20) {
      const yesterday = wibDateISO(-1);
      const { data: recs } = await sb
        .from("receivables")
        .select("id,borrower_name,remaining_amount,promised_payment_date")
        .eq("user_id", row.user_id)
        .is("deleted_at", null)
        .eq("status", "active")
        .in("promised_payment_date", [today, in1, in3, yesterday]);
      for (const r of recs ?? []) {
        const due = r.promised_payment_date;
        if (!due) continue;
        const label =
          due === yesterday
            ? "TERLAMBAT (H+1)"
            : due === today
              ? "HARI INI"
              : due === in1
                ? "BESOK"
                : "H-3";
        if (
          await tryOnce(
            sb,
            row.user_id,
            chatId,
            "receivable_due",
            r.id + ":" + due,
            async () =>
              `💰 <b>Piutang ${label}</b>\nDari: ${r.borrower_name}\nSisa: ${showAmt ? fmtRp(Number(r.remaining_amount)) : "(disembunyikan)"}\nJatuh tempo: ${fmtDate(due)}\n\nWaktunya follow-up, Tuan.`,
          )
        )
          sent++;
      }
    }

    // Deadline reminder — all tasks: H-5, H-3, H-1, hari-H (jam 8)
    if (P.notify_deadline !== false && H === 8 && M < 20) {
      const { data: tasks } = await sb
        .from("academic_tasks")
        .select("id,title,due_date,priority")
        .eq("user_id", row.user_id)
        .is("deleted_at", null)
        .neq("status", "done")
        .in("due_date", [today, in1, in3, in5])
        .order("due_date");
      for (const t of tasks ?? []) {
        const label =
          t.due_date === today
            ? "HARI INI"
            : t.due_date === in1
              ? "BESOK"
              : t.due_date === in3
                ? "H-3"
                : "H-5";
        if (
          await tryOnce(
            sb,
            row.user_id,
            chatId,
            "deadline_reminder",
            t.id + ":" + t.due_date,
            async () =>
              `⏰ <b>Deadline ${label}</b>\n<b>${t.title}</b>\nPrioritas: ${t.priority}\nJatuh tempo: ${fmtDate(t.due_date)}\n\nSatu langkah kecil dulu, Tuan.`,
          )
        )
          sent++;
      }
    }
  }
  return { sent, gardenDecay, hour: H, minute: M, wibDate: today };
}

export const Route = createFileRoute("/api/public/cron/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
        try {
          const result = await runNotifications();
          return Response.json(result);
        } catch (e) {
          console.error("[cron/notify]", e);
          return Response.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      GET: async ({ request }) => {
        if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
        const result = await runNotifications();
        return Response.json(result);
      },
    },
  },
});
