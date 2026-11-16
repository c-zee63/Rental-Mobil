'use client';
import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, Paperclip, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useFleet } from '@/lib/useFleet';
import { toDataUrl, writeSafe } from '@/lib/images';
import { rupiah, tglJam, tglPendek, toISODate, toDate } from '@/lib/format';
import { sisaTagihan, totalTagihan } from '@/lib/billing';
import PhotoField from '@/components/PhotoField';
import BackupPanel from '@/components/BackupPanel';
import { Alert, Chips, Field, Sheet, btnGhost, btnPrimary, inputCls } from '@/components/ui';

const KATEGORI = [['servis', 'Servis'], ['oli', 'Ganti oli'], ['cuci', 'Cuci'], ['pajak', 'Pajak'], ['lainnya', 'Lainnya']];
const bulanIni = () => toISODate(new Date()).slice(0, 7);
const STATUS = { booked: ['Booked', 'bg-petrol-soft text-petrol-dark'], on_rent: ['On-Rent', 'bg-amber-soft text-ink'], completed: ['Selesai', 'bg-mist text-ink/70'], cancelled: ['Batal', 'bg-signal-soft text-signal'] };
const namaKategori = (k) => KATEGORI.find(([x]) => x === k)?.[1] || k;

export default function LaporanPage() {
  const { vehicles } = useFleet();
  const [bulan, setBulan] = useState(bulanIni());
  const [semua, setSemua] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null); // { tipe: 'unit', vid } | { tipe: 'biaya', id, dari? }
  const [cadangOpen, setCadangOpen] = useState(false);

  useEffect(() => {
    const [y, m] = bulan.split('-').map(Number);
    const a = Timestamp.fromDate(new Date(y, m - 1, 1)), z = Timestamp.fromDate(new Date(y, m, 1));
    const qb = semua ? collection(db, 'bookings') : query(collection(db, 'bookings'), where('start_datetime', '>=', a), where('start_datetime', '<', z));
    const qe = semua ? collection(db, 'expenses') : query(collection(db, 'expenses'), where('expense_date', '>=', a), where('expense_date', '<', z));
    const u1 = onSnapshot(qb, (s) => setBookings(s.docs.map((d) => ({ id: d.id, ...d.data() }))), console.error);
    const u2 = onSnapshot(qe, (s) => setExpenses(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y2) => toDate(y2.expense_date) - toDate(x.expense_date))), console.error);
    return () => { u1(); u2(); };
  }, [bulan, semua]);

  const rows = useMemo(() => {
    const map = new Map(vehicles.map((v) => [v.id, { v, pendapatan: 0, biaya: 0, n: 0 }]));
    bookings.forEach((b) => {
      const r = map.get(b.vehicle_id); if (!r) return;
      if (b.status === 'cancelled') { r.pendapatan += b.forfeited_dp || 0; return; } // DP hangus tetap jadi pendapatan
      r.pendapatan += totalTagihan(b); r.n += 1;
    });
    expenses.forEach((e) => { const r = map.get(e.vehicle_id); if (r) r.biaya += e.amount || 0; });
    return [...map.values()].sort((a, b) => b.pendapatan - b.biaya - (a.pendapatan - a.biaya));
  }, [vehicles, bookings, expenses]);

  const tot = rows.reduce((t, r) => ({ p: t.p + r.pendapatan, b: t.b + r.biaya }), { p: 0, b: 0 });
  const piutang = bookings.filter((b) => b.status !== 'cancelled').reduce((t, b) => t + sisaTagihan(b), 0);
  async function hapusBiaya(e) {
    if (!confirm('Hapus catatan biaya ini?')) return false;
    await writeSafe(deleteDoc(doc(db, 'expenses', e.id)));
    if (e.receipt_id) await writeSafe(deleteDoc(doc(db, 'images', e.receipt_id)));
    return true;
  }
  const plat = (id) => vehicles.find((v) => v.id === id)?.plate_number || '(unit dihapus)';
  const detailUnit = detail?.tipe === 'unit' ? vehicles.find((v) => v.id === detail.vid) : null;
  const detailBiaya = detail?.tipe === 'biaya' ? expenses.find((x) => x.id === detail.id) : null;

  return (
    <main className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Laporan</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCadangOpen(true)} aria-label="Cadangkan data" className="w-10 h-10 grid place-items-center rounded-full bg-white border border-line"><Download size={18} /></button>
          <button onClick={() => setOpen(true)} className="h-10 px-4 rounded-full bg-petrol text-white text-sm font-semibold flex items-center gap-1.5"><Plus size={16} /> Biaya</button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input type="month" disabled={semua} value={bulan} onChange={(e) => setBulan(e.target.value)} className={`${inputCls} !w-auto`} />
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="w-5 h-5 accent-[#0E5A52]" checked={semua} onChange={(e) => setSemua(e.target.checked)} />Semua periode</label>
      </div>

      <section className="bg-petrol text-white rounded-2xl p-4">
        <p className="text-sm opacity-80">Profit bersih</p>
        <p className="font-display text-3xl font-bold mt-1">{rupiah(tot.p - tot.b)}</p>
        <p className="text-sm opacity-80 mt-2">Pendapatan {rupiah(tot.p)} − Biaya {rupiah(tot.b)}</p>
        <p className="text-sm opacity-80">Belum tertagih (piutang): {rupiah(piutang)}</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display font-bold text-lg">Per unit</h2>
        {rows.map(({ v, pendapatan, biaya, n }) => {
          const profit = pendapatan - biaya;
          return (
            <button key={v.id} type="button" onClick={() => setDetail({ tipe: 'unit', vid: v.id })} className="w-full text-left bg-white border border-line rounded-xl p-3 active:bg-mist">
              <div className="flex justify-between gap-2"><p className="font-semibold">{v.plate_number} <span className="font-normal text-ink/60">{v.brand_model}</span></p>
                <p className={`font-bold ${profit < 0 ? 'text-signal' : 'text-petrol'}`}>{rupiah(profit)}</p></div>
              <p className="text-xs text-ink/60 mt-1 flex items-center justify-between gap-2"><span>{n} sewa · pendapatan {rupiah(pendapatan)} · biaya {rupiah(biaya)}</span><ChevronRight size={16} className="shrink-0" /></p>
            </button>
          );
        })}
        {!rows.length && <p className="text-sm text-ink/60">Belum ada unit.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-display font-bold text-lg">Catatan biaya</h2>
        {expenses.map((e) => (
          <div key={e.id} className="bg-white border border-line rounded-xl flex items-stretch text-sm">
            <button type="button" onClick={() => setDetail({ tipe: 'biaya', id: e.id })} className="flex-1 min-w-0 text-left p-3 flex justify-between gap-2 active:bg-mist rounded-l-xl">
              <div className="min-w-0">
                <p className="font-semibold">{plat(e.vehicle_id)} · {namaKategori(e.category)}</p>
                <p className="text-ink/60 truncate">{tglPendek(e.expense_date)}{e.description ? ` · ${e.description}` : ''}</p>
                {e.receipt_id && <p className="text-petrol font-medium flex items-center gap-1"><Paperclip size={13} />Ada foto nota</p>}
              </div>
              <p className="font-semibold shrink-0">{rupiah(e.amount)}</p>
            </button>
            <button aria-label="Hapus biaya" onClick={() => hapusBiaya(e)} className="px-3 text-signal border-l border-line grid place-items-center"><Trash2 size={16} /></button>
          </div>
        ))}
        {!expenses.length && <p className="text-sm text-ink/60">Belum ada biaya pada periode ini.</p>}
      </section>

      <Sheet open={!!detailUnit || !!detailBiaya} onClose={() => setDetail(null)} title={detailBiaya ? 'Detail biaya' : detailUnit ? `${detailUnit.plate_number} · ${detailUnit.brand_model}` : ''}>
        {detailBiaya && (
          <DetailBiaya e={detailBiaya} unit={vehicles.find((v) => v.id === detailBiaya.vehicle_id)}
            onBack={detail?.dari ? () => setDetail({ tipe: 'unit', vid: detail.dari }) : null}
            onHapus={async () => { if (await hapusBiaya(detailBiaya)) setDetail(null); }} />
        )}
        {!detailBiaya && detailUnit && (
          <RiwayatUnit v={detailUnit} ringkas={rows.find((r) => r.v.id === detailUnit.id)} periode={semua ? 'Semua periode' : periodeLabel(bulan)}
            bookings={bookings.filter((b) => b.vehicle_id === detailUnit.id).sort((x, y) => toDate(y.start_datetime) - toDate(x.start_datetime))}
            expenses={expenses.filter((x) => x.vehicle_id === detailUnit.id)}
            onBiaya={(id) => setDetail({ tipe: 'biaya', id, dari: detailUnit.id })} />
        )}
      </Sheet>
      <Sheet open={cadangOpen} onClose={() => setCadangOpen(false)} title="Cadangkan data"><BackupPanel /></Sheet>
      <ExpenseSheet open={open} onClose={() => setOpen(false)} vehicles={vehicles} />
    </main>
  );
}

