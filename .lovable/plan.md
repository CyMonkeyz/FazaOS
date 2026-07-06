# Faza OS — Revisi Menyeluruh (Rencana Bertahap)

Tujuan: memperbaiki Faza OS yang sudah ada agar terasa seperti OS harian sesungguhnya. Tidak membangun ulang. Semua UI Bahasa Indonesia. Navigasi utama tetap: Home, Money, Activity, Business, Review, More.

Karena scope-nya sangat besar, saya akan mengerjakan dalam 6 fase berurutan. Setiap fase saya kirim sebagai satu batch (migration + code + verifikasi build), lalu lanjut ke fase berikutnya. Rencana ini adalah kontrak untuk seluruh 6 fase.

## Ringkasan Arsitektur

- Semua rahasia (Telegram token, DeepSeek/Lovable AI, Google token, service role) tetap di server. Frontend hanya pakai anon key + publishable envs.
- Semua integrasi eksternal via TanStack server functions / server routes / cron endpoint. Tidak ada panggilan langsung dari browser.
- Timezone Asia/Jakarta dipakai eksplisit di semua scheduler & tanggal Home/Telegram (bukan server local time).
- Notifikasi via tabel `notifications` + `notification_logs` + `telegram_notification_queue` dengan `dedupe_key` unik untuk idempotensi.

## Phase 1 — Workout & Body (Review tab baru)

Database (satu migration):

- `workout_plans`, `workout_logs`, `exercise_library`, `workout_sets`, `body_metrics` (persis skema yang diminta).
- RLS + GRANT ke authenticated & service_role, indeks, trigger `updated_at`, soft-delete kecuali `workout_sets`.

UI:

- `Review` tabs jadi: Daily, Workout, Body, Weekly, Monthly, Goals, Score. Monthly & Score sebagai stub ringan (list bulan lalu / skor komposit dari existing weekly_reviews) supaya tidak "coming soon".
- Komponen: `WorkoutTab` (rencana hari ini, log cepat, library exercise, set tracker di dalam "More details"), `BodyTab` (input cepat berat/tidur/air + grafik berat 30 hari via recharts, rata-rata tidur).
- Quick Add ditambah: Workout selesai, Rencana workout, Berat badan, Tidur, Air minum, Tugas, Agenda, Penjualan, Stok (invalidate hanya query keys terkait).
- Home card baru: "Workout Hari Ini" dengan aksi Mulai/Selesai/Skip.

## Phase 2 — Notifikasi & Telegram Harian

Database:

- `notifications`, `notification_logs`, `telegram_notification_queue`, `telegram_message_logs` dengan `unique(user_id, dedupe_key)`.
- Tambah kolom ke `user_preferences`: `notify_morning_brief`, `notify_midday_check`, `notify_night_review`, `notify_workout`, `notify_debt_due`, `notify_receivable_due`, `notify_deadline`, `show_amounts_in_telegram`, `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end`, `tz` (default 'Asia/Jakarta').

Server:

- Refactor `/api/public/cron/notify` jadi jalan tiap 15 menit; hitung waktu WIB via `Intl.DateTimeFormat('Asia/Jakarta')`, hormati quiet hours, cek preferensi user, log tiap kirim, gunakan `dedupe_key` (mis. `morning:{user}:{yyyy-mm-dd}`).
- Jenis pesan: Morning Brief (06:30), Midday Check (12:30 kondisional), Night Review (20:30), Workout Reminder (H-1 jam atau 17:00), Debt/Receivable Reminder (H-3/H-1/H0/H+1 piutang), Deadline Reminder (H-3/H-1/H0 untuk urgent/high).
- Tambah command bot: `/brief /jadwal /uang /tugas /hutang /piutang /workout /workout_done /workout_skip /berat /tidur /review /notif /notif_on /notif_off`. Parser sederhana `/berat 70.5`, `/tidur 7 kualitas 4`.
- Kartu Telegram di `More` diperluas: status, last sent (dari `telegram_message_logs`), next scheduled, preferensi (toggle), test morning brief, test workout reminder, list command, disconnect.

## Phase 3 — Home Command Center

`src/routes/_authenticated/home.tsx` di-rewrite jadi 8 kartu: Today Focus, Agenda Hari Ini, Deadline & Tugas Mendesak, Money Alert, Hutang & Piutang Alert, Workout Hari Ini, Activity Load, Telegram Notif Status.

