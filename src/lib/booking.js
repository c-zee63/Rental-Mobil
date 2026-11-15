import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toDate } from '@/lib/format';

// Anti double-booking: cari booking aktif pada vehicle_id yang sama dengan rentang waktu beririsan.
// Irisan: start_baru < end_lama  DAN  end_baru > start_lama.
// Unit on_rent yang belum kembali dianggap terpakai sampai sekarang (overtime).
export async function cekBentrok({ vehicleId, start, end, excludeId }) {
  const snap = await getDocs(query(collection(db, 'bookings'), where('vehicle_id', '==', vehicleId)));
  const now = new Date();
  return (
    snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .find((b) => {
        if (b.id === excludeId || !['booked', 'on_rent'].includes(b.status)) return false;
        const s = toDate(b.start_datetime);
        let e = toDate(b.end_datetime);
        if (b.status === 'on_rent' && e < now) e = now;
        return start < e && end > s;
      }) || null
  );
}

export function kodeBooking(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `RM${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rand}`;
}
