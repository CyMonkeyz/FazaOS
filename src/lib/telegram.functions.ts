import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  sendMessage,
  REMOVE_KEYBOARD,
  fmtRp,
  registerBotCommands,
  isTelegramConfigured,
  PUBLIC_BOT_COMMANDS,
} from "./telegram-bot.server";
import { getUpcomingGoogleCalendarEvents } from "./google-calendar.server";

export const sendTelegramTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: link } = await supabase
      .from("telegram_users")
      .select("chat_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!link?.chat_id) throw new Error("Telegram belum ditautkan.");
    await sendMessage(
      Number(link.chat_id),
      "✅ <b>Faza OS</b> terhubung. Test message dari Tuan.",
      { reply_markup: REMOVE_KEYBOARD },
    );
    return { ok: true };
  });

const telegramChatIdSchema = z.object({
  chatId: z.coerce.number().int().positive("Chat ID Telegram harus berupa angka positif."),
});

export const saveTelegramChatId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => telegramChatIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("telegram_users").upsert(
      {
        user_id: userId,
        chat_id: data.chatId,
        linked_at: new Date().toISOString(),
        link_code: null,
        link_code_expires_at: null,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        throw new Error("Chat ID ini sudah terdaftar untuk akun lain.");
      }
      throw error;
    }
    return { ok: true };
  });

/** Generate a 6-digit code to link current user's Faza OS account with a Telegram chat. */
export const generateTelegramLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("telegram_users")
      .upsert(
        { user_id: userId, link_code: code, link_code_expires_at: expires },
        { onConflict: "user_id" },
      );
    if (error) throw error;
    return { code, expiresAt: expires };
  });

export const sendDailyDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: link } = await supabase
      .from("telegram_users")
      .select("chat_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!link?.chat_id)
      throw new Error("Telegram belum ditautkan. Masukkan Chat ID Telegram di halaman More.");

    const startMonth = new Date();
    startMonth.setDate(1);
    const startIso = startMonth.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const [txn, tasks, bills] = await Promise.all([
      supabase
        .from("transactions")
        .select("type,amount")
        .is("deleted_at", null)
        .gte("date", startIso),
      supabase
        .from("academic_tasks")
        .select("title,due_date")
        .is("deleted_at", null)
        .neq("status", "done")
        .not("due_date", "is", null)
        .gte("due_date", today)
        .order("due_date")
        .limit(5),
      supabase
        .from("bills")
        .select("name,amount,due_date")
        .is("deleted_at", null)
        .eq("status", "upcoming")
        .order("due_date")
        .limit(5),
    ]);

    const income = (txn.data ?? [])
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);
    const expense = (txn.data ?? [])
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);

    let msg = `🌅 <b>Ringkasan Faza OS</b>\n\n`;
    msg += `💰 <b>Uang bulan ini</b>\n  Masuk: ${fmtRp(income)}\n  Keluar: ${fmtRp(expense)}\n  Sisa: ${fmtRp(income - expense)}\n\n`;
    if ((tasks.data ?? []).length > 0) {
      msg += `📚 <b>Tugas mendekat</b>\n`;
      for (const t of tasks.data!) msg += `  • ${t.title} (${t.due_date})\n`;
      msg += `\n`;
    }
    if ((bills.data ?? []).length > 0) {
      msg += `🧾 <b>Tagihan</b>\n`;
      for (const b of bills.data!)
        msg += `  • ${b.name}: ${fmtRp(Number(b.amount))} (${b.due_date})\n`;
    }
    await sendMessage(Number(link.chat_id), msg);
    return { ok: true };
  });

/** Register bot commands with Telegram (setMyCommands). Shows the / menu in Telegram clients. */
export const registerTelegramCommands = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    if (!isTelegramConfigured()) throw new Error("Telegram belum dikonfigurasi.");
    await registerBotCommands();
    return { ok: true, count: PUBLIC_BOT_COMMANDS.length };
  });

/** Return real integration status (Telegram + Google Calendar) — no static "Terhubung". */
export const getIntegrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: tg } = await supabase
      .from("telegram_users")
      .select("chat_id,linked_at")
      .eq("user_id", userId)
      .maybeSingle();

    // Live-check Google Calendar via manual Google OAuth refresh token.
    let gcal: { connected: boolean; error?: string; eventCountUpcoming?: number } = {
      connected: false,
    };
    try {
      const result = await getUpcomingGoogleCalendarEvents(30, 50);
      gcal = {
        connected: result.configured && !result.error,
        eventCountUpcoming: result.events.length,
        error: result.configured ? result.error : "Google Calendar belum dikonfigurasi di .env.",
      };
    } catch (e) {
      gcal = { connected: false, error: e instanceof Error ? e.message : "unknown" };
    }

    return {
      telegram: {
        configured: isTelegramConfigured(),
        linked: !!tg?.chat_id,
        chatId: tg?.chat_id ?? null,
        linkedAt: tg?.linked_at ?? null,
      },
      googleCalendar: gcal,
    };
  });

export type NotifPrefs = {
  notify_morning_brief: boolean;
  notify_midday_check: boolean;
  notify_night_review: boolean;
  notify_workout: boolean;
  notify_debt_due: boolean;
  notify_receivable_due: boolean;
  notify_deadline: boolean;
  notify_habits: boolean;
  show_amounts_in_telegram: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export const getNotifPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_preferences")
      .select(
        "notify_morning_brief,notify_midday_check,notify_night_review,notify_workout,notify_debt_due,notify_receivable_due,notify_deadline,notify_habits,show_amounts_in_telegram,quiet_hours_enabled,quiet_hours_start,quiet_hours_end",
      )
      .eq("user_id", userId)
      .maybeSingle();
    return (data ?? {}) as Partial<NotifPrefs>;
  });

export const updateNotifPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: Partial<NotifPrefs>) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw error;
    return { ok: true };
  });
