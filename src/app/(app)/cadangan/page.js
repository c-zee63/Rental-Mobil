'use client';
import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Download } from 'lucide-react';
import { db } from '@/lib/firebase';
import { download, dt, toCsv } from '@/lib/csv';
import { toISODate } from '@/lib/format';
import { sisaTagihan, totalTagihan } from '@/lib/billing';
import { Alert, Section } from '@/components/ui';

const ambil = async (nama) => (await getDocs(collection(db, nama))).docs.map((d) => ({ id: d.id, ...d.data() }));

export default function CadanganPage() {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const stamp = toISODate(new Date());

  async function jalankan(kunci) {
    setBusy(kunci); setErr('');
    try {
      if (kunci === 'pesanan') {
        const r = await ambil('bookings');
        download(`pesanan-${stamp}.csv`, toCsv(r.sort((a, b) => a.booking_code?.localeCompare(b.booking_code)), [
          { h: 'Kode', f: (b) => b.booking_code }, { h: 'Mulai', f: (b) => dt(b.start_datetime) }, { h: 'Selesai', f: (b) => dt(b.end_datetime) },
          { h: 'Pelanggan', f: (b) => b.customer_name }, { h: 'NIK', f: (b) => `'${b.customer_nik}` }, { h: 'Plat', f: (b) => b.vehicle_plate },
          { h: 'Layanan', f: (b) => b.service_type }, { h: 'Status', f: (b) => b.status },
          { h: 'Biaya sewa', f: (b) => b.total_price }, { h: 'Denda', f: (b) => b.overtime_fee || 0 }, { h: 'Biaya tambahan', f: (b) => b.extra_total || 0 },
          { h: 'Total tagihan', f: totalTagihan }, { h: 'Sudah dibayar', f: (b) => b.dp_paid || 0 }, { h: 'Sisa', f: (b) => (b.status === 'cancelled' ? 0 : sisaTagihan(b)) },
          { h: 'Deposit', f: (b) => b.deposit_amount || 0 }, { h: 'Deposit kembali', f: (b) => (b.deposit_returned ? 'ya' : 'belum') },
        ]));
      } else if (kunci === 'pembayaran') {
        const r = (await ambil('bookings')).flatMap((b) => (b.payments || []).map((p) => ({ b, p })));
        download(`pembayaran-${stamp}.csv`, toCsv(r, [
          { h: 'Tanggal', f: (x) => dt(x.p.at) }, { h: 'Kode', f: (x) => x.b.booking_code }, { h: 'Pelanggan', f: (x) => x.b.customer_name },
          { h: 'Nominal', f: (x) => x.p.amount }, { h: 'Metode', f: (x) => x.p.method }, { h: 'Catatan', f: (x) => x.p.note },
        ]));
      } else if (kunci === 'pelanggan') {
        download(`pelanggan-${stamp}.csv`, toCsv(await ambil('customers'), [
          { h: 'NIK', f: (c) => `'${c.id}` }, { h: 'Nama', f: (c) => c.full_name }, { h: 'WhatsApp', f: (c) => c.phone_whatsapp },
          { h: 'Blacklist', f: (c) => (c.is_blacklisted ? 'ya' : '') }, { h: 'Alasan', f: (c) => c.blacklist_reason },
        ]));
      } else if (kunci === 'unit') {
        download(`unit-${stamp}.csv`, toCsv(await ambil('vehicles'), [
          { h: 'Plat', f: (v) => v.plate_number }, { h: 'Model', f: (v) => v.brand_model }, { h: 'Tarif harian', f: (v) => v.daily_rate },
          { h: 'Status', f: (v) => v.status }, { h: 'Odometer', f: (v) => v.current_odometer }, { h: 'Ganti oli di', f: (v) => v.next_service_odometer },
          { h: 'Pajak', f: (v) => dt(v.tax_due_date).slice(0, 10) },
        ]));
      } else if (kunci === 'biaya') {
        const [e, v] = await Promise.all([ambil('expenses'), ambil('vehicles')]);
        const plat = Object.fromEntries(v.map((x) => [x.id, x.plate_number]));
        download(`biaya-${stamp}.csv`, toCsv(e, [
          { h: 'Tanggal', f: (x) => dt(x.expense_date).slice(0, 10) }, { h: 'Plat', f: (x) => plat[x.vehicle_id] || '' },
          { h: 'Kategori', f: (x) => x.category }, { h: 'Nominal', f: (x) => x.amount }, { h: 'Keterangan', f: (x) => x.description },
        ]));
      } else if (kunci === 'json') {
        const semua = {};
        for (const n of ['vehicles', 'customers', 'bookings', 'handovers', 'expenses']) semua[n] = await ambil(n);
        download(`cadangan-lengkap-${stamp}.json`, JSON.stringify(semua, null, 1), 'application/json');
      }
    } catch { setErr('Gagal mengambil data. Periksa koneksi lalu coba lagi.'); }
    finally { setBusy(''); }
  }

  const Tombol = ({ k, t, d }) => (
    <button onClick={() => jalankan(k)} disabled={!!busy} className="w-full text-left bg-mist rounded-xl p-3 flex items-center gap-3 disabled:opacity-50">
      <Download size={20} className="text-petrol shrink-0" />
      <span><b className="block">{busy === k ? 'Mengunduh…' : t}</b><span className="text-xs text-ink/60">{d}</span></span>
    </button>
  );

  return (
    <main className="px-4 pt-6 space-y-4">
      <h1 className="font-display text-2xl font-bold">Cadangkan data</h1>
      <p className="text-sm text-ink/70">Firebase gratis tidak punya backup otomatis. Unduh data secara berkala (misalnya sebulan sekali) dan simpan di Google Drive atau PC. File CSV bisa dibuka di Excel atau Google Sheets.</p>
      <Section title="Tabel (CSV)">
        <Tombol k="pesanan" t="Pesanan" d="Semua pesanan, tagihan, dan sisa" />
        <Tombol k="pembayaran" t="Pembayaran" d="Riwayat DP dan pelunasan" />
        <Tombol k="pelanggan" t="Pelanggan" d="Tanpa foto KTP dan SIM" />
        <Tombol k="unit" t="Unit armada" d="Tarif, odometer, pajak" />
        <Tombol k="biaya" t="Biaya operasional" d="Servis, oli, cuci, pajak" />
      </Section>
      <Section title="Cadangan lengkap">
        <Tombol k="json" t="Semua data (JSON)" d="Pesanan, pelanggan, unit, biaya, serah terima. Foto tidak termasuk." />
      </Section>
      {err && <Alert>{err}</Alert>}
    </main>
  );
}
