import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requiredEnv } from "@/lib/env.server";
import type { SoraToolContext } from "./types";

const DELETE_TARGETS: Record<string, { label: string; display: string; search: string[] }> = {
  transactions: { label: "transaksi", display: "note", search: ["note"] },
  academic_tasks: { label: "tugas", display: "title", search: ["title", "notes"] },
  activity_events: { label: "agenda", display: "title", search: ["title", "notes"] },
  debts: { label: "hutang", display: "lender_name", search: ["lender_name", "notes"] },
  receivables: { label: "piutang", display: "borrower_name", search: ["borrower_name", "notes"] },
  bills: { label: "tagihan", display: "name", search: ["name", "notes"] },
  budgets: { label: "budget", display: "name", search: ["name"] },
  notes: { label: "catatan", display: "title", search: ["title", "body"] },
  goals: { label: "goal", display: "title", search: ["title", "notes"] },
  habits: { label: "habit", display: "name", search: ["name", "description"] },
  businesses: { label: "bisnis", display: "name", search: ["name"] },
  products: { label: "produk", display: "name", search: ["name"] },
  workout_plans: { label: "rencana workout", display: "title", search: ["title", "notes"] },
};

function admin() {
  return createClient<Database>(
    requiredEnv("Supabase URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    requiredEnv("Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as any;
}

function db(ctx: SoraToolContext) {
  return ctx.supabase as any;
}

function challenge() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

function scope(ctx: SoraToolContext) {
  return {
    channel: ctx.channel ?? "web",
    conversationKey: (ctx.conversationKey ?? "default").slice(0, 180),
  };
}

export async function prepareServerDelete(
  ctx: SoraToolContext,
  input: { table: string; recordId?: string; query?: string },
) {
  const spec = DELETE_TARGETS[input.table];
  if (!spec) return { ok: false, message: "Modul itu tidak diizinkan untuk dihapus oleh Sora." };

  const columns = Array.from(new Set(["id", spec.display, ...spec.search])).join(",");
  let query = db(ctx)
    .from(input.table)
    .select(columns)
    .eq("user_id", ctx.userId)
    .is("deleted_at", null);
  if (input.recordId) query = query.eq("id", input.recordId);
  else if (input.query?.trim()) query = query.ilike(spec.search[0], `%${input.query.trim()}%`);
  else return { ok: false, message: "Sebutkan satu nama atau ID record yang ingin dihapus." };

  const { data, error } = await query.limit(3);
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: `${spec.label} itu tidak ditemukan.` };
  if (data.length > 1)
    return {
      ok: false,
      ambiguous: true,
      message: `Ada beberapa ${spec.label} yang cocok. Sebutkan lebih spesifik.`,
      matches: data.map((row: any) => ({ id: row.id, label: row[spec.display] ?? "(tanpa nama)" })),
    };

  const row = data[0] as any;
  const key = challenge();
  const { channel, conversationKey } = scope(ctx);
  const sb = admin();
  await sb
    .from("sora_pending_actions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("user_id", ctx.userId)
    .eq("channel", channel)
    .eq("conversation_key", conversationKey)
    .eq("status", "pending");
  const { error: pendingError } = await sb.from("sora_pending_actions").insert({
    user_id: ctx.userId,
    channel,
    conversation_key: conversationKey,
    action_type: "delete_record",
    target_table: input.table,
    target_id: row.id,
    target_label: String(row[spec.display] ?? row.id),
    payload: { impact: "Record disembunyikan dari aplikasi dan tetap tersimpan sebagai arsip." },
    confirmation_step: 0,
    challenge: key,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  if (pendingError) return { ok: false, message: pendingError.message };
  return {
    ok: true,
    needsConfirmation: true,
    step: 1,
    message: `Konfirmasi 1/2: hapus ${spec.label} “${row[spec.display] ?? row.id}”? Dampak: record akan diarsipkan dan hilang dari tampilan. Balas “ya” untuk lanjut atau “batal”.`,
  };
}

export async function continueServerDelete(ctx: SoraToolContext) {
  const raw = (ctx.rawUserText ?? "").trim();
  const { channel, conversationKey } = scope(ctx);
  const sb = admin();
  const { data: pending } = await sb
    .from("sora_pending_actions")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("channel", channel)
    .eq("conversation_key", conversationKey)
    .eq("status", "pending")
    .maybeSingle();
  if (!pending) return { ok: false, message: "Tidak ada aksi hapus yang menunggu konfirmasi." };
  if (new Date(pending.expires_at).getTime() <= Date.now()) {
    await sb.from("sora_pending_actions").update({ status: "expired" }).eq("id", pending.id);
    return {
      ok: false,
      expired: true,
      message: "Konfirmasi sudah kedaluwarsa. Mulai lagi ya, Tuan.",
    };
  }
  if (/^(batal|cancel|jangan|tidak|nggak|gak)$/i.test(raw)) {
    await sb.from("sora_pending_actions").update({ status: "cancelled" }).eq("id", pending.id);
    return {
      ok: true,
      cancelled: true,
      message: "Aksi hapus dibatalkan. Aman, tidak ada data yang berubah.",
    };
  }
  if (pending.confirmation_step === 0) {
    if (!/^(ya|iya|yes|lanjut|oke|ok)$/i.test(raw))
      return { ok: false, message: "Balas “ya” untuk lanjut atau “batal” untuk membatalkan." };
    await sb
      .from("sora_pending_actions")
      .update({ confirmation_step: 1, updated_at: new Date().toISOString() })
      .eq("id", pending.id);
    return {
      ok: true,
      needsConfirmation: true,
      step: 2,
      message: `Konfirmasi 2/2: ketik persis HAPUS ${pending.challenge} untuk mengarsipkan “${pending.target_label}”.`,
    };
  }

  const exact = `HAPUS ${pending.challenge}`;
  if (raw !== exact)
    return { ok: false, message: `Challenge salah. Ketik persis ${exact}, atau “batal”.` };
  if (!DELETE_TARGETS[pending.target_table]) {
    await sb.from("sora_pending_actions").update({ status: "cancelled" }).eq("id", pending.id);
    return { ok: false, message: "Target tidak lagi diizinkan." };
  }
  const { data: deleted, error } = await sb
    .from(pending.target_table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", pending.target_id)
    .eq("user_id", ctx.userId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !deleted)
    return {
      ok: false,
      message: error?.message ?? "Record tidak ditemukan atau sudah diarsipkan.",
    };
  await sb
    .from("sora_pending_actions")
    .update({ status: "completed", confirmation_step: 2, updated_at: new Date().toISOString() })
    .eq("id", pending.id);
  return { ok: true, deleted: true, message: `“${pending.target_label}” berhasil diarsipkan.` };
}

export async function getPendingDeleteSummary(ctx: SoraToolContext) {
  const { channel, conversationKey } = scope(ctx);
  const { data } = await admin()
    .from("sora_pending_actions")
    .select("target_table,target_label,confirmation_step,expires_at,status")
    .eq("user_id", ctx.userId)
    .eq("channel", channel)
    .eq("conversation_key", conversationKey)
    .eq("status", "pending")
    .maybeSingle();
  return data ?? null;
}
