'use client';
import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useFleet } from '@/lib/useFleet';
import { toDataUrl, writeSafe } from '@/lib/images';
import { rupiah, tglPendek, toISODate, toDate } from '@/lib/format';
import { sisaTagihan, totalTagihan } from '@/lib/billing';
import PhotoField from '@/components/PhotoField';
import { Alert, Chips, Field, Sheet, btnPrimary, inputCls } from '@/components/ui';

const KATEGORI = [['servis', 'Servis'], ['oli', 'Ganti oli'], ['cuci', 'Cuci'], ['pajak', 'Pajak'], ['lainnya', 'Lainnya']];
const bulanIni = () => toISODate(new Date()).slice(0, 7);

export default function LaporanPage() {
  const { vehicles } = useFleet();
  const [bulan, setBulan] = useState(bulanIni());
  const [semua, setSemua] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [open, setOpen] = useState(false);
  const [lihat, setLihat] = useState(null);

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
  async function bukaNota(id) {
    setLihat({ loading: true });
    try { const s = await getDoc(doc(db, 'images', id)); setLihat({ src: s.data()?.data || '' }); }
    catch { setLihat({ src: '' }); }
  }
  async function hapusBiaya(e) {
    if (!confirm('Hapus catatan biaya ini?')) return;
    await writeSafe(deleteDoc(doc(db, 'expenses', e.id)));
    if (e.receipt_id) await writeSafe(deleteDoc(doc(db, 'images', e.receipt_id)));
  }
  const plat = (id) => vehicles.find((v) => v.id === id)?.plate_number || '(unit dihapus)';

  return (
    <main className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Laporan</h1>
        <button onClick={() => setOpen(true)} className="h-10 px-4 rounded-full bg-petrol text-white text-sm font-semibold flex items-center gap-1.5"><Plus size={16} /> Biaya</button>
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
            <div key={v.id} className="bg-white border border-line rounded-xl p-3">
              <div className="flex justify-between"><p className="font-semibold">{v.plate_number} <span className="font-normal text-ink/60">{v.brand_model}</span></p>
                <p className={`font-bold ${profit < 0 ? 'text-signal' : 'text-petrol'}`}>{rupiah(profit)}</p></div>
              <p className="text-xs text-ink/60 mt-1">{n} sewa · pendapatan {rupiah(pendapatan)} · biaya {rupiah(biaya)}</p>
            </div>
          );
        })}
        {!rows.length && <p className="text-sm text-ink/60">Belum ada unit.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-display font-bold text-lg">Catatan biaya</h2>
        {expenses.map((e) => (
          <div key={e.id} className="bg-white border border-line rounded-xl p-3 flex justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-semibold">{plat(e.vehicle_id)} · {KATEGORI.find(([k]) => k === e.category)?.[1] || e.category}</p>
              <p className="text-ink/60 truncate">{tglPendek(e.expense_date)}{e.description ? ` · ${e.description}` : ''}</p>
              {e.receipt_id && <button onClick={() => bukaNota(e.receipt_id)} className="text-petrol font-medium">Lihat nota</button>}
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold">{rupiah(e.amount)}</p>
              <button aria-label="Hapus biaya" onClick={() => hapusBiaya(e)} className="text-signal mt-1"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {!expenses.length && <p className="text-sm text-ink/60">Belum ada biaya pada periode ini.</p>}
      </section>

      <Sheet open={!!lihat} onClose={() => setLihat(null)} title="Foto nota">
        {lihat?.loading ? <p className="text-ink/60">Memuat…</p> : lihat?.src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={lihat.src} alt="Nota" className="w-full rounded-xl" /> : <p className="text-ink/60">Foto tidak ditemukan.</p>}
      </Sheet>
      <ExpenseSheet open={open} onClose={() => setOpen(false)} vehicles={vehicles} />
    </main>
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
