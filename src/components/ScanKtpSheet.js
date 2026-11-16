'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, ContactRound, ExternalLink } from 'lucide-react';
import { bacaKtp } from '@/lib/ktpScan';
import { normPhone } from '@/lib/format';
import { useBusiness } from '@/context/BusinessContext';
import { Alert, Field, Sheet, inputCls } from '@/components/ui';

/**
 * Alur: (1) pilih kontak pemesan (daftar kontak HP, sama dengan kontak WhatsApp) -> nomor terisi,
 *       (2) foto KTP dengan kamera -> NIK dan nama dibaca otomatis -> onResult() mengisi formulir.
 * Catatan: browser tidak bisa membaca kontak yang dipilih di dalam aplikasi WhatsApp,
 * jadi tombol "Buka WhatsApp" hanya membuka chat; nomor diambil dari pilihan kontak di sini.
 */
export default function ScanKtpSheet({ open, onClose, onResult }) {
  const biz = useBusiness();
  const fileRef = useRef(null);
  const [phone, setPhone] = useState('');
  const [namaKontak, setNamaKontak] = useState('');
  const [bisaKontak, setBisaKontak] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const busy = !!status;

  useEffect(() => {
    if (!open) return;
    setErr(''); setStatus('');
    setBisaKontak('contacts' in navigator && 'ContactsManager' in window); // Chrome Android
  }, [open]);

  async function pilihKontak() {
    setErr('');
    try {
      const [c] = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!c) return;
      const tel = (c.tel || [])[0];
      setNamaKontak((c.name || [])[0] || '');
      if (!tel) return setErr('Kontak ini tidak punya nomor telepon.');
      setPhone(normPhone(tel));
      // Langsung lanjut ke kamera. Bila browser menolak (butuh sentuhan baru), tombol Foto KTP tetap tersedia.
      try { fileRef.current?.click(); } catch { /* abaikan */ }
    } catch { setErr('Daftar kontak tidak bisa dibuka. Ketik nomor pemesan secara manual.'); }
  }

  function bukaWhatsApp() {
    const n = normPhone(phone);
    const teks = encodeURIComponent(`Halo, saya dari ${biz?.nama || 'rental mobil'}.`);
    // Tanpa nomor: WhatsApp membuka daftar kontak untuk dipilih
    window.open(n.length >= 8 ? `https://wa.me/${n}?text=${teks}` : `https://wa.me/?text=${teks}`, '_blank', 'noopener');
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(''); setStatus('Menyiapkan foto…');
    let r = { nik: '', nama: '' }, gagal = false;
    try { r = await bacaKtp(file, setStatus); } catch { gagal = true; }
    setStatus('');
    onResult({ phone: normPhone(phone), nik: r.nik, nama: r.nama || namaKontak, file, gagal });
    onClose();
  }

  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title="Pelanggan lewat WhatsApp">
      <div className="space-y-4">
        <section className="bg-white rounded-2xl border border-line p-4 space-y-3">
          <h3 className="font-semibold">1. Pilih kontak pemesan</h3>
          {bisaKontak && (
            <button type="button" onClick={pilihKontak} disabled={busy} className="w-full h-12 rounded-xl bg-[#25D366] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              <ContactRound size={20} /> Pilih dari kontak HP
            </button>
          )}
          <Field label="No WhatsApp pemesan" hint={bisaKontak ? '' : 'Browser ini tidak bisa membuka daftar kontak. Ketik nomor secara manual (atau pakai Chrome di Android).'}>
            <input className={inputCls} inputMode="tel" placeholder="08xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          {namaKontak && <p className="text-xs text-ink/60">Kontak: {namaKontak}</p>}
          <button type="button" onClick={bukaWhatsApp} className="text-petrol font-semibold text-sm inline-flex items-center gap-1.5">
            <ExternalLink size={14} /> Buka WhatsApp{phone.replace(/\D/g, '').length >= 8 ? ' (chat dengan pemesan)' : ' (pilih kontak di WhatsApp)'}
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-line p-4 space-y-3">
          <h3 className="font-semibold">2. Foto KTP</h3>
          <p className="text-sm text-ink/70">Posisikan KTP mendatar, terang, tanpa silau, dan memenuhi bingkai. NIK dan nama terisi otomatis.</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="w-full h-12 rounded-xl bg-petrol text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            <Camera size={20} /> {busy ? status : 'Buka kamera & foto KTP'}
          </button>
        </section>
        {err && <Alert>{err}</Alert>}
      </div>
    </Sheet>
  );
}
