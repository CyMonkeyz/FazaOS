# To-Do Publish Faza OS Gratis Tanpa Credit Card

Panduan ini adalah alternatif kalau Oracle Always Free tidak bisa dipakai karena Oracle
meminta credit card untuk verifikasi. Jalur ini memakai:

- Netlify Free untuk menjalankan website dan server function Faza OS.
- Supabase hosted untuk database dan auth.
- Telegram webhook production ke domain `fazaos.my.id`.
- cron-job.org untuk memanggil endpoint cron otomatis.

Hasil akhirnya tetap sama: laptop boleh mati, Faza OS tetap bisa dibuka, Telegram tetap
masuk ke webhook production, dan cron tetap berjalan dari cloud.

## Kapan Pakai Panduan Ini

Pakai ini kalau:

- Kamu tidak punya credit card.
- Kamu sudah punya domain `fazaos.my.id`.
- Kamu ingin deploy gratis dulu.
- Traffic masih personal / kecil.

Jangan pakai ini kalau:

- Kamu butuh server 24 jam berbentuk VPS.
- Kamu butuh proses background panjang.
- Kamu butuh kontrol Linux penuh seperti PM2, Caddy, dan SSH.

Netlify adalah serverless. Artinya tidak ada PM2 dan tidak ada terminal server yang hidup
terus. Tapi untuk Faza OS, ini masih cocok karena database ada di Supabase, webhook adalah
HTTP endpoint, dan cron bisa dipanggil dari layanan luar.

## Checklist Besar

- [ ] Repo Faza OS sudah ada di GitHub.
- [ ] Akun Netlify sudah dibuat.
- [ ] Domain `fazaos.my.id` siap dikelola DNS-nya.
- [ ] Supabase project sudah aktif.
- [ ] Semua env production sudah disiapkan.
- [ ] Netlify deploy berhasil.
- [ ] Domain `fazaos.my.id` tersambung ke Netlify.
- [ ] Supabase Auth URL sudah diarahkan ke `https://fazaos.my.id`.
- [ ] Telegram webhook sudah diset ke domain production.
- [ ] cron-job.org sudah memanggil endpoint notify dan investasi.
- [ ] Tes laptop mati berhasil.

## 1. Pastikan Config Netlify Ada

File `netlify.toml` di root project harus berisi:

```toml
[build]
  command = "npm run build"
  publish = ".output/public"

[build.environment]
  NODE_VERSION = "22"
  NITRO_PRESET = "netlify"
  NODE_OPTIONS = "--max-old-space-size=4096"
```

File `vite.config.ts` juga sudah dibuat fleksibel:

```ts
const nitroPreset = process.env.NITRO_PRESET || "node-server";
```

Artinya:

- Local dan Oracle tetap memakai `node-server`.
- Netlify memakai `netlify`.

## 2. Push Kode ke GitHub

Dari laptop:

```bash
git status
git add .
git commit -m "Add Netlify free deployment path"
git push
```

Kalau repo belum ada di GitHub, buat repo baru dulu, lalu ikuti perintah push dari GitHub.

## 3. Buat Site di Netlify

1. Buka Netlify.
2. Login / daftar akun.
3. Pilih `Add new site`.
4. Pilih `Import an existing project`.
5. Hubungkan GitHub.
6. Pilih repo Faza OS.
7. Pastikan setting build:

```text
Build command: npm run build
Publish directory: .output/public
```

8. Klik deploy.

Kalau Netlify membaca `netlify.toml`, biasanya setting ini otomatis.

## 4. Isi Environment Variables di Netlify

Di Netlify:

1. Buka site Faza OS.
2. Masuk `Site configuration`.
3. Buka `Environment variables`.
4. Tambahkan env berikut.

