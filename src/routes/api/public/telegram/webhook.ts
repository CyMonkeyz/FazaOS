import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  sendMessage,
  editMessage,
  answerCallback,
  REMOVE_KEYBOARD,
  fmtRp,
  fmtDate,
  fmtDateTime,
  esc,
  buildMenuMessages,
  buildShortMenuMessage,
  BOT_COMMANDS,
  registerBotCommands,
} from "@/lib/telegram-bot.server";
import { handleSoraText } from "@/lib/sora-telegram.server";
import { getUpcomingGoogleCalendarEvents } from "@/lib/google-calendar.server";
import { envValue, requiredEnv } from "@/lib/env.server";

const TELEGRAM_NOTIFICATION_PREF_KEYS = [
  "telegram_enabled",
  "notify_morning_brief",
  "notify_daily_digest",
  "notify_bill_due",
  "notify_task_due",
] as const;

type TelegramNotificationPrefKey = (typeof TELEGRAM_NOTIFICATION_PREF_KEYS)[number];

function isTelegramNotificationPrefKey(key: string): key is TelegramNotificationPrefKey {
  return TELEGRAM_NOTIFICATION_PREF_KEYS.includes(key as TelegramNotificationPrefKey);
}

function deriveSecret(apiKey: string) {
  return createHash("sha256").update(`telegram-webhook:${apiKey}`).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

function admin() {
  return createClient<Database>(
    requiredEnv("Supabase URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    requiredEnv("Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Get today's date in Asia/Jakarta (WIB) as YYYY-MM-DD. */
function todayWIB(): string {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 7 * 3600000);
  return wib.toISOString().slice(0, 10);
}

async function findUser(chatId: number) {
  const sb = admin();
  const { data } = await sb
    .from("telegram_users")
    .select("user_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function requireLinked(chatId: number): Promise<string | null> {
  const uid = await findUser(chatId);
  if (!uid) {
    await sendMessage(
      chatId,
      `Telegram ID kamu: <code>${chatId}</code>\n\nMasukkan ID ini di Faza OS -> <b>More</b> -> <b>Telegram Bot</b>. Setelah tersimpan, aku baru akan merespon command dan chat dari ID ini.`,
    );
    return null;
  }
  return uid;
}

async function runSoraSafely(chatId: number, userId: string, text: string) {
  const sb = admin() as any;
  const { data: job } = await sb
    .from("telegram_jobs")
    .insert({
      user_id: userId,
      chat_id: String(chatId),
      job_type: "sora_message",
      payload: { text },
      status: "processing",
      scheduled_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  try {
    // Netlify may freeze/terminate work as soon as the webhook response is returned.
    // Keep the request alive until Sora has edited the placeholder with a final reply.
    await handleSoraText(chatId, userId, text);
    if (job?.id)
      await sb
        .from("telegram_jobs")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", job.id);
  } catch (err) {
    console.error("[sora telegram]", err);
    if (job?.id)
      await sb
        .from("telegram_jobs")
        .update({
          status: "queued",
          attempts: 1,
          last_error: err instanceof Error ? err.message : String(err),
          next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .eq("id", job.id);
    try {
      await sendMessage(
        chatId,
        "Sora belum bisa diproses di server sekarang. Cek env production dan log server ya, Tuan.",
      );
    } catch {
      // Telegram delivery failure is already visible in server logs.
    }
  }
}

// ============ COMMAND HANDLERS ============

async function handleStart(chatId: number) {
  const uid = await findUser(chatId);
  try {
    await registerBotCommands();
  } catch (error) {
    console.error("[telegram commands]", error);
  }
  const msg = uid
    ? "Halo Tuan! Telegram sudah terhubung ke Faza OS. Kirim /menu untuk mulai."
    : `Halo Tuan! Telegram ID kamu: <code>${chatId}</code>\n\nBuka Faza OS -> <b>More</b> -> <b>Telegram Bot</b>, lalu masukkan Chat ID ini. Setelah itu bot hanya akan merespon ID Telegram yang terdaftar.`;
  await sendMessage(chatId, msg, { reply_markup: REMOVE_KEYBOARD });
}

async function handleMenu(chatId: number) {
  // Default: SHORT menu. Users ask Sora for the rest.
  await sendMessage(chatId, buildShortMenuMessage(), { reply_markup: REMOVE_KEYBOARD });
}

async function handleFullCommands(chatId: number) {
  const chunks = buildMenuMessages();
  for (let i = 0; i < chunks.length; i++) {
    await sendMessage(
      chatId,
      chunks[i],
      i === chunks.length - 1 ? { reply_markup: REMOVE_KEYBOARD } : {},
    );
  }
}

async function handleUnknown(chatId: number, cmd: string) {
  await sendMessage(
    chatId,
    `❓ Command <code>/${esc(cmd)}</code> belum ada. Coba tanya <b>Sora</b> saja:\n<code>/sora ${esc(cmd)}</code>`,
  );
}

async function handleLink(chatId: number, from: { id: number; first_name?: string }, code: string) {
  const sb = admin();
  const { data: row } = await sb
    .from("telegram_users")
    .select("user_id,link_code_expires_at")
    .eq("link_code", code)
    .maybeSingle();
  if (!row) {
    await sendMessage(chatId, "❌ Kode tidak valid. Buat kode baru di Faza OS → More.");
    return;
  }
  if (row.link_code_expires_at && new Date(row.link_code_expires_at) < new Date()) {
    await sendMessage(chatId, "⏰ Kode sudah kedaluwarsa. Buat kode baru di Faza OS → More.");
    return;
  }
  await sb.from("telegram_users").update({ chat_id: null }).eq("chat_id", chatId);
  const { error } = await sb
    .from("telegram_users")
    .update({
      chat_id: chatId,
      linked_at: new Date().toISOString(),
      link_code: null,
      link_code_expires_at: null,
    })
    .eq("user_id", row.user_id);
  if (error) {
    await sendMessage(chatId, "❌ Gagal menautkan: " + esc(error.message));
    return;
  }
  await sendMessage(
    chatId,
    `✅ Berhasil ditautkan${from.first_name ? `, ${esc(from.first_name)}` : ""}! Kirim /menu untuk mulai.`,
    { reply_markup: REMOVE_KEYBOARD },
  );
}

async function handleUnlink(chatId: number, userId: string) {
  const sb = admin();
  await sb.from("telegram_users").update({ chat_id: null, linked_at: null }).eq("user_id", userId);
  await sendMessage(
    chatId,
    "🔌 Akun Telegram diputus dari Faza OS. Kirim /link KODE lagi kapan saja.",
    { reply_markup: { remove_keyboard: true } },
  );
}

async function handleMoney(chatId: number, userId: string) {
  const sb = admin();
  const startMonth = new Date();
  startMonth.setDate(1);
  const { data: txn } = await sb
    .from("transactions")
    .select("type,amount")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("date", startMonth.toISOString().slice(0, 10));
  const income = (txn ?? [])
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = (txn ?? [])
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  await sendMessage(
    chatId,
    `💰 <b>Uang bulan ini</b>\n\nMasuk: <b>${fmtRp(income)}</b>\nKeluar: <b>${fmtRp(expense)}</b>\nSisa: <b>${fmtRp(income - expense)}</b>`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🧾 Tagihan", callback_data: "bills" },
            { text: "📊 Refresh", callback_data: "money" },
          ],
        ],
      },
    },
  );
}

async function handleTasks(chatId: number, userId: string) {
  const sb = admin();
  const { data } = await sb
    .from("academic_tasks")
    .select("id,title,priority,due_date,status")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(10);
  if (!data || data.length === 0) {
    await sendMessage(chatId, "📚 Tidak ada tugas aktif, Tuan. 🎉");
    return;
  }
  let msg = `📚 <b>Tugas mendekat</b>\n\n`;
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const t of data) {
    const p = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🟢";
    msg += `${p} <b>${esc(t.title)}</b>\n   ${t.due_date ? "⏰ " + fmtDate(t.due_date) : "tanpa deadline"}\n`;
    buttons.push([{ text: `✓ ${t.title.slice(0, 30)}`, callback_data: `task_done:${t.id}` }]);
  }
  await sendMessage(chatId, msg, { reply_markup: { inline_keyboard: buttons } });
}

async function handleAgenda(chatId: number, userId: string, days = 3) {
  const sb = admin();
  const now = new Date().toISOString();
  const inX = new Date(Date.now() + days * 86400000).toISOString();
  const { data } = await sb
    .from("activity_events")
    .select("title,kind,starts_at,location")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("starts_at", now)
    .lte("starts_at", inX)
    .order("starts_at")
    .limit(15);
  let gcalMsg = "";
  try {
    const result = await getUpcomingGoogleCalendarEvents(days, 10);
    if (result.events.length > 0) {
      gcalMsg = "\n📆 <b>Google Calendar</b>\n";
      for (const e of result.events.slice(0, 5)) {
        const st = e.start?.dateTime || e.start?.date || "";
        gcalMsg += `  • ${esc(e.summary || "(tanpa judul)")} — ${st ? fmtDateTime(st) : ""}\n`;
      }
    }
  } catch {
    /* ignore */
  }

  if ((!data || data.length === 0) && !gcalMsg) {
    await sendMessage(chatId, `📅 Kosong dalam ${days} hari ke depan, Tuan.`);
    return;
  }
  let msg = `📅 <b>Agenda ${days} hari ke depan</b>\n\n`;
  if (data && data.length > 0) {
    msg += "📌 <b>Faza OS</b>\n";
    for (const e of data) {
      msg += `  • ${esc(e.title)} — ${fmtDateTime(e.starts_at)}${e.location ? " @ " + esc(e.location) : ""}\n`;
    }
  }
  msg += gcalMsg;
  await sendMessage(chatId, msg);
}

async function handleBills(chatId: number, userId: string) {
  const sb = admin();
  const { data } = await sb
    .from("bills")
    .select("id,name,amount,due_date")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("status", "upcoming")
    .order("due_date")
    .limit(10);
  if (!data || data.length === 0) {
    await sendMessage(chatId, "🧾 Tidak ada tagihan pending, Tuan. 👍");
    return;
  }
  let msg = `🧾 <b>Tagihan</b>\n\n`;
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const b of data) {
    msg += `• <b>${esc(b.name)}</b>\n  ${fmtRp(Number(b.amount))} — jatuh tempo ${fmtDate(b.due_date)}\n`;
    buttons.push([
      { text: `💸 Sudah bayar: ${b.name.slice(0, 25)}`, callback_data: `bill_paid:${b.id}` },
    ]);
  }
  await sendMessage(chatId, msg, { reply_markup: { inline_keyboard: buttons } });
}

async function handleBusiness(chatId: number, userId: string) {
  const sb = admin();
  const startMonth = new Date();
  startMonth.setDate(1);
  const { data } = await sb
    .from("sales")
    .select("product_name,quantity,total,profit")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("sold_at", startMonth.toISOString().slice(0, 10));
  const rows = data ?? [];
  const rev = rows.reduce((s, r) => s + Number(r.total), 0);
  const profit = rows.reduce((s, r) => s + Number(r.profit), 0);
  await sendMessage(
    chatId,
    `🛍️ <b>Bisnis bulan ini</b>\n\nTransaksi: <b>${rows.length}</b>\nOmzet: <b>${fmtRp(rev)}</b>\nProfit: <b>${fmtRp(profit)}</b>`,
  );
}

async function handleNotif(chatId: number, userId: string) {
  const sb = admin();
  const { data } = await sb
    .from("user_preferences")
    .select(
      "telegram_enabled,notify_morning_brief,notify_daily_digest,notify_bill_due,notify_task_due",
    )
    .eq("user_id", userId)
    .maybeSingle();
  const p = data ?? {
    telegram_enabled: true,
    notify_morning_brief: true,
    notify_daily_digest: true,
    notify_bill_due: true,
    notify_task_due: true,
  };
  const mk = (label: string, key: TelegramNotificationPrefKey, on: boolean) => ({
    text: `${on ? "✅" : "⬜"} ${label}`,
    callback_data: `notif_toggle:${key}`,
  });
  await sendMessage(chatId, "⚙️ <b>Notifikasi</b>\nTap untuk toggle:", {
    reply_markup: {
      inline_keyboard: [
        [mk("Telegram (semua)", "telegram_enabled", p.telegram_enabled ?? true)],
        [mk("Brief pagi", "notify_morning_brief", p.notify_morning_brief ?? true)],
        [mk("Ringkasan harian", "notify_daily_digest", !!p.notify_daily_digest)],
        [mk("Tagihan jatuh tempo", "notify_bill_due", !!p.notify_bill_due)],
        [mk("Tugas mendekat", "notify_task_due", !!p.notify_task_due)],
      ],
    },
  });
}

async function setPref(userId: string, patch: Record<string, unknown>) {
  const sb = admin();
  await sb
    .from("user_preferences")
    .upsert({ user_id: userId, ...patch } as never, { onConflict: "user_id" });
}

async function handleQuickTxn(
  chatId: number,
  userId: string,
  args: string,
  type: "income" | "expense",
) {
  const m = args.match(/^\s*(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (!m) {
    const cmd = type === "income" ? "/pemasukan 500000 freelance" : "/catat 25000 kopi";
    await sendMessage(chatId, `Format: <code>${cmd}</code>`);
    return;
  }
  const amount = Number(m[1].replace(",", "."));
  const note = m[2].trim();
  const sb = admin();
  const { data: acc } = await sb
    .from("money_accounts")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!acc) {
    await sendMessage(chatId, "❌ Belum ada akun uang. Buat di Faza OS → Money.");
    return;
  }
  const { error } = await sb.from("transactions").insert({
    user_id: userId,
    account_id: acc.id,
    type,
    amount,
    note,
    date: new Date().toISOString().slice(0, 10),
  });
  if (error) {
    await sendMessage(chatId, "❌ " + esc(error.message));
    return;
  }
  const label = type === "income" ? "Pemasukan" : "Pengeluaran";
  await sendMessage(chatId, `✅ ${label} tercatat: <b>${fmtRp(amount)}</b> — ${esc(note)}`);
}

async function handleQuickTask(chatId: number, userId: string, args: string) {
  const parts = args.split("|").map((s) => s.trim());
  const title = parts[0];
  const due = parts[1];
  if (!title) {
    await sendMessage(chatId, "Format: <code>/tugas_baru Judul | 2026-07-30</code>");
    return;
  }
  const sb = admin();
  const { error } = await sb.from("academic_tasks").insert({
    user_id: userId,
    title,
    due_date: due || null,
    priority: "medium",
    status: "todo",
  });
  if (error) {
    await sendMessage(chatId, "❌ " + esc(error.message));
    return;
  }
  await sendMessage(
    chatId,
    `✅ Tugas ditambahkan: <b>${esc(title)}</b>${due ? " (⏰ " + esc(due) + ")" : ""}`,
  );
}

async function handleWorkout(chatId: number, userId: string) {
  const sb = admin();
  const today = todayWIB();
  const { data } = await sb
    .from("workout_plans")
    .select("id,title,workout_type,workout_time,target_duration_minutes,target_intensity,status")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("workout_date", today)
    .maybeSingle();
  if (!data) {
    await sendMessage(
      chatId,
      "💪 Tidak ada rencana workout hari ini, Tuan.\n\nBuat lewat Faza OS → Health → Workout, atau kirim <code>/workout_done</code> untuk catat manual.",
    );
    return;
  }
  const statusEmoji: Record<string, string> = {
    planned: "🟡 Direncanakan",
    in_progress: "🟠 Berjalan",
    completed: "✅ Selesai",
    skipped: "⏭️ Dilewati",
    cancelled: "❌ Batal",
  };
  await sendMessage(
    chatId,
    `💪 <b>Workout Hari Ini</b>\n\n<b>${esc(data.title)}</b>\nJenis: ${esc(data.workout_type)}\nDurasi: ${data.target_duration_minutes ?? 30} menit\nIntensitas: ${esc(data.target_intensity ?? "-")}\n${data.workout_time ? "Jam: " + data.workout_time.slice(0, 5) + "\n" : ""}Status: ${statusEmoji[data.status] ?? esc(data.status)}`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Selesai", callback_data: `wo_done:${data.id}` },
            { text: "⏭️ Skip", callback_data: `wo_skip:${data.id}` },
          ],
        ],
      },
    },
  );
}

