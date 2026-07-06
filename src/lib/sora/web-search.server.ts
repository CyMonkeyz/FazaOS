import { envValue } from "@/lib/env.server";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

function stripHtml(input: string) {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanUrl(url: string) {
  try {
    const parsed = new URL(url);
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
  } catch {
    // Keep original below.
  }
  return url;
}

function compactResult(result: WebSearchResult): WebSearchResult {
  return {
    title: result.title.slice(0, 100),
    url: result.url,
    snippet: result.snippet.slice(0, 170),
    source: result.source,
  };
}

async function searchTavily(query: string, signal: AbortSignal): Promise<WebSearchResult[]> {
  const apiKey = envValue("TAVILY_API_KEY", "TALIFY_API_KEY");
  if (!apiKey) return [];
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 3,
      include_answer: false,
      include_raw_content: false,
    }),
    signal,
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  return ((json?.results ?? []) as Array<{ title?: string; url?: string; content?: string }>)
    .filter((r) => r.title && r.url)
    .map((r) =>
      compactResult({
        title: r.title!,
        url: r.url!,
        snippet: r.content ?? "",
        source: "tavily",
      }),
    );
}

async function searchSerper(query: string, signal: AbortSignal): Promise<WebSearchResult[]> {
  const apiKey = envValue("SERPER_API_KEY");
  if (!apiKey) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ q: query, num: 3 }),
    signal,
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  return ((json?.organic ?? []) as Array<{ title?: string; link?: string; snippet?: string }>)
    .filter((r) => r.title && r.link)
    .map((r) =>
      compactResult({
        title: r.title!,
        url: r.link!,
        snippet: r.snippet ?? "",
        source: "serper",
      }),
    );
}

async function searchBrave(query: string, signal: AbortSignal): Promise<WebSearchResult[]> {
  const apiKey = envValue("BRAVE_SEARCH_API_KEY");
  if (!apiKey) return [];
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "3");
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    signal,
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  return (
    (json?.web?.results ?? []) as Array<{ title?: string; url?: string; description?: string }>
  )
    .filter((r) => r.title && r.url)
    .map((r) =>
      compactResult({
        title: stripHtml(r.title!),
        url: r.url!,
        snippet: stripHtml(r.description ?? ""),
        source: "brave",
      }),
    );
}

async function searchDuckDuckGo(query: string, signal: AbortSignal): Promise<WebSearchResult[]> {
  const url = new URL("https://lite.duckduckgo.com/lite/");
  url.searchParams.set("q", query);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 FazaOS Sora/1.0",
      Accept: "text/html",
    },
    signal,
  });
  if (!res.ok) return [];
  const html = await res.text();
  const results: WebSearchResult[] = [];
  const linkRe =
    /<a[^>]+class=(?:"result-link"|'result-link')[^>]+href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) && results.length < 3) {
    const after = html.slice(linkRe.lastIndex, linkRe.lastIndex + 800);
    const snippet =
      after.match(/class=(?:"result-snippet"|'result-snippet')[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "";
    results.push(
      compactResult({
        title: stripHtml(match[3]),
        url: cleanUrl(match[1] || match[2] || ""),
        snippet: stripHtml(snippet),
        source: "duckduckgo",
      }),
    );
  }
  return results.filter((r) => r.title && r.url);
}

export function shouldUseWebSearch(text: string) {
  return /\b(terbaru|update|real[-\s]?time|hari ini|sekarang|barusan|internet|web|berita|news|tren|trend|rilis|launch|harga|kurs|cuaca|jadwal|skor|live|2026)\b/i.test(
    text,
  );
}

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const signal = AbortSignal.timeout(6_000);
  for (const provider of [searchTavily, searchSerper, searchBrave, searchDuckDuckGo]) {
    try {
      const results = await provider(query, signal);
      if (results.length) return results.slice(0, 3);
    } catch {
      // Try the next provider; web context is helpful, not mission-critical.
    }
  }
  return [];
}

export function formatWebContext(results: WebSearchResult[]) {
  if (!results.length) return "WEB_CONTEXT: tidak tersedia.";
  return [
    "WEB_CONTEXT ringkas, gunakan hanya untuk fakta eksternal terbaru:",
    ...results.map(
      (r, index) => `${index + 1}. ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet || "-"}`,
    ),
  ].join("\n");
}
