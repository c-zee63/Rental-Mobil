export const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

export const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

export const jam = (v) =>
  toDate(v)?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':') ?? '-';

export const tanggalPanjang = (d = new Date()) =>
  d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const awalHari = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const akhirHari = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
export const sameDay = (a, b) => a && b && awalHari(a).getTime() === awalHari(b).getTime();

export const hariKe = (tgl) => Math.ceil((toDate(tgl) - new Date()) / 86400000);

export const gmapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

const pad = (n) => String(n).padStart(2, '0');
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const toISODate = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '');
export const toLocalInput = (d) => `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const tglPendek = (v) =>
  toDate(v)?.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '-';
export const tglJam = (v) => (toDate(v) ? `${tglPendek(v)} ${jam(v)}` : '-');
export const normPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('0')) return '62' + d.slice(1);
  if (d.startsWith('8')) return '62' + d;
  return d;
};
