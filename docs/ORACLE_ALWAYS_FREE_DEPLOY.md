# To-Do Publish Faza OS di Oracle Always Free

Panduan ini dibuat untuk deploy Faza OS supaya jalan di server Oracle Cloud, bukan di laptop.
Kalau sudah selesai, laptop boleh mati dan program tetap berjalan karena yang hidup adalah VM
Oracle, PM2, Caddy, cron server, Supabase hosted, dan Telegram webhook production.

Catatan penting: Oracle Cloud biasanya meminta credit card untuk verifikasi akun. Kalau kamu
tidak punya credit card, pakai alternatif gratis tanpa kartu di
`docs/NETLIFY_FREE_DEPLOY_NO_CARD.md`.

## Gambaran Sederhana

- Laptop hanya dipakai untuk setup awal dan update kode.
- Oracle Cloud VM adalah komputer Linux kecil yang menyala 24 jam.
- PM2 menjaga aplikasi Node.js tetap hidup dan otomatis restart kalau crash.
- `pm2 startup` membuat aplikasi otomatis hidup lagi setelah VM reboot.
- Caddy menerima HTTPS dari internet dan meneruskan request ke app lokal di VM.
- Supabase tetap hosted di Supabase.
- Telegram webhook diarahkan ke domain production, bukan ke localhost/laptop.
- Cron Linux di VM memanggil endpoint cron Faza OS memakai `CRON_SECRET`.

Target akhir:

```text
User Browser / Telegram
        |
        v
https://fazaos.my.id
        |
        v
Oracle VM + Caddy + PM2 + Faza OS
        |
        v
Supabase + DeepSeek + Telegram API
```

## Checklist Besar

- [ ] Punya akun Oracle Cloud.
- [ ] Punya Supabase project.
- [ ] Punya Telegram bot token dari BotFather.
- [ ] Punya DeepSeek API key.
- [ ] Punya domain `fazaos.my.id`.
- [ ] Oracle VM dibuat sebagai Always Free eligible.
- [ ] Port `80` dan `443` dibuka di Oracle Security List.
- [ ] Node.js, Git, PM2, dan Caddy terinstall di VM.
- [ ] Repo Faza OS sudah di-clone ke VM.
- [ ] `.env` production sudah dibuat di VM.
- [ ] Supabase migrations sudah dijalankan.
- [ ] `npm run typecheck`, `npm run lint`, `npm run smoke`, dan `npm run build` lolos.
- [ ] App berjalan via PM2.
- [ ] Caddy HTTPS aktif.
- [ ] Telegram webhook diarahkan ke domain production.
- [ ] Cron production aktif di VM.
- [ ] Tes setelah laptop mati berhasil.

## 1. Siapkan Akun dan Data Rahasia

### 1.1 Oracle Cloud

- Daftar di Oracle Cloud Free Tier.
- Saat membuat resource, pilih yang bertanda `Always Free eligible`.
- Simpan region yang kamu pilih. Pilih region yang dekat dan stok VM-nya tersedia.

Catatan awam:

- Oracle biasanya meminta kartu untuk verifikasi.
- Tetap pilih resource Always Free eligible agar tidak masuk biaya.
- Jangan membuat resource besar yang tidak ada label Always Free eligible.

### 1.2 Supabase

Buat project Supabase, lalu siapkan:

- Project URL.
- Publishable/anon key.
- Service role key.

Nanti isi ke `.env`:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Penting:

- `SUPABASE_SERVICE_ROLE_KEY` jangan pernah dimasukkan ke frontend.
- Jangan screenshot/share `.env`.

### 1.3 Telegram Bot

Di Telegram:

1. Buka `@BotFather`.
2. Buat bot dengan `/newbot`.
3. Simpan token bot.

Nanti isi:

```env
TELEGRAM_API_KEY=123456:ABC...
```

### 1.4 DeepSeek

Siapkan API key:

```env
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
```

### 1.5 Buat CRON_SECRET

Di laptop atau VM, jalankan:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Contoh hasil:

```text
Ocn0g7kqT9aNwPanjangSekaliRandom
```

Isi ke `.env`:

```env
CRON_SECRET=hasil-random-tadi
```

Penting:

- Jangan pakai `SUPABASE_PUBLISHABLE_KEY` sebagai `CRON_SECRET`.
- Jangan pakai password pendek.

## 2. Buat VM Oracle Always Free

Di Oracle Cloud Console:

1. Buka menu `Compute`.
2. Pilih `Instances`.
3. Klik `Create instance`.
4. Beri nama, misalnya `faza-os`.
5. Image: pilih Ubuntu 24.04 atau Ubuntu 22.04 yang Always Free eligible.
6. Shape: pilih shape yang Always Free eligible.
7. Networking: pakai VCN default atau buat baru.
8. Pastikan ada Public IPv4 address.
9. SSH key:
   - Kalau Oracle menawarkan generate key, download private key.
   - Kalau sudah punya SSH key, upload public key.