```env
SUPABASE_PROJECT_ID=your-project-ref
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

VITE_SUPABASE_PROJECT_ID=your-project-ref
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-or-publishable-key

DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-v4-flash
TAVILY_API_KEY=your-tavily-api-key
TALIFY_API_KEY=
SERPER_API_KEY=
BRAVE_SEARCH_API_KEY=

TELEGRAM_API_KEY=your-telegram-bot-token
CRON_SECRET=your-long-random-cron-secret

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary

ALPHA_VANTAGE_API_KEY=
MARKET_DATA_API_KEY=

NITRO_PRESET=netlify
NODE_OPTIONS=--max-old-space-size=4096
NODE_ENV=production
```

Penting:

- Jangan isi `CRON_SECRET` dengan Supabase publishable key.
- Jangan share `SUPABASE_SERVICE_ROLE_KEY`.
- Kalau Google Calendar belum dipakai, env Google boleh kosong dulu.

## 5. Redeploy Setelah Env Diisi

Setelah semua env masuk:

1. Buka `Deploys`.
2. Klik `Trigger deploy`.
3. Pilih `Deploy site`.

Tunggu sampai status deploy menjadi `Published`.

## 6. Sambungkan Domain `fazaos.my.id`

Di Netlify:

1. Buka site Faza OS.
2. Masuk `Domain management`.
3. Pilih `Add a domain`.
4. Masukkan:

```text
fazaos.my.id
```

Netlify akan memberi instruksi DNS. Ada dua pola umum.

### Opsi A: Pakai Netlify DNS

Kalau Netlify memberi nameserver, ubah nameserver di tempat kamu beli domain menjadi
nameserver Netlify.

Contoh bentuknya:

```text
dns1.pxx.nsone.net
dns2.pxx.nsone.net
dns3.pxx.nsone.net
dns4.pxx.nsone.net
```

Ikuti yang muncul di akun Netlify kamu, jangan asal copy contoh.

### Opsi B: Tetap Pakai DNS Provider Lama

Kalau tidak mau pindah nameserver, buat record sesuai instruksi Netlify.

Biasanya untuk domain utama:

```text
Type: A
Name: @
Value: IP yang diberikan Netlify
TTL: Auto / Default
```

Untuk `www`:

```text
Type: CNAME
Name: www
Value: nama-site-netlify.netlify.app
TTL: Auto / Default
```

Gunakan value persis dari Netlify karena bisa berbeda tiap site.

## 7. Aktifkan HTTPS

Di Netlify:

1. Buka `Domain management`.
2. Cari bagian HTTPS / TLS certificate.
3. Klik `Verify DNS configuration` kalau ada.
4. Klik `Provision certificate` kalau belum otomatis.

Tunggu sampai `https://fazaos.my.id` aktif.

Cek dari laptop:

```bash
curl -I https://fazaos.my.id
```

Kalau belum aktif, tunggu propagasi DNS. Bisa butuh beberapa menit sampai beberapa jam.

## 8. Update Supabase Auth URL

Di Supabase Dashboard:

1. Buka `Authentication`.
2. Buka `URL Configuration`.
3. Isi:

```text
Site URL:
https://fazaos.my.id

Additional Redirect URLs:
https://fazaos.my.id/auth/callback
```

Simpan.

## 9. Set Telegram Webhook Production

Di laptop, dari folder project:

```bash
npm run telegram:webhook -- set https://fazaos.my.id/api/public/telegram/webhook
```

Cek:

```bash
npm run telegram:webhook -- info
```

Hasil sehat:

```json
{
  "url": "https://fazaos.my.id/api/public/telegram/webhook",
  "pending_update_count": 0,
  "last_error_message": null
}
```

Kalau `"url": null`, webhook belum terset.

Kalau `last_error_message` timeout:

- Domain belum aktif.
- HTTPS belum aktif.
- Netlify function error.
- Env `TELEGRAM_API_KEY` salah atau belum masuk Netlify.

## 10. Link Telegram ke Akun

Di Telegram:

1. Kirim `/start` ke bot.
2. Ambil Chat ID.
3. Buka `https://fazaos.my.id`.
4. Login.
5. Buka `More` -> `Telegram Bot`.
6. Masukkan Chat ID.
7. Simpan.
8. Coba:

```text
/menu
```

Lalu coba:

