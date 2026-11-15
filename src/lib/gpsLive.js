'use client';
import { useEffect, useMemo, useState } from 'react';

// Ambil nilai dari JSON dengan path bertitik, mis. "data.0.speed" atau "position.lat"
const ambil = (obj, path) => (path || '').split('.').filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), obj);
const KONVERSI = { kmh: 1, knot: 1.852, ms: 3.6 };

/**
 * Untuk unit yang mengisi `gps_api_url`, aplikasi mengambil data tiap 30 detik saat halaman terbuka
 * dan menimpa lat/lng/speed unit itu (hanya di layar, tidak ditulis ke database).
 * Catatan: server GPS harus mengizinkan akses dari browser (CORS). Kalau tidak, data tidak bisa diambil.
 */
export function useLiveGps(vehicles) {
  const [live, setLive] = useState({});
  const sumber = vehicles.filter((v) => v.gps_api_url);
  const key = sumber.map((v) => [v.id, v.gps_api_url, v.gps_path_lat, v.gps_path_lng, v.gps_path_speed, v.gps_speed_unit].join('~')).join('|');

  useEffect(() => {
    if (!sumber.length) return;
    let alive = true;
    async function tick() {
      if (document.visibilityState === 'hidden') return;
      const hasil = {};
      await Promise.all(sumber.map(async (v) => {
        try {
          const r = await fetch(v.gps_api_url, { cache: 'no-store' });
          const j = await r.json();
          const lat = Number(ambil(j, v.gps_path_lat));
          const lng = Number(ambil(j, v.gps_path_lng));
          const sp = Number(ambil(j, v.gps_path_speed));
          const o = { gps_live_ok: true, speed_updated_at: new Date() };
          if (Number.isFinite(lat) && Number.isFinite(lng) && v.gps_path_lat) { o.lat = lat; o.lng = lng; }
          if (Number.isFinite(sp) && v.gps_path_speed) o.speed_kmh = sp * (KONVERSI[v.gps_speed_unit] || 1);
          hasil[v.id] = o;
        } catch { hasil[v.id] = { gps_live_ok: false }; }
      }));
      if (alive) setLive((p) => ({ ...p, ...hasil }));
    }
    tick();
    const t = setInterval(tick, 30000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(() => vehicles.map((v) => (live[v.id]?.gps_live_ok ? { ...v, ...live[v.id] } : v)), [vehicles, live]);
}
