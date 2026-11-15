import Link from 'next/link';
import { Wrench, FileWarning, Gauge } from 'lucide-react';
import { hariKe, jam } from '@/lib/format';
import { SPEED_LIMIT, isOverspeed } from '@/lib/speed';

export const OIL_WARN_KM = 500; // peringatan saat sisa km ke servis <= 500
export const TAX_WARN_DAYS = 30; // H-30 pajak STNK

export function buildAlerts(vehicles) {
  const out = [];
  for (const v of vehicles) {
    if (isOverspeed(v)) out.push({ id: `spd-${v.id}`, type: 'speed', v, key: -Infinity });
    if (v.next_service_odometer && v.current_odometer != null) {
      const sisa = v.next_service_odometer - v.current_odometer;
      if (sisa <= OIL_WARN_KM) out.push({ id: `oil-${v.id}`, type: 'oil', v, sisa, key: sisa });
    }
    if (v.tax_due_date) {
      const h = hariKe(v.tax_due_date);
      if (h <= TAX_WARN_DAYS) out.push({ id: `tax-${v.id}`, type: 'tax', v, h, key: h * 30 });
    }
  }
  return out.sort((a, b) => a.key - b.key); // kecepatan dulu, lalu paling mendesak
}

export default function AlertCards({ vehicles }) {
  const alerts = buildAlerts(vehicles);
  if (!alerts.length) return null;

  return (
    <section aria-label="Perlu perhatian" className="space-y-2">
      <h2 className="font-display font-bold text-lg">Perlu perhatian</h2>
      {alerts.map((a) => {
        const lewat = a.type === 'speed' ? true : a.type === 'oil' ? a.sisa <= 0 : a.h < 0;
        const Icon = a.type === 'speed' ? Gauge : a.type === 'oil' ? Wrench : FileWarning;
        const teks =
          a.type === 'speed'
            ? `Melaju ${Math.round(a.v.speed_kmh)} km/jam (batas ${SPEED_LIMIT}) · ${jam(a.v.speed_updated_at)}`
            : a.type === 'oil'
            ? lewat ? `Ganti oli terlewat ${Math.abs(a.sisa).toLocaleString('id-ID')} km` : `Ganti oli ${a.sisa.toLocaleString('id-ID')} km lagi`
            : lewat ? `Pajak STNK terlewat ${Math.abs(a.h)} hari` : `Pajak STNK ${a.h} hari lagi`;
        return (
          <Link key={a.id} href={`/armada?unit=${a.v.id}`}
            className={`flex items-center gap-3 rounded-xl p-3 border ${lewat ? 'bg-signal-soft border-signal/30' : 'bg-amber-soft border-amber/40'}`}>
            <Icon size={22} className={lewat ? 'text-signal' : 'text-amber'} />
            <div className="min-w-0">
              <p className="font-semibold truncate">{a.v.brand_model} <span className="font-normal text-ink/60">{a.v.plate_number}</span></p>
              <p className="text-sm">{teks}</p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
