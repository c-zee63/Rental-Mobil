'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { db } from '@/lib/firebase';
import { rupiah, tglPendek } from '@/lib/format';
import { sisaTagihan, sudahLunas } from '@/lib/billing';
import BatalkanSheet from '@/components/BatalkanSheet';
import { Chips, inputCls } from '@/components/ui';

const STATUS = { booked: ['Booked', 'bg-petrol-soft text-petrol-dark'], on_rent: ['On-Rent', 'bg-amber-soft text-ink'], completed: ['Selesai', 'bg-mist text-ink/70'], cancelled: ['Batal', 'bg-signal-soft text-signal'] };
const FILTER = [['semua', 'Semua'], ['belum', 'Belum lunas'], ['aktif', 'Aktif'], ['selesai', 'Selesai'], ['batal', 'Batal']];

export default function PesananPage() {
  const [rows, setRows] = useState([]);
  const [n, setN] = useState(100);
  const [f, setF] = useState('semua');
  const [q, setQ] = useState('');
  const [batal, setBatal] = useState(null);

  useEffect(() => onSnapshot(query(collection(db, 'bookings'), orderBy('start_datetime', 'desc'), limit(n)),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))), console.error), [n]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((b) => {
      if (f === 'belum' && (b.status === 'cancelled' || sudahLunas(b))) return false;
      if (f === 'aktif' && !['booked', 'on_rent'].includes(b.status)) return false;
      if (f === 'selesai' && b.status !== 'completed') return false;
      if (f === 'batal' && b.status !== 'cancelled') return false;
      return !t || [b.customer_name, b.vehicle_plate, b.booking_code, b.customer_nik].some((x) => String(x || '').toLowerCase().includes(t));
    });
  }, [rows, f, q]);

  const piutang = rows.filter((b) => b.status !== 'cancelled').reduce((t, b) => t + sisaTagihan(b), 0);

  return (
    <main className="px-4 pt-6 space-y-4">
      <h1 className="font-display text-2xl font-bold">Semua pesanan</h1>
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
        <input className={`${inputCls} pl-11`} placeholder="Cari nama, plat, atau kode" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Chips options={FILTER} value={f} onChange={setF} />
      <p className="text-sm text-ink/70">Belum tertagih (dari {rows.length} pesanan dimuat): <b className={piutang ? 'text-signal' : ''}>{rupiah(piutang)}</b></p>

      <ul className="space-y-2">
        {list.map((b) => {
          const [lbl, cls] = STATUS[b.status] || ['-', ''];
          const sisa = sisaTagihan(b);
          return (
            <li key={b.id}>
              <Link href={`/pesanan/detail?id=${b.id}`} className="block bg-white border border-line rounded-xl p-3">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold truncate">{b.customer_name} <span className="font-normal text-ink/60">· {b.vehicle_plate}</span></p>
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 ${cls}`}>{lbl}</span>
                </div>
                <p className="text-xs text-ink/60 mt-1">{b.booking_code} · {tglPendek(b.start_datetime)} – {tglPendek(b.end_datetime)}</p>
                {b.status !== 'cancelled' && (sisa > 0
                  ? <p className="text-sm font-semibold text-signal mt-1">Sisa {rupiah(sisa)}</p>
                  : <p className="text-sm font-semibold text-petrol mt-1">Lunas</p>)}
              </Link>
              {b.status === 'booked' && (
                <button type="button" onClick={() => setBatal(b)} className="w-full h-10 text-sm font-semibold text-signal">Batalkan pesanan</button>
              )}
            </li>
          );
        })}
      </ul>
      {!list.length && <p className="text-sm text-ink/60">Tidak ada pesanan yang cocok.</p>}
      {rows.length >= n && <button onClick={() => setN(n + 100)} className="w-full h-11 rounded-xl border border-line bg-white font-semibold">Muat lebih banyak</button>}
      <BatalkanSheet open={!!batal} booking={batal} onClose={() => setBatal(null)} />
    </main>
  );
}
