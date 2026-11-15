// Total tagihan = sewa + denda overtime + biaya tambahan (kerusakan, BBM kurang, dll)
export const sumExtras = (items = []) => items.reduce((t, i) => t + (Number(i.amount) || 0), 0);
export const totalTagihan = (b) => (b.total_price || 0) + (b.overtime_fee || 0) + (b.extra_total || 0);
// dp_paid = total uang yang sudah diterima (DP + pelunasan); rinciannya ada di array `payments`
export const sisaTagihan = (b) => Math.max(0, totalTagihan(b) - (b.dp_paid || 0));
export const sudahLunas = (b) => totalTagihan(b) > 0 && sisaTagihan(b) === 0;
