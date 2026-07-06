import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const requiredServer = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "DEEPSEEK_API_KEY",
  "TELEGRAM_API_KEY",
  "CRON_SECRET",
];

const requiredClient = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
const optional = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"];
const optionalWebSearch = [
  "TAVILY_API_KEY",
  "TALIFY_API_KEY",
  "SERPER_API_KEY",
  "BRAVE_SEARCH_API_KEY",
];

function parseDotenv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    out[key.trim()] = rest.join("=").trim();
  }
  return out;
}

const localEnv = parseDotenv(".env");
const get = (key) => process.env[key]?.trim() || localEnv[key]?.trim() || "";
const missing = [...requiredServer, ...requiredClient].filter((key) => !get(key));

if (missing.length) {
  console.error(`Missing required env: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Required env names are present.");
}

const missingGoogle = optional.filter((key) => !get(key));
if (missingGoogle.length) {
  console.log(`Google Calendar is optional but incomplete: ${missingGoogle.join(", ")}`);
} else {
  console.log("Google Calendar env names are present.");
}

if (optionalWebSearch.some((key) => get(key))) {
  console.log("Sora realtime web search env is present.");
} else {
  console.log("Sora realtime web search has no provider key; fallback search may be limited.");
}

const telegramToken = get("TELEGRAM_API_KEY") || get("TELEGRAM_BOT_TOKEN");
if (telegramToken) {
  const secret = createHash("sha256")
    .update(`telegram-webhook:${telegramToken}`)
    .digest("base64url");
  console.log(`Telegram webhook secret derivation OK (${secret.length} chars).`);
}