const periodeLabel = (bulan) => { const [y, m] = bulan.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); };
const Baris = ({ k, v, tebal, cls = '' }) => <div className={`flex justify-between gap-4 ${tebal ? 'font-semibold' : ''} ${cls}`}><dt>{k}</dt><dd className="text-right">{v}</dd></div>;

// Pop-up riwayat lengkap satu unit: ringkasan, semua sewa (tagihan, pembayaran), dan semua biaya pada periode terpilih
function RiwayatUnit({ v, ringkas, periode, bookings, expenses, onBiaya }) {
  const { pendapatan = 0, biaya = 0, n = 0 } = ringkas || {};
  const profit = pendapatan - biaya;
  return (
    <div className="space-y-4">
      <section className="bg-petrol text-white rounded-2xl p-4">
        <p className="text-sm opacity-80">Profit · {periode}</p>
        <p className="font-display text-2xl font-bold mt-0.5">{rupiah(profit)}</p>
        <p className="text-sm opacity-80 mt-1">{n} sewa · Pendapatan {rupiah(pendapatan)} − Biaya {rupiah(biaya)}</p>
      </section>

      <section className="space-y-2">
        <h3 className="font-display font-bold">Riwayat sewa ({bookings.length})</h3>
        {bookings.map((b) => {
          const [lbl, cls] = STATUS[b.status] || ['-', ''];
          const batal = b.status === 'cancelled', sisa = sisaTagihan(b);
          return (
            <div key={b.id} className="bg-white border border-line rounded-xl p-3 text-sm space-y-2">
              <div className="flex justify-between gap-2">
                <div className="min-w-0"><p className="font-semibold truncate">{b.customer_name}</p><p className="text-xs text-ink/60">{b.booking_code} · {b.service_type === 'dengan_sopir' ? 'Dengan sopir' : 'Lepas kunci'}</p></div>
                <span className={`text-xs font-semibold rounded-full px-2.5 py-1 h-fit shrink-0 ${cls}`}>{lbl}</span>
              </div>
              <p className="text-xs text-ink/70">{tglJam(b.start_datetime)} → {tglJam(b.end_datetime)}</p>
              <dl className="space-y-1 border-t border-line pt-2">
                <Baris k="Biaya sewa" v={rupiah(b.total_price)} />
                {b.overtime_fee > 0 && <Baris k="Denda overtime" v={rupiah(b.overtime_fee)} />}
                {(b.extra_fees || []).map((x, i) => <Baris key={i} k={x.label || 'Biaya tambahan'} v={rupiah(x.amount)} />)}
                <Baris k="Total tagihan" v={rupiah(totalTagihan(b))} tebal />
                <Baris k="Sudah dibayar" v={rupiah(b.dp_paid)} />
                {!batal && <Baris k={sisa > 0 ? 'Sisa tagihan' : 'Status'} v={sisa > 0 ? rupiah(sisa) : 'Lunas'} tebal cls={sisa > 0 ? 'text-signal' : 'text-petrol'} />}
                {batal && b.forfeited_dp > 0 && <Baris k="DP hangus (pendapatan)" v={rupiah(b.forfeited_dp)} tebal />}
                {b.deposit_amount > 0 && <Baris k="Deposit" v={`${rupiah(b.deposit_amount)} · ${b.deposit_returned ? 'dikembalikan' : 'ditahan'}`} />}
              </dl>
              {(b.payments || []).length > 0 && (
                <div className="border-t border-line pt-2 space-y-1">
                  <p className="text-xs font-semibold text-ink/60">Pembayaran</p>
                  {b.payments.map((p, i) => (
                    <div key={i} className="flex justify-between gap-3 text-xs"><span className="text-ink/70">{tglPendek(p.at)} · {p.method}{p.note ? ` · ${p.note}` : ''}</span><b>{rupiah(p.amount)}</b></div>
                  ))}
                </div>
              )}
              <Link href={`/pesanan/detail?id=${b.id}`} className="text-petrol font-semibold inline-flex items-center gap-0.5">Buka detail pesanan <ChevronRight size={14} /></Link>
            </div>
          );
        })}
        {!bookings.length && <p className="text-sm text-ink/60">Belum ada sewa pada periode ini.</p>}
      </section>

      <section className="space-y-2">
        <h3 className="font-display font-bold">Biaya unit ({expenses.length})</h3>
        {expenses.map((e) => (
          <button key={e.id} type="button" onClick={() => onBiaya(e.id)} className="w-full text-left bg-white border border-line rounded-xl p-3 text-sm flex justify-between gap-3 active:bg-mist">
            <div className="min-w-0">
              <p className="font-semibold">{namaKategori(e.category)}</p>
              <p className="text-ink/60 truncate">{tglPendek(e.expense_date)}{e.description ? ` · ${e.description}` : ''}</p>
              {e.receipt_id && <p className="text-petrol font-medium flex items-center gap-1"><Paperclip size={13} />Ada foto nota</p>}
            </div>
            <p className="font-semibold shrink-0">{rupiah(e.amount)}</p>
          </button>
        ))}
        {!expenses.length && <p className="text-sm text-ink/60">Belum ada biaya pada periode ini.</p>}
      </section>
    </div>
  );
}