async function handleWorkoutDone(chatId: number, userId: string) {
  const sb = admin();
  const today = todayWIB();
  const { data: plan } = await sb
    .from("workout_plans")
    .select("id,title,workout_type,target_duration_minutes,target_intensity,status")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("workout_date", today)
    .maybeSingle();
  if (plan) {
    if (plan.status === "completed") {
      await sendMessage(chatId, "ℹ️ Workout hari ini sudah pernah ditandai selesai, Tuan.");
      return;
    }
    await sb.from("workout_plans").update({ status: "completed" }).eq("id", plan.id);
    await sb.from("workout_logs").insert({
      user_id: userId,
      workout_plan_id: plan.id,
      workout_date: today,
      workout_type: plan.workout_type,
      duration_minutes: plan.target_duration_minutes ?? 30,
      intensity: plan.target_intensity ?? "moderate",
    });
    await sendMessage(
      chatId,
      `✅ Workout <b>${esc(plan.title)}</b> ditandai selesai, Tuan. Mantap!`,
    );
  } else {
    await sb.from("workout_logs").insert({
      user_id: userId,
      workout_date: today,
      workout_type: "other",
      duration_minutes: 30,
      intensity: "moderate",
    });
    await sendMessage(chatId, "✅ Workout tercatat (manual, 30 menit), Tuan.");
  }
}

