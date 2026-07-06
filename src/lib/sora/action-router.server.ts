import type { SoraActionResult, SoraDbClient, SoraIntent, SoraModule } from "./types";
import {
  getAvailableDataSummary,
  getRelevantContextForQuestion,
  getWibNow,
  isBroadSchemaQuestion,
} from "./context-builder.server";
import { createDeepSeekChatCompletion } from "@/lib/deepseek.server";

type Parsed = Omit<SoraActionResult, "reply"> & { reply?: string };

const MISSING_TABLE_REPLY =
  "Struktur modulnya belum ada di database saat ini. Aku bisa bantu Codex menambahkannya.";

const INTENTS: SoraIntent[] = [
  "answer_question",
  "get_schema_summary",
  "get_today_summary",
  "add_expense",
  "add_income",
  "add_task",
  "add_agenda",
  "add_debt",
  "add_receivable",
  "add_bill",
  "add_workout_plan",
  "complete_workout",
  "skip_workout",
  "add_body_metric",
  "add_supplement_purchase",
  "add_business",
  "add_product",
  "add_sale",
  "update_stock",
  "update_record",
  "delete_record",
  "analyze_money",
  "analyze_business",
  "analyze_activity",
  "analyze_health",
  "analyze_review",
  "analyze_investment",
  "generate_receivable_message",
  "unknown",
];

function db(supabase: SoraDbClient) {
  return supabase as any;
}

const ACTION_TABLES = {
  transactions: {
    aliases: ["transaksi", "pengeluaran", "pemasukan", "transaction"],
    label: "transaksi",
    display: "note",
    search: ["note"],
    update: ["amount", "date", "note", "type", "category_id", "account_id", "budget_id"],
  },
  academic_tasks: {
    aliases: ["tugas", "task", "academic_tasks"],
    label: "tugas",
    display: "title",
    search: ["title", "notes"],
    update: ["title", "due_date", "priority", "status", "notes", "course_id"],
  },
  activity_events: {
    aliases: ["agenda", "jadwal", "event", "activity_events"],
    label: "agenda",
    display: "title",
    search: ["title", "location", "notes"],
    update: ["title", "kind", "starts_at", "ends_at", "location", "notes"],
  },
  courses: {
    aliases: ["kuliah", "matkul", "course", "courses"],
    label: "matkul",
    display: "name",
    search: ["name", "lecturer", "notion_url"],
    update: ["name", "lecturer", "schedule_text", "notion_url", "notes"],
  },
  organizations: {
    aliases: ["organisasi", "org", "organization", "organizations"],
    label: "organisasi",
    display: "name",
    search: ["name", "role", "notes"],
    update: ["name", "role", "kind", "status", "started_on", "ended_on", "notes"],
  },
  competitions: {
    aliases: ["lomba", "kompetisi", "competition", "competitions"],
    label: "lomba",
    display: "title",
    search: ["title", "organizer", "result_notes"],
    update: ["title", "organizer", "deadline", "status", "result", "result_notes", "notes"],
  },
  portfolio_items: {
    aliases: ["portfolio", "portofolio", "project", "portfolio_items"],
    label: "portofolio",
    display: "title",
    search: ["title", "description", "url"],
    update: ["title", "description", "url", "status", "notes"],
  },
  debts: {
    aliases: ["hutang", "debt", "debts"],
    label: "hutang",
    display: "lender_name",
    search: ["lender_name", "notes"],
    update: ["lender_name", "amount", "remaining_balance", "due_date", "status", "notes"],
  },
  receivables: {
    aliases: ["piutang", "receivable", "receivables"],
    label: "piutang",
    display: "borrower_name",
    search: ["borrower_name", "notes"],
    update: [
      "borrower_name",
      "amount",
      "remaining_amount",
      "promised_payment_date",
      "status",
      "notes",
    ],
  },
  bills: {
    aliases: ["tagihan", "bill", "bills"],
    label: "tagihan",
    display: "name",
    search: ["name", "notes"],
    update: ["name", "amount", "due_date", "status", "recurrence", "notes"],
  },
  budgets: {
    aliases: ["budget", "anggaran", "budgets"],
    label: "budget",
    display: "name",
    search: ["name", "notes"],
    update: ["name", "planned_amount", "period_type", "start_date", "end_date", "status", "notes"],
  },
  investments: {
    aliases: ["investasi", "investment", "investments"],
    label: "investasi",
    display: "name",
    search: ["name", "ticker", "notes"],
    update: ["name", "ticker", "quantity", "avg_buy_price", "current_price", "notes"],
  },
  businesses: {
    aliases: ["bisnis", "business", "businesses"],
    label: "bisnis",
    display: "name",
    search: ["name", "description"],
    update: ["name", "description"],
  },
  products: {
    aliases: ["produk", "product", "products"],
    label: "produk",
    display: "name",
    search: ["name", "sku", "notes"],
    update: ["name", "price", "hpp", "stock", "min_stock", "notes"],
  },
  sales: {
    aliases: ["penjualan", "sale", "sales"],
    label: "penjualan",
    display: "product_name",
    search: ["product_name", "channel", "notes"],
    update: [
      "product_name",
      "quantity",
      "unit_price",
      "unit_hpp",
      "total",
      "profit",
      "sold_at",
      "channel",
      "notes",
    ],
  },
  business_expenses: {
    aliases: ["pengeluaran bisnis", "business expense", "business_expenses"],
    label: "pengeluaran bisnis",
    display: "name",
    search: ["name", "category", "vendor", "notes"],
    update: ["name", "amount", "expense_date", "category", "vendor", "notes"],
  },
  goals: {
    aliases: ["goal", "goals", "target"],
    label: "goal",
    display: "title",
    search: ["title", "notes"],
    update: ["title", "target_value", "current_value", "status", "notes"],
  },
  workout_plans: {
    aliases: ["workout", "rencana workout", "workout_plans"],
    label: "rencana workout",
    display: "title",
    search: ["title", "notes"],
    update: [
      "title",
      "workout_date",
      "workout_time",
      "workout_type",
      "target_duration_minutes",
      "target_intensity",
      "status",
      "notes",
    ],
  },
  workout_goals: {
    aliases: ["fitness goal", "workout goal", "workout_goals"],
    label: "fitness goal",
    display: "title",
    search: ["title", "notes"],
    update: ["title", "target_value", "current_value", "status", "notes"],
  },
  workout_routines: {
    aliases: ["routine", "rutinitas", "workout_routines"],
    label: "routine workout",
    display: "title",
    search: ["title", "notes"],
    update: ["title", "workout_type", "weekdays", "target_intensity", "is_active", "notes"],
  },
  body_metrics: {
    aliases: ["body", "body metric", "body_metrics", "berat"],
    label: "body metric",
    display: "metric_date",
    search: ["metric_date", "notes"],
    update: [
      "metric_date",
      "weight_kg",
      "height_cm",
      "body_fat_percentage",
      "vo2_max",
      "body_goal",
      "sleep_hours",
      "sleep_quality",
      "water_liters",
      "steps",
      "notes",
    ],
  },
  supplement_items: {
    aliases: ["suplemen", "supplement", "supplement_items"],
    label: "suplemen",
    display: "name",
    search: ["name", "dosage", "frequency", "notes"],
    update: [
      "name",
      "dosage",
      "frequency",
      "stock_quantity",
      "unit",
      "low_stock_threshold",
      "dose_quantity",
      "notes",
    ],
  },
} as const;

