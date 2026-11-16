'use client';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { collection, deleteDoc, doc, setDoc, Timestamp } from 'firebase/firestore';
import { LocateFixed, Pencil, Plus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useFleet } from '@/lib/useFleet';
import { useLiveGps, bacaGps } from '@/lib/gpsLive';
import { writeSafe } from '@/lib/images';
import { rupiah, tglPendek, toDate, toISODate } from '@/lib/format';
import { Alert, Chips, Field, Sheet, btnPrimary, inputCls } from '@/components/ui';

// Leaflet butuh `window` -> wajib client-only
const MapGpsView = dynamic(() => import('@/components/MapGpsView'), {
  ssr: false,
  loading: () => <div className="h-[60dvh] rounded-2xl bg-white border border-line grid place-items-center text-ink/60">Memuat peta…</div>,
});

const STATUS = { available: 'Available', on_rent: 'On-Rent', maintenance: 'Servis' };
const KOSONG = { plate_number: '', brand_model: '', daily_rate: '', status: 'available', current_odometer: '', next_service_odometer: '', tax_due_date: '', lat: '', lng: '', gps_external_url: '', gps_vendor: '', gps_device_id: '', gps_share_url: '', gps_api_url: '', gps_auth_type: 'none', gps_auth_value: '', gps_path_lat: '', gps_path_lng: '', gps_path_speed: '', gps_path_time: '', gps_speed_unit: 'kmh', gps_poll_sec: 30 };

const PRESET = {
  // Traccar menyimpan kecepatan dalam knot; /api/positions mengembalikan daftar posisi terbaru
  traccar: { gps_mode: 'api', gps_vendor: 'Traccar', gps_auth_type: 'basic', gps_path_lat: '0.latitude', gps_path_lng: '0.longitude', gps_path_speed: '0.speed', gps_path_time: '0.fixTime', gps_speed_unit: 'knot', gps_api_url: 'https://SERVER-ANDA/api/positions?deviceId={device_id}' },
  kosong: { gps_api_url: '', gps_auth_type: 'none', gps_auth_value: '', gps_path_lat: '', gps_path_lng: '', gps_path_speed: '', gps_path_time: '', gps_speed_unit: 'kmh' },
};

