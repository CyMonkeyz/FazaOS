import { tool } from "ai";
import { z } from "zod";
import {
  getFazaSchemaMap,
  getFazaSchemaSummary,
  getModuleTables,
  getTablePurpose,
} from "./schema-registry";
import { getAvailableDataSummary, getWibNow } from "./context-builder.server";
import type { SoraModule, SoraToolContext } from "./types";
import { getUpcomingGoogleCalendarEvents } from "@/lib/google-calendar.server";
import { searchWeb } from "@/lib/sora/web-search.server";
import { continueServerDelete, prepareServerDelete } from "./pending-actions.server";

type Filter = [column: string, op: "eq" | "neq" | "gte" | "lte" | "in", value: unknown];

const MISSING_TABLE_REPLY =
  "Struktur modulnya belum ada di database saat ini. Aku bisa bantu Codex menambahkannya.";

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
  "business_expenses",
  "suppliers",
  "products",
  "sales",
  "daily_logs",
  "weekly_reviews",
  "goals",
  "habits",
  "workout_plans",
  "workout_logs",
  "workout_goals",
  "workout_routines",
  "exercise_library",
  "body_metrics",
  "supplement_items",
  "supplement_logs",
  "recovery_logs",
  "google_sheets_connections",
]);

const SAFE_READ_COLUMNS: Record<string, string> = {
  notes: "id,title,body,tags,created_at,updated_at",
  transactions: "id,type,amount,date,note,category_id,account_id",
  budgets: "id,name,planned_amount,start_date,end_date,status,category_id",
  debts: "id,lender_name,amount,remaining_balance,due_date,status,notes",
  receivables: "id,borrower_name,amount,remaining_amount,promised_payment_date,status,notes",
  bills: "id,name,amount,due_date,status,recurrence,notes",
  academic_tasks: "id,title,due_date,priority,status,notes,course_id",
  activity_events: "id,title,kind,starts_at,ends_at,location,notes",
  courses: "id,name,lecturer,schedule_text,notes",
  organizations: "id,name,role,kind,status,notes",
  competitions: "id,title,organizer,deadline,status,result,notes",
  portfolio_items: "id,title,description,url,status,notes",
  businesses: "id,name,description,is_active",
  business_sheet_connections: "id,business_id,spreadsheet_id,status,last_sync_at,last_error",
  business_sheet_snapshots: "id,business_id,summary,sales,expenses,products,stock,captured_at",
  products: "id,business_id,name,sku,selling_price,current_stock,is_active",
  sales: "id,business_id,product_name,quantity,total,profit,sold_at",
  daily_logs: "id,log_date,mood,energy,focus,wins,struggles,gratitude,tomorrow_focus",
  weekly_reviews: "id,week_start,highlights,lessons,next_week_focus,score_money,score_health",
  monthly_reviews: "id,month_start,highlights,lessons,next_month_focus,score",
  goals: "id,title,area,target_date,progress,status,notes",
  habits: "id,name,description,icon,color,weekdays,reminder_enabled,reminder_time,is_active",
  habit_logs: "id,habit_id,log_date,completed_at",
  garden_seasons: "id,season_month,score,stage,vitality,status,final_snapshot",
  garden_events: "id,season_id,event_date,source_type,points,metadata,created_at",
  workout_plans: "id,title,workout_date,workout_time,workout_type,duration_minutes,status,notes",
  workout_logs: "id,workout_date,workout_type,duration_minutes,intensity,notes",
  body_metrics: "id,metric_date,weight_kg,sleep_hours,sleep_quality,water_liters,steps",
  supplement_items: "id,name,category,dosage,frequency,stock_quantity,unit",
  scheduled_messages: "id,title,message,recurrence,next_run_at,last_run_at,status",
  sora_profile_memories: "id,category,memory_key,content,updated_at",
};

const SAFE_UPDATE_COLUMNS: Record<string, string[]> = {
  academic_tasks: ["title", "due_date", "priority", "status", "notes", "course_id"],
  activity_events: ["title", "kind", "starts_at", "ends_at", "location", "notes"],
  bills: ["name", "amount", "due_date", "status", "recurrence", "notes"],
  debts: ["lender_name", "amount", "remaining_balance", "due_date", "status", "notes"],
  receivables: [
    "borrower_name",
    "amount",
    "remaining_amount",
    "promised_payment_date",
    "status",
    "notes",
  ],
  goals: ["title", "area", "target_date", "progress", "status", "notes"],
  habits: [
    "name",
    "description",
    "icon",
    "color",
    "weekdays",
    "reminder_enabled",
    "reminder_time",
    "sort_order",
    "is_active",
  ],
  notes: ["title", "body", "tags"],
  products: ["name", "sku", "selling_price", "current_stock", "is_active"],
  workout_plans: [
    "title",
    "workout_date",
    "workout_time",
    "workout_type",
    "duration_minutes",
    "status",
    "notes",
  ],
};

function db(ctx: SoraToolContext) {
  return ctx.supabase as any;
}

function isMissingTable(message = "") {
  return /schema cache|does not exist|not found|relation .* does not exist/i.test(message);
}

function compact(value: unknown) {
  return JSON.parse(
    JSON.stringify(value ?? null, (_key, val) => {
      if (typeof val === "string" && val.length > 220) return val.slice(0, 217) + "...";
      return val;
    }),
  );
}

function startOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function endOfMonthIso() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(dateIso: string, days: number) {
  const d = new Date(dateIso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchGoogleCalendarEvents() {
  try {
    const result = await getUpcomingGoogleCalendarEvents(30, 50);
    if (!result.configured) {
      return {
        configured: false,
        events: [],
        message: "Google Calendar belum dikonfigurasi di .env.",
      };
    }
    const events = result.events.map((event) => ({
      title: event.summary ?? "(tanpa judul)",
      when: event.start?.dateTime || event.start?.date || null,
      location: event.location ?? null,
      link: event.htmlLink ?? null,
    }));
    return { configured: true, lookahead_days: 30, events, error: result.error };
  } catch (err) {
    return {
      configured: true,
      events: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function budgetEnd(start: string, period: string, end?: string | null) {
  if (end) return end;
  if (period === "daily") return start;
  if (period === "weekly") return addDaysIso(start, 6);
  if (period === "monthly") {
    const d = new Date(start + "T00:00:00");
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  }
  return endOfMonthIso();
}

async function rows(
  ctx: SoraToolContext,
  table: string,
  columns = "*",
  options: {
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
    filters?: Filter[];
    userColumn?: "user_id" | "id" | null;
  } = {},
) {
  try {
    let q = db(ctx).from(table).select(columns);
    if (options.userColumn !== null)
      q = q.eq(options.userColumn ?? (table === "profiles" ? "id" : "user_id"), ctx.userId);
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
    q = q.limit(options.limit ?? 20);
    const { data, error } = await q;
    if (error) {
      return {
        ok: false,
        table,
        message: isMissingTable(error.message) ? MISSING_TABLE_REPLY : error.message,
        rows: [],
      };
    }
    return { ok: true, table, rows: compact(data ?? []) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      table,
      message: isMissingTable(message) ? MISSING_TABLE_REPLY : message,
      rows: [],
    };
  }
}

async function maybeSingle(
  ctx: SoraToolContext,
  table: string,
  columns = "*",
  filters: Filter[] = [],
) {
  const r = await rows(ctx, table, columns, { limit: 1, filters });
  return { ...r, row: r.rows[0] ?? null };
}

async function firstAccount(ctx: SoraToolContext) {
  const { rows: data } = await rows(ctx, "money_accounts", "id,name", {
    limit: 1,
    orderBy: "created_at",
    ascending: true,
  });
  return data[0] as { id: string; name: string } | undefined;
}

async function selectedBusinessId(ctx: SoraToolContext) {
  const { row } = await maybeSingle(ctx, "user_preferences", "selected_business_id");
  return (row as { selected_business_id?: string | null } | null)?.selected_business_id ?? null;
}

async function selectedOrNamedBusiness(
  ctx: SoraToolContext,
  businessId?: string | null,
  businessName?: string | null,
) {
  if (businessId) return businessId;
  if (businessName) {
    const { rows: found } = await rows(ctx, "businesses", "id,name", {
      limit: 1,
      filters: [["name", "eq", businessName]],
    });
    const id = (found[0] as { id?: string } | undefined)?.id;
    if (id) return id;
  }
  return selectedBusinessId(ctx);
}

async function getCategoryId(ctx: SoraToolContext, name: string, kind: "income" | "expense") {
  const { rows: found } = await rows(ctx, "money_categories", "id,name", {
    limit: 1,
    filters: [
      ["name", "eq", name],
      ["kind", "eq", kind],
    ],
  });
  const existing = (found[0] as { id?: string } | undefined)?.id;
  if (existing) return existing;
  const { data, error } = await db(ctx)
    .from("money_categories")
    .insert({ user_id: ctx.userId, name, kind })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return data?.id as string | null;
}

async function addTransaction(
  ctx: SoraToolContext,
  type: "income" | "expense",
  amount: number,
  note: string,
  date?: string,
  categoryId?: string | null,
) {
  const acc = await firstAccount(ctx);
  const { data, error } = await db(ctx)
    .from("transactions")
    .insert({
      user_id: ctx.userId,
      type,
      amount,
      note: note || null,
      date: date ?? getWibNow().date,
      account_id: acc?.id ?? null,
      category_id: categoryId ?? null,
    })
    .select("id,type,amount,date,note,category_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function moneyOverview(ctx: SoraToolContext) {
  const start = startOfMonthIso();
  const [txn, debts, receivables, bills, assets, investments] = await Promise.all([
    rows(ctx, "transactions", "type,amount,date,category_id,note", {
      limit: 200,
      filters: [["date", "gte", start]],
    }),
    rows(ctx, "debts", "lender_name,remaining_balance,due_date,status", {
      limit: 20,
      filters: [["status", "neq", "paid"]],
    }),
    rows(ctx, "receivables", "borrower_name,remaining_amount,promised_payment_date,status", {
      limit: 20,
      filters: [["status", "neq", "paid"]],
    }),
    rows(ctx, "bills", "name,amount,due_date,status", {
      limit: 20,
      filters: [["status", "eq", "upcoming"]],
    }),
    rows(ctx, "assets", "name,current_value,asset_type", { limit: 50 }),
    rows(
      ctx,
      "investments",
      "type,ticker,name,quantity,avg_buy_price,current_price,last_updated_at",
      { limit: 50 },
    ),
  ]);
  const tx = txn.rows as Array<{ type: string; amount: number }>;
  const income = tx
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expense = tx
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const assetValue = (assets.rows as Array<{ current_value: number }>).reduce(
    (sum, a) => sum + Number(a.current_value),
    0,
  );
  const investmentValue = (
    investments.rows as Array<{ quantity: number; current_price: number }>
  ).reduce((sum, inv) => sum + Number(inv.quantity) * Number(inv.current_price), 0);
  const debtValue = (debts.rows as Array<{ remaining_balance: number }>).reduce(
    (sum, d) => sum + Number(d.remaining_balance),
    0,
  );
  return {
    period_start: start,
    income,
    expense,
    cashflow: income - expense,
    active_debt_total: debtValue,
    active_receivable_total: (receivables.rows as Array<{ remaining_amount: number }>).reduce(
      (sum, r) => sum + Number(r.remaining_amount),
      0,
    ),
    upcoming_bills: bills.rows,
    asset_value: assetValue,
    investment_value: investmentValue,
    estimated_net_worth: assetValue + investmentValue - debtValue,
  };
}

async function budgetStatus(ctx: SoraToolContext) {
  const { rows: budgetRows } = await rows(
    ctx,
    "budgets",
    "id,name,category_id,period_type,planned_amount,start_date,end_date,status,notes",
    { limit: 50, orderBy: "created_at" },
  );
  const tx = await rows(ctx, "transactions", "id,amount,date,category_id,note", {
    limit: 500,
    filters: [["type", "eq", "expense"]],
  });
  const transactions = tx.rows as Array<{
    id: string;
    amount: number;
    date: string;
    category_id: string | null;
    note?: string | null;
  }>;
  return {
    budgets: (budgetRows as Array<any>).map((budget) => {
      const start = budget.start_date ?? startOfMonthIso();
      const end = budgetEnd(start, budget.period_type, budget.end_date);
      const related = transactions.filter(
        (t) =>
          t.date >= start &&
          t.date <= end &&
          (!budget.category_id || t.category_id === budget.category_id),
      );
      const used = related.reduce((sum, t) => sum + Number(t.amount), 0);
      const planned = Number(budget.planned_amount);
      const percentage = planned > 0 ? (used / planned) * 100 : 0;
      const label =
        percentage > 100
          ? "lewat"
          : percentage >= 100
            ? "habis"
            : percentage >= 80
              ? "waspada"
              : "aman";
      return {
        ...budget,
        range: { start, end },
        used_amount: used,
        remaining_amount: planned - used,
        percentage: Math.round(percentage),
        status_label: label,
        related_transactions: related.slice(0, 8),
      };
    }),
  };
}

async function businessOverview(ctx: SoraToolContext, businessId?: string | null) {
  const filters: Filter[] = [["sold_at", "gte", startOfMonthIso()]];
  if (businessId) filters.push(["business_id", "eq", businessId]);
  const [sales, products, businesses] = await Promise.all([
    rows(ctx, "sales", "id,business_id,product_name,quantity,total,profit,sold_at", {
      limit: 200,
      filters,
    }),
    rows(ctx, "products", "id,business_id,name,stock,min_stock,price,hpp", {
      limit: 100,
      filters: businessId ? [["business_id", "eq", businessId]] : [],
    }),
    rows(ctx, "businesses", "id,name,description", { limit: 50, orderBy: "name", ascending: true }),
  ]);
  const salesRows = sales.rows as Array<{
    business_id: string | null;
    product_name: string;
    quantity: number;
    total: number;
    profit: number;
  }>;
  const productRows = products.rows as Array<{
    name: string;
    stock: number;
    min_stock: number;
    business_id: string | null;
  }>;
  const revenue = salesRows.reduce((sum, row) => sum + Number(row.total), 0);
  const profit = salesRows.reduce((sum, row) => sum + Number(row.profit), 0);
  const byBusiness = new Map<string, { revenue: number; profit: number; count: number }>();
  for (const row of salesRows) {
    const key = row.business_id ?? "unknown";
    const item = byBusiness.get(key) ?? { revenue: 0, profit: 0, count: 0 };
    item.revenue += Number(row.total);
    item.profit += Number(row.profit);
    item.count += 1;
    byBusiness.set(key, item);
  }
  const byProduct = new Map<string, { qty: number; revenue: number; profit: number }>();
  for (const row of salesRows) {
    const item = byProduct.get(row.product_name) ?? { qty: 0, revenue: 0, profit: 0 };
    item.qty += Number(row.quantity);
    item.revenue += Number(row.total);
    item.profit += Number(row.profit);
    byProduct.set(row.product_name, item);
  }
  return {
    selected_business_id: businessId ?? null,
    businesses: businesses.rows,
    revenue,
    profit,
    transaction_count: salesRows.length,
    product_count: productRows.length,
    low_stock: productRows.filter((p) => Number(p.stock) <= Number(p.min_stock ?? 0)).slice(0, 10),
    top_products: Array.from(byProduct.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
    by_business: Array.from(byBusiness.entries())
      .map(([id, value]) => ({ business_id: id, ...value }))
      .sort((a, b) => b.profit - a.profit),
  };
}

async function healthOverview(ctx: SoraToolContext) {
  const today = getWibNow().date;
  const [plans, logs, body, supplements, recovery, tx] = await Promise.all([
    rows(
      ctx,
      "workout_plans",
      "id,title,workout_date,workout_time,workout_type,status,target_duration_minutes",
      { limit: 5, filters: [["workout_date", "eq", today]] },
    ),
    rows(ctx, "workout_logs", "id,workout_date,workout_type,duration_minutes,intensity", {
      limit: 14,
      orderBy: "workout_date",
    }),
    rows(
      ctx,
      "body_metrics",
      "metric_date,weight_kg,sleep_hours,sleep_quality,water_liters,steps",
      { limit: 14, orderBy: "metric_date" },
    ),
    rows(ctx, "supplement_items", "id,name,stock_quantity,unit,low_stock_threshold,frequency", {
      limit: 20,
      orderBy: "name",
      ascending: true,
    }),
    rows(ctx, "recovery_logs", "log_date,soreness,stress,energy,sleep_quality,recovery_score", {
      limit: 7,
      orderBy: "log_date",
    }),
    rows(ctx, "transactions", "amount,date,note,category_id", {
      limit: 50,
      filters: [
        ["type", "eq", "expense"],
        ["date", "gte", startOfMonthIso()],
      ],
    }),
  ]);
  const bodyRows = body.rows as Array<{
    weight_kg?: number;
    sleep_hours?: number;
    water_liters?: number;
  }>;
  const avg = (vals: number[]) =>
    vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return {
    today_workout: plans.rows,
    recent_workout_logs: logs.rows,
    latest_body_metric: bodyRows[0] ?? null,
    sleep_average: avg(bodyRows.map((r) => Number(r.sleep_hours)).filter(Number.isFinite)),
    water_average: avg(bodyRows.map((r) => Number(r.water_liters)).filter(Number.isFinite)),
    supplements_due_or_low_stock: supplements.ok
      ? (supplements.rows as Array<any>).filter(
          (s) => Number(s.stock_quantity ?? 0) <= Number(s.low_stock_threshold ?? 0),
        )
      : supplements,
    recovery_latest: recovery.rows[0] ?? null,
    health_expense_candidates: (tx.rows as Array<{ note?: string | null }>)
      .filter((t) =>
        /health|sehat|suplemen|supplement|whey|vitamin|gym|workout/i.test(t.note ?? ""),
      )
      .slice(0, 12),
  };
}

export function createSoraTools(ctx: SoraToolContext) {
  const readTool = (
    description: string,
    table: string,
    columns = "*",
    defaults: Parameters<typeof rows>[3] = {},
  ) =>
    tool({
      description,
      inputSchema: z.object({
        limit: z.number().min(1).max(50).optional(),
      }),
      execute: async ({ limit }) =>
        rows(ctx, table, columns, { ...defaults, limit: limit ?? defaults.limit ?? 20 }),
    });

  const tools: Record<string, any> = {
    readUserData: tool({
      description:
        "Safe allowlisted reader for user-facing Faza OS data, always scoped to the active user and limited to 20 rows.",
      inputSchema: z.object({
        table: z.enum(Object.keys(SAFE_READ_COLUMNS) as [string, ...string[]]),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async ({ table, limit }) =>
        rows(ctx, table, SAFE_READ_COLUMNS[table], { limit: limit ?? 10 }),
    }),
    updateUserRecord: tool({
      description: "Update one exact user-owned record using allowlisted fields only.",
      inputSchema: z.object({
        table: z.enum(Object.keys(SAFE_UPDATE_COLUMNS) as [string, ...string[]]),
        recordId: z.string().uuid(),
        changes: z.record(z.string(), z.unknown()),
      }),
      execute: async ({ table, recordId, changes }) => {
        const safe = Object.fromEntries(
          Object.entries(changes).filter(([key]) =>
            (SAFE_UPDATE_COLUMNS[table] ?? []).includes(key),
          ),
        );
        if (!Object.keys(safe).length) return { ok: false, message: "Tidak ada field aman." };
        const { data, error } = await db(ctx)
          .from(table)
          .update(safe)
          .eq("id", recordId)
          .eq("user_id", ctx.userId)
          .is("deleted_at", null)
          .select("id")
          .maybeSingle();
        return error
          ? { ok: false, message: error.message }
          : { ok: Boolean(data), updated: Object.keys(safe) };
      },
    }),
    requestDeleteRecord: tool({
      description: "Start a server-side two-step soft-delete for one exact record.",
      inputSchema: z.object({
        table: z.string(),
        recordId: z.string().uuid().optional(),
        query: z.string().max(120).optional(),
      }),
      execute: async (input) => prepareServerDelete(ctx, input),
    }),
    confirmPendingDelete: tool({
      description: "Continue pending deletion; the server validates raw user confirmation.",
      inputSchema: z.object({}),
      execute: async () => continueServerDelete(ctx),
    }),
    runSafeMaintenance: tool({
      description: "Run an allowlisted, user-scoped maintenance action.",
      inputSchema: z.object({ action: z.enum(["refresh_garden", "schema_audit"]) }),
      execute: async ({ action }) => {
        if (action === "schema_audit") return { ok: true, schema: getFazaSchemaMap() };
        const { error } = await db(ctx).rpc("refresh_garden_season", {
          p_user_id: ctx.userId,
          p_date: getWibNow().date,
        });
        return error ? { ok: false, message: error.message } : { ok: true };
      },
    }),
    rememberProfileFact: tool({
      description: "Save a permanent memory only after an explicit remember request.",
      inputSchema: z.object({
        category: z.enum([
          "identity",
          "communication",
          "interest",
          "education",
          "work",
          "project",
          "goal",
          "habit",
          "appearance",
          "other",
        ]),
        key: z.string().min(2).max(80),
        content: z.string().min(2).max(1000),
      }),
      execute: async ({ category, key, content }) => {
        const { data, error } = await db(ctx)
          .from("sora_profile_memories")
          .upsert(
            {
              user_id: ctx.userId,
              category,
              memory_key: key,
              content,
              source_channel: ctx.channel ?? "web",
              deleted_at: null,
            },
            { onConflict: "user_id,memory_key" },
          )
          .select("id,category,content")
          .maybeSingle();
        return error ? { ok: false, message: error.message } : { ok: true, memory: data };
      },
    }),
    getFazaSchemaMap: tool({
      description:
        "Full Faza OS schema registry: all modules, tables, purposes, relationships, and planned/implemented status.",
      inputSchema: z.object({}),
      execute: async () => ({ schema: getFazaSchemaMap() }),
    }),
    getModuleTables: tool({
      description: "Get tables for a Faza OS module.",
      inputSchema: z.object({ module: z.string() }),
      execute: async ({ module }) => ({ module, tables: getModuleTables(module) }),
    }),
    getAvailableDataSummary: tool({
      description:
        "Counts available records per table for the current user. Use for broad questions like 'data apa saja yang kamu tahu?'.",
      inputSchema: z.object({}),
      execute: async () => getAvailableDataSummary(ctx.userId, ctx.supabase),
    }),
    searchRealtimeWeb: tool({
      description:
        "Realtime web search for external facts that change fast: latest news, releases, current prices, schedules, weather, public facts, and live internet context. Returns compact snippets to save tokens.",
      inputSchema: z.object({
        query: z.string().min(3).max(180),
      }),
      execute: async ({ query }) => ({ results: await searchWeb(query) }),
    }),
    getTablePurpose: tool({
      description: "Explain a table's purpose, key columns, relationships, and common questions.",
      inputSchema: z.object({ table: z.string() }),
      execute: async ({ table }) => ({ table, purpose: getTablePurpose(table) }),
    }),

    getMoneyOverview: tool({
      description:
        "Money overview for current month, debts, receivables, bills, assets, and investments.",
      inputSchema: z.object({}),
      execute: async () => moneyOverview(ctx),
    }),
    getTransactions: readTool(
      "Recent transactions with optional limit.",
      "transactions",
      "id,type,amount,date,category_id,account_id,note",
      { orderBy: "date" },
    ),
    getBudgetStatus: tool({
      description:
        "Envelope/category budget status with used, remaining, percentage, and related transactions.",
      inputSchema: z.object({}),
      execute: async () => budgetStatus(ctx),
    }),
    getBudgetDetails: tool({
      description: "Detailed budget status for a budget id if provided.",
      inputSchema: z.object({ budgetId: z.string().optional() }),
      execute: async ({ budgetId }) => {
        const status = await budgetStatus(ctx);
        return budgetId
          ? { budgets: status.budgets.filter((b: any) => b.id === budgetId) }
          : status;
      },
    }),
    getDebts: readTool(
      "Active debts.",
      "debts",
      "id,lender_name,amount,remaining_balance,due_date,status,notes",
      { orderBy: "due_date", ascending: true, filters: [["status", "neq", "paid"]] },
    ),
    getDebtPayments: readTool(
      "Debt payment records.",
      "debt_payments",
      "id,debt_id,amount,payment_date,method,note",
      { orderBy: "payment_date" },
    ),
    getReceivables: readTool(
      "Active receivables/piutang.",
      "receivables",
      "id,borrower_name,amount,remaining_amount,promised_payment_date,status,notes",
      { orderBy: "promised_payment_date", ascending: true, filters: [["status", "neq", "paid"]] },
    ),
    getReceivablePayments: readTool(
      "Receivable payment records.",
      "receivable_payments",
      "id,receivable_id,amount,received_date,method,note",
      { orderBy: "received_date" },
    ),
    getBills: readTool(
      "Upcoming bills.",
      "bills",
      "id,name,amount,due_date,status,recurrence,category",
      { orderBy: "due_date", ascending: true },
    ),
    getAssets: readTool(
      "Assets.",
      "assets",
      "id,name,asset_type,current_value,acquisition_date,notes",
      { orderBy: "name", ascending: true },
    ),
    getInvestments: readTool(
      "Investment holdings and stored current prices.",
      "investments",
      "id,type,ticker,name,quantity,avg_buy_price,current_price,currency,last_updated_at,last_price_error",
      { orderBy: "name", ascending: true },
    ),
    getInvestmentPriceHistory: readTool(
      "Investment stored price history if table exists.",
      "investment_price_history",
      "id,investment_id,ticker,provider,price,currency,fetched_at",
      { orderBy: "fetched_at" },
    ),
    getCashflowProjection: tool({
      description:
        "Simple cashflow projection from current month income, expense, and upcoming bills.",
      inputSchema: z.object({}),
      execute: async () => {
        const overview = await moneyOverview(ctx);
        const billTotal = (overview.upcoming_bills as Array<{ amount: number }>).reduce(
          (sum, bill) => sum + Number(bill.amount),
          0,
        );
        return {
          ...overview,
          upcoming_bill_total: billTotal,
          projected_after_bills: overview.cashflow - billTotal,
        };
      },
    }),
    getSpreadsheetSyncStatus: readTool(
      "Google Sheets Money sync connection/log status if tables exist.",
      "google_sheets_connections",
      "id,status,last_sync_at,last_error,spreadsheet_url",
      { limit: 3, orderBy: "updated_at" },
    ),

    getBusinesses: readTool("List businesses.", "businesses", "id,name,description,created_at", {
      orderBy: "name",
      ascending: true,
    }),
    getSelectedBusiness: tool({
      description: "Selected business from user preferences.",
      inputSchema: z.object({}),
      execute: async () => {
        const id = await selectedBusinessId(ctx);
        if (!id) return { selected_business_id: null };
        const { row } = await maybeSingle(ctx, "businesses", "id,name,description", [
          ["id", "eq", id],
        ]);
        return { selected_business_id: id, business: row };
      },
    }),
    getBusinessOverview: tool({
      description:
        "Business overview separated by business_id. If no id, uses selected business or all businesses.",
      inputSchema: z.object({
        businessId: z.string().nullable().optional(),
        businessName: z.string().nullable().optional(),
      }),
      execute: async ({ businessId, businessName }) =>
        businessOverview(ctx, await selectedOrNamedBusiness(ctx, businessId, businessName)),
    }),
    getBusinessProducts: tool({
      description: "Products for selected/specified business.",
      inputSchema: z.object({ businessId: z.string().nullable().optional() }),
      execute: async ({ businessId }) =>
        rows(ctx, "products", "id,business_id,name,sku,hpp,price,stock,min_stock", {
          filters: businessId ? [["business_id", "eq", businessId]] : [],
        }),
    }),
    getBusinessSales: tool({
      description: "Sales for selected/specified business.",
      inputSchema: z.object({ businessId: z.string().nullable().optional() }),
      execute: async ({ businessId }) =>
        rows(ctx, "sales", "id,business_id,product_name,quantity,total,profit,sold_at,channel", {
          orderBy: "sold_at",
          filters: businessId ? [["business_id", "eq", businessId]] : [],
        }),
    }),
    getBusinessSuppliers: tool({
      description: "Suppliers, including global suppliers and business-linked suppliers.",
      inputSchema: z.object({ businessId: z.string().nullable().optional() }),
      execute: async ({ businessId }) =>
        rows(ctx, "suppliers", "id,business_id,name,contact,notes", {
          orderBy: "name",
          ascending: true,
          filters: businessId ? [["business_id", "in", [businessId, null]]] : [],
        }),
    }),
    getBusinessHPP: readTool(
      "Saved HPP calculations if table exists.",
      "hpp_calculations",
      "id,business_id,product_id,total_cost,yield_portion,hpp_per_unit,suggested_price,created_at",
      { orderBy: "created_at" },
    ),
    getBusinessPromos: readTool(
      "Saved promo simulations if table exists.",
      "promo_simulations",
      "id,business_id,product_id,discount_percent,promo_price,target_units,result_status,created_at",
      { orderBy: "created_at" },
    ),
    getBusinessInventory: readTool(
      "Business inventory if table exists.",
      "inventory_items",
      "id,business_id,product_id,name,quantity,unit,low_stock_threshold,expires_at",
      { orderBy: "name", ascending: true },
    ),
    getLowStockItems: tool({
      description: "Low stock products plus inventory low stock if available.",
      inputSchema: z.object({}),
      execute: async () => {
        const productRows = await rows(ctx, "products", "id,business_id,name,stock,min_stock", {
          limit: 100,
        });
        const inventoryRows = await rows(
          ctx,
          "inventory_items",
          "id,business_id,name,quantity,unit,low_stock_threshold,expires_at",
          { limit: 100 },
        );
        return {
          products: (productRows.rows as Array<any>).filter(
            (p) => Number(p.stock) <= Number(p.min_stock ?? 0),
          ),
          inventory: inventoryRows.ok
            ? (inventoryRows.rows as Array<any>).filter(
                (p) => Number(p.quantity) <= Number(p.low_stock_threshold ?? 0),
              )
            : inventoryRows,
        };
      },
    }),
    getBusinessProfitReport: tool({
      description: "Profit report by business for current month.",
      inputSchema: z.object({}),
      execute: async () => businessOverview(ctx, null),
    }),
    getAllBusinessAggregate: tool({
      description: "Aggregate all businesses without mixing individual details.",
      inputSchema: z.object({}),
      execute: async () => businessOverview(ctx, null),
    }),

    getAcademicTasks: readTool(
      "Academic tasks.",
      "academic_tasks",
      "id,title,priority,status,due_date,course_id",
      { orderBy: "due_date", ascending: true },
    ),
    getCourses: readTool("Courses.", "courses", "id,name,code,lecturer,sks,semester", {
      orderBy: "name",
      ascending: true,
    }),
    getRevisionNotes: readTool("Revision notes if table exists.", "revision_notes", "*"),
    getActivityEvents: readTool(
      "Internal Faza OS activity events for 30 days.",
      "activity_events",
      "id,title,kind,starts_at,ends_at,location,gcal_event_id",
      {
        orderBy: "starts_at",
        ascending: true,
        filters: [
          ["starts_at", "gte", new Date().toISOString()],
          ["starts_at", "lte", new Date(Date.now() + 30 * 86400000).toISOString()],
        ],
      },
    ),
    getOrganizations: readTool("Organizations.", "organizations", "id,name,role,kind,status", {
      orderBy: "name",
      ascending: true,
    }),
    getOrgMeetings: readTool(
      "Organization meetings.",
      "org_meetings",
      "id,organization_id,title,starts_at,location,agenda",
      { orderBy: "starts_at", ascending: true },
    ),
    getCompetitions: readTool(
      "Competitions.",
      "competitions",
      "id,name,organizer,status,registration_deadline,event_date,result",
      { orderBy: "registration_deadline", ascending: true },
    ),
    getPortfolioItems: readTool(
      "Portfolio items.",
      "portfolio_items",
      "id,title,kind,role,link,date_on",
      { orderBy: "date_on" },
    ),
    getActionItems: readTool("Action items if table exists.", "action_items", "*"),

    getDailyLogs: readTool(
      "Latest 7 daily logs.",
      "daily_logs",
      "id,log_date,mood,energy,focus,wins,struggles,tomorrow_focus",
      { limit: 7, orderBy: "log_date" },
    ),
    getWeeklyReviews: readTool(
      "Latest 4 weekly reviews.",
      "weekly_reviews",
      "id,week_start,highlights,lessons,next_week_focus,score_money,score_academic,score_business,score_health",
      { limit: 4, orderBy: "week_start" },
    ),
    getMonthlyReviews: readTool("Monthly reviews if table exists.", "monthly_reviews", "*", {
      limit: 6,
      orderBy: "month_start",
    }),
    getGoals: readTool("Goals.", "goals", "id,title,area,target_date,progress,status,notes", {
      orderBy: "target_date",
      ascending: true,
    }),
    getJournalProgress: tool({
      description: "Journal streak/progress from latest daily and weekly reviews.",
      inputSchema: z.object({}),
      execute: async () => {
        const [daily, weekly, goals] = await Promise.all([
          rows(ctx, "daily_logs", "log_date,mood,energy,focus", { limit: 7, orderBy: "log_date" }),
          rows(
            ctx,
            "weekly_reviews",
            "week_start,score_money,score_academic,score_business,score_health",
            { limit: 4, orderBy: "week_start" },
          ),
          rows(ctx, "goals", "title,progress,status", { limit: 20 }),
        ]);
        return {
          daily_logs_latest_7: daily.rows,
          weekly_reviews_latest_4: weekly.rows,
          goals: goals.rows,
        };
      },
    }),
    getJournalRetentionStatus: readTool(
      "Journal retention cleanup logs if table exists.",
      "journal_retention_logs",
      "id,table_name,deleted_count,ran_at",
      { orderBy: "ran_at" },
    ),

    getWorkoutToday: tool({
      description: "Today's workout plans and logs.",
      inputSchema: z.object({}),
      execute: async () => healthOverview(ctx),
    }),
    getWorkoutPlans: readTool(
      "Workout plans.",
      "workout_plans",
      "id,title,workout_date,workout_time,workout_type,status,target_duration_minutes,target_intensity",
      { orderBy: "workout_date" },
    ),
    getWorkoutLogs: readTool(
      "Workout logs.",
      "workout_logs",
      "id,workout_date,workout_type,duration_minutes,intensity,notes",
      { orderBy: "workout_date" },
    ),
    getWorkoutSets: readTool(
      "Workout sets.",
      "workout_sets",
      "id,workout_log_id,exercise_id,set_number,reps,weight,duration_seconds,distance_km",
      { orderBy: "created_at" },
    ),
    getExerciseLibrary: readTool(
      "Exercise library.",
      "exercise_library",
      "id,name,category,muscle_group,equipment,default_sets,default_reps",
      { orderBy: "name", ascending: true },
    ),
    getBodyMetrics: readTool(
      "Body metrics.",
      "body_metrics",
      "id,metric_date,weight_kg,body_fat_percentage,waist_cm,sleep_hours,sleep_quality,water_liters,steps",
      { orderBy: "metric_date" },
    ),
    getSupplementItems: readTool(
      "Supplement items if table exists.",
      "supplement_items",
      "id,name,category,dosage,frequency,stock_quantity,unit,low_stock_threshold,price_per_unit",
      { orderBy: "name", ascending: true },
    ),
    getSupplementLogs: readTool(
      "Supplement logs if table exists.",
      "supplement_logs",
      "id,supplement_id,taken_at,quantity,notes",
      { orderBy: "taken_at" },
    ),
    getRecoveryLogs: readTool(
      "Recovery logs if table exists.",
      "recovery_logs",
      "id,log_date,soreness,stress,energy,sleep_quality,recovery_score,notes",
      { orderBy: "log_date" },
    ),

    getTelegramStatus: tool({
      description: "Telegram linked state and notification preferences.",
      inputSchema: z.object({}),
      execute: async () => {
        const [tg, pref] = await Promise.all([
          maybeSingle(ctx, "telegram_users", "user_id,chat_id,linked_at"),
          maybeSingle(
            ctx,
            "user_preferences",
            "telegram_enabled,notify_morning_brief,notify_midday_check,notify_night_review,quiet_hours_enabled,quiet_hours_start,quiet_hours_end",
          ),
        ]);
        return { telegram: tg.row, preferences: pref.row };
      },
    }),
    getTelegramRecentMessages: readTool(
      "Recent Telegram message logs.",
      "telegram_message_logs",
      "id,direction,message_text,status,error_message,created_at",
      { limit: 10, orderBy: "created_at" },
    ),
    getNotificationHistory: readTool(
      "Notification history.",
      "notifications",
      "id,type,channel,status,dedupe_key,sent_at,error_message,created_at",
      { limit: 20, orderBy: "created_at" },
    ),
    getTelegramJobs: readTool(
      "Telegram jobs.",
      "telegram_jobs",
      "id,job_type,status,attempts,last_error,scheduled_at,created_at",
      { limit: 12, orderBy: "created_at" },
    ),
    getGoogleCalendarEvents: tool({
      description:
        "Google Calendar connector events for the next 30 days. Use together with getActivityEvents for agenda questions.",
      inputSchema: z.object({}),
      execute: async () => fetchGoogleCalendarEvents(),
    }),
    getGoogleCalendarStatus: tool({
      description: "Google Calendar connector status and 30-day event count.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await fetchGoogleCalendarEvents();
        return {
          configured: result.configured,
          lookahead_days: 30,
          event_count: result.events.length,
          error: (result as { error?: string }).error,
        };
      },
    }),

    addExpense: tool({
      description: "Add an expense transaction. Low-risk if amount and note are clear.",
      inputSchema: z.object({
        amount: z.number().positive(),
        note: z.string().default(""),
        date: z.string().optional(),
        categoryName: z.string().optional(),
      }),
      execute: async ({ amount, note, date, categoryName }) => {
        const categoryId = categoryName ? await getCategoryId(ctx, categoryName, "expense") : null;
        return {
          transaction: await addTransaction(ctx, "expense", amount, note, date, categoryId),
        };
      },
    }),
    addIncome: tool({
      description: "Add an income transaction.",
      inputSchema: z.object({
        amount: z.number().positive(),
        note: z.string().default(""),
        date: z.string().optional(),
        categoryName: z.string().optional(),
      }),
      execute: async ({ amount, note, date, categoryName }) => {
        const categoryId = categoryName ? await getCategoryId(ctx, categoryName, "income") : null;
        return { transaction: await addTransaction(ctx, "income", amount, note, date, categoryId) };
      },
    }),
    addTask: tool({
      description: "Add academic task.",
      inputSchema: z.object({
        title: z.string().min(1),
        dueDate: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      }),
      execute: async ({ title, dueDate, priority }) => {
        const { data, error } = await db(ctx)
          .from("academic_tasks")
          .insert({
            user_id: ctx.userId,
            title,
            due_date: dueDate ?? null,
            priority,
            status: "todo",
          })
          .select("id,title,due_date,priority,status")
          .maybeSingle();
        if (error) throw error;
        return { task: data };
      },
    }),
    addAgenda: tool({
      description: "Add internal Faza OS agenda.",
      inputSchema: z.object({
        title: z.string().min(1),
        startsAt: z.string(),
        endsAt: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
      execute: async (input) => {
        const { data, error } = await db(ctx)
          .from("activity_events")
          .insert({
            user_id: ctx.userId,
            title: input.title,
            starts_at: input.startsAt,
            ends_at: input.endsAt ?? null,
            location: input.location ?? null,
            notes: input.notes ?? null,
          })
          .select("id,title,starts_at")
          .maybeSingle();
        if (error) throw error;
        return { event: data };
      },
    }),
    addDebt: tool({
      description: "Add debt owed by user.",
      inputSchema: z.object({
        lenderName: z.string(),
        amount: z.number().positive(),
        dueDate: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
      execute: async ({ lenderName, amount, dueDate, notes }) => {
        const { data, error } = await db(ctx)
          .from("debts")
          .insert({
            user_id: ctx.userId,
            lender_name: lenderName,
            amount,
            remaining_balance: amount,
            due_date: dueDate ?? null,
            notes: notes ?? null,
            status: "active",
          })
          .select("id,lender_name,remaining_balance,due_date,status")
          .maybeSingle();
        if (error) throw error;
        return { debt: data };
      },
    }),
    addReceivable: tool({
      description: "Add receivable/piutang owed to user.",
      inputSchema: z.object({
        borrowerName: z.string(),
        amount: z.number().positive(),
        promisedPaymentDate: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
      execute: async ({ borrowerName, amount, promisedPaymentDate, notes }) => {
        const { data, error } = await db(ctx)
          .from("receivables")
          .insert({
            user_id: ctx.userId,
            borrower_name: borrowerName,
            amount,
            remaining_amount: amount,
            promised_payment_date: promisedPaymentDate ?? null,
            notes: notes ?? null,
            status: "active",
          })
          .select("id,borrower_name,remaining_amount,promised_payment_date,status")
          .maybeSingle();
        if (error) throw error;
        return { receivable: data };
      },
    }),
    addBill: tool({
      description: "Add bill.",
      inputSchema: z.object({
        name: z.string(),
        amount: z.number().nonnegative(),
        dueDate: z.string(),
        recurrence: z.string().optional(),
      }),
      execute: async ({ name, amount, dueDate, recurrence }) => {
        const { data, error } = await db(ctx)
          .from("bills")
          .insert({
            user_id: ctx.userId,
            name,
            amount,
            due_date: dueDate,
            recurrence: recurrence ?? "monthly",
            status: "upcoming",
          })
          .select("id,name,amount,due_date,status")
          .maybeSingle();
        if (error) throw error;
        return { bill: data };
      },
    }),
    addWorkoutPlan: tool({
      description: "Add workout plan.",
      inputSchema: z.object({
        title: z.string(),
        workoutDate: z.string(),
        workoutType: z.string().default("other"),
        durationMinutes: z.number().optional(),
      }),
      execute: async ({ title, workoutDate, workoutType, durationMinutes }) => {
        const { data, error } = await db(ctx)
          .from("workout_plans")
          .insert({
            user_id: ctx.userId,
            title,
            workout_date: workoutDate,
            workout_type: workoutType,
            target_duration_minutes: durationMinutes ?? null,
            status: "planned",
          })
          .select("id,title,workout_date,status")
          .maybeSingle();
        if (error) throw error;
        return { workout_plan: data };
      },
    }),
    addWorkoutLog: tool({
      description: "Add workout log.",
      inputSchema: z.object({
        workoutDate: z.string().optional(),
        workoutType: z.string().default("other"),
        durationMinutes: z.number().optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ workoutDate, workoutType, durationMinutes, notes }) => {
        const { data, error } = await db(ctx)
          .from("workout_logs")
          .insert({
            user_id: ctx.userId,
            workout_date: workoutDate ?? getWibNow().date,
            workout_type: workoutType,
            duration_minutes: durationMinutes ?? null,
            notes: notes ?? null,
          })
          .select("id,workout_date,workout_type")
          .maybeSingle();
        if (error) throw error;
        return { workout_log: data };
      },
    }),
    addBodyMetric: tool({
      description: "Add/update body metric for date.",
      inputSchema: z.object({
        metricDate: z.string().optional(),
        weightKg: z.number().optional(),
        sleepHours: z.number().optional(),
        sleepQuality: z.number().min(1).max(5).optional(),
        waterLiters: z.number().optional(),
        notes: z.string().optional(),
      }),
      execute: async (input) => {
        const { data, error } = await db(ctx)
          .from("body_metrics")
          .upsert(
            {
              user_id: ctx.userId,
              metric_date: input.metricDate ?? getWibNow().date,
              weight_kg: input.weightKg ?? null,
              sleep_hours: input.sleepHours ?? null,
              sleep_quality: input.sleepQuality ?? null,
              water_liters: input.waterLiters ?? null,
              notes: input.notes ?? null,
            },
            { onConflict: "user_id,metric_date" },
          )
          .select("id,metric_date,weight_kg,sleep_hours,water_liters")
          .maybeSingle();
        if (error) throw error;
        return { body_metric: data };
      },
    }),
    addSupplementPurchase: tool({
      description:
        "Add supplement purchase if supplement tables exist; also creates linked Money expense.",
      inputSchema: z.object({
        supplementName: z.string(),
        amount: z.number().positive(),
        quantity: z.number().positive().default(1),
        store: z.string().optional(),
        date: z.string().optional(),
      }),
      execute: async ({ supplementName, amount, quantity, store, date }) => {
        const categoryId = await getCategoryId(ctx, "Suplemen", "expense");
        const transaction = await addTransaction(
          ctx,
          "expense",
          amount,
          `Suplemen: ${supplementName}`,
          date,
          categoryId,
        );
        const { data, error } = await db(ctx)
          .from("supplement_purchases")
          .insert({
            user_id: ctx.userId,
            purchase_date: date ?? getWibNow().date,
            amount,
            quantity,
            store: store ?? null,
            transaction_id: transaction.id,
            notes: supplementName,
          })
          .select("id,amount,transaction_id")
          .maybeSingle();
        if (error)
          return {
            transaction,
            supplement_purchase: null,
            message: isMissingTable(error.message) ? MISSING_TABLE_REPLY : error.message,
          };
        return { transaction, supplement_purchase: data };
      },
    }),
    addBusiness: tool({
      description: "Add business.",
      inputSchema: z.object({ name: z.string(), description: z.string().optional() }),
      execute: async ({ name, description }) => {
        const { data, error } = await db(ctx)
          .from("businesses")
          .insert({ user_id: ctx.userId, name, description: description ?? null })
          .select("id,name,description")
          .maybeSingle();
        if (error) throw error;
        return { business: data };
      },
    }),
    addProduct: tool({
      description: "Add product to selected/specified business.",
      inputSchema: z.object({
        businessId: z.string().optional(),
        name: z.string(),
        price: z.number().nonnegative().default(0),
        hpp: z.number().nonnegative().default(0),
        stock: z.number().default(0),
        minStock: z.number().default(0),
      }),
      execute: async ({ businessId, name, price, hpp, stock, minStock }) => {
        const id = await selectedOrNamedBusiness(ctx, businessId);
        if (!id) return { needs_business: true, message: "Pilih bisnis dulu, Tuan." };
        const { data, error } = await db(ctx)
          .from("products")
          .insert({
            user_id: ctx.userId,
            business_id: id,
            name,
            price,
            hpp,
            stock,
            min_stock: minStock,
          })
          .select("id,business_id,name,price,hpp,stock")
          .maybeSingle();
        if (error) throw error;
        return { product: data };
      },
    }),
    addSale: tool({
      description: "Add sale to selected/specified business.",
      inputSchema: z.object({
        businessId: z.string().optional(),
        businessName: z.string().optional(),
        productName: z.string(),
        productId: z.string().nullable().optional(),
        quantity: z.number().positive(),
        total: z.number().positive(),
        unitPrice: z.number().optional(),
        unitHpp: z.number().optional(),
        soldAt: z.string().optional(),
        channel: z.string().optional(),
      }),
      execute: async (input) => {
        const id = await selectedOrNamedBusiness(ctx, input.businessId, input.businessName);
        if (!id)
          return {
            needs_business: true,
            message: "Bisnis mana, Tuan? Pilih atau sebutkan nama bisnis dulu.",
          };
        const unitPrice = input.unitPrice ?? input.total / input.quantity;
        const unitHpp = input.unitHpp ?? 0;
        const { data, error } = await db(ctx)
          .from("sales")
          .insert({
            user_id: ctx.userId,
            business_id: id,
            product_id: input.productId ?? null,
            product_name: input.productName,
            quantity: input.quantity,
            unit_price: unitPrice,
            unit_hpp: unitHpp,
            total: input.total,
            profit: input.total - input.quantity * unitHpp,
            channel: input.channel ?? null,
            sold_at: input.soldAt ?? getWibNow().date,
          })
          .select("id,business_id,product_name,total,profit,sold_at")
          .maybeSingle();
        if (error) throw error;
        return { sale: data };
      },
    }),
    addBusinessExpense: tool({
      description: "Add expense for selected/specified business; optionally mirrors to Money.",
      inputSchema: z.object({
        businessId: z.string().optional(),
        businessName: z.string().optional(),
        name: z.string(),
        amount: z.number().positive(),
        expenseDate: z.string().optional(),
        category: z.string().optional(),
        vendor: z.string().optional(),
        notes: z.string().optional(),
        mirrorToMoney: z.boolean().default(true),
      }),
      execute: async (input) => {
        const id = await selectedOrNamedBusiness(ctx, input.businessId, input.businessName);
        if (!id)
          return {
            needs_business: true,
            message: "Bisnis mana, Tuan? Pilih atau sebutkan nama bisnis dulu.",
          };
        let transactionId: string | null = null;
        if (input.mirrorToMoney) {
          const tx = await addTransaction(
            ctx,
            "expense",
            input.amount,
            input.notes || `Pengeluaran bisnis: ${input.name}`,
            input.expenseDate,
            null,
          );
          transactionId = tx?.id ?? null;
        }
        const { data, error } = await db(ctx)
          .from("business_expenses")
          .insert({
            user_id: ctx.userId,
            business_id: id,
            name: input.name,
            amount: input.amount,
            expense_date: input.expenseDate ?? getWibNow().date,
            category: input.category ?? null,
            vendor: input.vendor ?? null,
            notes: input.notes ?? null,
            transaction_id: transactionId,
          })
          .select("id,business_id,name,amount,expense_date")
          .maybeSingle();
        if (error) throw error;
        return { business_expense: data, money_transaction_id: transactionId };
      },
    }),
    updateStock: tool({
      description: "Update product stock or inventory item stock.",
      inputSchema: z.object({
        productId: z.string().optional(),
        productName: z.string().optional(),
        quantity: z.number(),
        businessId: z.string().optional(),
      }),
      execute: async ({ productId, productName, quantity, businessId }) => {
        let id = productId;
        if (!id && productName) {
          const found = await rows(ctx, "products", "id,name,business_id", {
            limit: 1,
            filters: [
              ["name", "eq", productName],
              ...(businessId ? [["business_id", "eq", businessId] as Filter] : []),
            ],
          });
          id = (found.rows[0] as { id?: string } | undefined)?.id;
        }
        if (!id) return { message: "Produk tidak ditemukan." };
        const { data, error } = await db(ctx)
          .from("products")
          .update({ stock: quantity })
          .eq("id", id)
          .eq("user_id", ctx.userId)
          .select("id,name,stock")
          .maybeSingle();
        if (error) throw error;
        return { product: data };
      },
    }),
    markTaskDone: tool({
      description: "Mark task done.",
      inputSchema: z.object({ taskId: z.string() }),
      execute: async ({ taskId }) => {
        const { data, error } = await db(ctx)
          .from("academic_tasks")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", taskId)
          .eq("user_id", ctx.userId)
          .select("id,title,status")
          .maybeSingle();
        if (error) throw error;
        return { task: data };
      },
    }),
    markWorkoutDone: tool({
      description: "Mark workout plan done and create workout log.",
      inputSchema: z.object({ workoutPlanId: z.string().optional() }),
      execute: async ({ workoutPlanId }) => {
        const today = getWibNow().date;
        const plan = workoutPlanId
          ? await maybeSingle(
              ctx,
              "workout_plans",
              "id,title,workout_date,workout_type,target_duration_minutes,target_intensity,status",
              [["id", "eq", workoutPlanId]],
            )
          : await maybeSingle(
              ctx,
              "workout_plans",
              "id,title,workout_date,workout_type,target_duration_minutes,target_intensity,status",
              [["workout_date", "eq", today]],
            );
        const p = plan.row as any;
        if (p?.id)
          await db(ctx)
            .from("workout_plans")
            .update({ status: "completed" })
            .eq("id", p.id)
            .eq("user_id", ctx.userId);
        const { data, error } = await db(ctx)
          .from("workout_logs")
          .insert({
            user_id: ctx.userId,
            workout_plan_id: p?.id ?? null,
            workout_date: p?.workout_date ?? today,
            workout_type: p?.workout_type ?? "other",
            duration_minutes: p?.target_duration_minutes ?? 30,
            intensity: p?.target_intensity ?? "moderate",
          })
          .select("id,workout_date,workout_type")
          .maybeSingle();
        if (error) throw error;
        return { workout_log: data, plan_updated: p?.id ?? null };
      },
    }),
    markDebtPaid: tool({
      description: "Mark debt paid by adding payment amount.",
      inputSchema: z.object({ debtId: z.string(), amount: z.number().positive().optional() }),
      execute: async ({ debtId, amount }) => {
        const debt = await maybeSingle(ctx, "debts", "id,remaining_balance", [
          ["id", "eq", debtId],
        ]);
        const pay = amount ?? Number((debt.row as any)?.remaining_balance ?? 0);
        const { data, error } = await db(ctx)
          .from("debt_payments")
          .insert({ user_id: ctx.userId, debt_id: debtId, amount: pay })
          .select("id,debt_id,amount")
          .maybeSingle();
        if (error) throw error;
        return { debt_payment: data };
      },
    }),
    markReceivablePaid: tool({
      description: "Mark receivable paid by adding payment amount.",
      inputSchema: z.object({ receivableId: z.string(), amount: z.number().positive().optional() }),
      execute: async ({ receivableId, amount }) => {
        const rec = await maybeSingle(ctx, "receivables", "id,remaining_amount", [
          ["id", "eq", receivableId],
        ]);
        const pay = amount ?? Number((rec.row as any)?.remaining_amount ?? 0);
        const { data, error } = await db(ctx)
          .from("receivable_payments")
          .insert({ user_id: ctx.userId, receivable_id: receivableId, amount: pay })
          .select("id,receivable_id,amount")
          .maybeSingle();
        if (error) throw error;
        return { receivable_payment: data };
      },
    }),
    createBudget: tool({
      description: "Create budget.",
      inputSchema: z.object({
        name: z.string(),
        plannedAmount: z.number().positive(),
        categoryId: z.string().nullable().optional(),
        periodType: z.enum(["daily", "weekly", "monthly", "custom"]).default("monthly"),
        startDate: z.string().optional(),
        endDate: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
      execute: async (input) => {
        const start = input.startDate ?? startOfMonthIso();
        const { data, error } = await db(ctx)
          .from("budgets")
          .insert({
            user_id: ctx.userId,
            name: input.name,
            planned_amount: input.plannedAmount,
            category_id: input.categoryId ?? null,
            period_type: input.periodType,
            start_date: start,
            end_date: input.endDate ?? budgetEnd(start, input.periodType),
            notes: input.notes ?? null,
          })
          .select("id,name,planned_amount,start_date,end_date")
          .maybeSingle();
        if (error) throw error;
        return { budget: data };
      },
    }),
    updateBudget: tool({
      description: "Update budget amount/status/date fields.",
      inputSchema: z.object({
        budgetId: z.string(),
        plannedAmount: z.number().positive().optional(),
        status: z.string().optional(),
        endDate: z.string().nullable().optional(),
      }),
      execute: async ({ budgetId, ...patch }) => {
        const dbPatch: Record<string, unknown> = {};
        if (patch.plannedAmount) dbPatch.planned_amount = patch.plannedAmount;
        if (patch.status) dbPatch.status = patch.status;
        if (patch.endDate !== undefined) dbPatch.end_date = patch.endDate;
        const { data, error } = await db(ctx)
          .from("budgets")
          .update(dbPatch)
          .eq("id", budgetId)
          .eq("user_id", ctx.userId)
          .select("id,name,planned_amount,status,end_date")
          .maybeSingle();
        if (error) throw error;
        return { budget: data };
      },
    }),
    createDailyLog: tool({
      description: "Create/update daily journal.",
      inputSchema: z.object({
        logDate: z.string().optional(),
        mood: z.number().min(1).max(5).optional(),
        energy: z.number().min(1).max(5).optional(),
        focus: z.number().min(1).max(5).optional(),
        wins: z.string().optional(),
        struggles: z.string().optional(),
        gratitude: z.string().optional(),
        tomorrowFocus: z.string().optional(),
      }),
      execute: async (input) => {
        const { data, error } = await db(ctx)
          .from("daily_logs")
          .upsert(
            {
              user_id: ctx.userId,
              log_date: input.logDate ?? getWibNow().date,
              mood: input.mood ?? null,
              energy: input.energy ?? null,
              focus: input.focus ?? null,
              wins: input.wins ?? null,
              struggles: input.struggles ?? null,
              gratitude: input.gratitude ?? null,
              tomorrow_focus: input.tomorrowFocus ?? null,
            },
            { onConflict: "user_id,log_date" },
          )
          .select("id,log_date,mood,energy,focus")
          .maybeSingle();
        if (error) throw error;
        return { daily_log: data };
      },
    }),
    createHabit: tool({
      description: "Create a habit with active weekdays and an optional Telegram reminder.",
      inputSchema: z.object({
        name: z.string().min(1).max(80),
        description: z.string().max(240).nullable().optional(),
        icon: z.string().max(8).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
        reminderEnabled: z.boolean().optional(),
        reminderTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .nullable()
          .optional(),
      }),
      execute: async (input) => {
        const { data, error } = await db(ctx)
          .from("habits")
          .insert({
            user_id: ctx.userId,
            name: input.name,
            description: input.description ?? null,
            icon: input.icon ?? "🌱",
            color: input.color ?? "#22c55e",
            weekdays: input.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
            reminder_enabled: input.reminderEnabled ?? false,
            reminder_time: input.reminderEnabled ? (input.reminderTime ?? "08:00") : null,
          })
          .select("id,name,weekdays,reminder_enabled,reminder_time")
          .maybeSingle();
        if (error) throw error;
        return { habit: data };
      },
    }),
    setHabitCompletion: tool({
      description: "Mark one habit complete or incomplete for a date.",
      inputSchema: z.object({
        habitId: z.string().uuid(),
        date: z.string().optional(),
        completed: z.boolean().default(true),
      }),
      execute: async ({ habitId, date, completed }) => {
        const logDate = date ?? getWibNow().date;
        const habit = await maybeSingle(ctx, "habits", "id,name", [["id", "eq", habitId]]);
        if (!habit.row) return { ok: false, message: "Habit tidak ditemukan." };
        if (completed) {
          const { data, error } = await db(ctx)
            .from("habit_logs")
            .upsert(
              { user_id: ctx.userId, habit_id: habitId, log_date: logDate },
              { onConflict: "habit_id,log_date" },
            )
            .select("id,habit_id,log_date")
            .maybeSingle();
          if (error) throw error;
          return { ok: true, completion: data };
        }
        const { error } = await db(ctx)
          .from("habit_logs")
          .delete()
          .eq("user_id", ctx.userId)
          .eq("habit_id", habitId)
          .eq("log_date", logDate);
        if (error) throw error;
        return { ok: true, completed: false, habitId, date: logDate };
      },
    }),
    createWeeklyReview: tool({
      description: "Create/update weekly review.",
      inputSchema: z.object({
        weekStart: z.string(),
        highlights: z.string().optional(),
        lessons: z.string().optional(),
        nextWeekFocus: z.string().optional(),
      }),
      execute: async ({ weekStart, highlights, lessons, nextWeekFocus }) => {
        const { data, error } = await db(ctx)
          .from("weekly_reviews")
          .upsert(
            {
              user_id: ctx.userId,
              week_start: weekStart,
              highlights: highlights ?? null,
              lessons: lessons ?? null,
              next_week_focus: nextWeekFocus ?? null,
            },
            { onConflict: "user_id,week_start" },
          )
          .select("id,week_start")
          .maybeSingle();
        if (error) throw error;
        return { weekly_review: data };
      },
    }),
  };
  for (const retired of [
    "getBusinessProducts",
    "getBusinessSales",
    "getBusinessSuppliers",
    "getBusinessHPP",
    "getBusinessPromos",
    "getBusinessInventory",
    "getBusinessProfitReport",
    "getAllBusinessAggregate",
    "addProduct",
    "addSale",
    "addBusinessExpense",
    "updateStock",
  ])
    delete tools[retired];
  return tools;
}

export type SoraTools = ReturnType<typeof createSoraTools>;
