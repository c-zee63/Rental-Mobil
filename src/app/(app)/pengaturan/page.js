'use client';
import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { ImagePlus, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { writeSafe } from '@/lib/images';
import { useBusiness } from '@/context/BusinessContext';
import { Alert, Field, Section, btnPrimary, inputCls } from '@/components/ui';

// Logo diperkecil (maks 300px) dan diberi latar putih agar aman dipakai di PDF
function muatLogo(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 300 / Math.max(img.width, img.height));
      const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(u);
      res({ logo: c.toDataURL('image/jpeg', 0.85), logo_w: w, logo_h: h });
    };
    img.onerror = rej; img.src = u;
  });
}

export default function PengaturanPage() {
  const biz = useBusiness();
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (f === null && Object.keys(biz).length) setF(biz); }, [biz, f]);
  const cur = f ?? biz;
  const set = (k) => (e) => setF({ ...cur, [k]: e.target.value });

  async function pilihLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setF({ ...cur, ...(await muatLogo(file)) }); setMsg(''); } catch { setMsg('Logo tidak bisa dibaca. Coba file PNG atau JPG lain.'); }
  }

  async function simpan() {
    setBusy(true);
    const data = {
      nama: (cur.nama || '').trim(), alamat: (cur.alamat || '').trim(), telepon: (cur.telepon || '').trim(),
      email: (cur.email || '').trim(), izin: (cur.izin || '').trim(), rekening: (cur.rekening || '').trim(),
      catatan: (cur.catatan || '').trim(), logo: cur.logo || '', logo_w: cur.logo_w || 0, logo_h: cur.logo_h || 0,
    };
    await writeSafe(setDoc(doc(db, 'settings', 'business'), data));
    setBusy(false); setMsg('Tersimpan. Data ini dipakai di PDF dan teks invoice.');
  }

  return (
    <main className="px-4 pt-6 space-y-4">
      <h1 className="font-display text-2xl font-bold">Pengaturan usaha</h1>
      <p className="text-sm text-ink/70">Data ini tampil di kop PDF invoice dan pesan WhatsApp.</p>

      <Section title="Logo">
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-xl border border-dashed border-ink/30 bg-white grid place-items-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {cur.logo ? <img src={cur.logo} alt="Logo usaha" className="w-full h-full object-contain" /> : <ImagePlus className="text-ink/40" />}
          </div>
          <div className="space-y-2">
            <label className="inline-block h-11 leading-[2.75rem] px-4 rounded-xl bg-petrol text-white font-semibold cursor-pointer">
              {cur.logo ? 'Ganti logo' : 'Pilih logo'}
              <input type="file" accept="image/*" className="sr-only" onChange={pilihLogo} />
            </label>
            {cur.logo && <button onClick={() => setF({ ...cur, logo: '', logo_w: 0, logo_h: 0 })} className="flex items-center gap-1 text-signal text-sm font-semibold"><Trash2 size={14} />Hapus logo</button>}
          </div>
        </div>
      </Section>

      <Section title="Identitas">
        <Field label="Nama usaha"><input className={inputCls} value={cur.nama || ''} onChange={set('nama')} placeholder="Mis. Rental Mobil Sejahtera" /></Field>
        <Field label="Alamat"><textarea className={`${inputCls} h-24 py-3`} value={cur.alamat || ''} onChange={set('alamat')} /></Field>
        <Field label="No. telepon / WhatsApp"><input className={inputCls} inputMode="tel" value={cur.telepon || ''} onChange={set('telepon')} /></Field>
        <Field label="Email (opsional)"><input className={inputCls} type="email" value={cur.email || ''} onChange={set('email')} /></Field>
        <Field label="No. izin usaha / NPWP (opsional)"><input className={inputCls} value={cur.izin || ''} onChange={set('izin')} /></Field>
      </Section>

      <Section title="Pembayaran dan catatan invoice">
        <Field label="Rekening / QRIS (opsional)" hint="Tampil di invoice yang masih ada sisa tagihan.">
          <textarea className={`${inputCls} h-24 py-3`} value={cur.rekening || ''} onChange={set('rekening')} placeholder={'BCA 1234567890 a.n. Nama Anda'} />
        </Field>
        <Field label="Catatan kaki / syarat sewa (opsional)">
          <textarea className={`${inputCls} h-24 py-3`} value={cur.catatan || ''} onChange={set('catatan')} placeholder="Mis. Keterlambatan dikenakan denda. BBM dikembalikan sama seperti saat serah terima." />
        </Field>
      </Section>

      {msg && <Alert tone="info">{msg}</Alert>}
      <button onClick={simpan} disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</button>
    </main>
  );
}
