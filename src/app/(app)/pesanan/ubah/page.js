'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useFleet } from '@/lib/useFleet';
import { cekBentrok } from '@/lib/booking';
import { DURASI, hitungTarif } from '@/lib/pricing';
import { writeSafe } from '@/lib/images';
import { rupiah, toDate, toLocalInput, tglJam } from '@/lib/format';
import { Alert, Chips, Field, Section, btnPrimary, inputCls } from '@/components/ui';

function Form() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const { vehicles } = useFleet();
  const [b, setB] = useState(null);
  const [f, setF] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'bookings', id)).then((s) => {
      if (!s.exists()) return setError('Pesanan tidak ditemukan.');
      const x = { id: s.id, ...s.data() };
      setB(x);
      setF({
        vehicleId: x.vehicle_id, layanan: x.service_type || 'lepas_kunci', driverFee: x.driver_fee || 250000,
        durasi: x.duration_type || '24h', qty: x.duration_qty || 1, start: toLocalInput(toDate(x.start_datetime)), deposit: x.deposit_amount || 0,
      });
    }).catch(() => setError('Gagal memuat pesanan.'));
  }, [id]);

  const vehicle = vehicles.find((v) => v.id === f?.vehicleId);
  const calc = useMemo(() => (f ? hitungTarif({ rate: vehicle?.daily_rate || 0, durasi: f.durasi, qty: Number(f.qty), layanan: f.layanan, driverFee: Number(f.driverFee) || 0 }) : null), [f, vehicle]);
  const startDate = f ? new Date(f.start) : null;
  const endDate = calc && startDate ? new Date(startDate.getTime() + calc.hours * 36e5) : null;
  const ok = startDate && !isNaN(startDate);

  useEffect(() => {
    if (!f || !ok || !f.vehicleId) return;
    cekBentrok({ vehicleId: f.vehicleId, start: startDate, end: endDate, excludeId: id }).then(setConflict).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.vehicleId, f?.start, calc?.hours]);

  if (!b || !f) return <main className="px-4 pt-10 text-ink/60">{error || 'Memuat…'}</main>;
  if (b.status !== 'booked') return <main className="px-4 pt-10 text-ink/70">Hanya pesanan berstatus Booked yang bisa diubah. Gunakan Perpanjang untuk unit yang sedang disewa.</main>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function simpan() {
    setError('');
    if (!vehicle || !ok) return setError('Unit atau tanggal tidak valid.');
    if (vehicle.status === 'maintenance') return setError('Unit sedang servis.');
    setBusy(true);
    try {
      const bentrok = await cekBentrok({ vehicleId: vehicle.id, start: startDate, end: endDate, excludeId: b.id });
      if (bentrok) throw new Error('Jadwal bentrok dengan pesanan lain.');
      await writeSafe(updateDoc(doc(db, 'bookings', b.id), {
        vehicle_id: vehicle.id, vehicle_plate: vehicle.plate_number, vehicle_model: vehicle.brand_model,
        service_type: f.layanan, duration_type: f.durasi, duration_qty: Number(f.qty) || 1,
        driver_fee: f.layanan === 'dengan_sopir' ? Number(f.driverFee) || 0 : 0,
        start_datetime: Timestamp.fromDate(startDate), end_datetime: Timestamp.fromDate(endDate),
        total_price: calc.total, deposit_amount: Number(f.deposit) || 0,
      }));
      router.replace(`/pesanan/detail?id=${b.id}`);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <main className="px-4 pt-6 space-y-4">
      <h1 className="font-display text-2xl font-bold">Ubah pesanan</h1>
      <p className="text-sm text-ink/70">{b.customer_name} · {b.booking_code}</p>
      <Section title="Unit dan jadwal">
        <Field label="Unit">
          <select className={inputCls} value={f.vehicleId} onChange={set('vehicleId')}>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand_model} · {v.plate_number} · {rupiah(v.daily_rate)}/hari</option>)}
          </select>
        </Field>
        <Chips value={f.layanan} onChange={(v) => setF({ ...f, layanan: v })} options={[['lepas_kunci', 'Lepas kunci'], ['dengan_sopir', 'Dengan sopir']]} />
        {f.layanan === 'dengan_sopir' && <Field label="Biaya sopir per hari"><input className={inputCls} inputMode="numeric" value={f.driverFee} onChange={set('driverFee')} /></Field>}
        <Chips value={f.durasi} onChange={(v) => setF({ ...f, durasi: v })} options={Object.entries(DURASI).map(([k, d]) => [k, d.label])} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jumlah"><input className={inputCls} type="number" min={1} value={f.qty} onChange={set('qty')} /></Field>
          <Field label="Mulai"><input className={inputCls} type="datetime-local" value={f.start} onChange={set('start')} /></Field>
        </div>
        <Field label="Deposit"><input className={inputCls} inputMode="numeric" value={f.deposit} onChange={set('deposit')} /></Field>
        {ok && <p className="text-sm">Selesai: <b>{tglJam(endDate)}</b> · Total baru <b>{rupiah(calc.total)}</b> (sudah dibayar {rupiah(b.dp_paid)})</p>}
        {conflict && <Alert>Bentrok dengan {conflict.customer_name} ({tglJam(conflict.start_datetime)} – {tglJam(conflict.end_datetime)}).</Alert>}
      </Section>
      {error && <Alert>{error}</Alert>}
      <button onClick={simpan} disabled={busy || !!conflict} className={`${btnPrimary} w-full`}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
      <Link href={`/pesanan/detail?id=${b.id}`} className="block text-center text-ink/60 py-2">Batal</Link>
    </main>
  );
}
export default function Page() { return <Suspense><Form /></Suspense>; }