async function handleWorkoutSkip(chatId: number, userId: string) {
  const sb = admin();
  const today = todayWIB();
  const { data: plan } = await sb
    .from("workout_plans")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("workout_date", today)
    .maybeSingle();
  if (!plan) {
    await sendMessage(chatId, "Tidak ada rencana workout hari ini.");
    return;
  }
  await sb.from("workout_plans").update({ status: "skipped" }).eq("id", plan.id);
  await sendMessage(chatId, "⏭️ Workout hari ini di-skip. Jangan biasakan ya Tuan.");
}

async function handleWeight(chatId: number, userId: string, args: string) {
  const w = Number(args.replace(",", ".").trim());
  if (!w || w <= 0 || w > 500) {
    await sendMessage(chatId, "Format: <code>/berat 70.5</code>");
    return;
  }
  const sb = admin();
  const today = todayWIB();
  const { error } = await sb.from("body_metrics").upsert(
    {
      user_id: userId,
      metric_date: today,
      weight_kg: w,
    },
    { onConflict: "user_id,metric_date" },
  );
  if (error) {
    await sendMessage(chatId, "❌ " + esc(error.message));
    return;
  }
  await sendMessage(chatId, `✅ Berat ${w} kg tercatat, Tuan.`);
}

async function handleSleep(chatId: number, userId: string, args: string) {
  const m = args.match(/^\s*(\d+(?:[.,]\d+)?)(?:\s+kualitas\s+(\d))?\s*$/i);
  if (!m) {
    await sendMessage(chatId, "Format: <code>/tidur 7 kualitas 4</code>");
    return;
  }
  const hours = Number(m[1].replace(",", "."));
  const qual = m[2] ? Math.min(5, Math.max(1, Number(m[2]))) : null;
  const sb = admin();
  const today = todayWIB();
  const { error } = await sb.from("body_metrics").upsert(
    {
      user_id: userId,
      metric_date: today,
      sleep_hours: hours,
      sleep_quality: qual,
    },
    { onConflict: "user_id,metric_date" },
  );
  if (error) {
    await sendMessage(chatId, "❌ " + esc(error.message));
    return;
  }
  await sendMessage(
    chatId,
    `✅ Tidur ${hours} jam${qual ? " (kualitas " + qual + "/5)" : ""} tercatat.`,
  );
}

