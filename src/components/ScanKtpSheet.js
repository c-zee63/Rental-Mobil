'use client';
import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { bacaKtp } from '@/lib/ktpScan';
import { normPhone } from '@/lib/format';
import { useBusiness } from '@/context/BusinessContext';
import { Alert, Field, Sheet, inputCls } from '@/components/ui';
import WhatsAppIcon from '@/components/WhatsAppIcon';

/**
 * Alur: (1) buka WhatsApp (chat pemesan / pilih kontak di WhatsApp), nomor pemesan diketik di kolom,
 *       (2) foto KTP dengan kamera -> NIK dan nama dibaca otomatis -> onResult() mengisi formulir.
 * Catatan: browser tidak bisa membaca kontak yang dipilih di dalam aplikasi WhatsApp,
 * jadi nomor pemesan tetap diisi di kolom ini.
 */
export default function ScanKtpSheet({ open, onClose, onResult }) {
  const biz = useBusiness();
  const fileRef = useRef(null);
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const busy = !!status;

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
    setStatus('Menyiapkan foto…');
    let r = { nik: '', nama: '' }, gagal = false;
    try { r = await bacaKtp(file, setStatus); } catch { gagal = true; }
    setStatus('');
    onResult({ phone: normPhone(phone), nik: r.nik, nama: r.nama, file, gagal });
    onClose();
  }

  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title="Pelanggan lewat WhatsApp">
      <div className="space-y-4">
        <section className="bg-white rounded-2xl border border-line p-4 space-y-3">
          <h3 className="font-semibold">1. WhatsApp pemesan</h3>
          <button type="button" onClick={bukaWhatsApp} disabled={busy} className="w-full h-12 rounded-xl bg-[#25D366] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            <WhatsAppIcon size={22} /> Buka WhatsApp
          </button>
          <Field label="No WhatsApp pemesan" hint="Ketik nomor pemesan agar terisi di formulir (boleh dikosongkan).">
            <input className={inputCls} inputMode="tel" placeholder="08xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </section>

        <section className="bg-white rounded-2xl border border-line p-4 space-y-3">
          <h3 className="font-semibold">2. Foto KTP</h3>
          <p className="text-sm text-ink/70">Posisikan KTP mendatar, terang, tanpa silau, dan memenuhi bingkai. NIK dan nama terisi otomatis.</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="w-full h-12 rounded-xl bg-petrol text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            <Camera size={20} /> {busy ? status : 'Buka kamera & foto KTP'}
          </button>
        </section>
      </div>
    </Sheet>
  );
}
