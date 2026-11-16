import { rupiah, tglJam, normPhone } from '@/lib/format';
import { totalTagihan, sisaTagihan } from '@/lib/billing';

const BISNIS = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Rental Mobil';

export const waUrl = (phone, text) => `https://wa.me/${normPhone(phone)}?text=${encodeURIComponent(text)}`;

/** jenis: 'booking' | 'pelunasan' | 'perpanjang' */
export function invoiceText(b, jenis = 'booking', biz = {}) {
  const judul = { booking: 'INVOICE SEWA MOBIL', pelunasan: 'INVOICE PELUNASAN', perpanjang: 'PERPANJANGAN SEWA' }[jenis];
  const sisa = sisaTagihan(b);
  const L = [
    `*${judul}*`,
    biz?.nama || BISNIS,
    ...(biz?.alamat ? [biz.alamat] : []),
    ...(biz?.telepon ? [`Telp/WA: ${biz.telepon}`] : []),
    '',
    `Kode: ${b.booking_code}`,
    `Nama: ${b.customer_name}`,
    `Unit: ${b.vehicle_model ? b.vehicle_model + ' ' : ''}(${b.vehicle_plate})`,
    `Layanan: ${b.service_type === 'dengan_sopir' ? 'Dengan sopir' : 'Lepas kunci'}`,
    `Mulai: ${tglJam(b.start_datetime)}`,
    `Selesai: ${tglJam(b.end_datetime)}`,
    '',
    `Biaya sewa: ${rupiah(b.total_price)}`,
  ];
  if (b.overtime_fee) L.push(`Denda overtime: ${rupiah(b.overtime_fee)}`);
  (b.extra_fees || []).forEach((x) => L.push(`${x.label}: ${rupiah(x.amount)}`));
  if (b.overtime_fee || (b.extra_fees || []).length) L.push(`Total: ${rupiah(totalTagihan(b))}`);
  L.push(`${jenis === 'booking' ? 'DP dibayar' : 'Sudah dibayar'}: ${rupiah(b.dp_paid)}`);
  L.push(sisa === 0 && jenis === 'pelunasan' ? '*LUNAS ✅*' : `*Sisa tagihan: ${rupiah(sisa)}*`);
  if (sisa > 0 && biz?.rekening) L.push('', 'Pembayaran ke:', biz.rekening);
  if (b.deposit_amount) L.push(b.deposit_returned ? `Deposit ${rupiah(b.deposit_amount)}: sudah dikembalikan` : `Deposit: ${rupiah(b.deposit_amount)} (dikembalikan saat unit kembali sesuai kondisi)`);
  L.push('', 'Terima kasih sudah mempercayakan perjalanan Anda kepada kami 🙏');
  return L.join('\n');
}
