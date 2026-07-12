import fs from "node:fs";

const types = fs.readFileSync(
  new URL("../src/integrations/supabase/types.ts", import.meta.url),
  "utf8",
);
const registry = fs.readFileSync(
  new URL("../src/lib/sora/schema-registry.ts", import.meta.url),
  "utf8",
);
const tablesBlock = types.match(/Tables:\s*\{([\s\S]*?)\n\s*Views:\s*\{/i)?.[1] ?? "";
const tables = [...tablesBlock.matchAll(/^\s{6}([a-z][a-z0-9_]*):\s*\{/gm)].map((m) => m[1]);
const registered = new Set(
  [...registry.matchAll(/table:\s*"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]),
);

// Infrastructure tables are intentionally unavailable to Sora's record-reading tools.
const internal = new Set([
  "account_reset_audit",
  "app_logs",
  "cron_runs",
  "notification_jobs",
  "notification_logs",
  "push_subscriptions",
  "telegram_link_codes",
  "webhook_events",
]);
const missing = tables.filter((table) => !internal.has(table) && !registered.has(table));
if (missing.length) {
  console.error(`Sora schema registry belum mengenal: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Sora schema registry mencakup ${tables.length - internal.size} tabel user-facing.`);
