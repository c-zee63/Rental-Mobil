'use client';
import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Sheet } from '@/components/ui';

const Contoh = ({ children }) => <div className="bg-petrol-soft text-petrol-dark rounded-lg px-3 py-2 text-sm mt-2"><b>Contoh: </b>{children}</div>;
const Langkah = ({ children }) => <ol className="list-decimal pl-5 space-y-1 text-sm mt-2">{children}</ol>;

function Bab({ judul, children, buka }) {
  return (
    <details open={buka} className="bg-white border border-line rounded-xl px-4 py-3 group">
      <summary className="font-semibold cursor-pointer">{judul}</summary>
      <div className="text-sm text-ink/80 mt-2 space-y-2">{children}</div>
    </details>
  );
}

export default function HelpGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Panduan penggunaan"
        className="fixed right-3 bottom-24 z-[900] w-11 h-11 rounded-full bg-petrol text-white grid place-items-center shadow-lg">
        <HelpCircle size={24} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Panduan penggunaan">
        <div className="space-y-2">
          <Bab judul="1. Mulai cepat: urutan pertama kali pakai" buka>
            <Langkah>
              <li>Buka <b>Beranda → Pengaturan</b>, isi nama usaha, alamat, telepon, dan logo.</li>
              <li>Buka <b>Armada → + Unit</b>, tambahkan semua mobil.</li>
              <li>Buat pesanan lewat tombol hijau <b>+Sewa</b>.</li>
              <li>Saat mobil keluar, tekan <b>Serah Terima</b>. Saat kembali, tekan <b>Terima Unit</b>.</li>
              <li>Catat pembayaran dan kirim invoice PDF lewat WhatsApp.</li>
              <li>Lihat untung-rugi di menu <b>Laporan</b>.</li>
            </Langkah>
          </Bab>

          <Bab judul="2. Pengaturan usaha dan logo">
            <p>Data ini muncul di kop PDF invoice dan pesan WhatsApp. Logo diperkecil otomatis. Isi juga rekening atau QRIS agar tampil di invoice yang masih ada sisa tagihan.</p>
            <Contoh>Nama “Rental Sejahtera”, alamat “Jl. Sudirman No. 5, Palu”, telepon 0812-0000-0000, rekening “BCA 1234567890 a.n. Budi”.</Contoh>
          </Bab>

          <Bab judul="3. Armada: tambah dan ubah unit">
            <p>Isi plat, model, tarif harian, odometer, batas ganti oli (km), dan jatuh tempo pajak STNK. Data ini memicu <b>kartu peringatan</b> di Beranda: oli ≤ 500 km lagi dan pajak H-30.</p>
            <Contoh>Avanza B 1234 XYZ, tarif Rp450.000, odometer 45.000, ganti oli di 50.000, pajak 10 Maret 2027. Saat odometer mencapai 49.600, kartu “Ganti oli 400 km lagi” muncul.</Contoh>
            <p>Status unit: <b>Available</b>, <b>On-Rent</b> (otomatis berubah saat serah terima), atau <b>Servis</b> (unit tidak bisa dipesan).</p>
          </Bab>

          <Bab judul="4. +Sewa: membuat pesanan">
            <Langkah>
              <li>Ketik NIK atau No WA pelanggan lalu tekan kaca pembesar. Pelanggan lama terisi otomatis.</li>
              <li>Pelanggan baru: isi NIK 16 digit, nama, WA, lalu foto KTP dan SIM A dari kamera.</li>
              <li>Pilih unit, layanan (lepas kunci atau dengan sopir), durasi, dan waktu mulai.</li>
              <li>Isi DP dan deposit. Total dan sisa tagihan dihitung otomatis.</li>
              <li>Tekan <b>Simpan pesanan</b>, lalu kirim invoice.</li>
            </Langkah>
            <Contoh>Budi sewa Avanza 2 hari (24 jam × 2) mulai Sabtu 09:00 → Rp900.000. Dengan sopir Rp250.000/hari → +Rp500.000 = Rp1.400.000. DP Rp300.000 → sisa Rp1.100.000.</Contoh>
            <p>Peringatan merah muncul bila jadwal <b>bentrok</b> dengan pesanan lain pada unit yang sama. Pelanggan blacklist ditandai merah dan perlu konfirmasi untuk lanjut. Tarif 12 jam = 60% harian, mingguan = 6,3× harian (ubah di <code>src/lib/pricing.js</code>).</p>
          </Bab>

          <Bab judul="5. Jadwal: timeline 14 hari">
            <p>Setiap baris adalah satu mobil. Warna: putih = tersedia, hijau tua = Booked, kuning = On-Rent, abu-abu = selesai. Sentuh kotak putih untuk membuat pesanan di tanggal itu, atau sentuh kotak berwarna untuk melihat detail dan aksi cepat. Panah di kanan atas menggeser 7 hari.</p>
          </Bab>

          <Bab judul="6. Serah terima dan terima unit">
            <p><b>Serah Terima</b> (mobil keluar): isi odometer, level bensin, checklist kelengkapan, dan catatan kondisi (baret, penyok). Status berubah menjadi On-Rent.</p>
            <p><b>Terima Unit</b> (mobil kembali): selain data di atas, aplikasi menghitung denda overtime dan menyediakan kolom biaya tambahan (kerusakan, BBM kurang, cuci), lalu pembayaran pelunasan.</p>
            <Contoh>Mobil kembali terlambat 3 jam. Toleransi 60 menit, sisa 2 jam × 10% × Rp450.000 = denda Rp90.000. BBM kurang Rp50.000. Total tagihan bertambah Rp140.000.</Contoh>
          </Bab>

          <Bab judul="7. Pembayaran dan invoice PDF">
            <Langkah>
              <li>Beranda → <b>Pesanan</b> → pilih pesanan.</li>
              <li>Di bagian <b>Pembayaran</b>, isi nominal (kosong = lunasi sisa), pilih Tunai/Transfer/QRIS, tekan <b>Catat pembayaran</b>.</li>
              <li>Tekan <b>Kirim invoice PDF via WhatsApp</b>. PDF dibuat otomatis, lalu menu Bagikan terbuka. Pilih WhatsApp, lalu pilih chat pelanggan.</li>
            </Langkah>
            <p>Jika HP/PC tidak mendukung berbagi file, PDF diunduh dan Anda melampirkannya manual di WhatsApp. Tombol kecil di bawahnya mengirim versi teks langsung ke nomor pelanggan. Pesanan yang sudah lunas menghasilkan <b>Kwitansi Pelunasan</b> dengan cap LUNAS.</p>
          </Bab>

          <Bab judul="8. Perpanjang sewa">
            <p>Dari Beranda (tombol <b>Extend</b>) atau detail pesanan. Pilih tambahan +12 jam sampai +3 hari. Aplikasi menolak bila bentrok dengan pesanan berikutnya.</p>
            <Contoh>Tambah 1 hari = +Rp450.000 pada total tagihan, jam selesai bergeser 24 jam.</Contoh>
          </Bab>

          <Bab judul="9. Biaya dan laporan profit">
            <p>Di <b>Laporan → + Biaya</b>, catat servis, oli, cuci, atau pajak per unit, boleh dengan foto nota. Profit bersih = pendapatan − biaya, per unit dan total, per bulan atau semua periode. Piutang (belum tertagih) tampil di kartu hijau.</p>
            <Contoh>Catat “Ganti oli Rp350.000” dengan odometer 50.000 dan interval 5.000 km → pengingat oli berikutnya otomatis di 55.000 km.</Contoh>
          </Bab>

          <Bab judul="10. Pelanggan, pesanan, dan blacklist">
            <p><b>Pelanggan</b>: cari, lihat foto KTP/SIM dan jumlah sewa, ubah nama/WA, atau tandai <b>Blacklist</b> dengan alasan. <b>Pesanan</b>: daftar semua pesanan dengan filter “Belum lunas”, bisa dicari berdasarkan nama, plat, atau kode. Pesanan berstatus Booked bisa diubah atau dibatalkan. Saat batal dan sudah ada DP, Anda memilih DP hangus (jadi pendapatan) atau dikembalikan.</p>
          </Bab>

          <Bab judul="11. Peta GPS dan peringatan kecepatan">
            <p>Menu <b>Armada → Peta GPS</b> menampilkan pin semua unit. Pin merah berarti melaju di atas 100 km/jam. Isi kolom GPS di <b>Armada → Daftar unit → ikon pensil</b>.</p>
            <p><b>Pilihan A, link</b> (paling mudah): isi link buka aplikasi dan link pantau publik (share link) dari vendor. Lokasi pin diisi manual lewat latitude/longitude.</p>
            <p><b>Pilihan B, API JSON</b> (otomatis): bila vendor punya API, pilih “Pakai API JSON”, isi URL data, autentikasi, dan path lat/lng/kecepatan, lalu tekan <b>Uji koneksi</b> untuk melihat hasilnya. Preset Traccar tersedia.</p>
            <Contoh>Traccar: URL <code>https://server-anda/api/positions?deviceId={'{device_id}'}</code>, autentikasi Username:Sandi, path <code>0.latitude</code>, <code>0.longitude</code>, <code>0.speed</code>, <code>0.fixTime</code>, satuan knot.</Contoh>
            <p>Vendor yang login lewat sesi atau tanda tangan (misalnya Wialon atau Navixy) tidak bisa dipakai langsung dengan satu URL. Pakai pilihan A untuk vendor tersebut. Data otomatis hanya diperbarui saat Beranda atau Armada terbuka.</p>
          </Bab>

          <Bab judul="12. Cadangkan data">
            <p>Firebase gratis tidak punya backup otomatis. Buka <b>Beranda → Cadangkan</b> dan unduh CSV atau JSON setiap bulan, lalu simpan di Google Drive atau PC. Foto KTP/SIM tidak ikut diunduh.</p>
          </Bab>

          <Bab judul="13. Pasang di HP dan bekerja tanpa sinyal">
            <p><b>Android (Chrome)</b>: menu ⋮ → Instal aplikasi. <b>iPhone (Safari)</b>: Bagikan → Tambahkan ke Layar Utama. Buka aplikasi sekali saat ada sinyal. Setelah itu data dan halaman tetap bisa dibuka saat sinyal lemah, dan perubahan tersinkron sendiri begitu sinyal kembali.</p>
            <p>Hal yang tetap butuh sinyal: login pertama kali, peta baru, dan data GPS otomatis.</p>
          </Bab>

          <Bab judul="14. Masalah yang sering muncul">
            <p><b>“Bentrok”</b>: unit sudah dipesan di jam itu, pilih unit atau jam lain. <b>Peta kosong</b>: unit belum punya koordinat. <b>PDF tidak masuk WhatsApp</b>: gunakan menu Bagikan, atau lampirkan PDF yang terunduh secara manual. <b>Uji koneksi GPS gagal</b>: periksa https, CORS, dan autentikasi.</p>
          </Bab>
        </div>
      </Sheet>
    </>
  );
}