10. Create.

Setelah VM jadi, catat:

```text
Public IP: x.x.x.x
Username Ubuntu biasanya: ubuntu
```

## 3. Buka Port 80 dan 443 di Oracle

Ini wajib agar HTTPS bisa diakses publik.

Di Oracle Console:

1. Buka VM instance.
2. Klik VCN/Subnet yang dipakai.
3. Buka `Security Lists` atau `Network Security Groups`.
4. Tambahkan ingress rules:

```text
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 80
Description: HTTP for Caddy
```

```text
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 443
Description: HTTPS for Caddy
```

Port SSH biasanya sudah ada:

```text
Destination Port Range: 22
```

Jangan buka port database atau port internal lain kalau tidak perlu.

## 4. Login ke VM via SSH

Dari laptop:

```bash
ssh ubuntu@PUBLIC_IP_VM
```

Kalau pakai private key:

```bash
ssh -i path/to/private-key.key ubuntu@PUBLIC_IP_VM
```

Kalau gagal karena permission key:

```bash
chmod 600 path/to/private-key.key
ssh -i path/to/private-key.key ubuntu@PUBLIC_IP_VM
```

## 5. Install Kebutuhan Server

Di dalam VM:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl build-essential ca-certificates
```

Install Node.js 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Cek:

```bash
node -v
npm -v
```

Install PM2:

```bash
sudo npm i -g pm2
pm2 -v
```

Install Caddy:

```bash
sudo apt install -y caddy
caddy version
```

## 6. Siapkan Domain `fazaos.my.id`

Telegram webhook production wajib HTTPS. Karena kamu sudah punya domain `fazaos.my.id`,
pakai domain ini langsung untuk website, webhook Telegram, dan cron production.

### 6.1 Arahkan domain utama ke IP VM

Di DNS provider tempat kamu membeli `fazaos.my.id`, cari menu DNS Management /
Kelola DNS / DNS Records. Tambahkan record:

```text
Type: A
Name: @
Value: PUBLIC_IP_VM
TTL: Auto / Default
```

Arti sederhananya:

- `@` berarti domain utama `fazaos.my.id`.
- `PUBLIC_IP_VM` adalah IP publik Oracle VM kamu.

Hasil akhirnya:

```text
https://fazaos.my.id
```

### 6.2 Opsional: arahkan `www`

Kalau kamu ingin `www.fazaos.my.id` juga bisa dibuka, tambahkan salah satu dari dua
opsi berikut.

Opsi yang paling umum:

```text
Type: CNAME
Name: www
Value: fazaos.my.id
TTL: Auto / Default
```

Kalau DNS provider tidak mengizinkan CNAME ke domain utama, pakai A record:

```text
Type: A
Name: www
Value: PUBLIC_IP_VM
TTL: Auto / Default
```

Tunggu DNS aktif. Cek dari laptop:

```bash
nslookup fazaos.my.id
```

Kalau ingin cek `www`:

```bash
nslookup www.fazaos.my.id
```

IP yang muncul harus IP VM Oracle. DNS kadang butuh beberapa menit sampai beberapa jam.

## 7. Clone Repo ke VM

Di VM:

```bash
cd ~
git clone <URL_REPO_KAMU> FazaOS
cd FazaOS
```

Kalau repo private:

- Pakai GitHub personal access token, atau
- Setup SSH key untuk GitHub.

Install dependencies:

```bash
npm ci
```

## 8. Buat `.env` Production di VM

Di VM:

```bash
cp .env.example .env
nano .env
```

Isi minimal:

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
TAVILY_API_KEY=
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
```

Simpan di nano:

- Tekan `Ctrl+O`.
- Tekan `Enter`.
- Tekan `Ctrl+X`.

Cek env tanpa menampilkan isi secret:

```bash
npm run smoke
```

Kalau error `Missing required env`, buka `.env` lagi dan lengkapi.

## 9. Jalankan Supabase Migrations

Jika kamu punya Supabase CLI di laptop, jalankan dari laptop:

```bash
supabase link --project-ref PROJECT_REF
supabase db push
```

Atau jalankan SQL migration manual di Supabase SQL Editor sesuai urutan file:

```text
supabase/migrations/*.sql
```

Checklist Supabase:

- [ ] Semua migration sudah masuk.
- [ ] Tabel ada.
- [ ] RLS aktif.
- [ ] Auth redirect URL production sudah ditambahkan.

Tambahkan URL di Supabase Dashboard:

