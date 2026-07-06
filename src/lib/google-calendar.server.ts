import { envValue } from "./env.server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_URL = "https://www.googleapis.com/calendar/v3";

export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  htmlLink?: string;
};

function googleCalendarConfig() {
  const clientId = envValue("GOOGLE_CLIENT_ID");
  const clientSecret = envValue("GOOGLE_CLIENT_SECRET");
  const refreshToken = envValue("GOOGLE_REFRESH_TOKEN", "GOOGLE_CALENDAR_REFRESH_TOKEN");
  const calendarId = envValue("GOOGLE_CALENDAR_ID") || "primary";
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken, calendarId };
}

export function isGoogleCalendarConfigured() {
  return !!googleCalendarConfig();
}

async function getGoogleAccessToken() {
  const config = googleCalendarConfig();
  if (!config) throw new Error("Google Calendar belum dikonfigurasi.");
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    const detail = String(json?.error_description || json?.error || `HTTP ${res.status}`);
    if (/invalid_grant/i.test(detail)) {
      throw new Error("Google refresh token tidak valid, kedaluwarsa, atau sudah dicabut.");
    }
    throw new Error(`Google OAuth gagal: ${detail}`);
  }
  return json.access_token as string;
}

async function googleCalendarFetch(path: string, init: RequestInit = {}) {
  const config = googleCalendarConfig();
  if (!config) throw new Error("Google Calendar belum dikonfigurasi.");
  const token = await getGoogleAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${GOOGLE_CALENDAR_URL}${path}`, { ...init, headers });
}

export async function getUpcomingGoogleCalendarEvents(days = 30, maxResults = 50) {
  const config = googleCalendarConfig();
  if (!config) return { configured: false, events: [] as GoogleCalendarEvent[] };
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + days * 86400000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
  });
  const calendarId = encodeURIComponent(config.calendarId);
  try {
    const res = await googleCalendarFetch(`/calendars/${calendarId}/events?${params}`);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        configured: true,
        events: [] as GoogleCalendarEvent[],
        error: normalizeGoogleCalendarError(res.status, json?.error?.message),
      };
    }
    return {
      configured: true,
      events: (json?.items ?? []) as GoogleCalendarEvent[],
    };
  } catch (err) {
    return {
      configured: true,
      events: [] as GoogleCalendarEvent[],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function createGoogleCalendarEvent(input: {
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  description?: string | null;
}) {
  const config = googleCalendarConfig();
  if (!config) throw new Error("Google Calendar belum dikonfigurasi.");
  const start = new Date(input.startsAt);
  const end = input.endsAt ? new Date(input.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const res = await googleCalendarFetch(
    `/calendars/${encodeURIComponent(config.calendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: input.title,
        location: input.location ?? undefined,
        description: input.description ?? undefined,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(normalizeGoogleCalendarError(res.status, json?.error?.message));
  return { id: json.id as string, htmlLink: json.htmlLink as string | undefined };
}

export async function updateGoogleCalendarEvent(
  eventId: string,
  input: {
    title: string;
    startsAt: string;
    endsAt?: string | null;
    location?: string | null;
    description?: string | null;
  },
) {
  const config = googleCalendarConfig();
  if (!config) throw new Error("Google Calendar belum dikonfigurasi.");
  const start = new Date(input.startsAt);
  const end = input.endsAt ? new Date(input.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const res = await googleCalendarFetch(
    `/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        summary: input.title,
        location: input.location ?? undefined,
        description: input.description ?? undefined,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(normalizeGoogleCalendarError(res.status, json?.error?.message));
  return { id: json.id as string, htmlLink: json.htmlLink as string | undefined };
}

export async function deleteGoogleCalendarEvent(eventId: string) {
  const config = googleCalendarConfig();
  if (!config) return { ok: false };
  const res = await googleCalendarFetch(
    `/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
  return { ok: res.ok || res.status === 410 };
}

function normalizeGoogleCalendarError(status: number, message?: string) {
  const detail = message || `HTTP ${status}`;
  if (status === 403 && /disabled|not been used|enable/i.test(detail)) {
    return "Google Calendar API belum aktif di Google Cloud project.";
  }
  if (status === 403 && /insufficient|scope|permission/i.test(detail)) {
    return "Google Calendar scope/permission belum cukup. Buat refresh token baru dengan scope calendar.";
  }
  if (status === 401) {
    return "Google credential tidak valid atau refresh token sudah dicabut.";
  }
  if (status === 404) {
    return "Google Calendar ID tidak ditemukan. Gunakan GOOGLE_CALENDAR_ID=primary atau ID kalender yang benar.";
  }
  return `Google Calendar gagal: ${detail}`;
}
