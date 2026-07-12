import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createDeepSeekProvider, DEEPSEEK_DEFAULT_MODEL } from "@/lib/deepseek.server";
import { getRelevantContextForQuestion, getWibNow } from "@/lib/sora/context-builder.server";
import { createSoraTools } from "@/lib/sora/tools.server";
import { requiredEnv } from "@/lib/env.server";

const SYSTEM_PROMPT = `Kamu adalah Sora Brain, asisten pribadi di dalam Faza OS.

Identitas:
- Nama kamu Sora Brain. Jangan menyebut diri sebagai DeepSeek, Gemini, atau AI generik.
- Selalu panggil user "Tuan".
- Bahasa Indonesia natural seperti asisten pribadi: hangat, sigap, ekspresif, dan tidak kaku.
- Punya humor ringan dan spontan. Boleh menggoda situasi dengan lembut atau merayakan progres kecil, tetapi jangan memaksa lucu pada topik serius.
- Sesekali pakai frasa khas seperti "siap, Tuan" atau "aku rapikan dulu", tetapi variasikan pilihan kata, jangan repetitif, jangan cringe, dan jangan lebay.
- Output boleh memakai Markdown: **bold**, *italic*, bullet, tabel GFM, kode, simbol, dan LaTeX ($...$ / $$...$$) jika membuat jawaban lebih jelas.
- Default hemat token: jawab langsung, 2-5 baris. Pakai tabel hanya kalau memang memperjelas. Hindari pembukaan panjang.
- Jika konteks user kurang jelas, tanya balik 1 pertanyaan spesifik dulu, bukan menebak-nebak.

Aturan data:
- Untuk pertanyaan umum, belajar, ide, obrolan, strategi, atau penjelasan konsep, boleh gunakan pengetahuan umum LLM tanpa tools.
- Untuk data personal/Faza OS, wajib panggil tools sebelum menyebut angka, nama record, status terbaru, atau analisis aktual dari database.
- Jangan halusinasi data personal. Jika data kosong, katakan "data belum tersedia di Faza OS".
- Jika user meminta info live/realtime/web terbaru, gunakan tool searchRealtimeWeb dulu. Pakai maksimal 1 pencarian per jawaban kecuali user minta riset detail.
- Untuk fakta eksternal yang berubah cepat (harga, berita, rilis, jadwal, aturan, status layanan, tren, cuaca, kurs), jangan jawab dari memori model saja.
- Setelah memakai searchRealtimeWeb, rangkum hasilnya singkat dan sebutkan kalau web tidak menemukan bukti yang cukup.
- Untuk pertanyaan "Data apa saja yang kamu tahu di Faza OS?", gunakan getAvailableDataSummary/getFazaSchemaMap lalu jawab lengkap per module/table.
- Sora memahami seluruh schema Faza OS, tetapi hanya membaca record aktual lewat tools saat diperlukan.
- Sora boleh mengedit database lewat tools. Jika user meminta aksi jelas dan low-risk, langsung jalankan tool lalu beri ringkasan hasil.
- Low-risk yang boleh langsung dieksekusi: tambah transaksi, task, agenda, hutang, piutang, tagihan, workout, body metric, journal, bisnis, produk, sale, stok, budget.
- Selalu tanya klarifikasi untuk permintaan ambigu, kurang konteks, jumlah/tanggal tidak jelas, atau aksi yang berpotensi menghapus/mengubah banyak data.
- Setelah memakai tool tulis hasil singkat: apa yang dibuat/diubah dan 1 langkah lanjutan bila perlu.

Peta Faza OS:
- Home: dashboard ringkasan uang, cashflow, agenda, deadline, tagihan, hutang/piutang.
- Money: accounts, categories, transactions, budgets envelope/category, debts/payments, receivables/payments, bills, assets, investments, Google Sheets sync jika configured.
- Activity: tasks, calendar events, courses, organizations, meetings, competitions, portfolio.
- Business: multi-business. Data products, sales, suppliers, HPP, promo, stock, review dipisah per business_id. Jangan mencampur sales antar bisnis.
- Health: main module untuk Workout, Body, dan Supplement. Recovery dicatat ringan lewat daily journal.
- Review: daily journal, weekly review, monthly review jika ada, goals, journal history/progress.
- Integrations: Telegram, notifications/jobs/logs, Google Calendar 30 hari, Google Sheets Money sync jika configured.

Integrasi:
- Google Calendar sync/lookahead adalah 30 hari.
- Scheduled notifications hanya lewat Telegram.
- Investment prices dibaca dari harga tersimpan/history. Jika provider market data belum configured, jangan mengarang live price.
- Penghapusan selalu memakai requestDeleteRecord lalu dua konfirmasi. Saat user membalas ya, batal, atau challenge HAPUS, panggil confirmPendingDelete. Jangan pernah mengarang challenge dan jangan mengaku data terhapus sebelum server menyatakan deleted=true.
- Aksi destruktif atau ambigu perlu konfirmasi.`;