// Pop-up detail satu catatan biaya, termasuk foto nota
function DetailBiaya({ e, unit, onBack, onHapus }) {
  const [nota, setNota] = useState({ loading: !!e.receipt_id, src: '' });
  useEffect(() => {
    if (!e.receipt_id) return;
    let alive = true;
    getDoc(doc(db, 'images', e.receipt_id)).then((s) => alive && setNota({ loading: false, src: s.data()?.data || '' })).catch(() => alive && setNota({ loading: false, src: '' }));
    return () => { alive = false; };
  }, [e.receipt_id]);
  return (
    <div className="space-y-3">
      {onBack && <button type="button" onClick={onBack} className="text-petrol font-semibold text-sm inline-flex items-center gap-0.5"><ChevronLeft size={16} />Kembali ke riwayat unit</button>}
      <section className="bg-white border border-line rounded-2xl p-4 text-sm space-y-2">
        <p className="font-display text-2xl font-bold">{rupiah(e.amount)}</p>
        <dl className="space-y-1.5 border-t border-line pt-2">
          <Baris k="Unit" v={unit ? `${unit.plate_number} · ${unit.brand_model}` : '(unit dihapus)'} />
          <Baris k="Kategori" v={namaKategori(e.category)} />
          <Baris k="Tanggal" v={tglPendek(e.expense_date)} />
          <Baris k="Keterangan" v={e.description || '-'} />
        </dl>
      </section>
      {e.receipt_id && (
        <section className="space-y-2">
          <h3 className="font-display font-bold">Foto nota</h3>
          {nota.loading ? <p className="text-ink/60 text-sm">Memuat…</p> : nota.src
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={nota.src} alt="Nota" className="w-full rounded-xl border border-line" /> : <p className="text-ink/60 text-sm">Foto tidak ditemukan.</p>}
        </section>
      )}
      <button type="button" onClick={onHapus} className={`${btnGhost} w-full text-signal flex items-center justify-center gap-2`}><Trash2 size={16} />Hapus catatan biaya</button>
    </div>
  );
}

