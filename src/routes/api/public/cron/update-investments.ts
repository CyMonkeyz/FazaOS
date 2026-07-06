import { createFileRoute } from "@tanstack/react-router";
import { updateInvestmentPrices } from "@/lib/services/investment.service";
import { isCronAuthorized } from "@/lib/cron-auth.server";

function wibNow() {
  return new Date(Date.now() + 7 * 3600 * 1000);
}

function isNineAmWib() {
  return wibNow().getUTCHours() === 9;
}

async function run(request: Request) {
  if (!isCronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && !isNineAmWib()) {
    const now = wibNow();
    return Response.json({
      skipped: true,
      reason: "investment_refresh_runs_only_at_09_00_wib",
      wibTime: `${String(now.getUTCHours()).padStart(2, "0")}:${String(
        now.getUTCMinutes(),
      ).padStart(2, "0")}`,
    });
  }
  try {
    const result = await updateInvestmentPrices({ force });
    return Response.json(result);
  } catch (err) {
    console.error("[cron/update-investments]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/public/cron/update-investments")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});