- `today_focus` table baru (user_id, focus_date, source_type, source_id, title, status, position, override boolean). Auto-generator server fn `computeTodayFocus` — deteksi urgent tasks, event, debt due ≤3 hari, receivable overdue, bill due ≤3 hari, workout, weekly review next focus; user bisa override + tandai selesai.
- Agenda: gabung `activity_events` + Google Calendar cache. Deteksi konflik (overlap) → badge merah.
- Deadline: label Hari ini / Besok / H-3 / H-7 / Terlambat.
- Money Alert: hitung budget usage per kategori, overspending, bills upcoming 7 hari, negative cashflow bulan berjalan.
- Debt/Receivable Alert: hormati `show_amounts_in_telegram` untuk privasi tampilan.
- Activity Load: skor 0–100 komposit (tasks*4 + events*3 + meetings*3 + competitions_deadline*5 + committee*3 + volunteer*2 + workout*2), capped 100 + label & saran singkat.
- Telegram card: status dari DB, last & next dari `telegram_notification_queue`, tombol Kirim test.

## Phase 4 — Activity Center Lengkap

Tabs Activity jadi: Akademik, Agenda, Organisasi, Lomba, Kepanitiaan, Volunteer, Seminar, Portfolio.

- Reuse `competitions` (sudah ada) untuk Lomba dengan UI lengkap (deadline daftar/submisi, stage, team, hasil, sertifikat → convert Portfolio).
- Tabel baru: `committee_events`, `volunteer_activities`, `certifications` (skema sesuai spec).
- `portfolio_items` diperluas → `portfolio_entries` shape (tambah `source_type`, `source_id`, `cv_ready_description`, `is_cv_worthy`, `proof_file_id`). Migrasi kolom ke tabel existing daripada rename.
- Akademik: summary cards + task board (todo/doing/done) + revision tracker sederhana (tabel `revisions` opsional; jika time-boxed skip dan integrasikan ke `academic_tasks.status` doing).

## Phase 5 — Business Lab Lengkap + Money Guard Polish

Business tabs: Overview, Toko, Produk/Menu, HPP, Promo, Stok, Supplier, Sales.

- Tabel baru: `hpp_calculations`, `promo_simulations`, `inventory_items`. UI HPP calculator (validasi yield>0), Promo simulator (label profitable/break_even/loss), Stok bahan baku, Supplier tab pakai tabel `suppliers` existing.
- Overview: revenue/profit/top product/low stock/low margin/active promos + chart revenue 30 hari.

Money Guard:

- Cashflow Projection card (saldo + expected receivable − upcoming bills − upcoming debt) label safe/warning/danger.
- Debt Safety Score (0–100).
- Receivable follow-up generator (template sopan/tegas, tombol Copy, opsi kirim reminder ke Telegram user sendiri).
- Bills: generator recurring (monthly) dengan `dedupe_key` `bill:{name}:{yyyy-mm}` supaya tidak duplikat, tombol mark as paid.

## Phase 6 — Google Calendar + Sora Brain Polish + Audit

Google Calendar:

- Tabel `google_calendar_connections` (user_id, access_token_encrypted, refresh_token_encrypted, sync_token, last_sync_at, last_error). Status "Terhubung" hanya jika baris ada + refresh_token valid.
- Server fn `syncCalendar` (incremental via syncToken; fallback full sync jika 410). Simpan ke `calendar_events_cache`. Manual sync button + error state.
- Home Agenda & Telegram Morning Brief pakai cache.

Sora Brain:

- System prompt tambah aturan "jangan mengarang angka; jika tidak ada, jawab 'data belum tersedia'".
- Log token usage ke `ai_usage_logs` + batas bulanan via `user_preferences.ai_monthly_limit`.
- Tombol AI kontekstual di tiap modul (Money/Activity/Business/Review/Workout).

Audit akhir:

- `tsgo` bersih, `supabase--linter` clean, tidak ada token di frontend (grep), semua tabel baru punya RLS+GRANT, no duplicate route path, timezone WIB konsisten.

## Catatan Teknis

- Cron: satu endpoint `/api/public/cron/notify` dipanggil setiap 15 menit via pg_cron (pakai `apikey` = publishable key). Cron SQL dibuat via `supabase--insert` setelah Phase 2 deploy.
- Semua tabel baru mengikuti pola GRANT authenticated + service_role, RLS policy `auth.uid() = user_id` untuk SELECT/INSERT/UPDATE, soft-delete via `deleted_at`.
- Quick Add hanya invalidate query key spesifik (mis. `["transactions"]`, `["workout_logs"]`) bukan `qc.invalidateQueries()` global.

## Yang tidak dikerjakan sekarang

- Browser push notification (channel `browser` disiapkan di schema, UI belum).
- Encryption at rest untuk Google tokens memakai Supabase vault (disimpan sebagai text di kolom, akses hanya via service role).

Setelah Anda approve, saya mulai Phase 1 langsung (migration workout/body + UI Review tabs baru + Home Workout card + Quick Add options).
