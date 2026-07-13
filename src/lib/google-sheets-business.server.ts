import { createHash } from "node:crypto";
import { envValue } from "./env.server";
async function getGoogleSheetsAccessToken() {
  const clientId = envValue("GOOGLE_CLIENT_ID");
  const clientSecret = envValue("GOOGLE_CLIENT_SECRET");
  const refreshToken = envValue("GOOGLE_REFRESH_TOKEN", "GOOGLE_CALENDAR_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken)
    throw new Error("Google OAuth belum dikonfigurasi");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.access_token)
    throw new Error(String(json?.error_description ?? "Akun Google perlu dihubungkan ulang"));
  return String(json.access_token);
}
function records(values: unknown[][] = []) {
  const [headers = [], ...rows] = values;
  return rows
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [
          String(header).trim().toLowerCase().replace(/\s+/g, "_"),
          row[index] ?? null,
        ]),
      ),
    );
}
export async function readBusinessSheet(
  spreadsheetId: string,
  configuredTabs?: Array<{ role?: string; name: string }>,
) {
  const token = await getGoogleSheetsAccessToken();
  const defaults = ["summary", "sales", "expenses", "products", "stock"].map((role) => ({
    role,
    name: role[0].toUpperCase() + role.slice(1),
  }));
  const definitions = configuredTabs?.length ? configuredTabs : defaults;
  const tabs = definitions.map((tab) => tab.name);
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`,
  );
  tabs.forEach((tab) => url.searchParams.append("ranges", `${tab}!A1:Z5000`));
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json();
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: "Sesi Google kedaluwarsa. Hubungkan ulang akun Google.",
      403: "Izin ditolak. Pastikan akun Google memiliki akses lihat ke spreadsheet.",
      404: "Spreadsheet tidak ditemukan atau sudah dipindahkan.",
    };
    throw new Error(messages[response.status] ?? json.error?.message ?? "Spreadsheet gagal dibaca");
  }
  const ranges = json.valueRanges ?? [];
  const mapped = Object.fromEntries(
    definitions.map((tab, index) => [
      tab.role ?? tab.name.toLowerCase(),
      records(ranges[index]?.values),
    ]),
  );
  const summaryRows = mapped.summary ?? [];
  const summary =
    summaryRows.length && "key" in summaryRows[0]
      ? Object.fromEntries(summaryRows.map((row: any) => [row.key, row.value]))
      : (summaryRows[0] ?? {});
  const payload = {
    summary,
    sales: mapped.sales,
    expenses: mapped.expenses,
    products: mapped.products,
    stock: mapped.stock,
  };
  return {
    ...payload,
    sourceHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  };
}