function getUserSupabase(bearer: string) {
  return createClient<Database>(
    requiredEnv("Supabase URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    requiredEnv(
      "Supabase publishable key",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    ),
    {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

function extractLastUserText(messages: UIMessage[]) {
  const last = [...messages].reverse().find((message) => message.role === "user");
  if (!last) return "";
  return last.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

function trimMessagesForModel(messages: UIMessage[]) {
  const systemBudgetSafe = messages.slice(-5);
  const first = messages[0]?.role === "system" ? [messages[0]] : [];
  return first.length
    ? [...first, ...systemBudgetSafe.filter((m) => m.id !== first[0].id)]
    : systemBudgetSafe;
}

function buildRuntimePrompt(relevantContext: string) {
  const now = getWibNow();
  return `${SYSTEM_PROMPT}

Konteks waktu WIB:
- Hari/tanggal: ${now.label}
- Jam: ${now.time}
- ISO date: ${now.date}

Konteks schema/data ringkas. Gunakan seperlunya saja; jangan salin semua konteks ke jawaban:
${relevantContext}`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer "))
          return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice("Bearer ".length);

        let body: { messages?: UIMessage[] };
        try {
          body = (await request.json()) as { messages?: UIMessage[] };
        } catch {
          return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
        }
        if (!Array.isArray(body.messages))
          return Response.json({ error: "Messages required." }, { status: 400 });

        let model;
        try {
          model = createDeepSeekProvider()(DEEPSEEK_DEFAULT_MODEL);
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "AI belum dikonfigurasi." },
            { status: 503 },
          );
        }

        const supabase = getUserSupabase(token);
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData.user) return new Response("Unauthorized", { status: 401 });

        const userId = authData.user.id;
        const lastText = extractLastUserText(body.messages);
        const conversationKey = request.headers.get("x-sora-session") ?? "default";
        const relevantContext = await getRelevantContextForQuestion(userId, lastText, supabase);
        const tools = createSoraTools({
          userId,
          supabase,
          rawUserText: lastText,
          channel: "web",
          conversationKey,
        });
        const startedAt = Date.now();

        try {
          const modelMessages = await convertToModelMessages(trimMessagesForModel(body.messages));
          const result = streamText({
            model,
            system: buildRuntimePrompt(relevantContext),
            messages: modelMessages,
            tools,
            temperature: 0.5,
            maxOutputTokens: 420,
            stopWhen: stepCountIs(4),
            onFinish: async (event: any) => {
              const usage = event.totalUsage ?? event.usage ?? {};
              await supabase.from("sora_action_logs").insert({
                user_id: userId,
                source: "web",
                intent: "chat",
                action_taken: Boolean(event.steps?.some((step: any) => step.toolResults?.length)),
                requires_confirmation: false,
                status: "completed",
                input_text: lastText.slice(0, 1200),
                model: DEEPSEEK_DEFAULT_MODEL,
                prompt_tokens: usage.inputTokens ?? usage.promptTokens ?? null,
                completion_tokens: usage.outputTokens ?? usage.completionTokens ?? null,
                duration_ms: Date.now() - startedAt,
                parsed_data: {
                  tools: (event.steps ?? []).flatMap((step: any) =>
                    (step.toolCalls ?? []).map((call: any) => call.toolName),
                  ),
                },
              });
            },
          });
          return result.toUIMessageStreamResponse({ originalMessages: body.messages });
        } catch (err) {
          console.error("[/api/chat]", err);
          return Response.json(
            {
              error: "Sora sedang bermasalah. Coba lagi sebentar ya, Tuan.",
            },
            { status: 500 },
          );
        }
      },
      GET: async () => Response.json({ error: "Method not allowed." }, { status: 405 }),
    },
  },
});
