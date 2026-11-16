'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { collection, doc, getDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { writeSafe } from '@/lib/images';
import { hitungOvertime } from '@/lib/pricing';
import { sumExtras, totalTagihan, sisaTagihan } from '@/lib/billing';
import KirimInvoice from '@/components/KirimInvoice';
import { rupiah, toDate, tglJam } from '@/lib/format';
import ExtraFeesEditor from '@/components/ExtraFeesEditor';
import { Alert, Chips, Field, Section, btnGhost, btnPrimary, inputCls } from '@/components/ui';

const CHECKLIST = [['stnk', 'STNK'], ['dongkrak', 'Dongkrak'], ['ban_serep', 'Ban serep'], ['segitiga', 'Segitiga pengaman'], ['kunci_cadangan', 'Kunci cadangan']];
const BENSIN = [['kosong', 'Kosong'], ['1/4', '1/4'], ['1/2', '1/2'], ['3/4', '3/4'], ['penuh', 'Penuh']];
const METODE = [['Tunai', 'Tunai'], ['Transfer', 'Transfer'], ['QRIS', 'QRIS']];

function Form() {
  const sp = useSearchParams();
  const bookingId = sp.get('booking');
  const type = sp.get('type') === 'checkin' ? 'checkin' : 'checkout';

  const [b, setB] = useState(null);
  const [v, setV] = useState(null);
  const [odo, setOdo] = useState('');
  const [fuel, setFuel] = useState('penuh');
  const [checks, setChecks] = useState(Object.fromEntries(CHECKLIST.map(([k]) => [k, true])));
  const [notes, setNotes] = useState('');
  const [denda, setDenda] = useState(0);
  const [extras, setExtras] = useState([]);
  const [bayar, setBayar] = useState(null); // null = otomatis sebesar sisa tagihan
  const [metode, setMetode] = useState('Tunai');
  const [depositBack, setDepositBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      const bs = await getDoc(doc(db, 'bookings', bookingId));
      if (!bs.exists()) return setError('Pesanan tidak ditemukan.');
      const bk = { id: bs.id, ...bs.data() };
      const vs = await getDoc(doc(db, 'vehicles', bk.vehicle_id));
      const veh = vs.exists() ? { id: vs.id, ...vs.data() } : null;
      setB(bk); setV(veh);
      setOdo(String(veh?.current_odometer ?? ''));
      setExtras(bk.extra_fees || []);
      if (type === 'checkin') setDenda(hitungOvertime({ end: toDate(bk.end_datetime), rate: veh?.daily_rate || 0 }).denda);
    })().catch(() => setError('Gagal memuat data. Periksa koneksi.'));
  }, [bookingId, type]);

  const lembur = useMemo(() => (b && v && type === 'checkin' ? hitungOvertime({ end: toDate(b.end_datetime), rate: v.daily_rate }) : null), [b, v, type]);
  const calc = b ? { ...b, overtime_fee: Number(denda) || 0, extra_total: sumExtras(extras) } : null;
  const sisa = calc ? sisaTagihan(calc) : 0;
  const bayarNum = bayar === null ? sisa : Math.max(0, Number(bayar) || 0);

  async function simpan() {
    setError('');
    const odoNum = Number(odo);
    if (!odoNum || odoNum < (v?.current_odometer || 0)) return setError(`Odometer tidak boleh lebih kecil dari ${v?.current_odometer ?? 0} km.`);

    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, 'handovers')), {
        booking_id: b.id, type, odometer_reading: odoNum, fuel_level: fuel, checklist: checks, notes, recorded_at: Timestamp.now(),
      });
      const upd = type === 'checkout'
        ? { status: 'on_rent', picked_up_at: Timestamp.now() }
        : {
            status: 'completed', returned_at: Timestamp.now(),
            overtime_fee: Number(denda) || 0, extra_fees: extras, extra_total: sumExtras(extras),
            dp_paid: (b.dp_paid || 0) + bayarNum,
            payments: [...(b.payments || []), ...(bayarNum > 0 ? [{ amount: bayarNum, method: metode, at: Timestamp.now(), note: 'Pelunasan' }] : [])],
            deposit_returned: depositBack,
          };
      batch.update(doc(db, 'bookings', b.id), upd);
      batch.update(doc(db, 'vehicles', b.vehicle_id), { status: type === 'checkout' ? 'on_rent' : 'available', current_odometer: odoNum });
      await writeSafe(batch.commit());
      setDone({ ...b, ...upd });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <main className="px-4 pt-10 space-y-5 text-center">
        <CheckCircle2 size={56} className="text-petrol mx-auto" />
        <h1 className="font-display text-2xl font-bold">{type === 'checkout' ? 'Unit diserahkan' : 'Unit diterima kembali'}</h1>
        {type === 'checkin' && (
          <>
            <p className="text-ink/70">{sisaTagihan(done) === 0 ? 'Pesanan lunas.' : `Sisa tagihan ${rupiah(sisaTagihan(done))}.`}</p>
            <KirimInvoice booking={done} jenis="pelunasan" className={btnPrimary} label="Kirim kwitansi PDF via WhatsApp" />
          </>
        )}
        <Link href="/" className={btnGhost}>Kembali ke Beranda</Link>
      </main>
    );
  }
  if (!b) return <main className="px-4 pt-10 text-ink/60">{error || 'Memuat…'}</main>;

  return (
    <main className="px-4 pt-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">{type === 'checkout' ? 'Serah terima unit' : 'Terima unit kembali'}</h1>
        <p className="text-ink/70 text-sm mt-1">{b.vehicle_plate} · {b.customer_name} · {b.booking_code}</p>
      </div>

      <Section title="Kondisi unit">
        <Field label="Odometer (km)"><input className={inputCls} inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value)} /></Field>
        <Field label="Level bensin"><Chips options={BENSIN} value={fuel} onChange={setFuel} /></Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium mb-1">Kelengkapan</legend>
          {CHECKLIST.map(([k, l]) => (
            <label key={k} className="flex items-center gap-3 h-11">
              <input type="checkbox" className="w-6 h-6 accent-[#0E5A52]" checked={checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} />{l}
            </label>
          ))}
        </fieldset>
        <Field label="Catatan kondisi (baret, penyok, dll)"><textarea className={`${inputCls} h-24 py-3`} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </Section>

      {type === 'checkin' && (
        <>
          <Section title="Denda dan biaya tambahan">
            {lembur?.jam > 0 && <Alert tone="warn">Terlambat {lembur.jam} jam dari jadwal {tglJam(b.end_datetime)}.</Alert>}
            <Field label="Denda overtime (bisa diubah)"><input className={inputCls} inputMode="numeric" value={denda} onChange={(e) => setDenda(e.target.value)} /></Field>
            <ExtraFeesEditor items={extras} onChange={setExtras} />
          </Section>

          <Section title="Penagihan">
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between"><dt>Biaya sewa</dt><dd>{rupiah(b.total_price)}</dd></div>
              <div className="flex justify-between"><dt>Denda overtime</dt><dd>{rupiah(Number(denda) || 0)}</dd></div>
              <div className="flex justify-between"><dt>Biaya tambahan</dt><dd>{rupiah(sumExtras(extras))}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total tagihan</dt><dd>{rupiah(totalTagihan(calc))}</dd></div>
              <div className="flex justify-between"><dt>Sudah dibayar</dt><dd>- {rupiah(b.dp_paid)}</dd></div>
              <div className="flex justify-between font-bold text-petrol text-base"><dt>Sisa tagihan</dt><dd>{rupiah(sisa)}</dd></div>
            </dl>
            <Field label="Pembayaran diterima sekarang (Rp)" hint="Otomatis sebesar sisa tagihan. Ubah jika pelanggan membayar sebagian; sisanya tercatat sebagai belum lunas.">
              <input className={inputCls} inputMode="numeric" value={bayar === null ? sisa : bayar} onChange={(e) => setBayar(e.target.value)} />
            </Field>
            <Chips options={METODE} value={metode} onChange={setMetode} />
            {b.deposit_amount > 0 && (
              <label className="flex items-center gap-3 h-11">
                <input type="checkbox" className="w-6 h-6 accent-[#0E5A52]" checked={depositBack} onChange={(e) => setDepositBack(e.target.checked)} />
                Deposit {rupiah(b.deposit_amount)} sudah dikembalikan
              </label>
            )}
          </Section>
        </>
      )}

      {error && <Alert>{error}</Alert>}
      <button onClick={simpan} disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Menyimpan…' : 'Simpan berita acara'}</button>
    </main>
  );
}

export default function Page() { return <Suspense><Form /></Suspense>; }
