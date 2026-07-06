import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  getFazaSchemaMap,
  getFazaSchemaSummary as getRegistrySchemaSummary,
  getModuleTables,
  IMPLEMENTED_SORA_TABLES,
} from "./schema-registry";
import type { SoraDbClient, SoraModule, SoraSchemaEntry } from "./types";
import { getUpcomingGoogleCalendarEvents } from "@/lib/google-calendar.server";

type AnyRecord = Record<string, unknown>;

const SOFT_DELETE_TABLES = new Set([
  "tags",
  "files",
  "notes",
  "money_accounts",
  "money_categories",
  "transactions",
  "budgets",
  "debts",
  "debt_payments",
  "receivables",
  "receivable_payments",
  "bills",
  "assets",
  "investments",
  "courses",
  "academic_tasks",
  "organizations",
  "org_meetings",
  "activity_events",
  "competitions",
  "portfolio_items",
  "businesses",
  "suppliers",
  "products",
  "sales",
  "daily_logs",
  "weekly_reviews",
  "goals",
  "workout_plans",
  "workout_logs",
  "exercise_library",
  "body_metrics",
  "supplement_items",
  "recovery_logs",
  "google_sheets_connections",
]);

function serviceClient(): SoraDbClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role belum dikonfigurasi untuk Sora context.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getWibNow() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return {
    date: wib.toISOString().slice(0, 10),
    iso: wib.toISOString(),
    dayName: days[wib.getUTCDay()],
    label: `${days[wib.getUTCDay()]}, ${wib.getUTCDate()} ${months[wib.getUTCMonth()]} ${wib.getUTCFullYear()}`,
    time: `${String(wib.getUTCHours()).padStart(2, "0")}:${String(wib.getUTCMinutes()).padStart(2, "0")} WIB`,
  };
}

function startOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function inDaysIso(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function compactRows(rows: AnyRecord[], limit = 8) {
  return rows.slice(0, limit).map((row) => {
    const copy: AnyRecord = {};
    for (const [key, value] of Object.entries(row)) {
      if (["deleted_at", "updated_at"].includes(key)) continue;
      if (typeof value === "string" && value.length > 180) copy[key] = value.slice(0, 177) + "...";
      else copy[key] = value;
    }
    return copy;
  });
}

async function googleCalendarSnapshot() {
  try {
    const result = await getUpcomingGoogleCalendarEvents(30, 50);
    return {
      source: "google_calendar",
      configured: result.configured,
      lookahead_days: 30,
      error: result.error ?? null,
      events: result.events.slice(0, 20).map((event) => ({
        id: event.id,
        title: event.summary ?? "(tanpa judul)",
        starts_at: event.start?.dateTime ?? event.start?.date ?? null,
        ends_at: event.end?.dateTime ?? event.end?.date ?? null,
        location: event.location ?? null,
        link: event.htmlLink ?? null,
      })),
    };
  } catch (err) {
    return {
      source: "google_calendar",
      configured: true,
      lookahead_days: 30,
      error: err instanceof Error ? err.message : String(err),
      events: [],
    };
  }
}

async function safeCount(db: SoraDbClient, table: string, userId: string, entry?: SoraSchemaEntry) {
  try {
    let q = (db as any).from(table).select("id", { count: "exact", head: true });
    if (entry?.userOwned !== false) {
      q = table === "profiles" ? q.eq("id", userId) : q.eq("user_id", userId);
    }
    const { count, error } = await q;
    if (error) return { table, count: 0, available: false, error: error.message };
    return { table, count: count ?? 0, available: true };
  } catch (err) {
    return {
      table,
      count: 0,
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function safeSelect(
  db: SoraDbClient,
  table: string,
  userId: string,
  columns = "*",
  options: {
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
    filters?: Array<[string, string, unknown]>;
    userColumn?: "user_id" | "id" | null;
  } = {},
) {
  try {
    let q = (db as any).from(table).select(columns);
    if (options.userColumn !== null)
      q = q.eq(options.userColumn ?? (table === "profiles" ? "id" : "user_id"), userId);
    if (SOFT_DELETE_TABLES.has(table)) q = q.is("deleted_at", null);
    for (const [column, op, value] of options.filters ?? []) {
      if (op === "eq") q = q.eq(column, value);
      else if (op === "neq") q = q.neq(column, value);
      else if (op === "gte") q = q.gte(column, value);
      else if (op === "lte") q = q.lte(column, value);
      else if (op === "in" && Array.isArray(value)) q = q.in(column, value);
    }
    if (options.orderBy)
      q = q.order(options.orderBy, { ascending: options.ascending ?? false, nullsFirst: false });
    if (options.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error)
      return {
        table,
        data: [],
        error: error.message,
        available: !/schema cache|does not exist|not found/i.test(error.message),
      };
    return { table, data: compactRows(data ?? [], options.limit ?? 8), available: true };
  } catch (err) {
    return {
      table,
      data: [],
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function getFazaSchemaSummary() {
  return getRegistrySchemaSummary();
}

export async function getAvailableDataSummary(userId: string, db: SoraDbClient = serviceClient()) {
  const schema = getFazaSchemaMap();
  const counts = await Promise.all(schema.map((item) => safeCount(db, item.table, userId, item)));
  const byModule = schema.map((item) => {
    const count = counts.find((c) => c.table === item.table);
    return {
      module: item.module,
      table: item.table,
      purpose: item.purpose,
      implemented: item.implemented,
      available: !!count?.available,
      count: count?.count ?? 0,
      error: count?.available ? undefined : count?.error,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    modules: getRegistrySchemaSummary(),
    tables: byModule,
    totals: {
      knownTables: schema.length,
      implementedTables: schema.filter((item) => item.implemented).length,
      tablesWithData: byModule.filter((item) => item.count > 0).length,
    },
  };
}

function modulesForText(text: string): SoraModule[] {
  const lower = text.toLowerCase();
  const result = new Set<SoraModule>();
  const addIf = (module: SoraModule, words: string[]) => {
    if (words.some((word) => lower.includes(word))) result.add(module);
  };
  addIf("Money", [
    "uang",
    "transaksi",
    "budget",
    "cashflow",
    "hutang",
    "piutang",
    "tagihan",
    "aset",
    "investasi",
    "sheets",
    "spreadsheet",
  ]);
  addIf("Business", [
    "bisnis",
    "jualan",
    "penjualan",
    "produk",
    "menu",
    "supplier",
    "stok",
    "hpp",
    "promo",
    "untung",
    "profit",
    "omzet",
  ]);
  addIf("Activity", [
    "tugas",
    "deadline",
    "hari ini",
    "besok",
    "minggu ini",
    "acara",
    "agenda",
    "jadwal",
    "meeting",
    "calendar",
    "kalender",
    "gcalendar",
    "gcal",
    "kuliah",
    "course",
    "organisasi",
    "rapat",
    "lomba",
    "portfolio",
  ]);
  addIf("Health", [
    "health",
    "workout",
    "latihan",
    "olahraga",
    "berat",
    "body",
    "tidur",
    "air",
    "suplemen",
    "supplement",
    "recovery",
  ]);
  addIf("Review", [
    "review",
    "jurnal",
    "journal",
    "daily log",
    "weekly",
    "monthly",
    "goal",
    "progress",
    "mood",
    "energy",
    "focus",
  ]);
  addIf("Integrations", [
    "telegram",
    "notifikasi",
    "notification",
    "google calendar",
    "gcalendar",
    "gcal",
    "calendar",
    "kalender",
    "sora",
    "sync",
  ]);
  if (result.size === 0) result.add("Core");
  return Array.from(result);
}

export function isBroadSchemaQuestion(text: string) {
  const lower = text.toLowerCase();
  return [
    "data apa",
    "apa saja yang kamu tahu",
    "seluruh database",
    "database os",
    "schema",
    "skema",
    "tabel apa",
    "module apa",
    "modul apa",
  ].some((needle) => lower.includes(needle));
}

async function fetchModuleSnapshot(userId: string, module: SoraModule, db: SoraDbClient) {
  const monthStart = startOfMonthIso();
  const today = getWibNow().date;
  const in30 = inDaysIso(30);

  switch (module) {
    case "Money":
      return Promise.all([
        safeSelect(db, "transactions", userId, "id,type,amount,date,category_id,note", {
          limit: 12,
          orderBy: "date",
          filters: [["date", "gte", monthStart]],
        }),
        safeSelect(
          db,
          "budgets",
          userId,
          "id,name,category_id,period_type,planned_amount,start_date,end_date,status,notes",
          { limit: 12, orderBy: "created_at" },
        ),
        safeSelect(db, "debts", userId, "id,lender_name,remaining_balance,due_date,status", {
          limit: 8,
          orderBy: "due_date",
          ascending: true,
          filters: [["status", "neq", "paid"]],
        }),
        safeSelect(
          db,
          "receivables",
          userId,
          "id,borrower_name,remaining_amount,promised_payment_date,status",
          {
            limit: 8,
            orderBy: "promised_payment_date",
            ascending: true,
            filters: [["status", "neq", "paid"]],
          },
        ),
        safeSelect(db, "bills", userId, "id,name,amount,due_date,status", {
          limit: 8,
          orderBy: "due_date",
          ascending: true,
          filters: [["status", "eq", "upcoming"]],
        }),
        safeSelect(
          db,
          "investments",
          userId,
          "id,type,ticker,name,quantity,avg_buy_price,current_price,last_updated_at,last_price_error",
          { limit: 12, orderBy: "name", ascending: true },
        ),
        safeSelect(
          db,
          "google_sheets_connections",
          userId,
          "id,status,last_sync_at,last_error,spreadsheet_url",
          { limit: 2, orderBy: "updated_at" },
        ),
      ]);
    case "Business":
      return Promise.all([
        safeSelect(db, "businesses", userId, "id,name,description", {
          limit: 10,
          orderBy: "name",
          ascending: true,
        }),
        safeSelect(db, "products", userId, "id,business_id,name,sku,hpp,price,stock,min_stock", {
          limit: 20,
          orderBy: "name",
          ascending: true,
        }),
        safeSelect(
          db,
          "sales",
          userId,
          "id,business_id,product_name,quantity,total,profit,sold_at",
          { limit: 20, orderBy: "sold_at", filters: [["sold_at", "gte", monthStart]] },
        ),
        safeSelect(db, "suppliers", userId, "id,business_id,name,contact", {
          limit: 12,
          orderBy: "name",
          ascending: true,
        }),
        safeSelect(
          db,
          "inventory_items",
          userId,
          "id,business_id,name,quantity,unit,low_stock_threshold,expires_at",
          { limit: 12, orderBy: "name", ascending: true },
        ),
      ]);
    case "Activity":
      return Promise.all([
        safeSelect(db, "academic_tasks", userId, "id,title,priority,status,due_date", {
          limit: 12,
          orderBy: "due_date",
          ascending: true,
          filters: [["status", "neq", "done"]],
        }),
        safeSelect(
          db,
          "activity_events",
          userId,
          "id,title,kind,starts_at,location,gcal_event_id",
          {
            limit: 15,
            orderBy: "starts_at",
            ascending: true,
            filters: [
              ["starts_at", "gte", new Date().toISOString()],
              ["starts_at", "lte", in30],
            ],
          },
        ),
        safeSelect(db, "courses", userId, "id,name,code,lecturer,sks", {
          limit: 10,
          orderBy: "name",
          ascending: true,
        }),
        safeSelect(db, "organizations", userId, "id,name,role,kind,status", {
          limit: 10,
          orderBy: "name",
          ascending: true,
        }),
        safeSelect(db, "org_meetings", userId, "id,title,starts_at,location", {
          limit: 10,
          orderBy: "starts_at",
          ascending: true,
          filters: [["starts_at", "gte", new Date().toISOString()]],
        }),
        safeSelect(db, "competitions", userId, "id,name,status,registration_deadline,event_date", {
          limit: 10,
          orderBy: "registration_deadline",
          ascending: true,
        }),
        googleCalendarSnapshot(),
      ]);
    case "Health":
      return Promise.all([
        safeSelect(
          db,
          "workout_plans",
          userId,
          "id,title,workout_date,workout_time,workout_type,status,target_duration_minutes",
          { limit: 12, orderBy: "workout_date", ascending: false },
        ),
        safeSelect(
          db,
          "workout_logs",
          userId,
          "id,workout_date,workout_type,duration_minutes,intensity",
          { limit: 12, orderBy: "workout_date" },
        ),
        safeSelect(
          db,
          "body_metrics",
          userId,
          "id,metric_date,weight_kg,sleep_hours,sleep_quality,water_liters,steps",
          { limit: 12, orderBy: "metric_date" },
        ),
        safeSelect(
          db,
          "supplement_items",
          userId,
          "id,name,category,dosage,frequency,stock_quantity,unit,low_stock_threshold",
          { limit: 12, orderBy: "name", ascending: true },
        ),
        safeSelect(
          db,
          "recovery_logs",
          userId,
          "id,log_date,soreness,stress,energy,sleep_quality,recovery_score",
          { limit: 12, orderBy: "log_date" },
        ),
      ]);
    case "Review":
      return Promise.all([
        safeSelect(
          db,
          "daily_logs",
          userId,
          "id,log_date,mood,energy,focus,wins,struggles,tomorrow_focus",
          { limit: 7, orderBy: "log_date" },
        ),
        safeSelect(
          db,
          "weekly_reviews",
          userId,
          "id,week_start,highlights,lessons,next_week_focus,score_money,score_academic,score_business,score_health",
          { limit: 4, orderBy: "week_start" },
        ),
        safeSelect(
          db,
          "monthly_reviews",
          userId,
          "id,month_start,highlights,lessons,next_month_focus,score",
          { limit: 3, orderBy: "month_start" },
        ),
        safeSelect(db, "goals", userId, "id,title,area,target_date,progress,status", {
          limit: 10,
          orderBy: "target_date",
          ascending: true,
        }),
      ]);
    case "Integrations":
      return Promise.all([
        safeSelect(db, "telegram_users", userId, "user_id,chat_id,linked_at", { limit: 1 }),
        safeSelect(
          db,
          "notifications",
          userId,
          "id,type,channel,status,dedupe_key,sent_at,error_message",
          { limit: 12, orderBy: "created_at" },
        ),
        safeSelect(
          db,
          "telegram_jobs",
          userId,
          "id,job_type,status,attempts,last_error,scheduled_at",
          { limit: 8, orderBy: "created_at" },
        ),
        safeSelect(
          db,
          "google_sheets_connections",
          userId,
          "id,status,last_sync_at,last_error,spreadsheet_url",
          { limit: 2, orderBy: "updated_at" },
        ),
        googleCalendarSnapshot(),
      ]);
    case "Core":
    default:
      return Promise.all([
        safeSelect(db, "profiles", userId, "id,display_name,timezone,currency,onboarded", {
          limit: 1,
          userColumn: "id",
        }),
        safeSelect(
          db,
          "user_preferences",
          userId,
          "user_id,theme,hide_amounts,selected_business_id,telegram_enabled,quiet_hours_start,quiet_hours_end",
          { limit: 1 },
        ),
        safeSelect(db, "notes", userId, "id,title,tags,created_at", {
          limit: 8,
          orderBy: "created_at",
        }),
      ]);
  }
}

function schemaLinesForModules(modules: SoraModule[]) {
  return modules.flatMap((module) =>
    getModuleTables(module).map((item) => ({
      table: item.table,
      module: item.module,
      purpose: item.purpose,
      keyColumns: item.keyColumns,
      relationships: item.relationships,
      implemented: item.implemented,
    })),
  );
}

export async function buildSoraBaseContext(userId: string, db: SoraDbClient = serviceClient()) {
  const now = getWibNow();
  const available = await getAvailableDataSummary(userId, db);
  return [
    "FAZA OS CONTEXT",
    `User id: ${userId}`,
    `Waktu WIB: ${now.label}, ${now.time} (${now.date})`,
    "Identity: Kamu adalah Sora Brain, bukan DeepSeek/Gemini. Panggil user Tuan.",
    "Rules: panggil tools sebelum menyebut angka/nama record aktual. Jika data kosong, bilang data belum tersedia di Faza OS.",
    "Integrations: Google Calendar lookahead 30 hari; scheduled notifications hanya Telegram; Money dapat sync ke Google Sheets jika configured.",
    "Business: data bisnis dipisah business_id; gunakan selected_business_id jika ada; jangan campur sales antar bisnis.",
    "Health: Health adalah modul utama berisi Workout, Body, dan Supplement. Recovery dicatat ringan lewat daily journal.",
    `Schema summary: ${JSON.stringify(getRegistrySchemaSummary())}`,
    `Available data summary: ${JSON.stringify(available.totals)}`,
    `Known implemented tables: ${IMPLEMENTED_SORA_TABLES.join(", ")}`,
  ].join("\n");
}

export function buildSoraFastBaseContext(userId: string) {
  const now = getWibNow();
  return [
    "FAZA OS CONTEXT",
    `User id: ${userId}`,
    `Waktu WIB: ${now.label}, ${now.time} (${now.date})`,
    "Identity: Kamu adalah Sora Brain. Panggil user Tuan.",
    "Rules: ringkas, natural, tidak mengarang data. Untuk aksi jelas gunakan tools. Kalau konteks kurang, tanya balik 1 pertanyaan spesifik.",
    "Integrations: notifikasi terjadwal hanya Telegram; Google Calendar lookahead 30 hari.",
  ].join("\n");
}

export async function buildSoraModuleContext(
  userId: string,
  modules: SoraModule[],
  db: SoraDbClient = serviceClient(),
) {
  const unique = Array.from(new Set(modules));
  const snapshots = await Promise.all(
    unique.map(async (module) => ({
      module,
      snapshot: await fetchModuleSnapshot(userId, module, db),
    })),
  );
  return [
    `Relevant schema: ${JSON.stringify(schemaLinesForModules(unique))}`,
    `Relevant data snapshot: ${JSON.stringify(snapshots)}`,
  ].join("\n");
}

export async function getRelevantContextForQuestion(
  userId: string,
  text: string,
  db: SoraDbClient = serviceClient(),
) {
  if (isBroadSchemaQuestion(text)) {
    const [base, available] = await Promise.all([
      buildSoraBaseContext(userId, db),
      getAvailableDataSummary(userId, db),
    ]);
    return `${base}\nFull data availability:\n${JSON.stringify(available)}`;
  }
  const modules = modulesForText(text);
  const [moduleCtx] = await Promise.all([buildSoraModuleContext(userId, modules, db)]);
  const base = buildSoraFastBaseContext(userId);
  return `${base}\n${moduleCtx}`;
}