function ExpenseSheet({ open, onClose, vehicles }) {
  const awal = { vehicleId: '', kategori: 'servis', amount: '', desc: '', tgl: toISODate(new Date()), odo: '', interval: 5000, nextTax: '' };
  const [f, setF] = useState(awal);
  const [nota, setNota] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function simpan() {
    if (!f.vehicleId) return setErr('Pilih unit.');
    if (!Number(f.amount)) return setErr('Isi nominal biaya.');
    setBusy(true); setErr('');
    try {
      let receipt_id = '';
      if (nota) {
        let data;
        try { data = await toDataUrl(nota); } catch { throw new Error('Foto nota gagal diproses. Coba ambil ulang.'); }
        const iref = doc(collection(db, 'images'));
        await writeSafe(setDoc(iref, { kind: 'receipt', vehicle_id: f.vehicleId, data, created_at: Timestamp.now() }));
        receipt_id = iref.id;
      }
      await writeSafe(setDoc(doc(collection(db, 'expenses')), {
        vehicle_id: f.vehicleId, category: f.kategori, amount: Number(f.amount), description: f.desc.trim(),
        receipt_id, expense_date: Timestamp.fromDate(new Date(`${f.tgl}T12:00`)),
      }));
      // Efek samping: reset pengingat oli / pajak otomatis
      const upd = {};
      if (f.kategori === 'oli' && Number(f.odo)) { upd.current_odometer = Number(f.odo); upd.next_service_odometer = Number(f.odo) + Number(f.interval || 5000); }
      if (f.kategori === 'pajak' && f.nextTax) upd.tax_due_date = Timestamp.fromDate(new Date(`${f.nextTax}T00:00`));
      if (Object.keys(upd).length) await writeSafe(updateDoc(doc(db, 'vehicles', f.vehicleId), upd));
      setF(awal); setNota(null); onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Catat biaya">
      <div className="space-y-3">
        <Field label="Unit">
          <select className={inputCls} value={f.vehicleId} onChange={set('vehicleId')}>
            <option value="">Pilih mobil…</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number} · {v.brand_model}</option>)}
          </select>
        </Field>
        <Field label="Kategori"><Chips value={f.kategori} onChange={(k) => setF({ ...f, kategori: k })} options={KATEGORI} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nominal (Rp)"><input className={inputCls} inputMode="numeric" value={f.amount} onChange={set('amount')} /></Field>
          <Field label="Tanggal"><input className={inputCls} type="date" value={f.tgl} onChange={set('tgl')} /></Field>
        </div>
        {f.kategori === 'oli' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Odometer saat ganti" hint="Pengingat oli ikut diperbarui"><input className={inputCls} inputMode="numeric" value={f.odo} onChange={set('odo')} /></Field>
            <Field label="Interval (km)"><input className={inputCls} inputMode="numeric" value={f.interval} onChange={set('interval')} /></Field>
          </div>
        )}
        {f.kategori === 'pajak' && <Field label="Jatuh tempo pajak berikutnya"><input className={inputCls} type="date" value={f.nextTax} onChange={set('nextTax')} /></Field>}
        <Field label="Keterangan"><input className={inputCls} value={f.desc} onChange={set('desc')} /></Field>
        <div className="w-1/2"><PhotoField label="Foto nota" file={nota} onChange={setNota} /></div>
        {err && <Alert>{err}</Alert>}
        <button onClick={simpan} disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Menyimpan…' : 'Simpan biaya'}</button>
      </div>
    </Sheet>
  );
}
