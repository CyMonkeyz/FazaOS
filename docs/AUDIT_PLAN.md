# Faza OS — Audit & Revisi (Rencana Bertahap)

Turn ini fokus pada perbaikan tinggi-dampak yang **shippable segera** tanpa migrasi besar:

## ✅ Sudah dieksekusi turn ini

1. **Sora placeholder edit-in-place** — di Telegram, pesan "🧠 Sora sedang berpikir…" sekarang **di-edit menjadi jawaban final** (tidak ada placeholder gantung).
2. **Sora context lebih kaya** — sekarang membaca: transactions, tasks, agenda 30 hari, debts, receivables, bills, workout, businesses, **investments**, **goals**, **daily_logs 5 hari**, **sales & products (low stock)**. Plus catatan modul + kebijakan (Telegram-only, GCal 30 hari, Sheets sync).
3. **Google Calendar lookahead 30 hari** — di `gcal.functions.ts`, `chat.ts` `fetchGCal`, tool `getUpcomingEvents`, dan deskripsi tool.
4. **System prompt Sora Brain** diperbarui — hapus "4 tab", "digest 07:00", ubah ke Activity lengkap (Lomba, Portfolio), Business per-toko dengan business_id, Telegram-only notifikasi, GCal 30 hari.
5. **Morning Brief encouragement** — baris hangat rotasi harian ditambahkan di akhir brief.
6. **Sora Telegram system prompt** — diperluas: kini menegaskan konteks lengkap tersedia, tidak boleh halusinasi, Telegram-only, GCal 30 hari.

## 🔜 Fase berikutnya (butuh migrasi DB + UI besar)

### Fase A — Schema Registry & Sora Tools Lengkap

- `src/lib/sora/schema-registry.ts` (deklaratif: tabel + tujuan + relasi)
- `src/lib/sora/tools.server.ts` (getFazaSchemaMap, getAvailableDataSummary, semua tool per modul)
- Ganti `chat.ts` tools[] dengan set dari registry.

### Fase B — Health Menu Baru (main nav)

- Migrasi: `supplement_items`, `supplement_logs`, `supplement_purchases` (FK ke `transactions.id`).
- Pindahkan Workout & Body dari Review → route baru `/health` (Dashboard, Workout, Body, Supplement, Recovery, Health Expense).
- Integrasi: `addSupplementPurchase` → auto-insert `transactions` (expense, category = health/supplement).

### Fase C — Business per-business enforcement

- Migrasi: pastikan `business_id NOT NULL` di products, sales, hpp_calculations, promo_simulations, inventory_items. Backfill "Bisnis Utama".
- Tambah `supplier_business_links`, `inventory_movements`.
- Redesign tab Business: sticky selector di atas, semua form isi `business_id` otomatis.

### Fase D — Budget kategori/period yang benar

- Sudah ada kolom `category_id`, `period_type`, `start_date`, `end_date`.
- UI: form select kategori + periode + tanggal auto. Kalkulasi filtered by category + date range.
- Cards: planned/used/remaining/percentage/status (aman/waspada/habis).
- Notif Telegram di 80% & 100%.

### Fase E — Investment auto-price 08:00 WIB

- Env: `ALPHA_VANTAGE_API_KEY`.
- Migrasi: `investment_price_history`, `investment_price_update_logs`. Kolom baru di `investments`: `ticker`, `provider_symbol`, `auto_update_enabled`, `price_provider`, `last_price_error`.
- Cron `update-investment-prices-daily` (pg_cron @ 01:00 UTC = 08:00 WIB).
- Summary Telegram: "Harga investasi diperbarui: X berhasil, Y gagal."

### Fase F — Google Sheets Sync

- Migrasi: `google_sheets_connections`, `google_sheets_sync_logs`.
- Fungsi: `setup-money-spreadsheet-tabs`, `sync-money-row-to-sheets`, `prune-google-sheet-tabs` (max 1000 rows/tab).
- Trigger: async enqueue setelah mutasi Money (non-blocking).

### Fase G — Review polish + Journal retention

- Migrasi + fungsi `enforceJournalRetention(userId)`: hard-delete daily_logs > 7 dan weekly_reviews > 4.
- Cron harian cleanup.
- UI Dashboard Review: streak, mood/energy/focus 7-hari mini chart, "mood garden" plant progress, tombol "Lihat Riwayat Jurnal".

### Fase H — Business Lab Redesign & Full Audit

- Audit tombol/handler kosong, query invalidation setelah mutasi.
- Loading/empty/error state konsisten.

---

## Catatan implementasi

- **Semua notifikasi terjadwal = Telegram-only.** Web/browser scheduled push dihapus.
- **Semua secret** (Telegram/DeepSeek/Lovable AI/GCal/Sheets/Alpha Vantage/Supabase service role) hanya di server functions.
- **Bahasa UI = Indonesia.** Format Rupiah `Rp1.234.567`, tanggal `id-ID`.
- **Mobile-first**, ringkas, tidak overcrowded.

Fase besar (A–H) akan dieksekusi turn berikutnya secara berurutan.
