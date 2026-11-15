'use client';
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { Search, ShieldAlert } from 'lucide-react';
import { db } from '@/lib/firebase';
import { loadImage, writeSafe } from '@/lib/images';
import { Alert, Chips, Field, Sheet, btnPrimary, inputCls } from '@/components/ui';

export default function PelangganPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);

  useEffect(() => onSnapshot(query(collection(db, 'customers'), limit(500)),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))), console.error), []);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((c) => !t || [c.full_name, c.nik, c.phone_whatsapp].some((x) => String(x || '').toLowerCase().includes(t)));
  }, [rows, q]);

  return (
    <main className="px-4 pt-6 space-y-4">
      <h1 className="font-display text-2xl font-bold">Pelanggan</h1>
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
        <input className={`${inputCls} pl-11`} placeholder="Cari nama, NIK, atau No WA" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id}>
            <button onClick={() => setSel(c)} className="w-full text-left bg-white border border-line rounded-xl p-3 flex items-center justify-between gap-2">
              <span className="min-w-0"><b className="block truncate">{c.full_name}</b><span className="text-xs text-ink/60">{c.nik} · {c.phone_whatsapp}</span></span>
              {c.is_blacklisted && <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-white bg-signal rounded-full px-2.5 py-1"><ShieldAlert size={12} />Blacklist</span>}
            </button>
          </li>
        ))}
      </ul>
      {!list.length && <p className="text-sm text-ink/60">Belum ada pelanggan. Pelanggan tersimpan otomatis dari form +Sewa.</p>}
      {sel && <Detail key={sel.id} c={sel} onClose={() => setSel(null)} />}
    </main>
  );
}

function Detail({ c, onClose }) {
  const [nama, setNama] = useState(c.full_name || '');
  const [wa, setWa] = useState(c.phone_whatsapp || '');
  const [bl, setBl] = useState(!!c.is_blacklisted);
  const [alasan, setAlasan] = useState(c.blacklist_reason || '');
  const [ktp, setKtp] = useState('');
  const [sim, setSim] = useState('');
  const [riwayat, setRiwayat] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    loadImage(c.ktp_url).then(setKtp); loadImage(c.sim_url).then(setSim);
    getDocs(query(collection(db, 'bookings'), where('customer_nik', '==', c.id))).then((s) => setRiwayat(s.size)).catch(() => {});
  }, [c]);

  async function simpan() {
    if (bl && !alasan.trim()) return setErr('Isi alasan blacklist.');
    await writeSafe(updateDoc(doc(db, 'customers', c.id), { full_name: nama.trim(), phone_whatsapp: wa.replace(/\D/g, ''), is_blacklisted: bl, blacklist_reason: bl ? alasan.trim() : '' }));
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={c.full_name}>
      <div className="space-y-3">
        <p className="text-sm text-ink/70">NIK {c.id}{riwayat != null ? ` · ${riwayat} kali menyewa` : ''}</p>
        <div className="grid grid-cols-2 gap-3">
          {[['KTP', ktp], ['SIM', sim]].map(([l, src]) => (
            <div key={l} className="aspect-[4/3] rounded-xl bg-white border border-line overflow-hidden grid place-items-center text-xs text-ink/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {src ? <img src={src} alt={l} className="w-full h-full object-cover" /> : `${l} belum ada`}
            </div>
          ))}
        </div>
        <Field label="Nama"><input className={inputCls} value={nama} onChange={(e) => setNama(e.target.value)} /></Field>
        <Field label="No WhatsApp"><input className={inputCls} inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} /></Field>
        <Field label="Status">
          <Chips value={bl ? 'bl' : 'ok'} onChange={(v) => setBl(v === 'bl')} options={[['ok', 'Normal'], ['bl', 'Blacklist']]} />
        </Field>
        {bl && <Field label="Alasan blacklist"><input className={inputCls} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Mis. unit dikembalikan rusak, tidak bayar" /></Field>}
        {err && <Alert>{err}</Alert>}
        <button onClick={simpan} className={`${btnPrimary} w-full`}>Simpan</button>
      </div>
    </Sheet>
  );
}
