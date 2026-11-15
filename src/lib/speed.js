import { toDate } from '@/lib/format';

export const SPEED_LIMIT = 100;   // km/jam
export const SPEED_STALE_MIN = 10; // data kecepatan lebih tua dari ini dianggap basi (diabaikan)

// Data kecepatan dibaca dari dokumen kendaraan: speed_kmh (angka) + speed_updated_at (Timestamp)
export function speedFresh(v) {
  const t = toDate(v.speed_updated_at)?.getTime();
  return Number.isFinite(Number(v.speed_kmh)) && v.speed_kmh !== null && !!t && Date.now() - t <= SPEED_STALE_MIN * 60000;
}
export const isOverspeed = (v) => speedFresh(v) && Number(v.speed_kmh) > SPEED_LIMIT;