function VehicleSheet({ open, vehicle, onClose }) {
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tes, setTes] = useState(null);
  const cur = f ?? (vehicle ? { ...KOSONG, ...vehicle, tax_due_date: toISODate(toDate(vehicle.tax_due_date)) } : KOSONG);
  const set = (k) => (e) => setF({ ...cur, [k]: e.target.value });

  async function ujiGps() {
    setTes({ loading: true });
    try { setTes({ ok: true, r: await bacaGps(cur) }); } catch (e) { setTes({ ok: false, msg: e.message }); }
  }

  function close() { setF(null); setErr(''); onClose(); }

  function lokasiSaya() {
    navigator.geolocation?.getCurrentPosition(
      (p) => setF({ ...cur, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }),
      () => setErr('Lokasi tidak bisa diambil. Izinkan akses lokasi di browser.'));
  }

  async function simpan() {
    if (!cur.plate_number.trim() || !cur.brand_model.trim() || !Number(cur.daily_rate)) return setErr('Plat, model, dan tarif harian wajib diisi.');
    setBusy(true);
    const num = (x) => (x === '' || x == null ? null : Number(x));
    const data = {
      plate_number: cur.plate_number.trim().toUpperCase(), brand_model: cur.brand_model.trim(), daily_rate: Number(cur.daily_rate),
      status: cur.status, current_odometer: num(cur.current_odometer) ?? 0, next_service_odometer: num(cur.next_service_odometer),
      tax_due_date: cur.tax_due_date ? Timestamp.fromDate(new Date(`${cur.tax_due_date}T00:00`)) : null,
      lat: num(cur.lat), lng: num(cur.lng), gps_external_url: (cur.gps_external_url || '').trim(),
      gps_vendor: (cur.gps_vendor || '').trim(), gps_device_id: (cur.gps_device_id || '').trim(), gps_share_url: (cur.gps_share_url || '').trim(),
      gps_api_url: (cur.gps_mode === 'link' ? '' : (cur.gps_api_url || '')).trim(), gps_auth_type: cur.gps_auth_type || 'none', gps_auth_value: (cur.gps_auth_value || '').trim(),
      gps_path_lat: (cur.gps_path_lat || '').trim(), gps_path_lng: (cur.gps_path_lng || '').trim(), gps_path_speed: (cur.gps_path_speed || '').trim(), gps_path_time: (cur.gps_path_time || '').trim(),
      gps_speed_unit: cur.gps_speed_unit || 'kmh', gps_poll_sec: Number(cur.gps_poll_sec) || 30,
    };
    await writeSafe(setDoc(vehicle ? doc(db, 'vehicles', vehicle.id) : doc(collection(db, 'vehicles')), data, { merge: true }));
    setBusy(false); close();
  }

  async function hapus() {
    if (!confirm(`Hapus unit ${vehicle.plate_number}? Riwayat pesanan tetap tersimpan.`)) return;
    await writeSafe(deleteDoc(doc(db, 'vehicles', vehicle.id)));
    close();
  }

  return (
    <Sheet open={open} onClose={close} title={vehicle ? 'Ubah unit' : 'Unit baru'}>
      <div className="space-y-3">
        <Field label="Plat nomor"><input className={inputCls} value={cur.plate_number} onChange={set('plate_number')} /></Field>
        <Field label="Merek / model"><input className={inputCls} value={cur.brand_model} onChange={set('brand_model')} /></Field>
        <Field label="Tarif harian (Rp)"><input className={inputCls} inputMode="numeric" value={cur.daily_rate} onChange={set('daily_rate')} /></Field>
        <Field label="Status"><Chips value={cur.status} onChange={(v) => setF({ ...cur, status: v })} options={Object.entries(STATUS)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Odometer (km)"><input className={inputCls} inputMode="numeric" value={cur.current_odometer} onChange={set('current_odometer')} /></Field>
          <Field label="Ganti oli di (km)"><input className={inputCls} inputMode="numeric" value={cur.next_service_odometer ?? ''} onChange={set('next_service_odometer')} /></Field>
        </div>
        <Field label="Jatuh tempo pajak STNK"><input className={inputCls} type="date" value={cur.tax_due_date} onChange={set('tax_due_date')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude"><input className={inputCls} inputMode="decimal" value={cur.lat ?? ''} onChange={set('lat')} /></Field>
          <Field label="Longitude"><input className={inputCls} inputMode="decimal" value={cur.lng ?? ''} onChange={set('lng')} /></Field>
        </div>
        <button type="button" onClick={lokasiSaya} className="flex items-center gap-2 text-petrol font-semibold text-sm"><LocateFixed size={16} /> Pakai lokasi HP saya</button>
        <div className="rounded-2xl border border-line bg-white p-3 space-y-3">
          <p className="font-display font-bold">Pelacakan GPS (opsional)</p>
          <p className="text-xs text-ink/60">Isi sesuai yang disediakan vendor GPS Anda. Cukup isi yang ada; kolom lain boleh kosong. Panduan lengkap ada di ikon “?”.</p>
          <Field label="Nama vendor / aplikasi GPS"><input className={inputCls} value={cur.gps_vendor ?? ''} onChange={set('gps_vendor')} placeholder="Mis. Traccar, Wialon, GPSWOX, Sinotrack" /></Field>
          <Field label="ID perangkat / IMEI" hint="Bisa dipakai sebagai {device_id} di URL data."><input className={inputCls} value={cur.gps_device_id ?? ''} onChange={set('gps_device_id')} /></Field>

          <p className="font-semibold text-sm pt-1">A. Link (paling mudah, hampir semua vendor punya)</p>
          <Field label="Link buka aplikasi / web GPS" hint="Tombol “Buka aplikasi GPS” di peta."><input className={inputCls} type="url" placeholder="https://" value={cur.gps_external_url ?? ''} onChange={set('gps_external_url')} /></Field>
          <Field label="Link pantau publik (share link)" hint="Link berbagi lokasi dari vendor, bisa dibuka tanpa login. Tombol “Pantau langsung” di peta."><input className={inputCls} type="url" placeholder="https://" value={cur.gps_share_url ?? ''} onChange={set('gps_share_url')} /></Field>

          <p className="font-semibold text-sm pt-1">B. Data otomatis (hanya jika vendor punya API JSON)</p>
          <Chips value={cur.gps_mode || (cur.gps_api_url ? 'api' : 'link')} onChange={(v) => setF({ ...cur, gps_mode: v })} options={[['link', 'Tidak dipakai'], ['api', 'Pakai API JSON']]} />
          {(cur.gps_mode || (cur.gps_api_url ? 'api' : 'link')) === 'api' && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">Isi cepat</p>
                <Chips value="" onChange={(v) => setF({ ...cur, ...PRESET[v] })} options={[['traccar', 'Traccar'], ['kosong', 'Kosongkan isian']]} />
              </div>
              <Field label="URL data GPS" hint="Boleh memakai {device_id}. Harus https:// dan server vendor harus mengizinkan akses dari browser (CORS)."><input className={inputCls} type="url" placeholder="https://" value={cur.gps_api_url ?? ''} onChange={set('gps_api_url')} /></Field>
              <Field label="Autentikasi"><Chips value={cur.gps_auth_type || 'none'} onChange={(v) => setF({ ...cur, gps_auth_type: v })} options={[['none', 'Tanpa / token di URL'], ['bearer', 'Bearer token'], ['basic', 'Username:Sandi'], ['header', 'Header lain']]} /></Field>
              {(cur.gps_auth_type || 'none') !== 'none' && (
                <Field label={{ bearer: 'Token', basic: 'username:sandi', header: 'Nama-Header: nilai' }[cur.gps_auth_type]} hint="Tersimpan di database Anda dan hanya terlihat setelah login.">
                  <input className={inputCls} value={cur.gps_auth_value ?? ''} onChange={set('gps_auth_value')} autoComplete="off" />
                </Field>
              )}
              <p className="text-xs text-ink/60">Lokasi nilai di dalam JSON, ditulis dengan titik. Contoh: <b>0.latitude</b> (angka = urutan data pertama), <b>data.speed</b>.</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Path latitude"><input className={inputCls} value={cur.gps_path_lat ?? ''} onChange={set('gps_path_lat')} /></Field>
                <Field label="Path longitude"><input className={inputCls} value={cur.gps_path_lng ?? ''} onChange={set('gps_path_lng')} /></Field>
                <Field label="Path kecepatan"><input className={inputCls} value={cur.gps_path_speed ?? ''} onChange={set('gps_path_speed')} /></Field>
                <Field label="Path waktu data"><input className={inputCls} value={cur.gps_path_time ?? ''} onChange={set('gps_path_time')} /></Field>
              </div>
              <Field label="Satuan kecepatan dari vendor"><Chips value={cur.gps_speed_unit || 'kmh'} onChange={(v) => setF({ ...cur, gps_speed_unit: v })} options={[['kmh', 'km/jam'], ['knot', 'knot'], ['ms', 'm/s']]} /></Field>
              <Field label="Ambil data tiap"><Chips value={String(cur.gps_poll_sec || 30)} onChange={(v) => setF({ ...cur, gps_poll_sec: Number(v) })} options={[['15', '15 detik'], ['30', '30 detik'], ['60', '60 detik']]} /></Field>
              <button type="button" onClick={ujiGps} className="w-full h-11 rounded-xl border border-petrol text-petrol font-semibold">{tes?.loading ? 'Menguji…' : 'Uji koneksi'}</button>
              {tes && !tes.loading && (tes.ok ? (
                <div className="rounded-xl bg-petrol-soft text-petrol-dark p-3 text-sm space-y-1">
                  <p className="font-semibold">Berhasil terhubung</p>
                  <p>Lat {tes.r.lat ?? '-'} · Lng {tes.r.lng ?? '-'} · Kecepatan {tes.r.speed_kmh != null ? `${Math.round(tes.r.speed_kmh)} km/jam` : '-'}</p>
                  <p className="text-xs">Waktu data: {tes.r.waktu.toLocaleString('id-ID')}</p>
                  <details className="text-xs"><summary className="cursor-pointer">Lihat balasan mentah (untuk mencari path)</summary><pre className="whitespace-pre-wrap break-all mt-1">{JSON.stringify(tes.r.raw, null, 1).slice(0, 700)}</pre></details>
                </div>
              ) : <Alert>{tes.msg}</Alert>)}
            </div>
          )}
        </div>
        {err && <Alert>{err}</Alert>}
        <button onClick={simpan} disabled={busy} className={`${btnPrimary} w-full`}>Simpan unit</button>
        {vehicle && <button onClick={hapus} className="w-full text-signal font-semibold h-11">Hapus unit</button>}
      </div>
    </Sheet>
  );
}