```text
Site URL:
https://fazaos.my.id

Additional Redirect URLs:
https://fazaos.my.id/auth/callback
```

## 10. Test Build di VM

Di VM:

```bash
npm run typecheck
npm run lint
npm run smoke
npm run build
```

Hasil yang diharapkan:

- `typecheck` tidak ada error.
- `lint` tidak ada error. Warning boleh dicatat, tapi error harus beres.
- `smoke` bilang required env hadir.
- `build` selesai.

## 11. Test Jalan Manual

Di VM:

```bash
npm start
```

Biarkan terminal ini jalan sebentar.

Dari terminal VM lain, cek:

```bash
curl -I http://127.0.0.1:3000
```

Kalau sudah OK, stop manual server dengan `Ctrl+C`.

## 12. Jalankan dengan PM2

Di VM:

```bash
pm2 start ecosystem.config.cjs
pm2 status
```

Log:

```bash
pm2 logs faza-os
```

Simpan daftar proses PM2:

```bash
pm2 save
```

Aktifkan auto-start setelah VM reboot:

```bash
pm2 startup
```

PM2 akan menampilkan command panjang yang diawali `sudo env ...`.
Copy command itu, paste, lalu tekan Enter.

Setelah itu jalankan lagi:

```bash
pm2 save
```

Checklist PM2:

- [ ] `pm2 status` menampilkan `faza-os` online.
- [ ] `pm2 logs faza-os` tidak spam error.
- [ ] `pm2 save` sudah dijalankan.
- [ ] Command hasil `pm2 startup` sudah dijalankan.

## 13. Setup Caddy HTTPS

Edit Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

Isi:

```caddyfile
fazaos.my.id {
  reverse_proxy 127.0.0.1:3000
}
```

Opsional, kalau kamu juga membuat DNS `www` dan ingin `www.fazaos.my.id` otomatis
diarahkan ke domain utama:

```caddyfile
www.fazaos.my.id {
  redir https://fazaos.my.id{uri} permanent
}
```

Format check:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

Reload:

```bash
sudo systemctl reload caddy
```

Cek status:

```bash
sudo systemctl status caddy --no-pager
```

Cek dari laptop:

```bash
curl -I https://fazaos.my.id
```

Kalau gagal HTTPS:

- Pastikan DNS sudah mengarah ke IP VM.
- Pastikan port `80` dan `443` terbuka di Oracle Security List.
- Pastikan PM2 app hidup di port `3000`.
- Cek log Caddy:

```bash
sudo journalctl -u caddy -n 100 --no-pager
```

## 14. Set Telegram Webhook Production

Di VM, dari folder repo:

```bash
cd ~/FazaOS
npm run telegram:webhook -- set https://fazaos.my.id/api/public/telegram/webhook
```

Cek:

```bash
npm run telegram:webhook -- info
```

Hasil yang sehat:

```json
{
  "url": "https://fazaos.my.id/api/public/telegram/webhook",
  "pending_update_count": 0,
  "last_error_message": null
}
```

Kalau `"url": null`, bot belum diarahkan ke server mana pun.
Sora dan command Telegram tidak akan merespon sampai webhook diset.

Kalau `last_error_message` berisi `401 Unauthorized`:

- Token webhook secret tidak cocok.
- Jalankan ulang command `set` di atas dari environment yang memakai `TELEGRAM_API_KEY` benar.

Kalau `last_error_message` berisi timeout:

- Cek Caddy.
- Cek PM2.
- Cek firewall Oracle.
- Cek domain mengarah ke IP VM.

## 15. Link Telegram ke Akun Faza OS

Di Telegram:

1. Kirim `/start` ke bot.
2. Bot akan mengirim Chat ID.
3. Buka Faza OS di browser.
4. Login.
5. Buka `More` -> `Telegram Bot`.
6. Masukkan Chat ID.
7. Simpan.
8. Coba kirim:

```text
/menu
```

Lalu coba Sora:

```text
/sora hari ini aku harus fokus apa?
```

Atau chat biasa:

```text
hari ini aku harus fokus apa?
```

## 16. Setup Cron Production di VM

Cron ini yang membuat notif tetap jalan walau laptop mati.

Edit crontab:

```bash
crontab -e
```

Tambahkan, ganti `YOUR_CRON_SECRET` dengan isi `CRON_SECRET` di `.env` production:

```cron
*/5 * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://fazaos.my.id/api/public/cron/notify >/dev/null
0 2 * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://fazaos.my.id/api/public/cron/update-investments >/dev/null
```

`0 2 * * *` adalah jam `02:00 UTC`, sama dengan `09:00 WIB`. Endpoint investasi juga menolak refresh di luar jam 09:00 WIB kecuali dipanggil manual dengan `?force=1`.

