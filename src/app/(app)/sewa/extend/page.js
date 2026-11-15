'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc, increment, Timestamp, updateDoc } from 'firebase/firestore';
import { MessageCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { cekBentrok } from '@/lib/booking';
import { hargaPerpanjang } from '@/lib/pricing';
import { invoiceText, waUrl } from '@/lib/whatsapp';
import { rupiah, toDate, tglJam } from '@/lib/format';
import { writeSafe } from '@/lib/images';
import { Alert, Chips, Field, Section, btnGhost, btnPrimary, inputCls } from '@/components/ui';

function Form() {
  const bookingId = useSearchParams().get('booking');
  const [b, setB] = useState(null);
  const [rate, setRate] = useState(0);
  const [hours, setHours] = useState(24);
  const [conflict, setConflict] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      const bs = await getDoc(doc(db, 'bookings', bookingId));
      const bk = { id: bs.id, ...bs.data() };
      const vs = await getDoc(doc(db, 'vehicles', bk.vehicle_id));
      setB(bk); setRate(vs.data()?.daily_rate || 0);
    })().catch(() => setError('Gagal memuat pesanan.'));
  }, [bookingId]);

  const h = Number(hours) || 0;
  const oldEnd = b && toDate(b.end_datetime);
  // Jika sudah lewat jadwal, perpanjangan dihitung dari jadwal lama (selisih overtime ditagih saat unit kembali)
  const newEnd = b && new Date(oldEnd.getTime() + h * 36e5);
  const extra = hargaPerpanjang(rate, h);

  useEffect(() => {
    if (!b || h <= 0) return setConflict(null);
    cekBentrok({ vehicleId: b.vehicle_id, start: oldEnd, end: newEnd, excludeId: b.id }).then(setConflict).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, h]);

  async function simpan() {
    setBusy(true); setError('');
    try {
      const bentrok = await cekBentrok({ vehicleId: b.vehicle_id, start: oldEnd, end: newEnd, excludeId: b.id });
      if (bentrok) throw new Error('Perpanjangan bentrok dengan pesanan berikutnya.');
      const upd = { end_datetime: Timestamp.fromDate(newEnd), total_price: (b.total_price || 0) + extra, extended_count: increment(1) };
      await writeSafe(updateDoc(doc(db, 'bookings', b.id), upd));
      setDone({ ...b, end_datetime: upd.end_datetime, total_price: upd.total_price });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (!b) return <main className="px-4 pt-10 text-ink/60">{error || 'Memuat…'}</main>;
  if (done) {
    return (
      <main className="px-4 pt-10 space-y-4 text-center">
        <h1 className="font-display text-2xl font-bold">Sewa diperpanjang</h1>
        <p className="text-ink/70">Selesai baru: {tglJam(done.end_datetime)}</p>
        <a href={waUrl(b.customer_phone, invoiceText(done, 'perpanjang'))} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} grid-flow-col gap-2`}><MessageCircle size={20} /> Kirim via WhatsApp</a>
        <Link href="/" className={btnGhost}>Kembali ke Beranda</Link>
      </main>
    );
  }
  return (
    <main className="px-4 pt-6 space-y-4">
      <h1 className="font-display text-2xl font-bold">Perpanjang sewa</h1>
      <p className="text-sm text-ink/70">{b.vehicle_plate} · {b.customer_name} · selesai {tglJam(b.end_datetime)}</p>
      <Section title="Tambah durasi">
        <Chips value={h} onChange={setHours} options={[[12, '+12 jam'], [24, '+1 hari'], [48, '+2 hari'], [72, '+3 hari']]} />
        <Field label="Atau jumlah jam"><input className={inputCls} type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
        <dl className="text-sm space-y-1.5 border-t border-line pt-3">
          <div className="flex justify-between"><dt>Selesai baru</dt><dd className="font-semibold">{tglJam(newEnd)}</dd></div>
          <div className="flex justify-between"><dt>Biaya tambahan</dt><dd className="font-semibold">{rupiah(extra)}</dd></div>
        </dl>
        {conflict && <Alert>Bentrok dengan pesanan {conflict.customer_name} ({tglJam(conflict.start_datetime)}).</Alert>}
      </Section>
      {error && <Alert>{error}</Alert>}
      <button onClick={simpan} disabled={busy || h <= 0 || !!conflict} className={`${btnPrimary} w-full`}>{busy ? 'Menyimpan…' : 'Perpanjang'}</button>
    </main>
  );
}
export default function Page() { return <Suspense><Form /></Suspense>; }
