'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export const inputCls =
  'w-full h-12 rounded-xl border border-line bg-white px-4 focus:outline-none focus:ring-2 focus:ring-petrol disabled:bg-mist';
export const btnPrimary =
  'h-12 rounded-xl bg-petrol text-white font-semibold px-5 active:bg-petrol-dark disabled:opacity-50 grid place-items-center';
export const btnGhost = 'h-12 rounded-xl border border-line bg-white font-semibold px-5 grid place-items-center';

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-xs text-ink/60 mt-1 block">{hint}</span>}
    </label>
  );
}

export function Section({ title, children }) {
  return (
    <section className="bg-white rounded-2xl border border-line p-4 space-y-3">
      <h2 className="font-display font-bold text-lg">{title}</h2>
      {children}
    </section>
  );
}

export function Alert({ tone = 'danger', children }) {
  const c = tone === 'danger' ? 'bg-signal-soft text-signal border-signal/40' : tone === 'warn' ? 'bg-amber-soft text-ink border-amber/50' : 'bg-petrol-soft text-petrol-dark border-petrol/30';
  return <div role="alert" className={`rounded-xl border px-3 py-2 text-sm font-medium ${c}`}>{children}</div>;
}

export function Sheet({ open, onClose, title, children }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Saat pop-up terbuka, tambahkan 1 entri riwayat: tombol Back HP menutup pop-up (bukan keluar halaman).
  useEffect(() => {
    if (!open) return;
    let viaBack = false;
    window.history.pushState({ sheet: true }, '');
    const onPop = () => { viaBack = true; closeRef.current(); };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Ditutup lewat tombol X / simpan: buang entri tambahan tadi (kecuali halaman sudah berpindah)
      if (!viaBack && window.history.state?.sheet) window.history.back();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] bg-black/40 flex items-end" onClick={onClose}>
      <div className="bg-mist w-full max-w-lg mx-auto rounded-t-3xl max-h-[88dvh] overflow-y-auto p-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="w-9 h-9 grid place-items-center rounded-full bg-white border border-line"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`h-10 px-4 rounded-full border text-sm font-semibold ${value === v ? 'bg-petrol text-white border-petrol' : 'bg-white border-line'}`}>{l}</button>
      ))}
    </div>
  );
}
