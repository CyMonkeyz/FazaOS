import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { envValue, requiredEnv } from "@/lib/env.server";

const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
const MARKET_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const REQUEST_GAP_MS = 1_200;

type AlphaPrice = {
  configured: true;
  price: number;
  sourceCurrency: "USD" | "IDR";
  raw: unknown;
  source: string;
  provider: string;
  stale?: boolean;
  note?: string;
};

const responseCache = new Map<string, { at: number; json: any }>();
const priceCache = new Map<string, { at: number; data: AlphaPrice }>();
let lastAlphaRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function friendlyMarketError(message: string) {
  if (
    /rate|frequency|25 requests|standard api call frequency|limit|thank you for using/i.test(
      message,
    )
  ) {
    return "Batas/rate limit provider harga tercapai. Faza OS memakai harga cache/terakhir tersimpan dulu.";
  }
  if (/invalid api call|symbol|not available|Error Message/i.test(message)) {
    return "Simbol market tidak dikenali provider. Cek ticker/provider symbol.";
  }
  return "Harga live belum bisa diambil. Faza OS memakai data terakhir yang tersedia.";
}

function admin() {
  return createClient<Database>(
    requiredEnv("Supabase URL", "SUPABASE_URL", "VITE_SUPABASE_URL"),
    requiredEnv("Supabase service role", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  ) as any;
}

function alphaProviderKey() {
  return envValue("ALPHA_VANTAGE_API_KEY", "ALPHAVANTAGE_API_KEY", "MARKET_DATA_API_KEY") || null;
}

function tavilyProviderKey() {
  return envValue("TAVILY_API_KEY", "TALIFY_API_KEY") || null;
}

function hasMarketProvider() {
  return !!(tavilyProviderKey() || alphaProviderKey());
}

async function fetchAlphaJson(params: URLSearchParams) {
  const key = alphaProviderKey();
  if (!key) return { configured: false as const };
  params.set("apikey", key);
  const cacheKey = params.toString();
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.at < MARKET_CACHE_TTL_MS) {
    return { configured: true as const, json: cached.json, cached: true };
  }
  const wait = Math.max(0, REQUEST_GAP_MS - (Date.now() - lastAlphaRequestAt));
  if (wait > 0) await sleep(wait);
  lastAlphaRequestAt = Date.now();
  const res = await fetch(`${ALPHA_VANTAGE_URL}?${params}`, {
    signal: AbortSignal.timeout(12_000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const note = json.Note || json.Information || json["Error Message"];
  if (note) throw new Error(String(note));
  responseCache.set(cacheKey, { at: Date.now(), json });
  return { configured: true as const, json };
}

function sourceCurrencyFor(symbol: string, exchange?: string | null): "USD" | "IDR" {
  const normalized = `${symbol} ${exchange ?? ""}`.toUpperCase();
  return normalized.includes(".JK") || normalized.includes("IDX") ? "IDR" : "USD";
}

async function fetchAlphaVantagePrice(
  symbol: string,
  exchange?: string | null,
): Promise<AlphaPrice | { configured: false }> {
  const cacheKey = `${symbol}:${exchange ?? ""}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.at < MARKET_CACHE_TTL_MS) return cached.data;

  const quoteResponse = await fetchAlphaJson(
    new URLSearchParams({
      function: "GLOBAL_QUOTE",
      symbol,
    }),
  );
  if (!quoteResponse.configured) return quoteResponse;
  const json = quoteResponse.json as any;
  const quoteData = json["Global Quote"] ?? {};
  const rawPrice = quoteData["05. price"];
  const price = Number(rawPrice);
  if (price > 0) {
    const data = {
      configured: true,
      price,
      sourceCurrency: sourceCurrencyFor(symbol, exchange),
      raw: json,
      source: "GLOBAL_QUOTE",
      provider: "alpha_vantage",
    } satisfies AlphaPrice;
    priceCache.set(cacheKey, { at: Date.now(), data });
    return data;
  }

  const daily = await fetchAlphaJson(
    new URLSearchParams({
      function: "TIME_SERIES_DAILY_ADJUSTED",
      symbol,
      outputsize: "compact",
    }),
  );
  if (!daily.configured) return daily;
  const dailyJson = daily.json as any;
  const series = dailyJson["Time Series (Daily)"] ?? {};
  const latestKey = Object.keys(series).sort().pop();
  const latest = latestKey ? series[latestKey] : null;
  const close = Number(latest?.["5. adjusted close"] ?? latest?.["4. close"]);
  if (!(close > 0)) throw new Error("Harga tidak tersedia dari Alpha Vantage untuk simbol ini.");
  const data = {
    configured: true,
    price: close,
    sourceCurrency: sourceCurrencyFor(symbol, exchange),
    raw: { latest_date: latestKey, ...dailyJson },
    source: "TIME_SERIES_DAILY_ADJUSTED",
    provider: "alpha_vantage",
  } satisfies AlphaPrice;
  priceCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

function parseMarketNumber(raw: string, currency: "USD" | "IDR") {
  const cleaned = raw.trim();
  if (currency === "IDR") {
    const normalized = cleaned.includes(",")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
    return Number(normalized);
  }
  return Number(cleaned.replace(/,/g, ""));
}

function extractPriceFromText(text: string, currency: "USD" | "IDR") {
  const patterns =
    currency === "IDR"
      ? [/\b(?:IDR|Rp\.?)\s*([0-9][0-9.,]{2,})/gi, /([0-9][0-9.,]{2,})\s*(?:IDR|rupiah)\b/gi]
      : [/\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/g, /\bUSD\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi];

  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const value = parseMarketNumber(match[1], currency);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

async function fetchTavilyJson(query: string) {
  const key = tavilyProviderKey();
  if (!key) return { configured: false as const };
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 3,
      include_answer: true,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const json = await res.json().catch(() => null);
  return { configured: true as const, json };
}

async function fetchTavilyPrice(
  symbol: string,
  exchange?: string | null,
  name?: string | null,
  targetCurrency: "USD" | "IDR" = "IDR",
): Promise<AlphaPrice | { configured: false }> {
  const currency =
    targetCurrency === "IDR" || sourceCurrencyFor(symbol, exchange) === "IDR" ? "IDR" : "USD";
  const query = [
    symbol,
    exchange,
    name,
    currency === "IDR" ? "harga saham terbaru rupiah" : "current stock price USD",
  ]
    .filter(Boolean)
    .join(" ");
  const result = await fetchTavilyJson(query);
  if (!result.configured) return result;
  const json = result.json as any;
  const haystack = [
    json?.answer,
    ...((json?.results ?? []) as Array<{ title?: string; content?: string }>).flatMap((item) => [
      item.title,
      item.content,
    ]),
  ]
    .filter(Boolean)
    .join("\n");
  const price = extractPriceFromText(haystack, currency);
  if (!(price && price > 0)) {
    throw new Error("Tavily belum menemukan harga numerik yang aman dari hasil web.");
  }
  return {
    configured: true,
    price,
    sourceCurrency: currency,
    raw: json,
    source: "TAVILY_SEARCH",
    provider: "tavily",
    note: "Harga diekstrak dari hasil web Tavily; cek manual jika simbol ambigu.",
  };
}

async function fetchUsdIdrRate() {
  const fx = await fetchAlphaJson(
    new URLSearchParams({
      function: "CURRENCY_EXCHANGE_RATE",
      from_currency: "USD",
      to_currency: "IDR",
    }),
  );
  if (!fx.configured) return null;
  const raw = (fx.json as any)["Realtime Currency Exchange Rate"] ?? {};
  const rate = Number(raw["5. Exchange Rate"]);
  return rate > 0 ? rate : null;
}

async function fetchTavilyUsdIdrRate() {
  const result = await fetchTavilyJson("USD to IDR exchange rate today");
  if (!result.configured) return null;
  const json = result.json as any;
  const haystack = [
    json?.answer,
    ...((json?.results ?? []) as Array<{ title?: string; content?: string }>).flatMap((item) => [
      item.title,
      item.content,
    ]),
  ]
    .filter(Boolean)
    .join("\n");
  return extractPriceFromText(haystack, "IDR");
}

async function fetchUsdIdrRateAny() {
  try {
    const fromAlpha = await fetchUsdIdrRate();
    if (fromAlpha) return fromAlpha;
  } catch {
    // Try Tavily below.
  }
  try {
    return await fetchTavilyUsdIdrRate();
  } catch {
    return null;
  }
}

async function fetchMarketPrice(
  symbol: string,
  exchange: string | null | undefined,
  name: string | null | undefined,
  targetCurrency: "USD" | "IDR",
): Promise<AlphaPrice> {
  const errors: string[] = [];
  if (tavilyProviderKey()) {
    try {
      const price = await fetchTavilyPrice(symbol, exchange, name, targetCurrency);
      if (price.configured) return price;
    } catch (err) {
      errors.push(`Tavily: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (alphaProviderKey()) {
    try {
      const price = await fetchAlphaVantagePrice(symbol, exchange);
      if (price.configured) return price;
    } catch (err) {
      errors.push(`Alpha Vantage: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(errors.join(" | ") || "API harga belum dikonfigurasi");
}

function wibDayBoundsUtc() {
  const wib = new Date(Date.now() + 7 * 3600_000);
  const startUtc =
    Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600_000;
  return {
    start: new Date(startUtc).toISOString(),
    end: new Date(startUtc + 24 * 3600_000).toISOString(),
  };
}

async function getStoredFallbackPrice(
  sb: ReturnType<typeof admin>,
  investmentId: string,
  currentPrice: unknown,
) {
  const { data } = await sb
    .from("investment_price_history")
    .select("price,raw,fetched_at")
    .eq("investment_id", investmentId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const historyPrice = Number(data?.price);
  if (historyPrice > 0) return { price: historyPrice, raw: data?.raw, from: "history" };
  const stored = Number(currentPrice);
  if (stored > 0) return { price: stored, raw: null, from: "current_price" };
  return null;
}

export async function updateInvestmentPrices(options: { force?: boolean } = {}) {
  const sb = admin();
  if (!hasMarketProvider())
    return { configured: false, message: "API harga belum dikonfigurasi", success: 0, failed: 0 };

  if (!options.force) {
    const today = wibDayBoundsUtc();
    const { count, error: logError } = await sb
      .from("investment_price_update_logs")
      .select("id", { count: "exact", head: true })
      .gte("fetched_at", today.start)
      .lt("fetched_at", today.end);
    if (!logError && (count ?? 0) > 0) {
      return {
        configured: true,
        skipped: true,
        reason: "investment_prices_already_refreshed_today_wib",
        success: 0,
        failed: 0,
      };
    }
  }

  const { data: investments, error } = await sb
    .from("investments")
    .select("id,user_id,ticker,provider_symbol,exchange,name,current_price,currency,price_provider")
    .eq("auto_update_enabled", true)
    .is("deleted_at", null)
    .not("ticker", "is", null);
  if (error) throw error;

  let success = 0;
  let failed = 0;
  const byUser = new Map<string, { success: number; failed: number }>();

  for (const inv of investments ?? []) {
    const symbol = inv.provider_symbol || inv.ticker;
    try {
      const targetCurrency = (inv.currency ?? "IDR") === "USD" ? "USD" : "IDR";
      const fetched = await fetchMarketPrice(symbol, inv.exchange, inv.name, targetCurrency);
      const oldPrice = Number(inv.current_price ?? 0);
      let newPrice = fetched.price;
      if ((inv.currency ?? "IDR") === "IDR" && fetched.sourceCurrency === "USD") {
        const rate = await fetchUsdIdrRateAny();
        if (!rate) throw new Error("Kurs USD/IDR tidak tersedia dari provider market/web.");
        newPrice = fetched.price * rate;
      }
      await sb
        .from("investments")
        .update({
          current_price: newPrice,
          last_updated_at: new Date().toISOString(),
          last_price_error: null,
        })
        .eq("id", inv.id);
      await sb.from("investment_price_history").insert({
        user_id: inv.user_id,
        investment_id: inv.id,
        ticker: symbol,
        provider: fetched.provider,
        price: newPrice,
        currency: inv.currency ?? "IDR",
        raw: {
          source: fetched.source,
          note: fetched.note,
          source_price: fetched.price,
          source_currency: fetched.sourceCurrency,
          target_currency: inv.currency ?? "IDR",
          raw: fetched.raw,
        },
      });
      await sb.from("investment_price_update_logs").insert({
        user_id: inv.user_id,
        investment_id: inv.id,
        provider: fetched.provider,
        status: "success",
        old_price: oldPrice,
        new_price: newPrice,
      });
      success++;
      const user = byUser.get(inv.user_id) ?? { success: 0, failed: 0 };
      user.success++;
      byUser.set(inv.user_id, user);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const message = friendlyMarketError(rawMessage);
      const fallback = await getStoredFallbackPrice(sb, inv.id, inv.current_price);
      if (fallback) {
        await sb
          .from("investments")
          .update({
            current_price: fallback.price,
            last_updated_at: new Date().toISOString(),
            last_price_error: message,
          })
          .eq("id", inv.id);
        await sb.from("investment_price_history").insert({
          user_id: inv.user_id,
          investment_id: inv.id,
          ticker: symbol,
          provider: tavilyProviderKey() ? "tavily_fallback" : "alpha_vantage_fallback",
          price: fallback.price,
          currency: inv.currency ?? "IDR",
          stale: true,
          note: message,
          raw: { fallback_from: fallback.from, previous_raw: fallback.raw, error: rawMessage },
        });
      } else {
        await sb.from("investments").update({ last_price_error: message }).eq("id", inv.id);
      }
      await sb.from("investment_price_update_logs").insert({
        user_id: inv.user_id,
        investment_id: inv.id,
        provider: tavilyProviderKey() ? "tavily" : "alpha_vantage",
        status: "failed",
        old_price: inv.current_price,
        error_message: message,
      });
      failed++;
      const user = byUser.get(inv.user_id) ?? { success: 0, failed: 0 };
      user.failed++;
      byUser.set(inv.user_id, user);
    }
  }

  return {
    configured: true,
    success,
    failed,
    users: Array.from(byUser.entries()).map(([user_id, counts]) => ({ user_id, ...counts })),
  };
}
