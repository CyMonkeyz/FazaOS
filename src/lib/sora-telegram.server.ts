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
import {
  continueServerDelete,
  getPendingDeleteSummary,
  prepareServerDelete,
} from "@/lib/sora/pending-actions.server";
import {
  getUnifiedMemory,
  rememberExplicit,
  saveConversationMessage,
} from "@/lib/sora/memory.server";

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
  return esc(text.replace(/[—–]/g, "-"))
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/__(.*?)__/g, "<b>$1</b>")
    .replace(/\n{3,}/g, "\n\n");
}

const THINKING_LINES = [
  "Sora lagi menyusun puzzle-nya, Tuan... 🧩",
  "Sebentar, neuron virtual Sora lagi pemanasan... ⚡",
  "Sora sedang meracik jawaban yang nggak hambar... ✨",
];

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

function confirmationValue(_text: string) {
  return null;
}

async function getPendingAction(
  _sb: SupabaseClient<Database>,
  _userId: string,
  _chatId: number,
): Promise<SoraActionResult | null> {
  // Legacy one-step confirmations are intentionally disabled. New actions use sora_pending_actions.
  return null;
}

async function clearPendingAction(_sb: SupabaseClient<Database>, _userId: string, _chatId: number) {
  // Kept only to make old in-flight code harmless while sessions migrate to the server-owned flow.
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
    await saveConversationMessage(
      userId,
      "telegram",
      String(chatId),
      direction === "in" ? "user" : "assistant",
      text,
      sb,
    );
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
  const [context, memory, unifiedMemory, webResults] = await Promise.all([
    getRelevantContextForQuestion(userId, text, sb),
    getTelegramMemory(sb, userId),
    getUnifiedMemory(
      userId,
      String(
        (await sb.from("telegram_users").select("chat_id").eq("user_id", userId).maybeSingle()).data
          ?.chat_id ?? "telegram",
      ),
      sb,
    ),
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
            "Gaya: Bahasa Indonesia natural, hangat, pintar, ekspresif, dan punya selera humor ringan. Boleh menggoda situasi dengan lembut, memberi reaksi spontan, atau merayakan progres kecil, tetapi jangan memaksa lucu saat topiknya serius. " +
            "Pakai 0-2 emoji yang relevan, variasikan pilihan kata, jangan repetitif, jangan cringe, dan jangan mengorbankan kejelasan demi bercanda. " +
            "Jawab hemat token: default maksimal 5 baris untuk Telegram, kecuali user minta detail. " +
            "Kalau konteks kurang jelas, tanya 1 pertanyaan spesifik dulu. " +
            "Untuk pertanyaan umum boleh pakai pengetahuan umum LLM. Untuk data personal Faza OS, gunakan hanya konteks DB dan memori 48 jam yang diberikan. Jangan mengarang angka/nama personal. " +
            "Jika WEB_CONTEXT tersedia, anggap itu hasil cek internet terbaru dan gunakan untuk fakta eksternal. Jika WEB_CONTEXT tidak tersedia padahal user minta info live, bilang belum berhasil verifikasi live lalu beri jawaban umum yang aman. " +
            "Jika data Faza OS kosong, katakan 'data belum tersedia di Faza OS'. " +
            "Health adalah modul utama. Business hanya dibaca dari snapshot Google Sheets per toko. Google Calendar lookahead 30 hari. Notifikasi terjadwal hanya Telegram. " +
            "Jangan gunakan em dash atau en dash; gunakan tanda hubung biasa. " +
            "Jangan menyebut diri DeepSeek/Gemini.",
        },
        {
          role: "system",
          content: `Waktu WIB: ${now.label}, ${now.time}.\n\n${unifiedMemory}\n\nMEMORI TELEGRAM 48 JAM:\n${memory}\n\nDATA FAZA OS:\n${context}${webContext ? `\n\n${webContext}` : ""}`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.55,
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
  await rememberExplicit(userId, text, "telegram", sb);

  try {
    const thinking = THINKING_LINES[Math.floor(Math.random() * THINKING_LINES.length)];
    const placeholder = (await sendMessage(chatId, `<i>${thinking}</i>`)) as
      { message_id?: number } | undefined;
    placeholderId = placeholder?.message_id ?? null;
  } catch {
    // Continue without placeholder.
  }

  try {
    const deleteContext = {
      userId,
      supabase: sb,
      rawUserText: text,
      channel: "telegram" as const,
      conversationKey: String(chatId),
    };
    if (await getPendingDeleteSummary(deleteContext)) {
      const continued = await continueServerDelete(deleteContext);
      const reply = continued.message;
      await sendFinal(chatId, placeholderId, reply);
      await logTelegramMemory(sb, userId, chatId, "out", reply);
      await logAction(sb, userId, text, {
        intent: "delete_record",
        confidence: 1,
        requiresConfirmation: Boolean(continued.needsConfirmation),
        module: "Unknown",
        data: continued,
        reply,
        actionTaken: Boolean(continued.deleted),
        status: continued.deleted ? "executed" : "needs_confirmation",
      });
      return;
    }

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
        const prepared = await prepareServerDelete(deleteContext, {
          table: String(routed.data.table ?? ""),
          recordId: String(routed.data.recordId),
        });
        const reply = prepared.message;
        await sendFinal(chatId, placeholderId, reply);
        await logTelegramMemory(sb, userId, chatId, "out", reply);
        await logAction(sb, userId, text, {
          ...routed,
          reply,
          requiresConfirmation: true,
          status: "needs_confirmation",
        });
        return;
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