async function handleWater(chatId: number, userId: string, args: string) {
  const l = Number(args.replace(",", ".").trim());
  if (!l || l <= 0 || l > 20) {
    await sendMessage(chatId, "Format: <code>/air 2.5</code> (liter)");
    return;
  }
  const sb = admin();
  const today = todayWIB();
  const { error } = await sb.from("body_metrics").upsert(
    {
      user_id: userId,
      metric_date: today,
      water_liters: l,
    },
    { onConflict: "user_id,metric_date" },
  );
  if (error) {
    await sendMessage(chatId, "❌ " + esc(error.message));
    return;
  }
  await sendMessage(chatId, `✅ Air ${l} L tercatat, Tuan.`);
}

async function handleBody(chatId: number, userId: string) {
  const sb = admin();
  const { data } = await sb
    .from("body_metrics")
    .select("metric_date,weight_kg,sleep_hours,sleep_quality,water_liters,steps")
    .eq("user_id", userId)
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) {
    await sendMessage(
      chatId,
      "🧬 Belum ada body metrics. Coba <code>/berat 70</code> atau <code>/tidur 7</code>.",
    );
    return;
  }
  await sendMessage(
    chatId,
    `🧬 <b>Body Metrics</b>\n<i>${fmtDate(data.metric_date)}</i>\n\n` +
      `⚖️ Berat: <b>${data.weight_kg ?? "-"}${data.weight_kg ? " kg" : ""}</b>\n` +
      `😴 Tidur: <b>${data.sleep_hours ?? "-"}${data.sleep_hours ? " jam" : ""}</b>${data.sleep_quality ? " (kualitas " + data.sleep_quality + "/5)" : ""}\n` +
      `💧 Air: <b>${data.water_liters ?? "-"}${data.water_liters ? " L" : ""}</b>\n` +
      `👟 Langkah: <b>${data.steps ?? "-"}</b>`,
  );
}

