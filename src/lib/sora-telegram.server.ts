import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendMessage, editMessage, deleteMessage, esc } from "./telegram-bot.server";
import { createDeepSeekChatCompletion } from "@/lib/deepseek.server";
import {
  getAvailableDataSummary,
  getRelevantContextForQuestion,
  getWibNow,
} from "@/lib/sora/context-builder.server";
import {
  executeSoraAction,
  routeSoraAction,
  parseDeterministicAction,
} from "@/lib/sora/action-router.server";
import type { SoraActionResult } from "@/lib/sora/types";
import { envValue, requiredEnv } from "@/lib/env.server";
import { formatWebContext, searchWeb, shouldUseWebSearch } from "@/lib/sora/web-search.server";

function admin(): SupabaseClient<Database> {
  return createClient<Database>(
    requiredEnv("Supabase URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    requiredEnv("Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export const parseDeterministic = parseDeterministicAction;

function telegramSafe(text: string) {
  return esc(text)
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/__(.*?)__/g, "<b>$1</b>")
    .replace(/\n{3,}/g, "\n\n");
}

function shortIntentNeedsAi(result: SoraActionResult) {
  return [
    "answer_question",
    "analyze_money",
    "analyze_business",
    "analyze_activity",
    "analyze_health",
    "analyze_review",
    "analyze_investment",
    "generate_receivable_message",
    "get_today_summary",
    "get_schema_summary",
  ].includes(result.intent);
}

function confirmationValue(text: string) {
  if (/^(ya|iya|yes|y|oke|ok|lanjut|betul|hapus|confirm)\b/i.test(text.trim())) return true;
  if (/^(batal|tidak|no|gak|ga|jangan|cancel)\b/i.test(text.trim())) return false;
  return null;
}

async function logTelegramMemory(
  sb: SupabaseClient<Database>,
  userId: string,
  chatId: number,
  direction: "in" | "out",
  text: string,
  status = "sent",
) {
  try {
    await sb.from("telegram_message_logs").insert({
      user_id: userId,
      chat_id: chatId,
      direction,
      message_text: text.slice(0, 1200),
      status,
    });
  } catch {
    // Memory is helpful, not critical for the webhook response.
  }
}

async function cleanupOldTelegramMemory(sb: SupabaseClient<Database>, userId: string) {
  try {
    await (sb as any)
      .from("telegram_message_logs")
      .delete()
      .eq("user_id", userId)
      .lt("created_at", new Date(Date.now() - 48 * 3600000).toISOString());
  } catch {
    // Querying with a 48h window is the real boundary; cleanup is best effort.
  }
}

async function getTelegramMemory(sb: SupabaseClient<Database>, userId: string) {
  const since = new Date(Date.now() - 48 * 3600000).toISOString();
  try {
    const { data } = await sb
      .from("telegram_message_logs")
      .select("direction,message_text,created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(36);
    const rows = data ?? [];
    if (!rows.length) return "Tidak ada memori Telegram 48 jam terakhir.";
    return rows
      .map((row: any) => {
        const who = row.direction === "in" ? "Tuan" : "Sora";
        return `${who}: ${String(row.message_text ?? "")
          .replace(/\s+/g, " ")
          .slice(0, 220)}`;
      })
      .join("\n");
  } catch {
    return "Memori Telegram 48 jam terakhir belum bisa dibaca.";
  }
}

async function getPendingAction(
  sb: SupabaseClient<Database>,
  userId: string,
  chatId: number,
): Promise<SoraActionResult | null> {
  const { data } = await sb
    .from("sora_telegram_sessions")
    .select("pending_action,pending_action_expires_at")
    .eq("user_id", userId)
    .eq("chat_id", String(chatId))
    .maybeSingle();
  if (!data?.pending_action) return null;
  if (data.pending_action_expires_at && new Date(data.pending_action_expires_at) < new Date()) {
    await sb.from("sora_telegram_sessions").upsert(
      {
        user_id: userId,
        chat_id: String(chatId),
        pending_action: null,
        pending_action_expires_at: null,
      } as never,
      { onConflict: "user_id,chat_id" },
    );
    return null;
  }
  return data.pending_action as SoraActionResult;
}

async function savePendingAction(
  sb: SupabaseClient<Database>,
  userId: string,
  chatId: number,
  action: SoraActionResult,
) {
  await sb.from("sora_telegram_sessions").upsert(
    {
      user_id: userId,
      chat_id: String(chatId),
      last_intent: action.intent,
      pending_action: JSON.parse(JSON.stringify(action)),
      pending_action_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    } as never,
    { onConflict: "user_id,chat_id" },
  );
}

async function clearPendingAction(sb: SupabaseClient<Database>, userId: string, chatId: number) {
  await sb.from("sora_telegram_sessions").upsert(
    {
      user_id: userId,
      chat_id: String(chatId),
      pending_action: null,
      pending_action_expires_at: null,
    } as never,
    { onConflict: "user_id,chat_id" },
  );
}

async function buildSchemaCoverage(userId: string, sb: SupabaseClient<Database>) {
  const summary = await getAvailableDataSummary(userId, sb);
  const byModule = new Map<
    string,
    Array<{ table: string; count: number; implemented: boolean; available: boolean }>
  >();
  for (const table of summary.tables) {
    const list = byModule.get(table.module) ?? [];
    list.push({
      table: table.table,
      count: table.count,
      implemented: table.implemented,
      available: table.available,
    });
    byModule.set(table.module, list);
  }
  const lines = [
    "**Data yang aku tahu di Faza OS**",
    "Aku paham schema lengkap OS Tuan, tapi record aktual kubaca lewat tools saat dibutuhkan.",
    "",
  ];
  for (const [module, tables] of byModule) {
    lines.push(`**${module}**`);
    lines.push(
      tables
        .map((t) => {
          const state = t.available
            ? `${t.count} record`
            : t.implemented
              ? "belum terbaca"
              : "struktur terencana";
          return `- ${t.table}: ${state}`;
        })
        .join("\n"),
    );
  }
  lines.push("");
  lines.push(
    "Jika suatu tabel belum ada di database saat ini, aku akan bilang jelas, bukan pura-pura punya datanya.",
  );
  return lines.join("\n");
}

async function askDeepSeekForTelegram(userId: string, text: string, sb: SupabaseClient<Database>) {
  if (!envValue("DEEPSEEK_API_KEY")) {
    return "Sora belum bisa jawab karena DEEPSEEK_API_KEY belum dikonfigurasi di server.";
  }

  const now = getWibNow();
  const [context, memory, webResults] = await Promise.all([
    getRelevantContextForQuestion(userId, text, sb),
    getTelegramMemory(sb, userId),
    shouldUseWebSearch(text) ? searchWeb(text) : Promise.resolve([]),
  ]);
  const webContext = shouldUseWebSearch(text) ? formatWebContext(webResults) : "";
  try {
    const res = await createDeepSeekChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah Sora Brain, asisten pribadi Faza OS. Panggil user Tuan. " +
            "Gaya: Bahasa Indonesia natural, hangat, pintar, on point, sedikit menggemaskan; boleh pakai 0-2 emot/emoji yang relevan, jangan repetitif. " +
            "Jawab hemat token: default maksimal 5 baris untuk Telegram, kecuali user minta detail. " +
            "Kalau konteks kurang jelas, tanya 1 pertanyaan spesifik dulu. " +
            "Untuk pertanyaan umum boleh pakai pengetahuan umum LLM. Untuk data personal Faza OS, gunakan hanya konteks DB dan memori 48 jam yang diberikan. Jangan mengarang angka/nama personal. " +
            "Jika WEB_CONTEXT tersedia, anggap itu hasil cek internet terbaru dan gunakan untuk fakta eksternal. Jika WEB_CONTEXT tidak tersedia padahal user minta info live, bilang belum berhasil verifikasi live lalu beri jawaban umum yang aman. " +
            "Jika data Faza OS kosong, katakan 'data belum tersedia di Faza OS'. " +
            "Health adalah modul utama. Google Calendar lookahead 30 hari. Notifikasi terjadwal hanya Telegram. " +
            "Jangan menyebut diri DeepSeek/Gemini.",
        },
        {
          role: "system",
          content: `Waktu WIB: ${now.label}, ${now.time}.\n\nMEMORI TELEGRAM 48 JAM:\n${memory}\n\nDATA FAZA OS:\n${context}${webContext ? `\n\n${webContext}` : ""}`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.42,
      max_tokens: 280,
      signal: AbortSignal.timeout(12_000),
    });
    return res.choices?.[0]?.message?.content?.trim() || "Sora belum menemukan jawaban, Tuan.";
  } catch (err) {
    console.error("[sora telegram deepseek]", err);
    return "Sora timeout atau gagal menghubungi AI. Coba lagi sebentar ya, Tuan.";
  }
}

async function logAction(
  sb: SupabaseClient<Database>,
  userId: string,
  text: string,
  result: SoraActionResult,
) {
  try {
    await sb.from("sora_action_logs").insert({
      user_id: userId,
      source: "telegram",
      intent: result.intent,
      input_text: text.slice(0, 500),
      parsed_data: JSON.parse(JSON.stringify(result.data ?? {})),
      confidence: result.confidence,
      action_taken: !!result.actionTaken,
      requires_confirmation: !!result.requiresConfirmation,
      status: result.status ?? "answered",
    });
  } catch (err) {
    console.error("[sora telegram log]", err);
  }
}

async function sendFinal(chatId: number, placeholderId: number | null, reply: string) {
  const safe = telegramSafe(reply);
  if (placeholderId) {
    try {
      await editMessage(chatId, placeholderId, safe);
      return;
    } catch {
      await sendMessage(chatId, safe);
      try {
        await deleteMessage(chatId, placeholderId);
      } catch {
        // Best effort cleanup only.
      }
      return;
    }
  }
  await sendMessage(chatId, safe);
}

export async function handleSoraText(chatId: number, userId: string, text: string) {
  const sb = admin();
  let placeholderId: number | null = null;

  await cleanupOldTelegramMemory(sb, userId);
  await logTelegramMemory(sb, userId, chatId, "in", text, "received");

  try {
    const placeholder = (await sendMessage(chatId, "<i>Sora sedang berpikir...</i>")) as
      { message_id?: number } | undefined;
    placeholderId = placeholder?.message_id ?? null;
  } catch {
    // Continue without placeholder.
  }

  try {
    const pending = await getPendingAction(sb, userId, chatId);
    const confirmation = confirmationValue(text);
    if (pending && confirmation === false) {
      await clearPendingAction(sb, userId, chatId);
      const reply = "Oke, aku batalin ya, Tuan. Datanya tetap aman. 🙂";
      await sendFinal(chatId, placeholderId, reply);
      await logTelegramMemory(sb, userId, chatId, "out", reply);
      await logAction(sb, userId, text, {
        ...pending,
        reply,
        actionTaken: false,
        status: "answered",
      });
      return;
    }
    if (pending && confirmation === true) {
      const confirmedAction = {
        ...pending,
        requiresConfirmation: false,
        data: { ...pending.data, confirmed: true },
      };
      const result = await executeSoraAction(sb, userId, confirmedAction);
      await clearPendingAction(sb, userId, chatId);
      const reply = result.reply || "Selesai, Tuan.";
      await sendFinal(chatId, placeholderId, reply);
      await logTelegramMemory(sb, userId, chatId, "out", reply);
      await logAction(sb, userId, text, result);
      return;
    }
    if (pending) {
      const reply =
        'Aku masih nunggu konfirmasi untuk aksi sebelumnya, Tuan. Balas "ya" untuk lanjut atau "batal" untuk membatalkan dulu ya.';
      await sendFinal(chatId, placeholderId, reply);
      await logTelegramMemory(sb, userId, chatId, "out", reply);
      return;
    }

    const routed = await routeSoraAction({ userId, text, supabase: sb });

    if (!shortIntentNeedsAi(routed)) {
      if (
        routed.intent === "delete_record" &&
        routed.status === "needs_confirmation" &&
        routed.data.recordId
      ) {
        await savePendingAction(sb, userId, chatId, routed);
      }
      const reply = routed.reply || "Selesai, Tuan.";
      await sendFinal(chatId, placeholderId, reply);
      await logTelegramMemory(sb, userId, chatId, "out", reply);
      await logAction(sb, userId, text, routed);
      return;
    }

    const reply =
      routed.intent === "get_schema_summary"
        ? await buildSchemaCoverage(userId, sb)
        : await askDeepSeekForTelegram(userId, text, sb);

    await sendFinal(chatId, placeholderId, reply);
    await logTelegramMemory(sb, userId, chatId, "out", reply);
    await logAction(sb, userId, text, { ...routed, reply, status: "answered" });
  } catch (err) {
    console.error("[sora telegram]", err);
    const reply =
      "Sora lagi kesandung di server, Tuan. Pesannya sudah masuk, coba kirim sekali lagi sebentar ya.";
    await sendFinal(chatId, placeholderId, reply);
    await logTelegramMemory(sb, userId, chatId, "out", reply, "failed");
  }
}
