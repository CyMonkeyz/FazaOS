# Panduan Instalasi Faza OS

Faza OS dikemas sebagai **Progressive Web App (PWA)** — bisa dipasang di desktop maupun Android seperti aplikasi native, tanpa lewat App Store / Play Store.

---

## 1. Publish dulu (sekali saja)

1. Di editor Lovable, klik tombol **Publish** (kanan atas).
2. Tunggu sampai dapat URL final, misal `https://faza-os.lovable.app`.
3. URL itu yang dipakai untuk install di semua device.

> Kalau kamu punya custom domain (opsional), pakai domain itu supaya ikon app di homescreen labelnya bersih.

---

## 2. Install di Desktop (Windows / macOS / Linux)

**Browser yang didukung: Chrome, Edge, Brave, Arc, Opera.**

1. Buka URL Faza OS di browser.
2. Login pakai akunmu.
3. Lihat address bar — ada **ikon install** (bentuknya monitor + panah, atau ⊕) di ujung kanan.
4. Klik ikon itu → **Install**.
5. Faza OS terbuka di window sendiri, muncul di Start Menu / Launchpad / Applications.
6. Bisa juga di-pin ke taskbar / dock.

**Kalau ikon install tidak muncul:**

- Chrome: menu ⋮ → **Cast, save, and share** → **Install page as app...**
- Edge: menu ⋯ → **Apps** → **Install this site as an app**

---

## 3. Install di Android

**Browser: Chrome (rekomendasi) atau Edge.**

1. Buka URL Faza OS di Chrome Android.
2. Login.
3. Ketuk menu **⋮** (kanan atas) → **Install app** (atau **Add to Home Screen**).
4. Konfirmasi **Install**.
5. Icon Faza OS muncul di homescreen + app drawer.
6. Buka dari icon → jalan fullscreen tanpa address bar, mirip app native.

Notifikasi Telegram tetap jalan lewat bot Telegram-mu (bukan push notification browser).

---

## 4. Install di iPhone / iPad (bonus)

**Browser: Safari (harus Safari, bukan Chrome iOS).**

1. Buka URL Faza OS di Safari.
2. Ketuk tombol **Share** (kotak dengan panah keatas).
3. Scroll → **Add to Home Screen**.
4. Beri nama (default "Faza OS") → **Add**.
5. Icon muncul di homescreen.

> Support PWA di iOS masih terbatas dibanding Android (storage lebih kecil, tidak ada install banner). Tapi fitur inti Faza OS tetap jalan.

---

## 5. Update aplikasi

Faza OS **auto-update**. Tiap kamu buka app, browser fetch versi terbaru dari server. Tidak perlu re-install.

Kalau ada perubahan besar yang belum ke-refresh:

- Desktop: klik kanan pada window app → **Reload**.
- Android: tutup app dari recent apps → buka lagi.

---

## 6. Uninstall

- **Desktop (Chrome/Edge):** buka app → menu ⋮ di dalam window app → **Uninstall Faza OS**.
- **Android:** tekan lama icon di homescreen → **Uninstall** / **Remove**.
- **iOS:** tekan lama icon → **Remove App** → **Delete from Home Screen**.

Data di database (Lovable Cloud) tidak ikut terhapus — bisa install ulang kapan saja, login, dan semua data kembali.

---

## 7. Jaga privasi (opsional, karena app ini pribadi)

Karena URL publish bisa diakses siapa saja yang tahu link-nya, kalau kamu mau kunci Faza OS supaya cuma kamu yang bisa login:

1. Buka **View Backend** dari editor Lovable.
2. Auth → **Sign-Ups** → matikan (disable new sign-ups).
3. Pastikan akunmu sudah kedaftar duluan. Selesai — orang lain masih bisa buka URL tapi tidak bisa bikin akun baru.

---

## Troubleshooting cepat

| Masalah                          | Solusi                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------- |
| Ikon install tidak muncul        | Pastikan buka via **HTTPS** (URL `.lovable.app` sudah HTTPS), refresh halaman |
| Login gagal setelah install      | Buka URL sekali dulu di browser biasa, login, baru install                    |
| Ikon buram di homescreen Android | Uninstall → install ulang, Chrome cache icon di install pertama               |
| Notifikasi Telegram gak datang   | Cek Chat ID di menu **More → Telegram**, tekan **Test**                       |
| Data tidak muncul                | Pastikan online — Faza OS butuh koneksi (belum ada mode offline)              |

---

Selamat pakai Faza OS 🚀
