import { rupiah, tglJam, tglPendek } from '@/lib/format';
import { totalTagihan, sisaTagihan } from '@/lib/billing';

const rp = (n) => rupiah(n).replace(/\u00a0/g, ' ');

/** Buat PDF invoice/kwitansi (A4) di browser. Mengembalikan { blob, filename }. */
export async function buatInvoicePdf(b, jenis = 'booking', biz = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 15, R = W - M;
  const sisa = sisaTagihan(b);
  const lunas = sisa === 0 && totalTagihan(b) > 0;
  let y = 15;
  const t = (s, x, yy, o) => doc.text(String(s), x, yy, o);
  const ensure = (h) => { if (y + h > 275) { doc.addPage(); y = 15; } };

  // ===== Kop usaha =====
  let x = M;
  if (biz.logo) {
    try {
      const h = 20, w = Math.min(40, h * ((biz.logo_w || 1) / (biz.logo_h || 1)));
      doc.addImage(biz.logo, 'JPEG', M, y, w, h);
      x = M + w + 5;
    } catch { /* logo rusak: abaikan */ }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(14, 90, 82);
  t(biz.nama || 'Rental Mobil', x, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(70);
  let ky = y + 11;
  [biz.alamat, [biz.telepon && `Telp/WA: ${biz.telepon}`, biz.email].filter(Boolean).join('   '), biz.izin]
    .filter(Boolean)
    .forEach((l) => doc.splitTextToSize(l, R - x).forEach((s) => { t(s, x, ky); ky += 4.2; }));
  y = Math.max(ky, y + 22) + 2;
  doc.setDrawColor(14, 90, 82); doc.setLineWidth(0.6); doc.line(M, y, R, y); y += 10;

  // ===== Judul =====
  const judul = { booking: 'INVOICE', pelunasan: lunas ? 'KWITANSI PELUNASAN' : 'INVOICE PELUNASAN', perpanjang: 'INVOICE PERPANJANGAN' }[jenis] || 'INVOICE';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20);
  t(judul, M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  t(`No: ${b.booking_code}`, R, y - 6, { align: 'right' });
  t(`Tanggal cetak: ${tglPendek(new Date())}`, R, y - 1, { align: 'right' });
  y += 10;

  // ===== Data pesanan =====
  doc.setFontSize(10);
  const info = (l, v) => {
    if (!v) return;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(20); t(l, M, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(50);
    doc.splitTextToSize(String(v), R - M - 35).forEach((s) => { t(s, M + 35, y); y += 5; });
  };
  info('Pelanggan', b.customer_name);
  info('No. WhatsApp', b.customer_phone);
  info('Unit', `${b.vehicle_model ? b.vehicle_model + ' - ' : ''}${b.vehicle_plate}`);
  info('Layanan', b.service_type === 'dengan_sopir' ? 'Dengan sopir' : 'Lepas kunci');
  info('Mulai', tglJam(b.start_datetime));
  info('Selesai', tglJam(b.end_datetime));
  y += 4;

  // ===== Rincian biaya =====
  const header = (judulTabel, kanan) => {
    ensure(14);
    doc.setFillColor(237, 240, 238); doc.rect(M, y - 4.5, R - M, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20);
    t(judulTabel, M + 2, y); if (kanan) t(kanan, R - 2, y, { align: 'right' });
    y += 8;
  };
  const row = (l, v, o = {}) => {
    ensure(7);
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(10);
    doc.setTextColor(...(o.color || [40, 40, 40]));
    doc.splitTextToSize(String(l), 110).forEach((s, i) => { t(s, M + 2, y); if (i === 0) t(v, R - 2, y, { align: 'right' }); y += 5.5; });
  };

  header('Rincian biaya', 'Jumlah');
  row('Biaya sewa', rp(b.total_price));
  if (b.overtime_fee) row('Denda overtime', rp(b.overtime_fee));
  (b.extra_fees || []).forEach((e) => row(e.label, rp(e.amount)));
  doc.setDrawColor(190); doc.setLineWidth(0.2); doc.line(M, y - 3, R, y - 3);
  row('Total tagihan', rp(totalTagihan(b)), { bold: true });
  row('Sudah dibayar', `- ${rp(b.dp_paid)}`);
  row('Sisa tagihan', rp(sisa), { bold: true, color: sisa ? [201, 58, 43] : [14, 90, 82] });
  y += 3;

  if (lunas) {
    ensure(20);
    doc.setDrawColor(14, 90, 82); doc.setLineWidth(1); doc.roundedRect(R - 42, y, 42, 13, 2, 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(14, 90, 82);
    t('LUNAS', R - 21, y + 9, { align: 'center' });
    y += 20;
  }

  // ===== Riwayat pembayaran =====
  if ((b.payments || []).length) {
    header('Riwayat pembayaran', 'Nominal');
    b.payments.forEach((p) => row(`${tglPendek(p.at)} - ${p.method || ''}${p.note ? ` (${p.note})` : ''}`, rp(p.amount)));
    y += 3;
  }
  if (b.deposit_amount) {
    row(`Deposit ${rp(b.deposit_amount)}`, b.deposit_returned ? 'sudah dikembalikan' : 'ditahan, dikembalikan saat unit kembali');
    y += 2;
  }

  // ===== Rekening & catatan =====
  const blok = (judulBlok, isi) => {
    if (!isi) return;
    ensure(20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20); t(judulBlok, M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60);
    doc.splitTextToSize(isi, R - M).forEach((s) => { ensure(5); t(s, M, y); y += 4.5; });
    y += 3;
  };
  if (sisa > 0) blok('Pembayaran ke', biz.rekening);
  blok('Catatan', biz.catatan);

  doc.setFontSize(8); doc.setTextColor(140);
  t('Dokumen ini dibuat otomatis oleh sistem.', W / 2, 290, { align: 'center' });

  const awal = judul.startsWith('KWITANSI') ? 'Kwitansi' : 'Invoice';
  return { blob: doc.output('blob'), filename: `${awal}-${b.booking_code}.pdf` };
}