async function handleHealth(chatId: number, userId: string) {
  const sb = admin() as any;
  const today = todayWIB();
  const [workout, body, supplements] = await Promise.all([
    sb
      .from("workout_plans")
      .select("title,status,workout_time,workout_type,target_duration_minutes")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("workout_date", today)
      .limit(3),
    sb
      .from("body_metrics")
      .select("metric_date,weight_kg,sleep_hours,sleep_quality,water_liters")
      .eq("user_id", userId)
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("supplement_items")
      .select("name,stock_quantity,unit,low_stock_threshold")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("name")
      .limit(5),
  ]);

  let msg = "💪 <b>Health Hari Ini</b>\n\n";
  const plans = workout.data ?? [];
  msg += "<b>Workout</b>\n";
  if (plans.length) {
    for (const p of plans) {
      msg += `• ${esc(p.title)} - ${esc(p.status)}${p.workout_time ? " @ " + esc(String(p.workout_time).slice(0, 5)) : ""}\n`;
    }
  } else {
    msg += "• Belum ada rencana workout hari ini.\n";
  }

  msg += "\n<b>Body terbaru</b>\n";
  if (body.data) {
    msg += `• ${fmtDate(body.data.metric_date)}\n`;
    msg += `• Berat: ${body.data.weight_kg ?? "-"} kg\n`;
    msg += `• Tidur: ${body.data.sleep_hours ?? "-"} jam${body.data.sleep_quality ? " kualitas " + body.data.sleep_quality + "/5" : ""}\n`;
    msg += `• Air: ${body.data.water_liters ?? "-"} L\n`;
  } else {
    msg += "• data belum tersedia di Faza OS\n";
  }

  msg += "\n<b>Suplemen</b>\n";
  if (
    supplements.error &&
    /schema cache|does not exist|not found/i.test(supplements.error.message)
  ) {
    msg +=
      "• Struktur modulnya belum ada di database saat ini. Aku bisa bantu Codex menambahkannya.";
  } else {
    const low = (supplements.data ?? []).filter(
      (s: any) => Number(s.stock_quantity ?? 0) <= Number(s.low_stock_threshold ?? 0),
    );
    msg += low.length
      ? low
          .map((s: any) => `• ${esc(s.name)} stok ${s.stock_quantity ?? 0} ${esc(s.unit ?? "")}`)
          .join("\n")
      : "• Tidak ada stok rendah tercatat.";
  }

  await sendMessage(chatId, msg);
}

async function handleDebts(chatId: number, userId: string) {
  const sb = admin();
  const { data } = await sb
    .from("debts")
    .select("lender_name,remaining_balance,due_date")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("status", "active")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(10);
  if (!data || data.length === 0) {
    await sendMessage(chatId, "💳 Tidak ada hutang aktif, Tuan. 🎉");
    return;
  }
  let msg = `💳 <b>Hutang Aktif</b>\n\n`;
  for (const d of data)
    msg += `• ${esc(d.lender_name)} — ${fmtRp(Number(d.remaining_balance))}${d.due_date ? " (" + fmtDate(d.due_date) + ")" : ""}\n`;
  await sendMessage(chatId, msg);
}