type ActionTable = keyof typeof ACTION_TABLES;

function normalizeActionTable(raw: unknown): ActionTable | null {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!value) return null;
  for (const [table, spec] of Object.entries(ACTION_TABLES)) {
    if (table === value || spec.aliases.includes(value as never)) return table as ActionTable;
  }
  return null;
}

function isMissingTable(message = "") {
  return /schema cache|does not exist|not found|relation .* does not exist/i.test(message);
}

function amountFrom(raw: string, suffix?: string) {
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return NaN;
  const s = suffix?.toLowerCase();
  if (s === "k" || s === "rb" || s === "ribu") return n * 1000;
  if (s === "jt" || s === "juta" || s === "jutaan") return n * 1_000_000;
  return n;
}

function isoDateOrNull(raw?: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function action(
  intent: SoraIntent,
  module: SoraModule | "Unknown",
  data: Record<string, unknown>,
  confidence = 0.95,
  requiresConfirmation = false,
  reply?: string,
): Parsed {
  return { intent, module, data, confidence, requiresConfirmation, reply };
}

export function parseDeterministicAction(text: string): Parsed | null {
  const t = text.trim();
  if (!t) return null;
  if (/^(ya|iya|yes|y|oke|ok|lanjut|betul)\b/i.test(t))
    return action("unknown", "Unknown", { confirmation: true }, 0.9, false);
  if (/^(batal|tidak|no|gak|ga|jangan|cancel)\b/i.test(t))
    return action("unknown", "Unknown", { confirmation: false }, 0.9, false);

  let m = t.match(
    /^(?:catat\s+)?(?:pengeluaran|keluar|expense)\s+(?<amt>[\d.,]+)\s*(?<suffix>rb|ribu|k|jt|juta|jutaan)?\s+(?<note>.+)$/i,
  );
  if (m?.groups) {
    return action("add_expense", "Money", {
      amount: amountFrom(m.groups.amt, m.groups.suffix),
      note: m.groups.note.trim(),
    });
  }

  m = t.match(
    /^(?:catat\s+)?(?:pemasukan|masuk|income|dapat)\s+(?<amt>[\d.,]+)\s*(?<suffix>rb|ribu|k|jt|juta|jutaan)?\s+(?<note>.+)$/i,
  );
  if (m?.groups) {
    return action("add_income", "Money", {
      amount: amountFrom(m.groups.amt, m.groups.suffix),
      note: m.groups.note.trim(),
    });
  }

  m = t.match(/^(?:tambah\s+)?tugas\s+(?<title>.+?)(?:\s+(?:deadline|tenggat|dl)\s+(?<due>.+))?$/i);
  if (m?.groups && m.groups.title.length >= 3 && !m.groups.title.includes("?")) {
    return action("add_task", "Activity", {
      title: m.groups.title.trim(),
      dueDate: isoDateOrNull(m.groups.due),
      dueText: m.groups.due?.trim(),
    });
  }

  m = t.match(
    /^(?:aku\s+)?hutang\s+(?:ke|sama)?\s*(?<name>[\w .'-]+?)\s+(?<amt>[\d.,]+)\s*(?<suffix>rb|ribu|k|jt|juta|jutaan)?(?:.*?(?:jatuh tempo|deadline|tempo)\s+(?<due>.+))?$/i,
  );
  if (m?.groups) {
    return action("add_debt", "Money", {
      lenderName: m.groups.name.trim(),
      amount: amountFrom(m.groups.amt, m.groups.suffix),
      dueDate: isoDateOrNull(m.groups.due),
      dueText: m.groups.due?.trim(),
    });
  }

  m = t.match(
    /^(?<name>[\w .'-]+)\s+(?:pinjam|ngutang|utang)\s+(?<amt>[\d.,]+)\s*(?<suffix>rb|ribu|k|jt|juta|jutaan)?(?:.*?(?:janji bayar|bayar|tanggal)\s+(?<due>.+))?$/i,
  );
  if (m?.groups) {
    return action("add_receivable", "Money", {
      borrowerName: m.groups.name.trim(),
      amount: amountFrom(m.groups.amt, m.groups.suffix),
      promisedPaymentDate: isoDateOrNull(m.groups.due),
      dueText: m.groups.due?.trim(),
    });
  }

  m = t.match(/^(?:berat|bb|catat berat)\s+(?<kg>[\d.,]+)\s*(?:kg)?$/i);
  if (m?.groups) {
    return action("add_body_metric", "Health", {
      weightKg: Number(m.groups.kg.replace(",", ".")),
    });
  }

  m = t.match(
    /^(?:aku\s+)?tidur\s+(?<hours>[\d.,]+)\s*(?:jam)?(?:\s+kualitas\s+(?<quality>[1-5]))?$/i,
  );
  if (m?.groups) {
    return action("add_body_metric", "Health", {
      sleepHours: Number(m.groups.hours.replace(",", ".")),
      sleepQuality: m.groups.quality ? Number(m.groups.quality) : undefined,
    });
  }

  m = t.match(/^(?:air|minum)\s+(?<liters>[\d.,]+)\s*(?:l|liter)?$/i);
  if (m?.groups) {
    return action("add_body_metric", "Health", {
      waterLiters: Number(m.groups.liters.replace(",", ".")),
    });
  }

  if (/^(?:workout|olahraga|latihan)(?:\s+hari ini)?\s+(?:selesai|done|beres|kelar)$/i.test(t)) {
    return action("complete_workout", "Health", {});
  }
  if (/^(?:skip|lewati)\s+(?:workout|olahraga|latihan)/i.test(t)) {
    return action("skip_workout", "Health", {});
  }

  m = t.match(
    /(?:beli|purchase)\s+(?<name>whey|suplemen|supplement|vitamin|creatine|kreatin|protein)(?:\s+\w+)?\s+(?<amt>[\d.,]+)\s*(?<suffix>rb|ribu|k|jt|juta|jutaan)?/i,
  );
  if (m?.groups) {
    return action("add_supplement_purchase", "Health", {
      supplementName: m.groups.name.trim(),
      amount: amountFrom(m.groups.amt, m.groups.suffix),
      quantity: 1,
    });
  }

  m = t.match(
    /catat\s+penjualan\s+(?<product>.+?)\s+(?<qty>[\d.,]+)(?:\s+\w+)?\s+total\s+(?<total>[\d.,]+)\s*(?<suffix>rb|ribu|k|jt|juta|jutaan)?(?:\s+untuk\s+bisnis\s+(?<business>.+))?$/i,
  );
  if (m?.groups) {
    return action("add_sale", "Business", {
      productName: m.groups.product.trim(),
      quantity: Number(m.groups.qty.replace(",", ".")),
      total: amountFrom(m.groups.total, m.groups.suffix),
      businessName: m.groups.business?.trim(),
    });
  }

  m = t.match(/^stok\s+(?<product>.+?)\s+(?:tinggal|sisa|jadi)\s+(?<qty>[\d.,]+)/i);
  if (m?.groups) {
    return action("update_stock", "Business", {
      productName: m.groups.product.trim(),
      quantity: Number(m.groups.qty.replace(",", ".")),
    });
  }

  m = t.match(
    /^(?:hapus|delete|remove|buang)\s+(?<kind>transaksi|pengeluaran|pemasukan|tugas|task|agenda|jadwal|kuliah|matkul|organisasi|lomba|portofolio|hutang|piutang|tagihan|budget|investasi|bisnis|produk|penjualan|goal|workout|suplemen)\s+(?<name>.+)$/i,
  );
  if (m?.groups) {
    return action(
      "delete_record",
      "Core",
      {
        table: normalizeActionTable(m.groups.kind),
        recordName: m.groups.name.trim(),
      },
      0.95,
      true,
    );
  }

  if (isBroadSchemaQuestion(t)) return action("get_schema_summary", "Core", {}, 0.95, false);
  return null;
}

async function firstMoneyAccount(supabase: SoraDbClient, userId: string) {
  const { data } = await db(supabase)
    .from("money_accounts")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.id as string | undefined;
}

async function categoryId(
  supabase: SoraDbClient,
  userId: string,
  name: string,
  kind: "income" | "expense",
) {
  const { data: existing } = await db(supabase)
    .from("money_categories")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .ilike("name", name)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await db(supabase)
    .from("money_categories")
    .insert({ user_id: userId, name, kind })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return data?.id as string | null;
}

async function resolveBusiness(
  supabase: SoraDbClient,
  userId: string,
  data: Record<string, unknown>,
) {
  if (typeof data.businessId === "string" && data.businessId)
    return { businessId: data.businessId };
  if (typeof data.businessName === "string" && data.businessName.trim()) {
    const { data: found } = await db(supabase)
      .from("businesses")
      .select("id,name")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .ilike("name", data.businessName.trim())
      .limit(1)
      .maybeSingle();
    if (found?.id) return { businessId: found.id as string };
  }

  const { data: pref } = await db(supabase)
    .from("user_preferences")
    .select("selected_business_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (pref?.selected_business_id) return { businessId: pref.selected_business_id as string };

  const { data: businesses } = await db(supabase)
    .from("businesses")
    .select("id,name")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("name");
  const rows = businesses ?? [];
  if (rows.length === 1) return { businessId: rows[0].id as string };
  if (rows.length > 1) return { needsBusiness: true, businesses: rows };
  return { needsBusiness: true, businesses: [] };
}

function recordQuery(data: Record<string, unknown>) {
  return String(
    data.recordName ??
      data.name ??
      data.title ??
      data.query ??
      data.search ??
      data.note ??
      data.target ??
      "",
  ).trim();
}

function labelRow(table: ActionTable, row: Record<string, unknown>) {
  const spec = ACTION_TABLES[table];
  return String(row[spec.display] ?? row.id ?? "(tanpa nama)");
}

async function resolveSingleActionRow(
  supabase: SoraDbClient,
  userId: string,
  table: ActionTable,
  data: Record<string, unknown>,
) {
  const spec = ACTION_TABLES[table];
  const cols = Array.from(new Set(["id", spec.display, ...spec.search])).join(",");
  const id =
    typeof data.recordId === "string" ? data.recordId : typeof data.id === "string" ? data.id : "";
  if (id) {
    const { data: row, error } = await db(supabase)
      .from(table)
      .select(cols)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return { status: row ? "single" : "none", rows: row ? [row] : [] };
  }

  const query = recordQuery(data);
  if (!query) return { status: "missing_query", rows: [] };

  const found = new Map<string, Record<string, unknown>>();
  for (const col of spec.search) {
    const { data: rows, error } = await db(supabase)
      .from(table)
      .select(cols)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .ilike(col, `%${query}%`)
      .limit(4);
    if (error) throw error;
    for (const row of rows ?? []) found.set(String(row.id), row);
    if (found.size > 1) break;
  }

  const rows = Array.from(found.values());
  if (rows.length === 0) return { status: "none", rows };
  if (rows.length > 1) return { status: "multiple", rows };
  return { status: "single", rows };
}

function confirmationReply(table: ActionTable, row: Record<string, unknown>) {
  const spec = ACTION_TABLES[table];
  return `Aku temukan 1 ${spec.label}: "${labelRow(table, row)}". Mau aku hapus? Balas "ya" untuk hapus atau "batal" untuk membatalkan.`;
}

function ambiguityReply(table: ActionTable, rows: Array<Record<string, unknown>>) {
  const spec = ACTION_TABLES[table];
  const list = rows
    .slice(0, 4)
    .map((row, index) => `${index + 1}. ${labelRow(table, row)} (${String(row.id).slice(0, 8)})`)
    .join("\n");
  return `Aku nemu beberapa ${spec.label}, Tuan. Sebutkan lebih spesifik atau pakai ID pendeknya ya:\n${list}`;
}

async function prepareDeleteConfirmation(
  supabase: SoraDbClient,
  userId: string,
  parsed: Parsed,
): Promise<SoraActionResult> {
  const table = normalizeActionTable(parsed.data.table);
  if (!table) {
    return {
      ...parsed,
      reply:
        "Data mana yang mau dihapus, Tuan? Sebutkan modulnya juga, misal: hapus tugas proposal.",
      actionTaken: false,
      status: "needs_confirmation",
    };
  }
  const target = await resolveSingleActionRow(supabase, userId, table, parsed.data);
  if (target.status === "missing_query") {
    return {
      ...parsed,
      data: { ...parsed.data, table },
      reply: `Sebutkan nama/judul ${ACTION_TABLES[table].label} yang mau dihapus ya, Tuan.`,
      actionTaken: false,
      status: "needs_confirmation",
    };
  }
  if (target.status === "none") {
    return {
      ...parsed,
      data: { ...parsed.data, table },
      reply: `${ACTION_TABLES[table].label} itu belum ketemu di Faza OS.`,
      actionTaken: false,
      status: "failed",
    };
  }
  if (target.status === "multiple") {
    return {
      ...parsed,
      data: { ...parsed.data, table },
      reply: ambiguityReply(table, target.rows),
      actionTaken: false,
      status: "needs_confirmation",
    };
  }
  const row = target.rows[0];
  return {
    ...parsed,
    data: {
      ...parsed.data,
      table,
      recordId: row.id,
      recordLabel: labelRow(table, row),
      confirmed: false,
    },
    requiresConfirmation: true,
    reply: confirmationReply(table, row),
    actionTaken: false,
    status: "needs_confirmation",
  };
}

function cleanPatch(table: ActionTable, patch: unknown) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return {};
  const allowed = new Set<string>(ACTION_TABLES[table].update as unknown as string[]);
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (allowed.has(key)) cleaned[key] = value === "" ? null : value;
  }
  return cleaned;
}

async function insertTransaction(
  supabase: SoraDbClient,
  userId: string,
  type: "income" | "expense",
  data: Record<string, unknown>,
) {
  const amount = Number(data.amount);
  if (!(amount > 0)) throw new Error("Nominal tidak valid.");
  const accountId = await firstMoneyAccount(supabase, userId);
  const { data: row, error } = await db(supabase)
    .from("transactions")
    .insert({
      user_id: userId,
      type,
      amount,
      account_id: accountId ?? null,
      date: typeof data.date === "string" ? data.date : getWibNow().date,
      note: typeof data.note === "string" ? data.note : null,
      category_id: typeof data.categoryId === "string" ? data.categoryId : null,
    })
    .select("id,type,amount,date,note")
    .maybeSingle();
  if (error) throw error;
  return row;
}

export async function executeSoraAction(
  supabase: SoraDbClient,
  userId: string,
  parsed: Parsed,
): Promise<SoraActionResult> {
  if (parsed.intent === "delete_record" && parsed.data.confirmed !== true) {
    return prepareDeleteConfirmation(supabase, userId, parsed);
  }

  if (parsed.requiresConfirmation || parsed.confidence < 0.85) {
    return {
      ...parsed,
      reply: parsed.reply ?? "Aku perlu konfirmasi dulu ya, Tuan.",
      actionTaken: false,
      status: "needs_confirmation",
    };
  }

  try {
    switch (parsed.intent) {
      case "get_schema_summary": {
        const summary = await getAvailableDataSummary(userId, supabase);
        return {
          ...parsed,
          data: summary as unknown as Record<string, unknown>,
          reply:
            "Aku tahu struktur penuh Faza OS, Tuan: Core, Money, Activity, Business, Health, Review, Telegram/Notifications, Google Calendar, dan Google Sheets jika dikonfigurasi. Aku hanya membaca record aktual lewat tools saat dibutuhkan.",
          actionTaken: false,
          status: "answered",
        };
      }
      case "add_expense": {
        const row = await insertTransaction(supabase, userId, "expense", parsed.data);
        return {
          ...parsed,
          data: { transaction: row },
          reply:
            `Tercatat pengeluaran Rp${Number(parsed.data.amount).toLocaleString("id-ID")} - ${parsed.data.note ?? ""}`.trim(),
          actionTaken: true,
          status: "executed",
        };
      }
      case "add_income": {
        const row = await insertTransaction(supabase, userId, "income", parsed.data);
        return {
          ...parsed,
          data: { transaction: row },
          reply:
            `Tercatat pemasukan Rp${Number(parsed.data.amount).toLocaleString("id-ID")} - ${parsed.data.note ?? ""}`.trim(),
          actionTaken: true,
          status: "executed",
        };
      }
      case "add_task": {
        const { data, error } = await db(supabase)
          .from("academic_tasks")
          .insert({
            user_id: userId,
            title: String(parsed.data.title ?? ""),
            due_date: typeof parsed.data.dueDate === "string" ? parsed.data.dueDate : null,
            priority: "medium",
            status: "todo",
          })
          .select("id,title,due_date,status")
          .maybeSingle();
        if (error) throw error;
        const dueNote =
          parsed.data.dueText && !parsed.data.dueDate
            ? ` Deadline "${parsed.data.dueText}" perlu dipilih tanggalnya di Activity.`
            : "";
        return {
          ...parsed,
          data: { task: data },
          reply: `Tugas dibuat: ${data.title}.${dueNote}`,
          actionTaken: true,
          status: "executed",
        };
      }
      case "add_debt": {
        const amount = Number(parsed.data.amount);
        const { data, error } = await db(supabase)
          .from("debts")
          .insert({
            user_id: userId,
            lender_name: String(parsed.data.lenderName ?? ""),
            amount,
            remaining_balance: amount,
            due_date: typeof parsed.data.dueDate === "string" ? parsed.data.dueDate : null,
            status: "active",
          })
          .select("id,lender_name,remaining_balance,due_date,status")
          .maybeSingle();
        if (error) throw error;
        return {
          ...parsed,
          data: { debt: data },
          reply: `Hutang ke ${data.lender_name} tercatat: Rp${Number(data.remaining_balance).toLocaleString("id-ID")}.`,
          actionTaken: true,
          status: "executed",
        };
      }
      case "add_receivable": {
        const amount = Number(parsed.data.amount);
        const { data, error } = await db(supabase)
          .from("receivables")
          .insert({
            user_id: userId,
            borrower_name: String(parsed.data.borrowerName ?? ""),
            amount,
            remaining_amount: amount,
            promised_payment_date:
              typeof parsed.data.promisedPaymentDate === "string"
                ? parsed.data.promisedPaymentDate
                : null,
            status: "active",
          })
          .select("id,borrower_name,remaining_amount,promised_payment_date,status")
          .maybeSingle();
        if (error) throw error;
        return {
          ...parsed,
          data: { receivable: data },
          reply: `Piutang ${data.borrower_name} tercatat: Rp${Number(data.remaining_amount).toLocaleString("id-ID")}.`,
          actionTaken: true,
          status: "executed",
        };
      }
      case "add_body_metric": {
        const { data, error } = await db(supabase)
          .from("body_metrics")
          .upsert(
            {
              user_id: userId,
              metric_date:
                typeof parsed.data.metricDate === "string"
                  ? parsed.data.metricDate
                  : getWibNow().date,
              weight_kg: parsed.data.weightKg ?? null,
              sleep_hours: parsed.data.sleepHours ?? null,
              sleep_quality: parsed.data.sleepQuality ?? null,
              water_liters: parsed.data.waterLiters ?? null,
            },
            { onConflict: "user_id,metric_date" },
          )
          .select("id,metric_date,weight_kg,sleep_hours,sleep_quality,water_liters")
          .maybeSingle();
        if (error) throw error;
        return {
          ...parsed,
          data: { body_metric: data },
          reply: "Health metric tercatat, Tuan.",
          actionTaken: true,
          status: "executed",
        };
      }
      case "complete_workout": {
        const today = getWibNow().date;
        const { data: plan } = await db(supabase)
          .from("workout_plans")
          .select(
            "id,title,workout_date,workout_type,target_duration_minutes,target_intensity,status",
          )
          .eq("user_id", userId)
          .eq("workout_date", today)
          .is("deleted_at", null)
          .maybeSingle();
        if (plan?.id) {
          await db(supabase)
            .from("workout_plans")
            .update({ status: "completed" })
            .eq("id", plan.id)
            .eq("user_id", userId);
        }
        const { data, error } = await db(supabase)
          .from("workout_logs")
          .insert({
            user_id: userId,
            workout_plan_id: plan?.id ?? null,
            workout_date: plan?.workout_date ?? today,
            workout_type: plan?.workout_type ?? "other",
            duration_minutes: plan?.target_duration_minutes ?? 30,
            intensity: plan?.target_intensity ?? "moderate",
          })
          .select("id,workout_date,workout_type")
          .maybeSingle();
        if (error) throw error;
        return {
          ...parsed,
          data: { workout_log: data, plan },
          reply: plan?.title
            ? `Workout ${plan.title} selesai. Mantap, Tuan.`
            : "Workout tercatat, Tuan.",
          actionTaken: true,
          status: "executed",
        };
      }
      case "skip_workout": {
        const today = getWibNow().date;
        const { data, error } = await db(supabase)
          .from("workout_plans")
          .update({ status: "skipped" })
          .eq("user_id", userId)
          .eq("workout_date", today)
          .select("id,title,status")
          .maybeSingle();
        if (error) throw error;
        return {
          ...parsed,
          data: { workout_plan: data },
          reply: data ? "Workout hari ini di-skip, Tuan." : "Tidak ada rencana workout hari ini.",
          actionTaken: !!data,
          status: "executed",
        };
      }
      case "add_supplement_purchase": {
        const amount = Number(parsed.data.amount);
        const category = await categoryId(supabase, userId, "Suplemen", "expense");
        const tx = await insertTransaction(supabase, userId, "expense", {
          amount,
          note: `Suplemen: ${parsed.data.supplementName}`,
          categoryId: category,
        });
        const { data, error } = await db(supabase)
          .from("supplement_purchases")
          .insert({
            user_id: userId,
            purchase_date: getWibNow().date,
            amount,
            quantity: Number(parsed.data.quantity ?? 1),
            transaction_id: tx.id,
            notes: String(parsed.data.supplementName ?? ""),
          })
          .select("id,amount,transaction_id")
          .maybeSingle();
        if (error && isMissingTable(error.message)) {
          return {
            ...parsed,
            data: { transaction: tx },
            reply: `Pengeluaran suplemen tercatat di Money. ${MISSING_TABLE_REPLY}`,
            actionTaken: true,
            status: "executed",
          };
        }
        if (error) throw error;
        return {
          ...parsed,
          data: { transaction: tx, supplement_purchase: data },
          reply: "Pembelian suplemen dan pengeluaran Money tercatat, Tuan.",
          actionTaken: true,
          status: "executed",
        };
      }
      case "add_sale": {
        const biz = await resolveBusiness(supabase, userId, parsed.data);
        if (biz.needsBusiness) {
          return {
            ...parsed,
            requiresConfirmation: true,
            data: { ...parsed.data, businesses: biz.businesses },
            reply: "Bisnis mana, Tuan? Pilih atau sebutkan nama bisnis dulu.",
            actionTaken: false,
            status: "needs_confirmation",
          };
        }
        const quantity = Number(parsed.data.quantity);
        const total = Number(parsed.data.total);
        const unitPrice = Number(parsed.data.unitPrice ?? total / quantity);
        const unitHpp = Number(parsed.data.unitHpp ?? 0);
        const { data, error } = await db(supabase)
          .from("sales")
          .insert({
            user_id: userId,
            business_id: biz.businessId,
            product_id: typeof parsed.data.productId === "string" ? parsed.data.productId : null,
            product_name: String(parsed.data.productName ?? "Produk"),
            quantity,
            unit_price: unitPrice,
            unit_hpp: unitHpp,
            total,
            profit: total - quantity * unitHpp,
            sold_at: typeof parsed.data.soldAt === "string" ? parsed.data.soldAt : getWibNow().date,
            channel: typeof parsed.data.channel === "string" ? parsed.data.channel : null,
          })
          .select("id,business_id,product_name,total,profit,sold_at")
          .maybeSingle();
        if (error) throw error;
        return {
          ...parsed,
          data: { sale: data },
          reply: `Penjualan ${data.product_name} tercatat: Rp${Number(data.total).toLocaleString("id-ID")}.`,
          actionTaken: true,
          status: "executed",
        };
      }
      case "update_stock": {
        const biz = await resolveBusiness(supabase, userId, parsed.data);
        const productName = String(parsed.data.productName ?? "");
        let q = db(supabase)
          .from("products")
          .select("id,name")
          .eq("user_id", userId)
          .is("deleted_at", null);
        if (productName) q = q.ilike("name", `%${productName}%`);
        if (biz.businessId) q = q.eq("business_id", biz.businessId);
        const { data: product } = await q.limit(1).maybeSingle();
        if (!product?.id)
          return {
            ...parsed,
            reply: "Produk tidak ditemukan di Faza OS.",
            actionTaken: false,
            status: "failed",
          };
        const { data, error } = await db(supabase)
          .from("products")
          .update({ stock: Number(parsed.data.quantity) })
          .eq("id", product.id)
          .eq("user_id", userId)
          .select("id,name,stock")
          .maybeSingle();
        if (error) throw error;
        return {
          ...parsed,
          data: { product: data },
          reply: `Stok ${data.name} diperbarui menjadi ${data.stock}.`,
          actionTaken: true,
          status: "executed",
        };
      }
      case "update_record": {
        const table = normalizeActionTable(parsed.data.table);
        if (!table) {
          return {
            ...parsed,
            reply: "Data apa yang mau diedit, Tuan? Sebutkan modulnya juga ya.",
            actionTaken: false,
            status: "needs_confirmation",
          };
        }
        const patch = cleanPatch(table, parsed.data.patch);
        if (Object.keys(patch).length === 0) {
          return {
            ...parsed,
            data: { ...parsed.data, table },
            reply: `Bagian mana dari ${ACTION_TABLES[table].label} yang mau diubah, Tuan?`,
            actionTaken: false,
            status: "needs_confirmation",
          };
        }
        const target = await resolveSingleActionRow(supabase, userId, table, parsed.data);
        if (target.status === "missing_query") {
          return {
            ...parsed,
            data: { ...parsed.data, table },
            reply: `Sebutkan nama/judul ${ACTION_TABLES[table].label} yang mau diedit ya.`,
            actionTaken: false,
            status: "needs_confirmation",
          };
        }
        if (target.status === "none") {
          return {
            ...parsed,
            data: { ...parsed.data, table },
            reply: `${ACTION_TABLES[table].label} itu belum ketemu di Faza OS.`,
            actionTaken: false,
            status: "failed",
          };
        }
        if (target.status === "multiple") {
          return {
            ...parsed,
            data: { ...parsed.data, table },
            reply: ambiguityReply(table, target.rows),
            actionTaken: false,
            status: "needs_confirmation",
          };
        }
        const row = target.rows[0];
        const { data, error } = await db(supabase)
          .from(table)
          .update(patch)
          .eq("id", row.id)
          .eq("user_id", userId)
          .select(`id,${ACTION_TABLES[table].display}`)
          .maybeSingle();
        if (error) throw error;
        return {
          ...parsed,
          data: { table, record: data, patch },
          reply: `${ACTION_TABLES[table].label} "${labelRow(table, data)}" sudah diedit, Tuan.`,
          actionTaken: true,
          status: "executed",
        };
      }
      case "delete_record": {
        const table = normalizeActionTable(parsed.data.table);
        const recordId = typeof parsed.data.recordId === "string" ? parsed.data.recordId : "";
        if (!table || !recordId) return prepareDeleteConfirmation(supabase, userId, parsed);
        const { data, error } = await db(supabase)
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", recordId)
          .eq("user_id", userId)
          .is("deleted_at", null)
          .select(`id,${ACTION_TABLES[table].display}`)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          return {
            ...parsed,
            data: { table, recordId },
            reply: `${ACTION_TABLES[table].label} itu sudah tidak aktif atau tidak ditemukan.`,
            actionTaken: false,
            status: "failed",
          };
        }
        return {
          ...parsed,
          data: { table, record: data },
          reply: `${ACTION_TABLES[table].label} "${labelRow(table, data)}" sudah dihapus, Tuan.`,
          actionTaken: true,
          status: "executed",
        };
      }
      default:
        return {
          ...parsed,
          reply: parsed.reply ?? "Aku proses sebagai pertanyaan ya, Tuan.",
          actionTaken: false,
          status: "parsed",
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...parsed,
      reply: isMissingTable(message) ? MISSING_TABLE_REPLY : `Gagal memproses: ${message}`,
      actionTaken: false,
      status: "failed",
    };
  }
}

async function classifyWithDeepSeek(
  userId: string,
  text: string,
  supabase: SoraDbClient,
): Promise<Parsed> {
  const context = await getRelevantContextForQuestion(userId, text, supabase);
  const now = getWibNow();
  const res = await createDeepSeekChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "Kamu adalah classifier intent untuk Sora Brain Faza OS. Balas JSON valid saja. " +
          `Intent harus salah satu: ${INTENTS.join(", ")}. ` +
          'Schema: {"intent":string,"confidence":number,"requiresConfirmation":boolean,"module":string,"data":object,"reply":string}. ' +
          'Untuk edit pakai intent update_record dengan data {"table":string,"recordName":string atau "recordId":string,"patch":object}. ' +
          'Untuk hapus pakai intent delete_record dengan data {"table":string,"recordName":string atau "recordId":string}; destructive actions wajib requiresConfirmation=true. ' +
          "Jangan pernah membuat patch/delete untuk lebih dari satu record. Jika target ambigu, requiresConfirmation=true dan reply berisi pertanyaan klarifikasi. " +
          "Low-risk create actions boleh requiresConfirmation=false kalau data lengkap. " +
          "Jika pertanyaan analisis/data, pakai intent answer_question/analyze_* dan jangan mengarang record.",
      },
      {
        role: "system",
        content: `Waktu WIB sekarang: ${now.label}, ${now.time}. Context:\n${context}`,
      },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 500,
    signal: AbortSignal.timeout(12_000),
  });
  const raw = res.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as Partial<SoraActionResult>;
    const intent = INTENTS.includes(parsed.intent as SoraIntent)
      ? (parsed.intent as SoraIntent)
      : "unknown";
    return {
      intent,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      requiresConfirmation: !!parsed.requiresConfirmation,
      module: (parsed.module as SoraModule | undefined) ?? "Unknown",
      data:
        typeof parsed.data === "object" && parsed.data
          ? (parsed.data as Record<string, unknown>)
          : {},
      reply: typeof parsed.reply === "string" ? parsed.reply : undefined,
    };
  } catch {
    return action("answer_question", "Unknown", {}, 0.5, false);
  }
}

export async function routeSoraAction({
  userId,
  text,
  supabase,
  execute = true,
}: {
  userId: string;
  text: string;
  supabase: SoraDbClient;
  execute?: boolean;
}): Promise<SoraActionResult> {
  const deterministic = parseDeterministicAction(text);
  let parsed: Parsed;

  if (deterministic) {
    parsed = deterministic;
  } else {
    try {
      parsed = await classifyWithDeepSeek(userId, text, supabase);
    } catch {
      parsed = action(
        isBroadSchemaQuestion(text) ? "get_schema_summary" : "answer_question",
        "Unknown",
        {},
        0.55,
        false,
      );
    }
  }

  if (!execute) {
    return {
      ...parsed,
      reply: parsed.reply ?? "",
      actionTaken: false,
      status: "parsed",
    };
  }
  return executeSoraAction(supabase, userId, parsed);
}
