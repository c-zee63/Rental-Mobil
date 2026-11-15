'use client';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, Navigation } from 'lucide-react';
import { gmapsUrl, jam } from '@/lib/format';
import { isOverspeed, speedFresh, SPEED_LIMIT } from '@/lib/speed';

// Pusat default: Palu, Sulawesi Tengah (dipakai bila belum ada koordinat)
const DEFAULT_CENTER = [-0.8917, 119.8707];

const WARNA = { available: '#0E5A52', on_rent: '#D99A1E', maintenance: '#C93A2B' };
const LABEL = { available: 'Available', on_rent: 'On-Rent', maintenance: 'Servis' };

// Pin berupa divIcon (tanpa file gambar) -> tidak ada masalah path ikon default Leaflet di Next.js
function pinIcon(status, plate, over) {
  const c = over ? '#C93A2B' : WARNA[status] || '#16231F';
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
      <div style="background:${c};color:#fff;font:600 11px system-ui;padding:3px 7px;border-radius:8px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)">${plate}</div>
      <div style="width:0;height:0;border:5px solid transparent;border-top-color:${c}"></div></div>`,
  });
}

function FitBounds({ points, focusId, vehicles }) {
  const map = useMap();
  useEffect(() => {
    const focus = vehicles.find((v) => v.id === focusId);
    if (focus) return void map.setView([focus.lat, focus.lng], 16);
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40] });
  }, [points, focusId, vehicles, map]);
  return null;
}

/**
 * Props:
 *  - vehicles: dokumen 'vehicles' ({id, plate_number, brand_model, status, lat, lng, gps_external_url})
 *  - bookings: booking aktif (untuk menampilkan nama penyewa unit On-Rent)
 *  - focusId : (opsional) id kendaraan yang langsung di-zoom
 */
export default function MapGpsView({ vehicles = [], bookings = [], focusId }) {
  const located = useMemo(
    () => vehicles.filter((v) => Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)))
                  .map((v) => ({ ...v, lat: Number(v.lat), lng: Number(v.lng) })),
    [vehicles]
  );
  const points = useMemo(() => located.map((v) => [v.lat, v.lng]), [located]);
  const renterOf = (vid) => bookings.find((b) => b.vehicle_id === vid && b.status === 'on_rent')?.customer_name;
  const tanpaLokasi = vehicles.length - located.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs font-medium px-1">
        {Object.entries(LABEL).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full" style={{ background: WARNA[k] }} />{l}
          </span>
        ))}
        {tanpaLokasi > 0 && <span className="text-ink/60">· {tanpaLokasi} unit belum punya koordinat</span>}
      </div>

      <div className="h-[60dvh] rounded-2xl overflow-hidden border border-line">
        <MapContainer center={DEFAULT_CENTER} zoom={12} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} focusId={focusId} vehicles={located} />
          {located.map((v) => {
            const renter = v.status === 'on_rent' ? renterOf(v.id) : null;
            return (
              <Marker key={v.id} position={[v.lat, v.lng]} icon={pinIcon(v.status, v.plate_number, isOverspeed(v))}>
                <Popup>
                  <div className="space-y-1 min-w-[180px]">
                    <p className="font-bold text-base leading-tight">{v.brand_model}</p>
                    <p className="text-sm">{v.plate_number} · <b style={{ color: WARNA[v.status] }}>{LABEL[v.status] || v.status}</b></p>
                    {renter && <p className="text-sm">Penyewa: <b>{renter}</b></p>}
                    {speedFresh(v) && (
                      <p className="text-sm">Kecepatan: <b style={{ color: isOverspeed(v) ? '#C93A2B' : undefined }}>{Math.round(v.speed_kmh)} km/jam{isOverspeed(v) ? ` (melebihi ${SPEED_LIMIT})` : ''}</b> · {jam(v.speed_updated_at)}</p>
                    )}
                    <div className="flex flex-col gap-1.5 pt-2">
                      {v.gps_external_url && (
                        <a href={v.gps_external_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#0E5A52] !text-white text-sm font-semibold">
                          <ExternalLink size={14} /> Buka aplikasi GPS
                        </a>
                      )}
                      <a href={gmapsUrl(v.lat, v.lng)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-[#D5DCD8] text-sm font-semibold">
                        <Navigation size={14} /> Google Maps
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
