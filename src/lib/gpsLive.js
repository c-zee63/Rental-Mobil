'use client';
import { useEffect, useMemo, useState } from 'react';

// Ambil nilai dari JSON dengan path bertitik, mis. "data.lat" atau "0.latitude" (angka = indeks array)
export const ambil = (obj, path) => (path || '').split('.').filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), obj);
const KONVERSI = { kmh: 1, knot: 1.852, ms: 3.6 };

export function bangunRequest(v) {
  const url = (v.gps_api_url || '').trim().split('{device_id}').join(encodeURIComponent(v.gps_device_id || ''));
  const headers = { Accept: 'application/json' };
  const tipe = v.gps_auth_type;
  const val = (v.gps_auth_value || '').trim();
  if (tipe === 'bearer' && val) headers.Authorization = `Bearer ${val}`;
  else if (tipe === 'basic' && val) headers.Authorization = `Basic ${btoa(unescape(encodeURIComponent(val)))}`;
  else if (tipe === 'header' && val.includes(':')) {
    const i = val.indexOf(':');
    headers[val.slice(0, i).trim()] = val.slice(i + 1).trim();
  }
  return { url, headers };
}

function bacaWaktu(x) {
  if (x == null || x === '') return new Date();
  const d = typeof x === 'number' ? new Date(x < 1e12 ? x * 1000 : x) : new Date(x);
  return isNaN(d) ? new Date() : d;
}

/** Ambil & urai satu kali. Melempar Error bila gagal. */
export async function bacaGps(v) {
  const { url, headers } = bangunRequest(v);
  if (!url) throw new Error('URL data GPS belum diisi.');
  let r;
  try { r = await fetch(url, { headers, cache: 'no-store' }); }
  catch { throw new Error('Tidak bisa terhubung. Kemungkinan: alamat salah, server belum mengizinkan akses dari browser (CORS), atau alamat memakai http:// padahal aplikasi memakai https://.'); }
  if (r.status === 401 || r.status === 403) throw new Error(`Ditolak server (${r.status}). Periksa jenis dan isi autentikasi.`);
  if (!r.ok) throw new Error(`Server membalas ${r.status}.`);
  let j;
  try { j = await r.json(); } catch { throw new Error('Balasan server bukan JSON (mungkin halaman web biasa).'); }
  const lat = Number(ambil(j, v.gps_path_lat)), lng = Number(ambil(j, v.gps_path_lng)), sp = Number(ambil(j, v.gps_path_speed));
  return {
    raw: j,
    lat: v.gps_path_lat && Number.isFinite(lat) ? lat : null,
    lng: v.gps_path_lng && Number.isFinite(lng) ? lng : null,
    speed_kmh: v.gps_path_speed && Number.isFinite(sp) ? sp * (KONVERSI[v.gps_speed_unit] || 1) : null,
    waktu: bacaWaktu(v.gps_path_time ? ambil(j, v.gps_path_time) : null),
  };
}

/**
 * Untuk unit yang mengisi `gps_api_url`, aplikasi mengambil data berkala saat halaman terbuka
 * dan menimpa lat/lng/speed unit itu di layar (tidak ditulis ke database).
 */
export function useLiveGps(vehicles) {
  const [live, setLive] = useState({});
  const sumber = vehicles.filter((v) => v.gps_api_url);
  const key = sumber.map((v) => [v.id, v.gps_api_url, v.gps_device_id, v.gps_auth_type, v.gps_auth_value, v.gps_path_lat, v.gps_path_lng, v.gps_path_speed, v.gps_path_time, v.gps_speed_unit, v.gps_poll_sec].join('~')).join('|');

  useEffect(() => {
    if (!sumber.length) return;
    let alive = true;
    const detik = Math.max(15, Math.min(...sumber.map((v) => Number(v.gps_poll_sec) || 30)));
    async function tick() {
      if (document.visibilityState === 'hidden') return;
      const hasil = {};
      await Promise.all(sumber.map(async (v) => {
        try {
          const g = await bacaGps(v);
          const o = { gps_live_ok: true, speed_updated_at: g.waktu };
          if (g.lat != null && g.lng != null) { o.lat = g.lat; o.lng = g.lng; }
          if (g.speed_kmh != null) o.speed_kmh = g.speed_kmh;
          hasil[v.id] = o;
        } catch { hasil[v.id] = { gps_live_ok: false }; }
      }));
      if (alive) setLive((p) => ({ ...p, ...hasil }));
    }
    tick();
    const t = setInterval(tick, detik * 1000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(() => vehicles.map((v) => (live[v.id]?.gps_live_ok ? { ...v, ...live[v.id] } : v)), [vehicles, live]);
}