Simpan.

Cek daftar cron:

```bash
crontab -l
```

Test manual:

```bash
curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://fazaos.my.id/api/public/cron/notify
```

Kalau secret salah, harus keluar `Unauthorized`.

## 17. Pastikan Tetap Jalan Saat Laptop Mati

Checklist penting:

- [ ] Webhook Telegram memakai domain production, bukan localtunnel/ngrok.
- [ ] App berjalan di Oracle VM via PM2.
- [ ] Caddy berjalan di Oracle VM.
- [ ] Cron dibuat di Oracle VM, bukan di laptop.
- [ ] Supabase hosted aktif.
- [ ] DeepSeek API key ada di `.env` VM.

Tes:

1. Pastikan app bisa dibuka:

```text
https://fazaos.my.id
```

2. Pastikan Telegram bot merespon:

```text
/menu
```

3. Matikan dev server di laptop.
4. Tutup laptop atau disconnect internet laptop.
5. Kirim pesan Telegram lagi:

```text
/sora tes, kamu jalan dari server kan?
```

Kalau tetap merespon, berarti sistem sudah tidak bergantung pada laptop.

## 18. Tes Reboot VM

Ini untuk memastikan PM2 startup benar.

Di VM:

```bash
sudo reboot
```

Tunggu 1-3 menit, lalu SSH lagi:

```bash
ssh ubuntu@PUBLIC_IP_VM
```

Cek:

```bash
pm2 status
sudo systemctl status caddy --no-pager
curl -I https://fazaos.my.id
```

Kirim Telegram:

```text
/menu
```

Kalau semua OK, app tahan restart server.

## 19. Cara Update Kode Setelah Publish

Di VM:

```bash
cd ~/FazaOS
git pull
npm ci
npm run typecheck
npm run lint
npm run smoke
npm run build
pm2 restart faza-os
pm2 logs faza-os
```

Kalau migration baru ada:

```bash
supabase db push
```

atau jalankan SQL migration baru di Supabase Dashboard.

## 20. Troubleshooting Cepat

### Telegram tidak respon sama sekali

Cek:

```bash
npm run telegram:webhook -- info
```

Masalah umum:

- `"url": null`: webhook belum diset.
- `401 Unauthorized`: secret webhook Telegram tidak cocok.
- Timeout: domain/HTTPS/server tidak bisa dijangkau Telegram.
- `pending_update_count` naik terus: Telegram gagal mengirim ke server.

Set ulang webhook:

```bash
npm run telegram:webhook -- set https://fazaos.my.id/api/public/telegram/webhook
```

### Sora tidak menjawab, tapi command lain bisa

Cek env:

```bash
npm run smoke
```

Cek log:

```bash
pm2 logs faza-os
```

Cari error:

- `DEEPSEEK_API_KEY belum dikonfigurasi`
- quota DeepSeek habis
- network error ke DeepSeek
- Supabase service role salah

### Website tidak bisa dibuka

Cek app:

```bash
pm2 status
pm2 logs faza-os
curl -I http://127.0.0.1:3000
```

Cek Caddy:

```bash
sudo systemctl status caddy --no-pager
sudo journalctl -u caddy -n 100 --no-pager
```

Cek DNS:

```bash
nslookup fazaos.my.id
```

Cek firewall Oracle:

- Port `80` terbuka.
- Port `443` terbuka.

### Cron Unauthorized

Pastikan header memakai `CRON_SECRET`, bukan Supabase key:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://fazaos.my.id/api/public/cron/notify
```

Cek `.env` VM:

```bash
grep CRON_SECRET .env
```

Jangan paste secret ke chat publik.

### Setelah reboot app mati

Cek:

```bash
pm2 status
pm2 resurrect
```

Kalau perlu ulang:

```bash
pm2 save
pm2 startup
```

Jalankan command `sudo env ...` yang diberikan PM2, lalu:

```bash
pm2 save
sudo reboot
```

## 21. Checklist Final Live

- [ ] `https://fazaos.my.id` bisa dibuka dari HP dengan mobile data.
- [ ] Login Supabase/Auth berhasil.
- [ ] `/menu` Telegram dibalas.
- [ ] `/sora halo` Telegram dibalas.
- [ ] `npm run telegram:webhook -- info` menampilkan URL production.
- [ ] `last_error_message` webhook `null`.
- [ ] `pm2 status` online.
- [ ] `sudo systemctl status caddy` active.
- [ ] `crontab -l` berisi dua cron Faza OS.
- [ ] VM sudah pernah direboot dan app tetap hidup.
- [ ] Laptop dimatikan dan bot tetap merespon.

Kalau semua checklist ini selesai, Faza OS sudah benar-benar jalan di cloud.
