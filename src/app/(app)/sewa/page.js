'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore';
import { Search, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useFleet } from '@/lib/useFleet';
import { toDataUrl, saveImage, loadImage, writeSafe } from '@/lib/images';
import { cekBentrok, kodeBooking } from '@/lib/booking';
import { DURASI, hitungTarif, DENDA_PER_JAM, GRACE_MENIT } from '@/lib/pricing';
import KirimInvoice from '@/components/KirimInvoice';
import { normPhone, rupiah, toLocalInput, tglJam } from '@/lib/format';
import PhotoField from '@/components/PhotoField';
import ScanKtpSheet from '@/components/ScanKtpSheet';
import WhatsAppIcon from '@/components/WhatsAppIcon';
import { Alert, Chips, Field, Section, btnGhost, btnPrimary, inputCls } from '@/components/ui';

const KOSONG = { nik: '', full_name: '', phone_whatsapp: '', ktp_url: '', sim_url: '', is_blacklisted: false, blacklist_reason: '' };

function defaultStart(param) {
  const d = param ? new Date(`${param}T09:00`) : new Date();
  if (!param) { d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); }
  return toLocalInput(d);
}

function Form() {
  const sp = useSearchParams();
  const { vehicles } = useFleet();

  const [cari, setCari] = useState('');
  const [found, setFound] = useState(null); // 'found' | 'new'
  const [cust, setCust] = useState(KOSONG);
  const [ktp, setKtp] = useState(null);
  const [sim, setSim] = useState(null);
  const [ktpPrev, setKtpPrev] = useState('');
  const [simPrev, setSimPrev] = useState('');
  const [ignoreBL, setIgnoreBL] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMsg, setScanMsg] = useState(null);

  const [vehicleId, setVehicleId] = useState(sp.get('vehicle') || '');
  const [layanan, setLayanan] = useState('lepas_kunci');
  const [driverFee, setDriverFee] = useState(250000);
  const [durasi, setDurasi] = useState('24h');
  const [qty, setQty] = useState(1);
  const [start, setStart] = useState(() => defaultStart(sp.get('start')));
  const [dp, setDp] = useState(0);
  const [deposit, setDeposit] = useState(0);

  const [conflict, setConflict] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const calc = useMemo(
    () => hitungTarif({ rate: vehicle?.daily_rate || 0, durasi, qty: Number(qty), layanan, driverFee: Number(driverFee) || 0, dp: Number(dp) || 0 }),
    [vehicle, durasi, qty, layanan, driverFee, dp]
  );
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + calc.hours * 36e5);
  const validTime = !isNaN(startDate);

  // Cek bentrok langsung saat unit/jadwal berubah
  useEffect(() => {
    if (!vehicleId || !validTime) return setConflict(null);
    let alive = true;
    cekBentrok({ vehicleId, start: startDate, end: endDate }).then((c) => alive && setConflict(c)).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, start, calc.hours]);

  async function cariPelanggan() {
    const q = cari.replace(/\D/g, '');
    if (!q) return;
    let snap = null;
    if (q.length >= 15) {
      const d = await getDoc(doc(db, 'customers', q));
      if (d.exists()) snap = d;
    }
    if (!snap) {
      const res = await getDocs(query(collection(db, 'customers'), where('phone_whatsapp', '==', normPhone(q))));
      if (!res.empty) snap = res.docs[0];
    }
    setIgnoreBL(false); setKtp(null); setSim(null); setKtpPrev(''); setSimPrev(''); setScanMsg(null);
    if (snap) {
      const d = snap.data();
      setCust({ ...KOSONG, ...d, nik: snap.id }); setFound('found');
      loadImage(d.ktp_url).then(setKtpPrev); loadImage(d.sim_url).then(setSimPrev);
    }
    else { setCust({ ...KOSONG, nik: q.length >= 15 ? q : '', phone_whatsapp: q.length < 15 ? q : '' }); setFound('new'); }
  }

  // Hasil dari pop-up WhatsApp + scan KTP: isi NIK, nama, dan nomor WA tanpa mengetik satu per satu
  async function terapkanScan({ phone, nik, nama, file, gagal }) {
    setIgnoreBL(false); setSim(null); setSimPrev(''); setKtpPrev('');
    setKtp(file);
    let snap = null;
    try {
      if (nik.length === 16) {
        const d = await getDoc(doc(db, 'customers', nik));
        if (d.exists()) snap = d;
      } else if (phone) {
        const res = await getDocs(query(collection(db, 'customers'), where('phone_whatsapp', '==', normPhone(phone))));
        if (!res.empty) snap = res.docs[0];
      }
    } catch { /* offline: lanjut sebagai pelanggan baru */ }

    if (snap) {
      const d = snap.data();
      setCust({ ...KOSONG, ...d, nik: snap.id }); setFound('found'); setCari(snap.id);
      loadImage(d.sim_url).then(setSimPrev);
      setScanMsg({ tone: 'info', text: 'Pelanggan lama ditemukan dari KTP. Data tersimpan dipakai, foto KTP baru akan menggantikan yang lama.' });
    } else {
      setCust({ ...KOSONG, nik, full_name: nama, phone_whatsapp: phone }); setFound('new'); setCari(nik || phone);
      if (gagal || (!nik && !nama)) setScanMsg({ tone: 'warn', text: 'Foto KTP tersimpan, tetapi NIK dan nama belum terbaca. Isi manual di bawah, atau foto ulang KTP (terang, mendatar, tanpa silau).' });
      else if (nik.length !== 16) setScanMsg({ tone: 'warn', text: `NIK terbaca ${nik.length} digit (seharusnya 16). Periksa dan perbaiki NIK serta nama sesuai KTP.` });
      else setScanMsg({ tone: 'info', text: 'NIK dan nama dibaca otomatis dari KTP. Cocokkan dengan fisik KTP sebelum menyimpan.' });
    }
  }

  async function simpan() {
    setError('');
    const nik = cust.nik.replace(/\D/g, '');
    if (nik.length !== 16) return setError('NIK harus 16 digit.');
    if (!cust.full_name.trim() || !cust.phone_whatsapp.trim()) return setError('Nama dan No WhatsApp wajib diisi.');
    if (cust.is_blacklisted && !ignoreBL) return setError('Pelanggan di-blacklist. Centang konfirmasi jika tetap ingin melanjutkan.');
    if (!vehicle) return setError('Pilih unit mobil.');
    if (vehicle.status === 'maintenance') return setError('Unit sedang servis.');
    if (!validTime) return setError('Tanggal mulai tidak valid.');
    if (!ktp && !cust.ktp_url) return setError('Foto KTP wajib diunggah.');
    if (!sim && !cust.sim_url) return setError('Foto SIM A wajib diunggah.');

    setBusy(true);
    try {
      // Validasi final sebelum menyimpan transaksi
      const bentrok = await cekBentrok({ vehicleId, start: startDate, end: endDate });
      if (bentrok) { setConflict(bentrok); throw new Error('Jadwal bentrok dengan pesanan lain. Ubah unit atau waktu.'); }

      let ktp_url = cust.ktp_url, sim_url = cust.sim_url;
      try {
        const [kd, sd] = await Promise.all([ktp ? toDataUrl(ktp) : null, sim ? toDataUrl(sim) : null]);
        // ktp_url / sim_url berisi ID dokumen foto di koleksi `images`
        if (kd) ktp_url = await saveImage(`ktp_${nik}`, kd, { kind: 'ktp', customer_nik: nik });
        if (sd) sim_url = await saveImage(`sim_${nik}`, sd, { kind: 'sim', customer_nik: nik });
      } catch { throw new Error('Foto KTP/SIM gagal diproses. Coba ambil ulang fotonya.'); }

      const phone = normPhone(cust.phone_whatsapp);
      await writeSafe(setDoc(doc(db, 'customers', nik), {
        nik, full_name: cust.full_name.trim(), phone_whatsapp: phone, ktp_url, sim_url,
        is_blacklisted: !!cust.is_blacklisted, blacklist_reason: cust.blacklist_reason || '',
      }, { merge: true }));

      const ref = doc(collection(db, 'bookings'));
      const data = {
        booking_code: kodeBooking(), customer_nik: nik, customer_name: cust.full_name.trim(), customer_phone: phone,
        vehicle_id: vehicle.id, vehicle_plate: vehicle.plate_number, vehicle_model: vehicle.brand_model,
        service_type: layanan, duration_type: durasi, duration_qty: Number(qty) || 1,
        driver_fee: layanan === 'dengan_sopir' ? Number(driverFee) || 0 : 0,
        start_datetime: Timestamp.fromDate(startDate), end_datetime: Timestamp.fromDate(endDate),
        total_price: calc.total, dp_paid: Number(dp) || 0, deposit_amount: Number(deposit) || 0,
        overtime_fee: 0, extra_fees: [], extra_total: 0, deposit_returned: false,
        payments: Number(dp) > 0 ? [{ amount: Number(dp), method: 'Tunai', at: Timestamp.now(), note: 'DP' }] : [],
        status: 'booked', created_at: Timestamp.now(),
      };
      await writeSafe(setDoc(ref, data));
      setDone({ id: ref.id, ...data });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <main className="px-4 pt-10 space-y-5 text-center">
        <CheckCircle2 size={56} className="text-petrol mx-auto" />
        <div>
          <h1 className="font-display text-2xl font-bold">Pesanan tersimpan</h1>
          <p className="text-ink/70 mt-1">{done.booking_code} · {done.vehicle_plate} · {tglJam(done.start_datetime)}</p>
        </div>
        <div className="space-y-3">
          <KirimInvoice booking={done} jenis="booking" className={btnPrimary} />
          <Link href={`/sewa/serah-terima?booking=${done.id}&type=checkout`} className={btnGhost}>Lakukan serah terima sekarang</Link>
          <button onClick={() => location.assign('/sewa')} className="text-petrol font-semibold">Buat pesanan lain</button>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pt-6 space-y-4">
      <h1 className="font-display text-2xl font-bold">Pesanan baru</h1>

      <Section title="Pelanggan">
        <div className="flex gap-2">
          <input className={inputCls} inputMode="numeric" placeholder="NIK atau No WhatsApp" value={cari}
            onChange={(e) => setCari(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cariPelanggan()} />
          <button type="button" onClick={cariPelanggan} aria-label="Cari pelanggan" className="w-12 h-12 shrink-0 rounded-xl bg-petrol text-white grid place-items-center"><Search size={20} /></button>
          <button type="button" onClick={() => setScanOpen(true)} aria-label="Pilih kontak WhatsApp dan foto KTP" className="w-12 h-12 shrink-0 rounded-xl bg-[#25D366] text-white grid place-items-center"><WhatsAppIcon size={24} /></button>
        </div>
        {scanMsg && <Alert tone={scanMsg.tone}>{scanMsg.text}</Alert>}
        {found === 'found' && <Alert tone="info">Pelanggan lama ditemukan, data terisi otomatis.</Alert>}
        {found === 'new' && <Alert tone="warn">Belum terdaftar. Lengkapi data pelanggan baru di bawah.</Alert>}
        {cust.is_blacklisted && (
          <div className="rounded-xl bg-signal text-white p-3 space-y-2">
            <p className="font-bold">PELANGGAN BLACKLIST</p>
            <p className="text-sm">{cust.blacklist_reason || 'Tanpa alasan tercatat.'}</p>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={ignoreBL} onChange={(e) => setIgnoreBL(e.target.checked)} className="w-5 h-5" />
              Saya sadar dan tetap ingin melanjutkan
            </label>
          </div>
        )}
        {found && (
          <>
            <Field label="NIK (16 digit)"><input className={inputCls} inputMode="numeric" maxLength={16} value={cust.nik} disabled={found === 'found'} onChange={(e) => setCust({ ...cust, nik: e.target.value })} /></Field>
            <Field label="Nama lengkap"><input className={inputCls} value={cust.full_name} onChange={(e) => setCust({ ...cust, full_name: e.target.value })} /></Field>
            <Field label="No WhatsApp"><input className={inputCls} inputMode="tel" value={cust.phone_whatsapp} onChange={(e) => setCust({ ...cust, phone_whatsapp: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <PhotoField label="Foto KTP" file={ktp} url={ktpPrev} onChange={setKtp} />
              <PhotoField label="Foto SIM A" file={sim} url={simPrev} onChange={setSim} />
            </div>
          </>
        )}
      </Section>

      <Section title="Unit dan jadwal">
        <Field label="Unit">
          <select className={inputCls} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Pilih mobil…</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand_model} · {v.plate_number} · {rupiah(v.daily_rate)}/hari{v.status === 'maintenance' ? ' (servis)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Layanan">
          <Chips value={layanan} onChange={setLayanan} options={[['lepas_kunci', 'Lepas kunci'], ['dengan_sopir', 'Dengan sopir']]} />
        </Field>
        {layanan === 'dengan_sopir' && (
          <Field label="Biaya sopir per hari"><input className={inputCls} inputMode="numeric" value={driverFee} onChange={(e) => setDriverFee(e.target.value)} /></Field>
        )}
        <Field label="Durasi">
          <Chips value={durasi} onChange={setDurasi} options={Object.entries(DURASI).map(([k, d]) => [k, d.label])} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={durasi === '7d' ? 'Jumlah minggu' : durasi === '12h' ? 'Jumlah paket 12 jam' : 'Jumlah hari'}>
            <input className={inputCls} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label="Mulai"><input className={inputCls} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        </div>
        {validTime && <p className="text-sm text-ink/70">Selesai: <b>{tglJam(endDate)}</b></p>}
        {conflict && (
          <Alert tone="danger">
            Bentrok! {vehicle?.plate_number} sudah dipesan {conflict.customer_name} ({tglJam(conflict.start_datetime)} – {tglJam(conflict.end_datetime)}).
          </Alert>
        )}
      </Section>

      <Section title="Biaya">
        <div className="grid grid-cols-2 gap-3">
          <Field label="DP dibayar"><input className={inputCls} inputMode="numeric" value={dp} onChange={(e) => setDp(e.target.value)} /></Field>
          <Field label="Deposit"><input className={inputCls} inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></Field>
        </div>
        <dl className="text-sm space-y-1.5 border-t border-line pt-3">
          <div className="flex justify-between"><dt>Sewa</dt><dd>{rupiah(calc.sewa)}</dd></div>
          {calc.sopir > 0 && <div className="flex justify-between"><dt>Sopir</dt><dd>{rupiah(calc.sopir)}</dd></div>}
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{rupiah(calc.total)}</dd></div>
          <div className="flex justify-between"><dt>DP</dt><dd>- {rupiah(Number(dp) || 0)}</dd></div>
          <div className="flex justify-between text-base font-bold text-petrol"><dt>Sisa tagihan</dt><dd>{rupiah(calc.sisa)}</dd></div>
          <p className="text-xs text-ink/60 pt-1">Denda overtime: {DENDA_PER_JAM * 100}% tarif harian per jam setelah toleransi {GRACE_MENIT} menit.</p>
        </dl>
      </Section>

      {error && <Alert>{error}</Alert>}
      <button onClick={simpan} disabled={busy || !found} className={`${btnPrimary} w-full`}>{busy ? 'Menyimpan…' : 'Simpan pesanan'}</button>
      {!found && <p className="text-center text-sm text-ink/60">Cari pelanggan dulu dengan NIK atau No WhatsApp, atau ketuk ikon WhatsApp untuk pilih kontak dan foto KTP.</p>}
      <ScanKtpSheet open={scanOpen} onClose={() => setScanOpen(false)} onResult={terapkanScan} />
    </main>
  );
}

export default function SewaPage() { return <Suspense><Form /></Suspense>; }
