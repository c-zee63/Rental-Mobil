'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Keyboard } from 'lucide-react';
import { bacaKtp, nikMasukAkal, siapkanPembaca } from '@/lib/ktpScan';
import { Alert, Sheet } from '@/components/ui';

/**
 * Scan NIK dari KTP memakai kamera langsung (live). NIK dianggap terbaca bila bentuknya valid
 * dan terbaca sama 2 kali berturut-turut. Cadangan: tombol "Foto KTP" (kamera bawaan HP).
 * onResult({ nik, file }) -> file = foto KTP (bisa dipakai sebagai foto KTP pesanan).
 */
export default function ScanNikSheet({ open, onClose, onResult }) {
  return (
    <Sheet open={open} onClose={onClose} title="Scan NIK dari KTP">
      {open && <Kamera onClose={onClose} onResult={onResult} />}
    </Sheet>
  );
}

function Kamera({ onClose, onResult }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const hidup = useRef(true);
  const [status, setStatus] = useState('Menyalakan kamera…');
  const [err, setErr] = useState('');
  const [busyFoto, setBusyFoto] = useState(false);

  useEffect(() => {
    hidup.current = true;
    let stream = null, pembaca = null, timer = null;
    const hits = {};

    async function mulai() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus(''); return setErr('Kamera langsung tidak didukung di browser ini. Pakai tombol “Foto KTP” di bawah.');
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
        });
      } catch {
        setStatus(''); return setErr('Kamera tidak bisa dibuka. Izinkan akses kamera di browser, atau pakai tombol “Foto KTP” di bawah.');
      }
      if (!hidup.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = videoRef.current;
      v.srcObject = stream;
      try { await v.play(); } catch { /* autoplay diblok: abaikan */ }

      setStatus('Memuat pembaca KTP… (pertama kali butuh internet)');
      try { pembaca = await siapkanPembaca(setStatus); }
      catch { setStatus(''); return setErr('Mesin pembaca gagal dimuat. Periksa internet, atau pakai tombol “Foto KTP” di bawah.'); }
      if (!hidup.current) { pembaca.stop(); return; }

      const putaran = async () => {
        if (!hidup.current) return;
        if (v.videoWidth) {
          setStatus('Mencari NIK… arahkan KTP mendatar ke bingkai, tahan diam');
          try {
            const { nik, kanvas } = await pembaca.bacaVideo(v);
            if (hidup.current && nikMasukAkal(nik)) {
              hits[nik] = (hits[nik] || 0) + 1;
              if (hits[nik] >= 2) {
                hidup.current = false;
                setStatus('NIK terbaca');
                const blob = await new Promise((res) => kanvas.toBlob(res, 'image/jpeg', 0.9));
                const file = blob ? new File([blob], 'ktp.jpg', { type: 'image/jpeg' }) : null;
                onResult({ nik, file });
                onClose();
                return;
              }
            }
          } catch { /* frame gagal dibaca: coba lagi */ }
        }
        if (hidup.current) timer = setTimeout(putaran, 300);
      };
      putaran();
    }
    mulai();

    return () => {
      hidup.current = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      pembaca?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusyFoto(true); setErr('');
    try {
      const r = await bacaKtp(file, setStatus);
      if (!hidup.current) return;
      hidup.current = false;
      onResult({ nik: r.nik || '', file });
      onClose();
    } catch {
      setErr('Foto tidak bisa dibaca. Coba lagi, atau ketik NIK secara manual.');
    } finally { setBusyFoto(false); }
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
        <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
        <div className="absolute inset-5 border-2 border-white/80 rounded-xl pointer-events-none" />
      </div>
      {status && <p className="text-sm text-ink/70 text-center">{status}</p>}
      {err && <Alert>{err}</Alert>}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFoto} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busyFoto}
        className="w-full h-12 rounded-xl bg-petrol text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
        <Camera size={20} /> {busyFoto ? 'Membaca foto…' : 'Foto KTP (kamera bawaan HP)'}
      </button>
      <button type="button" onClick={onClose} className="w-full h-11 rounded-xl border border-line bg-white font-semibold flex items-center justify-center gap-2">
        <Keyboard size={18} /> Ketik NIK manual
      </button>
    </div>
  );
}
