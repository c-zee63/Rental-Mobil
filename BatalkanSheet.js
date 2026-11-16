'use client';
import { useState } from 'react';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { writeSafe } from '@/lib/images';
import { rupiah, tglJam } from '@/lib/format';
import { Chips, Field, Sheet, inputCls } from '@/components/ui';

/**
 * Pembatalan pesanan berstatus Booked.
 * - Jadwal otomatis kosong lagi (pesanan batal tidak dihitung bentrok).
 * - Jika sudah ada DP: pilih DP dikembalikan, atau DP hangus (jadi pendapatan di Laporan).
 */
export default function BatalkanSheet({ open, booking, onClose, onDone }) {
  const [alasan, setAlasan] = useState('');
  const [dp, setDp] = useState('kembali');
  const [busy, setBusy] = useState(false);
  const b = booking;

  async function batalkan() {
    if (!b || b.status !== 'booked') return;
    setBusy(true);
    try {
      const hangus = dp === 'hangus' ? (b.dp_paid || 0) : 0;
      await writeSafe(updateDoc(doc(db, 'bookings', b.id), {
        status: 'cancelled', forfeited_dp: hangus, cancelled_at: Timestamp.now(), cancel_reason: alasan.trim(),
      }));
      setAlasan(''); setDp('kembali');
      onDone?.();
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Sheet open={open && !!b} onClose={() => !busy && onClose()} title="Batalkan pesanan">
      {b && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-line p-4 text-sm space-y-1">
            <p className="font-semibold text-base">{b.customer_name}</p>
            <p>{b.booking_code} · {b.vehicle_plate}</p>
            <p>{tglJam(b.start_datetime)} → {tglJam(b.end_datetime)}</p>
          </div>
          <Field label="Alasan pembatalan (opsional)">
            <input className={inputCls} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Mis. pelanggan berhalangan" />
          </Field>
          {(b.dp_paid || 0) > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">DP/pembayaran yang sudah diterima: <b>{rupiah(b.dp_paid)}</b></p>
              <Chips value={dp} onChange={setDp} options={[['kembali', 'Dikembalikan ke pelanggan'], ['hangus', 'DP hangus (jadi pendapatan)']]} />
            </div>
          )}
          <p className="text-xs text-ink/60">Setelah dibatalkan, jadwal unit kosong lagi dan pesanan tidak bisa diaktifkan kembali.</p>
          <button onClick={batalkan} disabled={busy} className="w-full h-12 rounded-xl bg-signal text-white font-semibold disabled:opacity-50">
            {busy ? 'Membatalkan…' : 'Ya, batalkan pesanan'}
          </button>
          <button onClick={onClose} disabled={busy} className="w-full h-11 rounded-xl border border-line bg-white font-semibold">Kembali</button>
        </div>
      )}
    </Sheet>
  );
}
