import { envValue, requiredEnv } from "./env.server";

function tgHeaders() {
  requiredEnv("Telegram", "TELEGRAM_API_KEY", "TELEGRAM_BOT_TOKEN");
  return {
    "Content-Type": "application/json",
  } as Record<string, string>;
}

export function isTelegramConfigured() {
  return !!envValue("TELEGRAM_API_KEY", "TELEGRAM_BOT_TOKEN");
}

export async function tgCall(method: string, body: unknown) {
  const token = requiredEnv("Telegram", "TELEGRAM_API_KEY", "TELEGRAM_BOT_TOKEN");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: tgHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.description || `Telegram gagal (${res.status})`);
  }
  return data.result;
}

/** Removes the legacy persistent reply keyboard from Telegram clients. */
export const REMOVE_KEYBOARD = { remove_keyboard: true } as const;

export function sendMessage(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
) {
  return tgCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

export function editMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  extra: Record<string, unknown> = {},
) {
  return tgCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

export function deleteMessage(chatId: number | string, messageId: number) {
  return tgCall("deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
}

export function answerCallback(id: string, text?: string) {
  return tgCall("answerCallbackQuery", { callback_query_id: id, text: text ?? "" });
}

export const fmtRp = (n: number) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Basic HTML escape for safe embedding of user-generated content into HTML parse_mode messages. */
export function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ============ CENTRAL COMMAND REGISTRY ============
// Single source of truth for /menu /help /commands, Telegram setMyCommands, and the More page.

export type BotCommand = {
  command: string;
  description: string;
  category: string;
  example?: string;
  requiresLink?: boolean;
  implemented?: boolean;
};

export const CATEGORIES = [
  "Basic",
  "Hari Ini",
  "Calendar & Agenda",
  "Money",
  "Debt & Bill",
  "Academic",
  "Activity",
  "Business",
  "Health",
  "Review & Goals",
  "Notifications",
  "Sora Brain",
] as const;

export const BOT_COMMANDS: BotCommand[] = [
  // Basic
  {
    command: "start",
    description: "Tampilkan Telegram Chat ID untuk disimpan di Faza OS.",
    category: "Basic",
    implemented: true,
  },
  {
    command: "menu",
    description: "Tampilkan menu utama dan daftar command.",
    category: "Basic",
    implemented: true,
  },
  {
    command: "help",
    description: "Tampilkan bantuan lengkap.",
    category: "Basic",
    implemented: true,
  },
  {
    command: "commands",
    description: "Tampilkan semua command dan deskripsi.",
    category: "Basic",
    implemented: true,
  },
  {
    command: "unlink",
    description: "Putuskan akun Telegram dari Faza OS.",
    category: "Basic",
    requiresLink: true,
    implemented: true,
  },

  // Hari Ini
  {
    command: "brief",
    description: "Kirim brief harian sekarang.",
    category: "Hari Ini",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "today",
    description: "Fokus, agenda, deadline, uang, workout hari ini.",
    category: "Hari Ini",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "fokus",
    description: "Lihat Today Focus.",
    category: "Hari Ini",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "fokus_done",
    description: "Tandai fokus tertentu selesai.",
    category: "Hari Ini",
    example: "/fokus_done 1",
    requiresLink: true,
  },
  {
    command: "fokus_skip",
    description: "Lewati fokus tertentu.",
    category: "Hari Ini",
    example: "/fokus_skip 1",
    requiresLink: true,
  },

  // Calendar & Agenda
  {
    command: "jadwal",
    description: "Agenda hari ini.",
    category: "Calendar & Agenda",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "agenda",
    description: "Agenda 3 hari ke depan.",
    category: "Calendar & Agenda",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "agenda_minggu",
    description: "Agenda 30 hari ke depan.",
    category: "Calendar & Agenda",
    requiresLink: true,
  },
  {
    command: "agenda_baru",
    description: "Tambah agenda baru.",
    category: "Calendar & Agenda",
    example: "/agenda_baru Rapat | 2026-07-05 14:00",
    requiresLink: true,
  },
  {
    command: "conflict",
    description: "Cek jadwal yang bentrok.",
    category: "Calendar & Agenda",
    requiresLink: true,
  },

  // Money
  {
    command: "uang",
    description: "Ringkasan keuangan bulan ini.",
    category: "Money",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "transaksi",
    description: "Lihat transaksi terakhir.",
    category: "Money",
    requiresLink: true,
  },
  {
    command: "catat",
    description: "Catat pengeluaran cepat.",
    category: "Money",
    example: "/catat 25000 kopi",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "pengeluaran",
    description: "Catat pengeluaran dengan kategori.",
    category: "Money",
    example: "/pengeluaran 25000 makan",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "pemasukan",
    description: "Catat pemasukan cepat.",
    category: "Money",
    example: "/pemasukan 500000 freelance",
    requiresLink: true,
    implemented: true,
  },
  { command: "budget", description: "Lihat status budget.", category: "Money", requiresLink: true },
  {
    command: "cashflow",
    description: "Estimasi cashflow bulan ini.",
    category: "Money",
    requiresLink: true,
  },

  // Debt & Bill
  {
    command: "hutang",
    description: "Lihat hutang aktif.",
    category: "Debt & Bill",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "hutang_baru",
    description: "Tambah hutang baru.",
    category: "Debt & Bill",
    example: "/hutang_baru Andi | 500000 | 2026-08-01",
    requiresLink: true,
  },
  {
    command: "hutang_bayar",
    description: "Catat pembayaran hutang.",
    category: "Debt & Bill",
    example: "/hutang_bayar ID 100000",
    requiresLink: true,
  },
  {
    command: "piutang",
    description: "Lihat piutang aktif.",
    category: "Debt & Bill",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "piutang_baru",
    description: "Tambah piutang baru.",
    category: "Debt & Bill",
    example: "/piutang_baru Budi | 200000 | 2026-07-20",
    requiresLink: true,
  },
  {
    command: "piutang_bayar",
    description: "Catat pembayaran piutang.",
    category: "Debt & Bill",
    example: "/piutang_bayar ID 100000",
    requiresLink: true,
  },
  {
    command: "tagih",
    description: "Buat pesan follow-up piutang.",
    category: "Debt & Bill",
    example: "/tagih ID",
    requiresLink: true,
  },
  {
    command: "tagihan",
    description: "Lihat tagihan mendekat.",
    category: "Debt & Bill",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "tagihan_bayar",
    description: "Tandai tagihan sudah dibayar.",
    category: "Debt & Bill",
    example: "/tagihan_bayar ID",
    requiresLink: true,
  },

  // Academic
  {
    command: "tugas",
    description: "Tugas mendekat.",
    category: "Academic",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "tugas_baru",
    description: "Tambah tugas baru.",
    category: "Academic",
    example: "/tugas_baru Skripsi Bab 2 | 2026-07-15",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "tugas_done",
    description: "Tandai tugas selesai.",
    category: "Academic",
    example: "/tugas_done ID",
    requiresLink: true,
  },
  {
    command: "tugas_urgent",
    description: "Tugas prioritas urgent/high.",
    category: "Academic",
    requiresLink: true,
  },
  {
    command: "kuliah",
    description: "Daftar mata kuliah.",
    category: "Academic",
    requiresLink: true,
  },
  {
    command: "revisi",
    description: "Catatan revisi aktif.",
    category: "Academic",
    requiresLink: true,
  },

  // Activity
  {
    command: "organisasi",
    description: "Organisasi dan action item.",
    category: "Activity",
    requiresLink: true,
  },
  { command: "rapat", description: "Jadwal rapat.", category: "Activity", requiresLink: true },
  {
    command: "lomba",
    description: "Lomba aktif dan deadline.",
    category: "Activity",
    requiresLink: true,
  },
  {
    command: "kepanitiaan",
    description: "Kegiatan kepanitiaan.",
    category: "Activity",
    requiresLink: true,
  },
  {
    command: "volunteer",
    description: "Kegiatan volunteer.",
    category: "Activity",
    requiresLink: true,
  },
  {
    command: "seminar",
    description: "Seminar/sertifikasi.",
    category: "Activity",
    requiresLink: true,
  },
  {
    command: "portfolio",
    description: "Item portfolio terbaru.",
    category: "Activity",
    requiresLink: true,
  },

  // Business
  {
    command: "bisnis",
    description: "Ringkasan bisnis bulan ini.",
    category: "Business",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "produk",
    description: "Lihat produk/menu.",
    category: "Business",
    requiresLink: true,
  },
  { command: "sales", description: "Penjualan terbaru.", category: "Business", requiresLink: true },
  {
    command: "penjualan",
    description: "Catat penjualan cepat.",
    category: "Business",
    example: "/penjualan Es Teh | 2 | 10000",
    requiresLink: true,
  },
  {
    command: "hpp",
    description: "Lihat HPP produk/menu.",
    category: "Business",
    requiresLink: true,
  },
  {
    command: "promo",
    description: "Simulasi promo aktif.",
    category: "Business",
    requiresLink: true,
  },
  { command: "stok", description: "Stok menipis.", category: "Business", requiresLink: true },
  {
    command: "stok_tambah",
    description: "Tambah stok item.",
    category: "Business",
    example: "/stok_tambah Kopi | 50",
    requiresLink: true,
  },
  {
    command: "supplier",
    description: "Daftar supplier.",
    category: "Business",
    requiresLink: true,
  },

  // Health
  {
    command: "health",
    description: "Workout & health hari ini.",
    category: "Health",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "workout",
    description: "Workout hari ini.",
    category: "Health",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "workout_plan",
    description: "Buat rencana workout cepat.",
    category: "Health",
    example: "/workout_plan strength besok 30 menit",
    requiresLink: true,
  },
  {
    command: "workout_done",
    description: "Tandai workout hari ini selesai.",
    category: "Health",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "workout_skip",
    description: "Skip workout hari ini.",
    category: "Health",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "workout_log",
    description: "Catat workout manual.",
    category: "Health",
    example: "/workout_log strength 45 hard",
    requiresLink: true,
  },
  {
    command: "berat",
    description: "Catat berat badan hari ini.",
    category: "Health",
    example: "/berat 70.5",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "tidur",
    description: "Catat tidur & kualitas.",
    category: "Health",
    example: "/tidur 7 kualitas 4",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "air",
    description: "Catat konsumsi air (liter).",
    category: "Health",
    example: "/air 2.5",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "body",
    description: "Ringkasan body metrics terbaru.",
    category: "Health",
    requiresLink: true,
    implemented: true,
  },

  // Review & Goals
  {
    command: "review",
    description: "Mulai review harian/mingguan.",
    category: "Review & Goals",
    requiresLink: true,
  },
  {
    command: "daily",
    description: "Isi daily log singkat.",
    category: "Review & Goals",
    requiresLink: true,
  },
  {
    command: "weekly",
    description: "Weekly review terbaru.",
    category: "Review & Goals",
    requiresLink: true,
  },
  { command: "goal", description: "Goals aktif.", category: "Review & Goals", requiresLink: true },
  {
    command: "goal_baru",
    description: "Tambah goal baru.",
    category: "Review & Goals",
    example: "/goal_baru Lulus 2026 | 2026-12-31",
    requiresLink: true,
  },

  // Notifications
  {
    command: "notif",
    description: "Status notifikasi.",
    category: "Notifications",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "notif_on",
    description: "Aktifkan notifikasi Telegram.",
    category: "Notifications",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "notif_off",
    description: "Matikan notifikasi Telegram.",
    category: "Notifications",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "notif_morning_on",
    description: "Aktifkan brief pagi.",
    category: "Notifications",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "notif_morning_off",
    description: "Matikan brief pagi.",
    category: "Notifications",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "notif_workout_on",
    description: "Aktifkan reminder workout.",
    category: "Notifications",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "notif_workout_off",
    description: "Matikan reminder workout.",
    category: "Notifications",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "quiet",
    description: "Lihat / atur quiet hours.",
    category: "Notifications",
    example: "/quiet 22:00 05:30",
    requiresLink: true,
    implemented: true,
  },

  // Sora Brain
  {
    command: "sora",
    description: "Menu bantuan Sora Brain.",
    category: "Sora Brain",
    requiresLink: true,
    implemented: true,
  },
  {
    command: "analisis_uang",
    description: "Analisis singkat keuangan.",
    category: "Sora Brain",
    requiresLink: true,
  },
  {
    command: "analisis_tugas",
    description: "Prioritas tugas minggu ini.",
    category: "Sora Brain",
    requiresLink: true,
  },
  {
    command: "analisis_bisnis",
    description: "Analisis bisnis singkat.",
    category: "Sora Brain",
    requiresLink: true,
  },
  {
    command: "analisis_health",
    description: "Evaluasi workout & health.",
    category: "Sora Brain",
    requiresLink: true,
  },
  {
    command: "ringkas_minggu",
    description: "Ringkas minggu ini dari data Faza OS.",
    category: "Sora Brain",
    requiresLink: true,
  },
];

const CATEGORY_ORDER: Record<string, number> = Object.fromEntries(CATEGORIES.map((c, i) => [c, i]));

const PUBLIC_COMMAND_NAMES = new Set([
  "start",
  "menu",
  "unlink",
  "brief",
  "today",
  "fokus",
  "jadwal",
  "agenda",
  "notif",
  "notif_on",
  "notif_off",
]);

export const PUBLIC_BOT_COMMANDS = BOT_COMMANDS.filter((command) =>
  PUBLIC_COMMAND_NAMES.has(command.command),
);

export function groupCommandsByCategory(): Array<{ category: string; items: BotCommand[] }> {
  const map = new Map<string, BotCommand[]>();
  for (const c of PUBLIC_BOT_COMMANDS) {
    if (!map.has(c.category)) map.set(c.category, []);
    map.get(c.category)!.push(c);
  }
  return Array.from(map.entries())
    .sort((a, b) => (CATEGORY_ORDER[a[0]] ?? 99) - (CATEGORY_ORDER[b[0]] ?? 99))
    .map(([category, items]) => ({ category, items }));
}

/**
 * Short main menu shown by default. Full technical list is /commands.
 */
export function buildShortMenuMessage(): string {
  return (
    "<b>Faza OS — Menu</b>\n<i>Ketik pesan biasa untuk ngobrol dengan Sora.</i>\n\n" +
    "<code>/brief</code> - Brief hari ini\n" +
    "<code>/today</code> - Ringkasan hari ini\n" +
    "<code>/fokus</code> - Fokus utama\n" +
    "<code>/jadwal</code> - Jadwal hari ini\n" +
    "<code>/agenda</code> - Agenda 3 hari\n" +
    "<code>/notif</code> - Notifikasi\n" +
    "<code>/notif_on</code> - Aktifkan notifikasi\n" +
    "<code>/notif_off</code> - Matikan notifikasi\n" +
    "<code>/unlink</code> - Putuskan akun"
  );
}

/**
 * Build full grouped command list. Splits into multiple chunks if too long.
 */
export function buildMenuMessages(): string[] {
  const groups = groupCommandsByCategory();
  const header =
    "📱 <b>Semua Command Faza OS</b>\n<i>Buat pemakaian lanjut. Untuk hal umum, cukup tanya Sora.</i>";
  const footer =
    "\n\n<b>Privasi:</b> Nominal uang hanya ditampilkan jika pengaturan " +
    "“Tampilkan nominal di Telegram” aktif.";

  const chunks: string[] = [];
  let cur = header;
  const push = (block: string) => {
    if ((cur + "\n\n" + block).length > 3500) {
      chunks.push(cur);
      cur = block;
    } else {
      cur += "\n\n" + block;
    }
  };

  for (const g of groups) {
    let block = `<b>${esc(g.category)}</b>`;
    for (const c of g.items) {
      const marker = c.implemented === false ? "  ○" : "  ▸";
      block += `\n${marker} <code>/${c.command}</code> — ${esc(c.description)}`;
    }
    push(block);
  }
  cur += footer;
  chunks.push(cur);
  return chunks;
}

/** Register bot command list with Telegram (shows up in the / menu in the client). */
export async function registerBotCommands() {
  // Telegram limits: description up to 256 chars, command lowercase a-z_0-9 up to 32 chars.
  const commands = PUBLIC_BOT_COMMANDS.map((c) => ({
    command: c.command.toLowerCase().slice(0, 32),
    description: c.description.slice(0, 256),
  }));
  return tgCall("setMyCommands", { commands });
}
