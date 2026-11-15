# Rental Mobil (Next.js + Tailwind + Firebase)

1. `npm install`
2. Salin `.env.local.example` ke `.env.local`, isi dari Firebase Console (Project settings > Web app).
3. Firebase Console: aktifkan Authentication (Email/Password) dan Firestore. Storage TIDAK dipakai (foto disimpan di Firestore, tanpa paket Blaze). Buat 1 akun owner secara manual.
4. Deploy rules: `npx firebase-tools deploy --only firestore:rules`
5. `npm run dev`

Status koleksi `vehicles.status`: `available` | `on_rent` | `maintenance`.
Status `bookings.status`: `booked` | `on_rent` | `completed` | `cancelled`.
Field tanggal (`start_datetime`, `end_datetime`, `tax_due_date`) disimpan sebagai Firestore Timestamp.

## Index Firestore
Semua query memakai satu filter range / equality sehingga tidak butuh composite index.

## Deploy
- Vercel: import repo GitHub, isi semua variabel `.env.local` di Project Settings > Environment Variables.
- Firebase Auth: tambahkan domain Vercel di Authentication > Settings > Authorized domains.
- Aturan tarif & denda ada di `src/lib/pricing.js`.

## Fitur tambahan
- Pelanggan & blacklist (`/pelanggan`), semua pesanan + filter belum lunas (`/pesanan`), detail/pembayaran/biaya tambahan (`/pesanan/detail`), ubah pesanan (`/pesanan/ubah`).
- Cadangkan data ke CSV/JSON (`/cadangan`). Lakukan berkala; Firebase gratis tidak punya backup otomatis.
- Service worker (`public/sw.js`): aplikasi bisa dibuka offline setelah pernah dibuka online. Hanya aktif di build produksi (Vercel).
- GPS: isi kolom di Armada > Ubah unit. `speed_kmh` + `speed_updated_at` pada dokumen unit, atau URL data JSON (butuh CORS), memicu peringatan > 100 km/jam.
- `customers.ktp_url` / `sim_url` berisi ID dokumen foto di koleksi `images` (bukan URL).
- `bookings.dp_paid` = total uang yang sudah diterima; rincian ada di array `payments`.
