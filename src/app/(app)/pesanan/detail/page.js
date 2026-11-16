'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { doc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { writeSafe } from '@/lib/images';
import { sumExtras, totalTagihan, sisaTagihan } from '@/lib/billing';
import KirimInvoice from '@/components/KirimInvoice';
import { rupiah, tglJam, tglPendek } from '@/lib/format';
import ExtraFeesEditor from '@/components/ExtraFeesEditor';
import { Chips, Field, Section, btnGhost, btnPrimary, inputCls } from '@/components/ui';

const LABEL = { booked: 'Booked', on_rent: 'On-Rent', completed: 'Selesai', cancelled: 'Dibatalkan' };
const METODE = [['Tunai', 'Tunai'], ['Transfer', 'Transfer'], ['QRIS', 'QRIS']];

function Detail() {
  const id = useSearchParams().get('id');
  const [b, setB] = useState(null);
  const [hilang, setHilang] = useState(false);
  const [amt, setAmt] = useState('');
  const [metode, setMetode] = useState('Tunai');
  const [note, setNote] = useState('');
  const [extras, setExtras] = useState(null); // null = belum diubah

  useEffect(() => onSnapshot(doc(db, 'bookings', id),
    (s) => (s.exists() ? setB({ id: s.id, ...s.data() }) : setHilang(true)), () => setHilang(true)), [id]);

  if (hilang) return <main className="px-4 pt-10 text-ink/60">Pesanan tidak ditemukan.</main>;
  if (!b) return <main className="px-4 pt-10 text-ink/60">Memuat…</main>;

  const ref = doc(db, 'bookings', b.id);
  const sisa = sisaTagihan(b);
  const ex = extras ?? b.extra_fees ?? [];
  const batal = b.status === 'cancelled';

  async function catatBayar() {
    const a = Number(amt) || sisa;
    if (a <= 0) return;
    if (a > sisa && !confirm(`Nominal ${rupiah(a)} melebihi sisa tagihan ${rupiah(sisa)}. Tetap catat?`)) return;
    await writeSafe(updateDoc(ref, {
      payments: [...(b.payments || []), { amount: a, method: metode, at: Timestamp.now(), note: note.trim() }],
      dp_paid: (b.dp_paid || 0) + a,
    }));
    setAmt(''); setNote('');
  }
  async function hapusBayar(i) {
    const p = b.payments[i];
    if (!confirm(`Hapus pembayaran ${rupiah(p.amount)}?`)) return;
    await writeSafe(updateDoc(ref, { payments: b.payments.filter((_, j) => j !== i), dp_paid: Math.max(0, (b.dp_paid || 0) - p.amount) }));
  }
  async function simpanExtras() {
    await writeSafe(updateDoc(ref, { extra_fees: ex, extra_total: sumExtras(ex) }));
    setExtras(null);
  }
  async function batalkan() {
    if (!confirm(`Batalkan pesanan ${b.booking_code}?`)) return;
    let hangus = 0;
    if ((b.dp_paid || 0) > 0 && confirm(`DP/pembayaran ${rupiah(b.dp_paid)} sudah diterima.\n\nOK = DP HANGUS (jadi pendapatan)\nBatal = DP dikembalikan ke pelanggan`)) hangus = b.dp_paid;
    await writeSafe(updateDoc(ref, { status: 'cancelled', forfeited_dp: hangus, cancelled_at: Timestamp.now() }));
  }

  return (
    <main className="px-4 pt-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">{b.customer_name}</h1>
        <p className="text-sm text-ink/70 mt-1">{b.booking_code} · <b>{LABEL[b.status]}</b>{!batal && (sisa === 0 ? ' · Lunas' : ' · Belum lunas')}</p>
      </div>

      <Section title="Pesanan">
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between"><dt>Unit</dt><dd>{b.vehicle_model} · {b.vehicle_plate}</dd></div>
          <div className="flex justify-between"><dt>Layanan</dt><dd>{b.service_type === 'dengan_sopir' ? 'Dengan sopir' : 'Lepas kunci'}</dd></div>
          <div className="flex justify-between gap-4"><dt>Jadwal</dt><dd className="text-right">{tglJam(b.start_datetime)}<br />{tglJam(b.end_datetime)}</dd></div>
          {b.deposit_amount > 0 && <div className="flex justify-between"><dt>Deposit</dt><dd>{rupiah(b.deposit_amount)} · {b.deposit_returned ? 'sudah dikembalikan' : 'ditahan'}</dd></div>}
        </dl>
        {b.deposit_amount > 0 && !batal && (
          <button onClick={() => writeSafe(updateDoc(ref, { deposit_returned: !b.deposit_returned }))} className="text-petrol font-semibold text-sm">
            {b.deposit_returned ? 'Batalkan tanda “dikembalikan”' : 'Tandai deposit sudah dikembalikan'}
          </button>
        )}
      </Section>

      {!batal && (
        <>
          <Section title="Tagihan">
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between"><dt>Biaya sewa</dt><dd>{rupiah(b.total_price)}</dd></div>
              {b.overtime_fee > 0 && <div className="flex justify-between"><dt>Denda overtime</dt><dd>{rupiah(b.overtime_fee)}</dd></div>}
              {(b.extra_fees || []).map((x, i) => <div key={i} className="flex justify-between"><dt>{x.label}</dt><dd>{rupiah(x.amount)}</dd></div>)}
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{rupiah(totalTagihan(b))}</dd></div>
              <div className="flex justify-between"><dt>Sudah dibayar</dt><dd>- {rupiah(b.dp_paid)}</dd></div>
              <div className={`flex justify-between text-base font-bold ${sisa ? 'text-signal' : 'text-petrol'}`}><dt>Sisa tagihan</dt><dd>{rupiah(sisa)}</dd></div>
            </dl>
          </Section>

          <Section title="Pembayaran">
            {(b.payments || []).map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-mist rounded-lg px-3 py-2 text-sm">
                <span>{tglPendek(p.at)} · {p.method}{p.note ? ` · ${p.note}` : ''}</span>
                <span className="flex items-center gap-3 font-semibold">{rupiah(p.amount)}
                  <button aria-label="Hapus pembayaran" onClick={() => hapusBayar(i)} className="text-signal"><Trash2 size={16} /></button></span>
              </div>
            ))}
            {!(b.payments || []).length && <p className="text-sm text-ink/60">Belum ada pembayaran tercatat.</p>}
            <Field label="Catat pembayaran baru (Rp)" hint={sisa ? `Kosongkan untuk melunasi sisa ${rupiah(sisa)}.` : undefined}>
              <input className={inputCls} inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={sisa ? String(sisa) : '0'} />
            </Field>
            <Chips options={METODE} value={metode} onChange={setMetode} />
            <input className={inputCls} placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button onClick={catatBayar} disabled={sisa === 0 && !Number(amt)} className={`${btnPrimary} w-full`}>Catat pembayaran</button>
          </Section>

          <Section title="Biaya tambahan">
            <ExtraFeesEditor items={ex} onChange={setExtras} />
            {extras && <button onClick={simpanExtras} className={`${btnPrimary} w-full`}>Simpan biaya tambahan</button>}
          </Section>
        </>
      )}

      <div className="space-y-2">
        <KirimInvoice booking={b} jenis={b.status === 'completed' ? 'pelunasan' : 'booking'} className={btnGhost} />
        {b.status === 'booked' && <>
          <Link href={`/sewa/serah-terima?booking=${b.id}&type=checkout`} className={`${btnPrimary} w-full`}>Serah terima</Link>
          <Link href={`/pesanan/ubah?id=${b.id}`} className={`${btnGhost} w-full`}>Ubah pesanan</Link>
          <button onClick={batalkan} className="w-full text-signal font-semibold h-11">Batalkan pesanan</button>
        </>}
        {b.status === 'on_rent' && <>
          <Link href={`/sewa/serah-terima?booking=${b.id}&type=checkin`} className={`${btnPrimary} w-full`}>Terima unit</Link>
          <Link href={`/sewa/extend?booking=${b.id}`} className={`${btnGhost} w-full`}>Perpanjang</Link>
        </>}
      </div>
    </main>
  );
}
export default function Page() { return <Suspense><Detail /></Suspense>; }
