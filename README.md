# FazaOS

FazaOS is a personal operating system app built with TanStack Start/Vite, React, Supabase, Telegram Bot API, Google Calendar OAuth, and DeepSeek.

## Local Setup

1. Install Node.js 22 or newer.
2. Install dependencies:

```bash
npm ci
```

3. Copy the env template:

```bash
cp .env.example .env
```

4. Fill `.env` with your own values. Never commit `.env`.
5. Start the app:

```bash
npm run dev
```

6. Open the local URL shown by Vite, usually `http://localhost:5173`.

## Commands

```bash
npm run typecheck
npm run lint
npm run smoke
npm run build
```

## Required Environment Variables

Client-safe:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server-only:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEEPSEEK_API_KEY`
- `TELEGRAM_API_KEY`
- `CRON_SECRET`

Optional but recommended:

- `DEEPSEEK_MODEL`, defaults to `deepseek-v4-flash`
- `TAVILY_API_KEY` or `TALIFY_API_KEY` for Sora realtime web search and Tavily investment price fallback
- `SERPER_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID`, defaults to `primary`
- `ALPHA_VANTAGE_API_KEY`

Server-only secrets must never be exposed in browser code:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_API_KEY`
- `DEEPSEEK_API_KEY`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

## Supabase Setup

1. Create a Supabase project.
2. In Project Settings > API, copy:
   - Project URL to `SUPABASE_URL` and `VITE_SUPABASE_URL`.
   - anon/publishable key to `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - service role key to `SUPABASE_SERVICE_ROLE_KEY`.
3. Run all SQL files in `supabase/migrations` in filename order.
4. In Authentication > URL Configuration, add your local and production URLs.
5. If using Google sign-in, enable the Google provider in Supabase Auth and set the Google OAuth credentials.

RLS is expected to be enabled for user data tables. User-facing queries should filter by `user_id`; server cron/webhook routes use the service role only for trusted server-side work.

## DeepSeek Setup

1. Create a DeepSeek API key.
2. Set `DEEPSEEK_API_KEY`.
3. Optional: set `DEEPSEEK_MODEL=deepseek-v4-flash`.

The app uses server-side DeepSeek calls only. Client responses use friendly errors and do not return API keys or stack traces.

## Telegram Webhook Setup

The webhook endpoint is:

```text
/api/public/telegram/webhook
```

It accepts POST only. The code validates the `X-Telegram-Bot-Api-Secret-Token` header.

The expected secret token is:

```text
base64url(sha256("telegram-webhook:" + TELEGRAM_API_KEY))
```

Generate it locally:

```bash
node -e "const crypto=require('crypto'); const token='YOUR_TELEGRAM_BOT_TOKEN'; console.log(crypto.createHash('sha256').update('telegram-webhook:'+token).digest('base64url'))"
```

For local development, expose Vite with ngrok or localtunnel:

```bash
ngrok http 5173
```

Delete old webhook:

```bash
curl "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/deleteWebhook"
```

Set webhook:

```bash
curl "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://YOUR_PUBLIC_URL/api/public/telegram/webhook" \
  -d "secret_token=YOUR_DERIVED_SECRET"
```

Check active webhook:

```bash
curl "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Telegram keeps only one active webhook URL per bot. Re-running `setWebhook` replaces the previous URL.

## Google Calendar Setup

Google Calendar uses manual OAuth credentials and a refresh token, not a connector gateway.

1. Create a Google Cloud project.
2. Enable Google Calendar API.
3. Configure OAuth consent screen.
4. Create an OAuth Client ID for a Web application.
5. Add this redirect URI for OAuth Playground:

```text
https://developers.google.com/oauthplayground
```

6. In OAuth Playground, enable "Use your own OAuth credentials".
7. Authorize this scope:

```text
https://www.googleapis.com/auth/calendar
```

8. Exchange the authorization code for tokens.
9. Copy the refresh token to `GOOGLE_REFRESH_TOKEN`.
10. Use `GOOGLE_CALENDAR_ID=primary` unless you need a specific calendar ID.

If Google Calendar is missing, revoked, disabled, or lacks scope, FazaOS keeps running and returns a clear integration error instead of crashing unrelated features.

## Cron Routes

Notification cron:

```text
GET /api/public/cron/notify
```

Investment price cron:

```text
GET /api/public/cron/update-investments
```

Pass one of these headers:

```text
apikey: YOUR_CRON_SECRET
```

or:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

`CRON_SECRET` is required. Do not use `SUPABASE_PUBLISHABLE_KEY` or any other browser-exposed key for cron authentication.

Investment refresh is intended to run once daily at 09:00 WIB. On a UTC server, use `0 2 * * *` for `/api/public/cron/update-investments`. Manual emergency refresh can use `?force=1` with `CRON_SECRET`.

## Deployment Checklist

- Add all required env variables in your hosting provider.
- Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run smoke`, and `npm run build`.
- Run Supabase migrations.
- Configure Supabase Auth redirect URLs for production.
- Set Telegram webhook to the production URL.
- Create production cron jobs for notify and investment updates.
- Confirm Google Calendar refresh token works in production.
- Confirm `.env` and other secret files are not committed.

Oracle Always Free notes are in [`docs/ORACLE_ALWAYS_FREE_DEPLOY.md`](docs/ORACLE_ALWAYS_FREE_DEPLOY.md).

## If Secrets Were Exposed

Rotate them immediately:

- Supabase service role key: rotate in Supabase dashboard.
- Telegram bot token: use BotFather `/revoke`.
- Google client secret/refresh token: rotate OAuth secret and revoke old refresh token.
- DeepSeek API key: delete old key and create a new one.

After rotating, update local `.env`, production env variables, and Telegram webhook secret.

## Troubleshooting

- "Missing Supabase environment variable": check `.env` names and restart dev server.
- "Unauthorized" on Telegram webhook: regenerate derived secret and re-run `setWebhook`.
- Telegram messages do not arrive: run `getWebhookInfo` and verify the URL points to the current ngrok/production URL.
- Google Calendar 401: refresh token was revoked or generated for the wrong OAuth client.
- Google Calendar 403: Calendar API is disabled or the refresh token lacks calendar scope.
- Sora unavailable: check `DEEPSEEK_API_KEY`, quota, and network access.