```text
/sora halo, kamu sudah jalan dari Netlify?
```

## 11. Setup Cron Gratis dengan cron-job.org

Karena Netlify Free bukan VPS, jangan pakai Linux crontab. Pakai cron-job.org untuk
memanggil endpoint Faza OS dari internet.

Buat akun di cron-job.org, lalu buat dua cron job.

### 11.1 Cron Notifikasi

URL:

```text
https://fazaos.my.id/api/public/cron/notify
```

Method:

```text
GET
```

Schedule:

```text
Every 5 minutes
```

Header:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

Ganti `YOUR_CRON_SECRET` dengan isi `CRON_SECRET` di Netlify.

### 11.2 Cron Refresh Investasi

URL:

```text
https://fazaos.my.id/api/public/cron/update-investments
```

Method:

```text
GET
```

Schedule:

```text
Every day at 02:00 UTC
```

Catatan:

- `02:00 UTC` sama dengan `09:00 WIB`.
- Endpoint investasi memang hanya refresh normal pada jam 09:00 WIB.
- Untuk test manual, pakai `?force=1`.

Header:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

## 12. Test Manual Cron

Dari laptop:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://fazaos.my.id/api/public/cron/notify
```

Untuk investasi:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://fazaos.my.id/api/public/cron/update-investments?force=1"
```

Kalau secret salah, hasilnya harus `Unauthorized`.

## 13. Test Laptop Mati

1. Pastikan website bisa dibuka:

```text
https://fazaos.my.id
```

2. Pastikan Telegram bot merespon:

```text
/menu
```

3. Tutup dev server lokal di laptop.
4. Matikan laptop / disconnect internet laptop.
5. Kirim:

```text
/sora tes, kamu masih hidup kan?
```

Kalau bot tetap menjawab, berarti webhook sudah tidak bergantung pada laptop.

## 14. Cara Update Kode Setelah Publish

Dari laptop:

```bash
git add .
git commit -m "Update Faza OS"
git push
```

Netlify akan otomatis build ulang dari GitHub.

Setelah deploy selesai, cek:

```bash
npm run telegram:webhook -- info
```

## 15. Troubleshooting

### Deploy gagal

Cek log deploy Netlify. Masalah umum:

- Env belum lengkap.
- Build command salah.
- Node version bukan 22.
- `NITRO_PRESET` belum `netlify`.

### Website bisa dibuka, Telegram tidak respon

Cek:

```bash
npm run telegram:webhook -- info
```

Masalah umum:

- Webhook belum diarahkan ke `https://fazaos.my.id`.
- Function Netlify error.
- Env `TELEGRAM_API_KEY` belum masuk.
- Env `DEEPSEEK_API_KEY` belum masuk.

### Sora lambat menjawab

Netlify Free bisa mengalami cold start. Itu normal untuk serverless. Kalau jawaban terlalu
sering timeout, kurangi prompt panjang atau pertimbangkan hosting VPS saat sudah punya kartu /
metode pembayaran.

### Cron Unauthorized

Pastikan header cron-job.org memakai:

```text
Authorization: Bearer isi_CRON_SECRET_asli
```

Bukan:

```text
SUPABASE_PUBLISHABLE_KEY
```

### Domain belum HTTPS

Cek:

```bash
nslookup fazaos.my.id
```

Lalu cek di Netlify `Domain management` apakah DNS sudah verified dan certificate sudah aktif.

## Checklist Final

- [ ] `https://fazaos.my.id` bisa dibuka.
- [ ] Login Supabase berhasil.
- [ ] `/menu` Telegram dibalas.
- [ ] `/sora halo` Telegram dibalas.
- [ ] `npm run telegram:webhook -- info` menampilkan URL production.
- [ ] cron-job.org notify aktif setiap 5 menit.
- [ ] cron-job.org investasi aktif jam 02:00 UTC / 09:00 WIB.
- [ ] Laptop dimatikan dan bot tetap merespon.

Kalau semua checklist ini selesai, Faza OS sudah jalan gratis tanpa credit card.
