'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, doc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useFleet } from '@/lib/useFleet';
import { addDays, awalHari, rupiah, tglJam, toDate, toISODate } from '@/lib/format';
import { invoiceText, waUrl } from '@/lib/whatsapp';
import { Sheet, btnGhost, btnPrimary } from '@/components/ui';

const DAYS = 14;
const WARNA = { on_rent: 'bg-amber', booked: 'bg-petrol', completed: 'bg-ink/20' };
const LABEL = { on_rent: 'On-Rent', booked: 'Booked', completed: 'Selesai' };

export default function JadwalPage() {
  const { vehicles } = useFleet();
  const [from, setFrom] = useState(() => awalHari());
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState(null);
  const to = addDays(from, DAYS);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(from, i)), [from]);
  const today = awalHari().getTime();

  useEffect(() => {
    // 1 filter range saja -> tidak perlu composite index
    const q = query(collection(db, 'bookings'), where('end_datetime', '>=', Timestamp.fromDate(from)));
    return onSnapshot(q, (s) =>
      setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.status !== 'cancelled' && toDate(b.start_datetime) < to)),
      console.error);
  }, [from]); // eslint-disable-line react-hooks/exhaustive-deps

  function cell(vid, day) {
    const ds = day, de = addDays(day, 1), now = new Date();
    const hit = rows.filter((b) => {
      if (b.vehicle_id !== vid) return false;
      let e = toDate(b.end_datetime);
      if (b.status === 'on_rent' && e < now) e = now; // overtime tetap tampil terisi
      return toDate(b.start_datetime) < de && e > ds;
    });
    return hit.find((b) => b.status === 'on_rent') || hit.find((b) => b.status === 'booked') || hit[0] || null;
  }

  async function batalkan(b) {
    if (!confirm(`Batalkan pesanan ${b.booking_code}?`)) return;
    await updateDoc(doc(db, 'bookings', b.id), { status: 'cancelled' });
    setSel(null);
  }

  return (
    <main className="pt-6 space-y-3">
      <div className="px-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Jadwal</h1>
        <div className="flex items-center gap-1">
          <button aria-label="Mundur 7 hari" onClick={() => setFrom(addDays(from, -7))} className="w-10 h-10 grid place-items-center rounded-full bg-white border border-line"><ChevronLeft size={18} /></button>
          <button onClick={() => setFrom(awalHari())} className="h-10 px-3 rounded-full bg-white border border-line text-sm font-semibold">Hari ini</button>
          <button aria-label="Maju 7 hari" onClick={() => setFrom(addDays(from, 7))} className="w-10 h-10 grid place-items-center rounded-full bg-white border border-line"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="px-4 flex gap-4 text-xs font-medium">
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded bg-white border border-line" />Available</span>
        {['booked', 'on_rent'].map((k) => <span key={k} className="flex items-center gap-1.5"><i className={`w-3 h-3 rounded ${WARNA[k]}`} />{LABEL[k]}</span>)}
        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded bg-ink/20" />Selesai</span>
      </div>

      <div className="overflow-x-auto">
        <div className="grid text-xs min-w-max" style={{ gridTemplateColumns: `104px repeat(${DAYS}, 44px)` }}>
          <div className="sticky left-0 z-20 bg-mist h-12" />
          {days.map((d) => (
            <div key={d} className={`h-12 grid place-items-center leading-tight ${d.getTime() === today ? 'bg-petrol text-white rounded-t-lg' : ''}`}>
              <span className="text-[10px] opacity-70">{d.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
              <b className="text-sm">{d.getDate()}</b>
            </div>
          ))}
          {vehicles.map((v) => (
            <Row key={v.id} v={v} days={days} today={today} cell={cell} onPick={setSel} />
          ))}
        </div>
      </div>
      {!vehicles.length && <p className="px-4 text-sm text-ink/60">Belum ada unit. Tambahkan di menu Armada.</p>}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.vehicle_plate || ''}>
        {sel && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-line p-4 text-sm space-y-1.5">
              <p className="font-semibold text-base">{sel.customer_name}</p>
              <p>{sel.booking_code} · <b>{LABEL[sel.status]}</b></p>
              <p>{tglJam(sel.start_datetime)} → {tglJam(sel.end_datetime)}</p>
              <p>Total {rupiah(sel.total_price)} · DP {rupiah(sel.dp_paid)}</p>
            </div>
            {sel.status === 'booked' && <Link href={`/sewa/serah-terima?booking=${sel.id}&type=checkout`} className={`${btnPrimary} w-full`}>Serah terima</Link>}
            {sel.status === 'on_rent' && <>
              <Link href={`/sewa/serah-terima?booking=${sel.id}&type=checkin`} className={`${btnPrimary} w-full`}>Terima unit</Link>
              <Link href={`/sewa/extend?booking=${sel.id}`} className={`${btnGhost} w-full`}>Perpanjang</Link>
            </>}
            <Link href={`/pesanan/detail?id=${sel.id}`} className={`${btnGhost} w-full`}>Detail, pembayaran, dan biaya</Link>
            {sel.customer_phone && <a href={waUrl(sel.customer_phone, invoiceText(sel))} target="_blank" rel="noopener noreferrer" className={`${btnGhost} w-full grid-flow-col gap-2`}><MessageCircle size={18} />Kirim invoice WhatsApp</a>}
            {sel.status === 'booked' && <button onClick={() => batalkan(sel)} className="w-full text-signal font-semibold h-11">Batalkan pesanan</button>}
          </div>
        )}
      </Sheet>
    </main>
  );
}

function Row({ v, days, today, cell, onPick }) {
  return (
    <>
      <div className="sticky left-0 z-10 bg-mist h-12 pl-4 pr-2 flex flex-col justify-center border-t border-line">
        <b className="text-[13px] leading-none">{v.plate_number}</b>
        <span className="text-[10px] text-ink/60 truncate">{v.status === 'maintenance' ? 'Servis' : v.brand_model}</span>
      </div>
      {days.map((d) => {
        const b = cell(v.id, d);
        const base = 'h-12 border-t border-l border-line/60';
        const col = d.getTime() === today ? 'bg-petrol-soft/50' : 'bg-white';
        if (b) return (
          <button key={d} onClick={() => onPick(b)} aria-label={`${v.plate_number} ${LABEL[b.status]} ${toISODate(d)}`} className={`${base} p-1`}>
            <span className={`block h-full rounded ${WARNA[b.status]}`} />
          </button>
        );
        return (
          <Link key={d} href={`/sewa?vehicle=${v.id}&start=${toISODate(d)}`} aria-label={`Pesan ${v.plate_number} ${toISODate(d)}`} className={`${base} ${col} ${v.status === 'maintenance' ? 'bg-signal-soft' : ''}`} />
        );
      })}
    </>
  );
}