async function handleReceivables(chatId: number, userId: string) {
  const sb = admin();
  const { data } = await sb
    .from("receivables")
    .select("borrower_name,remaining_amount,promised_payment_date")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("status", "active")
    .order("promised_payment_date", { ascending: true, nullsFirst: false })
    .limit(10);
  if (!data || data.length === 0) {
    await sendMessage(chatId, "💰 Tidak ada piutang aktif, Tuan.");
    return;
  }
  let msg = `💰 <b>Piutang Aktif</b>\n\n`;
  for (const r of data)
    msg += `• ${esc(r.borrower_name)} — ${fmtRp(Number(r.remaining_amount))}${r.promised_payment_date ? " (" + fmtDate(r.promised_payment_date) + ")" : ""}\n`;
  await sendMessage(chatId, msg);
}

async function handleFocus(chatId: number, userId: string) {
  const sb = admin();
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const { data } = await sb
    .from("academic_tasks")
    .select("id,title,priority,due_date")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .neq("status", "done")
    .in("priority", ["urgent", "high"])
    .or(`due_date.is.null,due_date.lte.${in3}`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(3);
  if (!data || data.length === 0) {
    await sendMessage(
      chatId,
      "🎯 Tidak ada fokus mendesak, Tuan. Tambahkan fokus manual atau lakukan deep work.",
    );
    return;
  }
  let msg = `🎯 <b>Today Focus</b>\n\n`;
  for (let i = 0; i < data.length; i++) {
    const t = data[i];
    const p = t.priority === "high" ? "🔴" : "🟠";
    msg += `${i + 1}. ${p} <b>${esc(t.title)}</b>${t.due_date ? " — " + fmtDate(t.due_date) : ""}\n`;
  }
  await sendMessage(chatId, msg);
}

async function handleBrief(chatId: number, userId: string) {
  const sb = admin();
  const today = todayWIB();
  const [{ data: events }, { data: tasks }, { data: workout }] = await Promise.all([
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
      .from("academic_tasks")
      .select("title,due_date,priority")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .neq("status", "done")
      .in("priority", ["urgent", "high"])
      .order("due_date")
      .limit(5),
    sb
      .from("workout_plans")
      .select("title,status,workout_time")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("workout_date", today)
      .maybeSingle(),
  ]);
  let msg = `🌅 <b>Brief Hari Ini</b>\nSelamat pagi, Tuan.\n`;
  if (workout)
    msg += `\n💪 Workout: ${esc(workout.title)} — <i>${esc(workout.status)}</i>${workout.workout_time ? " @ " + workout.workout_time.slice(0, 5) : ""}\n`;
  if (events && events.length > 0) {
    msg += `\n📅 <b>Agenda:</b>\n`;
    for (const e of events)
      msg += `• ${new Date(e.starts_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} ${esc(e.title)}\n`;
  }
  if (tasks && tasks.length > 0) {
    msg += `\n📚 <b>Tugas mendesak:</b>\n`;
    for (const t of tasks)
      msg += `• ${esc(t.title)}${t.due_date ? " — " + fmtDate(t.due_date) : ""}\n`;
  }
  if ((!events || events.length === 0) && (!tasks || tasks.length === 0) && !workout) {
    msg += `\nHari ini lapang. Waktunya deep work atau istirahat berkualitas.\n`;
  }
  await sendMessage(chatId, msg);
}

async function handleToday(chatId: number, userId: string) {
  await handleFocus(chatId, userId);
  await handleAgenda(chatId, userId, 1);
  await handleMoney(chatId, userId);
  await handleWorkout(chatId, userId);
}

async function handleQuiet(chatId: number, userId: string, args: string) {
  const sb = admin();
  const m = args.match(/^\s*(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s*$/);
  if (!args.trim()) {
    const { data } = await sb
      .from("user_preferences")
      .select("quiet_hours_enabled,quiet_hours_start,quiet_hours_end")
      .eq("user_id", userId)
      .maybeSingle();
    const p = data ?? {};
    await sendMessage(
      chatId,
      `🌙 <b>Quiet Hours</b>\n\nStatus: <b>${(p as any).quiet_hours_enabled ? "aktif" : "nonaktif"}</b>\nMulai: <b>${(p as any).quiet_hours_start ?? "22:00"}</b>\nSelesai: <b>${(p as any).quiet_hours_end ?? "05:30"}</b>\n\nUbah: <code>/quiet 22:00 05:30</code>`,
    );
    return;
  }
  if (!m) {
    await sendMessage(chatId, "Format: <code>/quiet 22:00 05:30</code>");
    return;
  }
  await setPref(userId, {
    quiet_hours_enabled: true,
    quiet_hours_start: m[1],
    quiet_hours_end: m[2],
  });
  await sendMessage(chatId, `✅ Quiet hours diatur: <b>${esc(m[1])}</b> — <b>${esc(m[2])}</b>.`);
}

async function handleSora(chatId: number) {
  await sendMessage(
    chatId,
    "🧠 <b>Sora Brain</b>\n\nAsisten AI Tuan. Perintah tersedia:\n\n" +
      "• /analisis_uang — analisis keuangan\n" +
      "• /analisis_tugas — prioritas tugas\n" +
      "• /analisis_bisnis — analisis bisnis\n" +
      "• /analisis_workout — evaluasi workout\n" +
      "• /ringkas_minggu — ringkas minggu ini\n\n" +
      "Untuk obrolan penuh, buka Faza OS → More → Sora Brain.",
  );
}

// ============ MAIN DISPATCHER ============

async function handleUpdate(update: any) {
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const data = String(cq.data || "");
    if (!chatId) return;
    const uid = await findUser(chatId);
    if (!uid) {
      await answerCallback(cq.id, "Akun belum ditautkan.");
      return;
    }
    const sb = admin();

    if (data === "money") {
      await answerCallback(cq.id);
      await handleMoney(chatId, uid);
      return;
    }
    if (data === "bills") {
      await answerCallback(cq.id);
      await handleBills(chatId, uid);
      return;
    }

    if (data.startsWith("task_done:")) {
      const id = data.split(":")[1];
      await sb
        .from("academic_tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", uid);
      await answerCallback(cq.id, "✓ Selesai");
      try {
        await editMessage(
          chatId,
          cq.message.message_id,
          cq.message.text + "\n\n<i>✓ Diperbarui</i>",
        );
      } catch {
        /* */
      }
      return;
    }
    if (data.startsWith("bill_paid:")) {
      const id = data.split(":")[1];
      await sb.from("bills").update({ status: "paid" }).eq("id", id).eq("user_id", uid);
      await answerCallback(cq.id, "💸 Ditandai lunas");
      return;
    }
    if (data.startsWith("wo_done:")) {
      const id = data.split(":")[1];
      const { data: plan } = await sb
        .from("workout_plans")
        .select("workout_type,target_duration_minutes,target_intensity,workout_date,status")
        .eq("id", id)
        .eq("user_id", uid)
        .maybeSingle();
      if (plan && plan.status !== "completed") {
        await sb
          .from("workout_plans")
          .update({ status: "completed" })
          .eq("id", id)
          .eq("user_id", uid);
        await sb.from("workout_logs").insert({
          user_id: uid,
          workout_plan_id: id,
          workout_date: plan.workout_date,
          workout_type: plan.workout_type,
          duration_minutes: plan.target_duration_minutes ?? 30,
          intensity: plan.target_intensity ?? "moderate",
        });
      }
      await answerCallback(cq.id, "✅ Selesai");
      return;
    }
    if (data.startsWith("wo_skip:")) {
      const id = data.split(":")[1];
      await sb.from("workout_plans").update({ status: "skipped" }).eq("id", id).eq("user_id", uid);
      await answerCallback(cq.id, "⏭️ Di-skip");
      return;
    }
    if (data.startsWith("notif_toggle:")) {
      const key = data.split(":")[1];
      if (!isTelegramNotificationPrefKey(key)) {
        await answerCallback(cq.id, "Pilihan notifikasi tidak valid");
        return;
      }
      const { data: cur } = await sb
        .from("user_preferences")
        .select(key)
        .eq("user_id", uid)
        .maybeSingle();
      const current = (
        cur as Partial<Record<TelegramNotificationPrefKey, boolean | null>> | null
      )?.[key];
      const next = !(current ?? true);
      await sb
        .from("user_preferences")
        .upsert({ user_id: uid, [key]: next } as never, { onConflict: "user_id" });
      await answerCallback(cq.id, next ? "Diaktifkan" : "Dimatikan");
      await handleNotif(chatId, uid);
      return;
    }
    await answerCallback(cq.id);
    return;
  }

  const msg = update.message ?? update.edited_message;
  if (!msg?.chat?.id) return;
  const chatId: number = msg.chat.id;
  const text: string = (msg.text || "").trim();
  if (!text) return;

  // Log inbound (fire-and-forget)
  const inboundUid = await findUser(chatId);
  admin()
    .from("telegram_message_logs")
    .insert({
      user_id: inboundUid,
      chat_id: chatId,
      direction: "in",
      message_text: text.slice(0, 500),
      status: "received",
    })
    .then(
      () => {},
      () => {},
    );

  // Commands
  const cmdMatch = text.match(/^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/s);
  if (cmdMatch) {
    const cmd = cmdMatch[1].toLowerCase();
    const args = cmdMatch[2] ?? "";

    // Public bootstrap: only reveals the Telegram chat ID needed for manual registration.
    if (cmd === "start") return handleStart(chatId);

    // Everything else requires linked account
    const u = await requireLinked(chatId);
    if (!u) return;

    switch (cmd) {
      case "menu":
        return handleMenu(chatId);
      case "unlink":
        return handleUnlink(chatId, u);
      case "brief":
        return handleBrief(chatId, u);
      case "today":
        return handleToday(chatId, u);
      case "fokus":
        return handleFocus(chatId, u);
      case "jadwal":
        return handleAgenda(chatId, u, 1);
      case "agenda":
        return handleAgenda(chatId, u, 3);
      case "agenda_minggu":
        return handleAgenda(chatId, u, 30);
      case "uang":
        return handleMoney(chatId, u);
      case "catat":
      case "pengeluaran":
        return handleQuickTxn(chatId, u, args, "expense");
      case "pemasukan":
        return handleQuickTxn(chatId, u, args, "income");
      case "tugas":
        return handleTasks(chatId, u);
      case "tugas_baru":
        return handleQuickTask(chatId, u, args);
      case "tagihan":
        return handleBills(chatId, u);
      case "hutang":
        return handleDebts(chatId, u);
      case "piutang":
        return handleReceivables(chatId, u);
      case "bisnis":
        return handleBusiness(chatId, u);
      case "health":
        return handleHealth(chatId, u);
      case "workout":
        return handleWorkout(chatId, u);
      case "workout_done":
        return handleWorkoutDone(chatId, u);
      case "workout_skip":
        return handleWorkoutSkip(chatId, u);
      case "berat":
        return handleWeight(chatId, u, args);
      case "tidur":
        return handleSleep(chatId, u, args);
      case "air":
        return handleWater(chatId, u, args);
      case "body":
        return handleBody(chatId, u);
      case "notif":
        return handleNotif(chatId, u);
      case "notif_on":
        await setPref(u, { telegram_enabled: true });
        return sendMessage(chatId, "✅ Notifikasi Telegram diaktifkan, Tuan.");
      case "notif_off":
        await setPref(u, { telegram_enabled: false });
        return sendMessage(chatId, "🔕 Notifikasi Telegram dimatikan.");
      case "notif_morning_on":
        await setPref(u, { notify_morning_brief: true, notify_daily_digest: true });
        return sendMessage(chatId, "🌅 Brief pagi aktif.");
      case "notif_morning_off":
        await setPref(u, { notify_morning_brief: false, notify_daily_digest: false });
        return sendMessage(chatId, "🌅 Brief pagi dimatikan.");
      case "notif_workout_on":
        await setPref(u, { notify_workout: true });
        return sendMessage(chatId, "💪 Reminder workout aktif.");
      case "notif_workout_off":
        await setPref(u, { notify_workout: false });
        return sendMessage(chatId, "💪 Reminder workout dimatikan.");
      case "quiet":
        return handleQuiet(chatId, u, args);
      case "sora":
      case "ask": {
        if (!args.trim()) {
          await sendMessage(
            chatId,
            "🧠 Tulis pertanyaannya, contoh:\n<code>/sora hari ini aku harus fokus apa?</code>",
          );
          return;
        }
        return runSoraSafely(chatId, u, args.trim());
      }
    }

    // Known command but no direct handler → route to Sora
    const known = BOT_COMMANDS.find((c) => c.command === cmd);
    if (known) {
      await sendMessage(chatId, "Aku proses lewat Sora ya, Tuan.");
      return runSoraSafely(chatId, u, `${cmd} ${args}`.trim());
    }
    await sendMessage(chatId, "Aku proses lewat Sora ya, Tuan.");
    return runSoraSafely(chatId, u, `${cmd} ${args}`.trim());
  }

  // Plain natural language → route to Sora
  const u = await requireLinked(chatId);
  if (!u) return;
  return runSoraSafely(chatId, u, text);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = envValue("TELEGRAM_API_KEY", "TELEGRAM_BOT_TOKEN");
        if (!apiKey) return new Response("Not configured", { status: 503 });
        const expected = deriveSecret(apiKey);
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

        let update: any;
        try {
          update = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        // Idempotency: dedupe by update_id
        const updateId = update?.update_id ? String(update.update_id) : null;
        if (updateId) {
          const sb = admin();
          const { error: dupErr } = await sb
            .from("telegram_update_dedupes")
            .insert({ update_id: updateId });
          if (dupErr && /duplicate|unique/i.test(dupErr.message)) {
            return Response.json({ ok: true, dedup: true });
          }
        }

        try {
          await handleUpdate(update);
        } catch (err) {
          console.error("[tg webhook]", err);
          const chatId = update?.message?.chat?.id ?? update?.edited_message?.chat?.id;
          if (chatId) {
            try {
              await sendMessage(
                Number(chatId),
                "Faza OS menerima pesanmu, tapi server sedang gagal memproses. Coba lagi sebentar ya, Tuan.",
              );
            } catch {
              // Avoid leaking nested Telegram errors to Telegram webhook response.
            }
          }
          return Response.json({ error: "Internal webhook error." }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ error: "Method not allowed." }, { status: 405 }),
      PUT: async () => Response.json({ error: "Method not allowed." }, { status: 405 }),
      PATCH: async () => Response.json({ error: "Method not allowed." }, { status: 405 }),
      DELETE: async () => Response.json({ error: "Method not allowed." }, { status: 405 }),
    },
  },
});
