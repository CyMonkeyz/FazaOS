import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "@/lib/env.server";
import { isCronAuthorized } from "@/lib/cron-auth.server";
function admin() {
  return createClient(
    requiredEnv("Supabase URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    requiredEnv("Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as any;
}
export const Route = createFileRoute("/api/public/cron/maintenance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
        const sb = admin();
        const [{ data: memory, error: memoryError }, { data: garden, error: gardenError }] =
          await Promise.all([
            sb.rpc("cleanup_sora_conversations"),
            sb.rpc("run_garden_maintenance", {}),
          ]);
        return Response.json({
          memoryDeleted: memory,
          gardenDecay: garden,
          errors: [memoryError?.message, gardenError?.message].filter(Boolean),
        });
      },
    },
  },
});
