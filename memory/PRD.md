# PRD — Twins Graduation: Photography Business Management Platform

## Original Problem Statement
Web app all-in-one untuk bisnis fotografi (studio/wisuda): booking form publik, jadwal otomatis (kalender), manajemen pembayaran (DP/pelunasan), invoice PDF otomatis, dashboard admin, keuangan, pengeluaran, seleksi foto klien via Google Drive, portal klien privat, manajemen booking, search & filter, notifikasi/pengingat (arsitektur siap WhatsApp/email), analitik bisnis, role-based access (Owner/Admin/Fotografer/Klien), UI premium dark & light mode, Bahasa Indonesia.

## User Choices
- Database: MongoDB Atlas (connection string diberikan tapi masih berisi placeholder `<db_password>` — sementara pakai MongoDB lokal via MONGO_URL; swap ke Atlas setelah password tersedia)
- UI: Bahasa Indonesia
- Auth: JWT custom (email + password, httpOnly cookies)
- Galeri foto: link folder Google Drive (embed), tanpa OAuth
- Notifikasi: log/antrean mock, siap integrasi WhatsApp/email

## Arsitektur
- Backend: FastAPI (`server.py`, `auth.py`, `bookings.py`, `ops.py`, `invoice_pdf.py`, `seed.py`, `database.py`), Motor/MongoDB, bcrypt + PyJWT, reportlab untuk PDF invoice
- Frontend: React + Tailwind + shadcn/ui + recharts, fonts Outfit/Manrope/JetBrains Mono, dark default
- Roles: owner (full), admin (booking/schedule/klien/invoice), photographer (jadwal & booking yang ditugaskan), client (portal token tanpa login)

## User Personas
- Owner studio: pantau revenue, expense, profit, kelola pengguna
- Admin: kelola booking, jadwal, pembayaran, invoice, seleksi foto
- Fotografer: lihat jadwal & detail sesi yang ditugaskan
- Klien: cek booking, invoice, bayar, pilih foto, status editing/pengiriman

## Implemented (2026-06)
- Form booking publik + paket auto-fill + portal link setelah submit
- Auth JWT + seed owner (sayapasuransi@gmail.com) + admin & fotografer demo + brute-force lockout
- Dasbor: 11 stat cards + sesi terdekat + jatuh tempo + antrean editing
- Kalender jadwal: tampilan hari/minggu/bulan, badge status, deteksi bentrok (<2 jam di tanggal sama)
- Manajemen booking: CRUD, assign fotografer, reschedule, status, catatan internal, search & filter lengkap
- Pembayaran: catat DP/pelunasan, auto hitung sisa & status, riwayat, hapus (owner)
- Invoice PDF (reportlab): preview HTML, unduh, cetak, kirim (mock → log notifikasi)
- Keuangan: filter hari/minggu/bulan/tahun/kustom, chart pendapatan vs pengeluaran, ringkasan laba
- Pengeluaran: CRUD dengan kategori & metode
- Analitik: chart bulanan, performa paket, revenue per fotografer/lokasi, repeat clients, rata-rata nilai booking
- Portal klien: detail sesi, progres pembayaran, invoice PDF, embed Drive, seleksi foto masonry + counter + catatan per foto + submit final
- Notifikasi: run-checks (pengingat sesi, DP, pelunasan, seleksi foto, pengiriman) dengan dedupe harian + log
- Manajemen pengguna (owner): buat admin/fotografer

## Status Pengujian (2026-06)
- Backend: 52/52 pytest lulus (auth, booking, pembayaran, invoice, schedule, portal, finance, analytics, notifikasi, users)
- Frontend: seluruh flow Playwright lulus (2 ronde); 6 bug ronde 1 diperbaiki & terverifikasi (redirect fotografer, lockout brute-force, overflow kartu mobile, AlertDialog portal, dedupe testid, select paket)
- Mock: kirim invoice via WhatsApp/email (log notifikasi), embed Google Drive

## Backlog
- P0: Swap MONGO_URL ke MongoDB Atlas (butuh password asli dari user)
- P1: Integrasi WhatsApp/email nyata untuk notifikasi & kirim invoice (Twilio/SendGrid/Resend)
- P1: Upload bukti nota pengeluaran (object storage) — sekarang hanya URL
- P2: Edit paket & info bisnis dari halaman Pengaturan
- P2: Sinkronisasi foto langsung dari folder Google Drive (Drive API)
- P2: Laporan keuangan export PDF/Excel, recurring expenses
- P2: Lupa/reset password via email (endpoint dasar belum dibuat)

## Next Tasks
1. Minta password Atlas asli → update MONGO_URL di backend/.env
2. Integrasi kanal notifikasi (tanyakan provider pilihan user)
3. Verifikasi ulang lewat testing agent setelah perubahan di atas
