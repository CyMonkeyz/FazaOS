import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "@/lib/env.server";
import { isCronAuthorized } from "@/lib/cron-auth.server";
import { readBusinessSheet } from "@/lib/google-sheets-business.server";

function admin() {
  return createClient(
    requiredEnv("Supabase URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    requiredEnv("Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as any;
}
async function sync() {
  const sb = admin();
  const { data: connections } = await sb
    .from("business_sheet_connections")
    .select("*")
    .in("status", ["active", "error"]);
  let synced = 0,
    failed = 0;
  for (const connection of connections ?? []) {
    try {
      const configuredTabs = Array.isArray(connection.template_config?.tabs)
        ? connection.template_config.tabs
        : undefined;
      const data = await readBusinessSheet(connection.spreadsheet_id, configuredTabs);
      const { error } = await sb.from("business_sheet_snapshots").insert({
        user_id: connection.user_id,
        business_id: connection.business_id,
        source_hash: data.sourceHash,
        summary: data.summary,
        sales: data.sales,
        expenses: data.expenses,
        products: data.products,
        stock: data.stock,
      });
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
      await sb
        .from("business_sheet_connections")
        .update({ last_sync_at: new Date().toISOString(), last_error: null, status: "active" })
        .eq("id", connection.id);
      synced++;
    } catch (error) {
      await sb
        .from("business_sheet_connections")
        .update({
          last_error:
            error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
          status: "error",
        })
        .eq("id", connection.id);
      failed++;
    }
  }
  return { synced, failed };
}
export const Route = createFileRoute("/api/public/cron/sync-business-sheets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
        return Response.json(await sync());
      },
    },
  },
});
