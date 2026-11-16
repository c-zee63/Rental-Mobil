'use client';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { useBusiness } from '@/context/BusinessContext';
import { buatInvoicePdf } from '@/lib/invoicePdf';
import { invoiceText, waUrl } from '@/lib/whatsapp';

/**
 * Tombol "Kirim invoice WhatsApp":
 *  1) Membuat PDF di HP.
 *  2) HP modern: membuka menu Bagikan dengan PDF terlampir -> pilih WhatsApp -> pilih chat pelanggan.
 *  3) Jika menu Bagikan file tidak didukung (mis. PC): PDF diunduh, lalu tombol buka WhatsApp muncul.
 * Catatan: tautan wa.me sendiri tidak bisa melampirkan file, maka PDF dikirim lewat menu Bagikan.
 */
export default function KirimInvoice({ booking, jenis = 'booking', label = 'Kirim invoice PDF via WhatsApp', className = 'h-12 rounded-xl bg-petrol text-white font-semibold px-5' }) {
  const biz = useBusiness();
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const teks = invoiceText(booking, jenis, biz);
  const linkTeks = booking.customer_phone ? waUrl(booking.customer_phone, teks) : null;

  async function kirim() {
    setBusy(true); setInfo('');
    try {
      const { blob, filename } = await buatInvoicePdf(booking, jenis, biz);
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text: teks, title: filename }); return; }
        catch (e) { if (e?.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      setInfo('PDF sudah diunduh. Buka WhatsApp, tekan ikon lampiran, lalu pilih file PDF tersebut.');
    } catch {
      setInfo('PDF gagal dibuat. Anda masih bisa mengirim invoice dalam bentuk teks.');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2 w-full">
      <button type="button" onClick={kirim} disabled={busy} className={`${className} w-full disabled:opacity-60`}>
        <span className="flex items-center justify-center gap-2"><FileText size={18} />{busy ? 'Membuat PDF…' : label}</span>
      </button>
      {info && <p className="text-sm text-ink/70">{info}</p>}
      {linkTeks && (
        <a href={linkTeks} target="_blank" rel="noopener noreferrer" className="block text-center text-sm font-semibold text-petrol py-1">
          {info ? 'Buka chat WhatsApp pelanggan' : 'Atau kirim teks saja langsung ke nomor pelanggan'}
        </a>
      )}
    </div>
  );
}
