// ===== Aturan tarif (ubah angka di sini sesuai kebijakan usaha) =====
export const DURASI = {
  '12h': { label: '12 jam', hours: 12 },
  '24h': { label: '24 jam (harian)', hours: 24 },
  '7d': { label: 'Mingguan', hours: 168 },
};
export const FAKTOR_12JAM = 0.6;     // tarif 12 jam = 60% tarif harian
export const FAKTOR_MINGGUAN = 6.3;  // tarif 7 hari = 6,3x tarif harian (diskon 10%)
export const GRACE_MENIT = 60;       // toleransi keterlambatan
export const DENDA_PER_JAM = 0.1;    // denda overtime = 10% tarif harian per jam (maks 1x tarif harian / 24 jam)

const bulat = (n) => Math.round(n / 1000) * 1000;

export function tarifSatuan(durasi, rate) {
  if (durasi === '12h') return bulat(rate * FAKTOR_12JAM);
  if (durasi === '7d') return bulat(rate * FAKTOR_MINGGUAN);
  return rate;
}

export function hitungTarif({ rate = 0, durasi = '24h', qty = 1, layanan = 'lepas_kunci', driverFee = 0, dp = 0 }) {
  const q = Math.max(1, Math.floor(qty) || 1);
  const hours = DURASI[durasi].hours * q;
  const sewa = tarifSatuan(durasi, rate) * q;
  const sopir = layanan === 'dengan_sopir' ? driverFee * Math.max(1, Math.ceil(hours / 24)) : 0;
  const total = sewa + sopir;
  return { hours, sewa, sopir, total, sisa: Math.max(0, total - dp) };
}

export function hitungOvertime({ end, returnedAt = new Date(), rate = 0 }) {
  const telat = (returnedAt - end) / 36e5 - GRACE_MENIT / 60;
  if (telat <= 0) return { jam: 0, denda: 0 };
  const jam = Math.ceil(telat);
  const denda = bulat(Math.min(jam * rate * DENDA_PER_JAM, Math.ceil(jam / 24) * rate));
  return { jam, denda };
}

export function hargaPerpanjang(rate, hours) {
  if (hours <= 0) return 0;
  return hours <= 12 ? tarifSatuan('12h', rate) : Math.ceil(hours / 24) * rate;
}
