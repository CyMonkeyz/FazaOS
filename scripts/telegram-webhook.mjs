import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path = ".env") {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    process.env[key] = value;
  }
}

function envValue(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function deriveSecret(token) {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

function maskUrl(url) {
  return url.replace(/bot\d+:[^/]+/g, "bot***");
}

async function tg(method, body) {
  const token = envValue("TELEGRAM_API_KEY", "TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_API_KEY belum ada di .env");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.description || `Telegram API gagal (${res.status})`);
  }
  return json.result;
}

async function info() {
  const result = await tg("getWebhookInfo");
  console.log(
    JSON.stringify(
      {
        url: result.url || null,
        pending_update_count: result.pending_update_count,
        last_error_date: result.last_error_date
          ? new Date(result.last_error_date * 1000).toISOString()
          : null,
        last_error_message: result.last_error_message || null,
        allowed_updates: result.allowed_updates || null,
      },
      null,
      2,
    ),
  );
}

async function set(urlArg) {
  const token = envValue("TELEGRAM_API_KEY", "TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_API_KEY belum ada di .env");

  const url = urlArg || envValue("TELEGRAM_WEBHOOK_URL");
  if (!url) {
    throw new Error(
      "Masukkan URL webhook: npm run telegram:webhook -- set https://nama.loca.lt/api/public/telegram/webhook",
    );
  }
  if (!/^https:\/\/.+\/api\/public\/telegram\/webhook$/.test(url)) {
    throw new Error("URL harus https dan berakhir dengan /api/public/telegram/webhook");
  }

  const result = await tg("setWebhook", {
    url,
    secret_token: deriveSecret(token),
    drop_pending_updates: true,
    allowed_updates: ["message", "edited_message", "callback_query"],
  });
  console.log(`Webhook diset ke ${maskUrl(url)}: ${result ? "ok" : "gagal"}`);
  await info();
}

loadEnvFile();

const command = process.argv[2] || "info";
try {
  if (command === "info") {
    await info();
  } else if (command === "set") {
    await set(process.argv[3]);
  } else {
    throw new Error("Command tersedia: info, set");
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