function Content() {
  const { vehicles, bookings } = useFleet();
  const live = useLiveGps(vehicles);
  const focusId = useSearchParams().get('unit') || undefined;
  const [tab, setTab] = useState(focusId ? 'peta' : 'peta');
  const [edit, setEdit] = useState({ open: false, vehicle: null });

  return (
    <main className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Armada</h1>
        <button onClick={() => setEdit({ open: true, vehicle: null })} className="h-10 px-4 rounded-full bg-petrol text-white text-sm font-semibold flex items-center gap-1.5"><Plus size={16} /> Unit</button>
      </div>
      <Chips value={tab} onChange={setTab} options={[['peta', 'Peta GPS'], ['unit', 'Daftar unit']]} />

      {tab === 'peta' ? (
        <MapGpsView vehicles={live} bookings={bookings} focusId={focusId} />
      ) : (
        <ul className="space-y-2">
          {vehicles.map((v) => {
            const sisa = v.next_service_odometer ? v.next_service_odometer - (v.current_odometer || 0) : null;
            return (
              <li key={v.id} className="bg-white border border-line rounded-xl p-3 flex items-start justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{v.brand_model} <span className="font-normal text-ink/60">{v.plate_number}</span></p>
                  <p className="text-ink/70">{STATUS[v.status] || v.status} · {rupiah(v.daily_rate)}/hari · {(v.current_odometer || 0).toLocaleString('id-ID')} km</p>
                  <p className="text-ink/70">Oli {sisa != null ? `${sisa.toLocaleString('id-ID')} km lagi` : '-'} · Pajak {v.tax_due_date ? tglPendek(v.tax_due_date) : '-'}</p>
                </div>
                <button onClick={() => setEdit({ open: true, vehicle: v })} aria-label={`Ubah ${v.plate_number}`} className="w-10 h-10 shrink-0 grid place-items-center rounded-full border border-line"><Pencil size={16} /></button>
              </li>
            );
          })}
          {!vehicles.length && <p className="text-sm text-ink/60">Belum ada unit. Tekan “+ Unit” untuk menambah.</p>}
        </ul>
      )}
      <VehicleSheet key={edit.vehicle?.id || 'new'} open={edit.open} vehicle={edit.vehicle} onClose={() => setEdit({ open: false, vehicle: null })} />
    </main>
  );
}

export default function ArmadaPage() { return <Suspense><Content /></Suspense>; }
