import { envValue } from "./env.server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
function config() {
  const clientId = envValue("GOOGLE_CLIENT_ID");
  const clientSecret = envValue("GOOGLE_CLIENT_SECRET");
  const refreshToken = envValue("GOOGLE_REFRESH_TOKEN", "GOOGLE_CALENDAR_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}
export async function getGoogleDriveAccessToken() {
  const value = config();
  if (!value) throw new Error("Google OAuth belum dikonfigurasi.");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: value.clientId,
      client_secret: value.clientSecret,
      refresh_token: value.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.access_token)
    throw new Error(String(json?.error_description ?? json?.error ?? "Google OAuth gagal"));
  return String(json.access_token);
}
async function google(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${await getGoogleDriveAccessToken()}`);
  headers.set("content-type", "application/json");
  const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(20_000) });
  const json = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(String(json?.error?.message ?? `Google API HTTP ${response.status}`));
  return json;
}
export async function listDriveFolders() {
  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id,name,parents,webViewLink)",
    orderBy: "name",
    pageSize: "100",
  });
  const json = await google(`https://www.googleapis.com/drive/v3/files?${params}`);
  return json.files ?? [];
}
export async function createDriveFolder(name: string, parentId?: string | null) {
  return google("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
}
export async function createCustomSpreadsheet(input: {
  name: string;
  folderId?: string | null;
  tabs: Array<{ name: string; columns: string[] }>;
}) {
  const sheets = input.tabs.map((tab, index) => ({
    properties: { sheetId: index, title: tab.name, index, gridProperties: { frozenRowCount: 1 } },
    data: [
      {
        startRow: 0,
        startColumn: 0,
        rowData: [
          {
            values: tab.columns.map((column) => ({
              userEnteredValue: { stringValue: column },
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.28, green: 0.18, blue: 0.48 },
                foregroundColor: { red: 1, green: 1, blue: 1 },
              },
            })),
          },
        ],
      },
    ],
  }));
  const created = await google("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title: input.name, locale: "id_ID", timeZone: "Asia/Jakarta" },
      sheets,
    }),
  });
  if (input.folderId) {
    const info = await google(
      `https://www.googleapis.com/drive/v3/files/${created.spreadsheetId}?fields=parents`,
    );
    const params = new URLSearchParams({
      addParents: input.folderId,
      removeParents: (info.parents ?? []).join(","),
      fields: "id,parents",
    });
    await google(`https://www.googleapis.com/drive/v3/files/${created.spreadsheetId}?${params}`, {
      method: "PATCH",
      body: "{}",
    });
  }
  return {
    spreadsheetId: created.spreadsheetId as string,
    spreadsheetUrl: created.spreadsheetUrl as string,
  };
}
