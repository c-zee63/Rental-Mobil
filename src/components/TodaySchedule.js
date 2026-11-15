import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft, CalendarPlus } from 'lucide-react';
import { jam, toDate, awalHari, akhirHari } from '@/lib/format';

function Row({ b, mode }) {
  const keluar = mode === 'out';
  const waktu = toDate(keluar ? b.start_datetime : b.end_datetime);
  const terlambat = waktu < new Date();
  const Icon = keluar ? ArrowUpRight : ArrowDownLeft;
  const btn = 'h-10 px-4 rounded-lg text-sm font-semibold grid place-items-center';

  return (
    <li className="bg-white rounded-xl border border-line p-3 flex gap-3">
      <span className={`w-1.5 rounded-full ${keluar ? 'bg-petrol' : 'bg-amber'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold truncate">{b.vehicle_plate} <span className="font-normal text-ink/60">· {b.customer_name}</span></p>
          <p className={`text-sm font-semibold shrink-0 flex items-center gap-1 ${terlambat ? 'text-signal' : ''}`}>
            <Icon size={14} />{jam(waktu)}
          </p>
        </div>
        <p className="text-xs text-ink/60 mt-0.5">
          {b.booking_code} · {b.service_type === 'dengan_sopir' ? 'Dengan sopir' : 'Lepas kunci'}
          {terlambat && <span className="text-signal font-medium"> · Lewat jadwal</span>}
        </p>
        <div className="flex gap-2 mt-3">
          {keluar ? (
            <Link href={`/sewa/serah-terima?booking=${b.id}&type=checkout`} className={`${btn} flex-1 bg-petrol text-white`}>Serah Terima</Link>
          ) : (
            <>
              <Link href={`/sewa/serah-terima?booking=${b.id}&type=checkin`} className={`${btn} flex-1 bg-petrol text-white`}>Terima Unit</Link>
              <Link href={`/sewa/extend?booking=${b.id}`} className={`${btn} border border-line bg-white`}>Extend</Link>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function Group({ title, items, mode, empty }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="font-display font-bold text-lg">{title} <span className="text-ink/50 font-medium">({items.length})</span></h2>
      {items.length ? <ul className="space-y-2">{items.map((b) => <Row key={b.id} b={b} mode={mode} />)}</ul>
        : <p className="text-sm text-ink/60 bg-white/60 border border-dashed border-line rounded-xl p-4">{empty}</p>}
    </section>
  );
}

export default function TodaySchedule({ bookings }) {
  const akhir = akhirHari();
  const awal = awalHari();
  // Keluar: status 'booked' yang jadwalnya hari ini (atau sudah lewat tapi belum diserahkan)
  const keluar = bookings
    .filter((b) => b.status === 'booked' && toDate(b.start_datetime) <= akhir)
    .sort((a, b) => toDate(a.start_datetime) - toDate(b.start_datetime));
  // Kembali: status 'on_rent' yang jatuh tempo hari ini (atau sudah lewat/overtime)
  const kembali = bookings
    .filter((b) => b.status === 'on_rent' && toDate(b.end_datetime) <= akhir)
    .sort((a, b) => toDate(a.end_datetime) - toDate(b.end_datetime));

  return (
    <div className="space-y-6">
      <Group title="Mobil keluar" items={keluar} mode="out" empty="Belum ada unit yang harus diserahkan hari ini." />
      <Group title="Mobil kembali" items={kembali} mode="in" empty="Tidak ada unit yang jatuh tempo hari ini." />
      {!keluar.length && !kembali.length && (
        <Link href="/sewa" className="flex items-center justify-center gap-2 h-12 rounded-xl border border-petrol text-petrol font-semibold">
          <CalendarPlus size={18} /> Buat pesanan baru
        </Link>
      )}
    </div>
  );
}
