'use client';
import Link from 'next/link';
import { ClipboardList, LogOut, Settings, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFleet } from '@/lib/useFleet';
import { useLiveGps } from '@/lib/gpsLive';
import { tanggalPanjang } from '@/lib/format';
import AlertCards from '@/components/AlertCards';
import TodaySchedule from '@/components/TodaySchedule';

export default function BerandaPage() {
  const { logout, user } = useAuth();
  const { vehicles, bookings, ready } = useFleet();
  const live = useLiveGps(vehicles);

  const onRent = vehicles.filter((v) => v.status === 'on_rent').length;
  const tersedia = vehicles.filter((v) => v.status === 'available').length;

  return (
    <main className="px-4 pt-6 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink/60">{tanggalPanjang()}</p>
          {user?.email && <p className="text-xs text-ink/50">Masuk sebagai {user.email}</p>}
          <h1 className="font-display text-3xl font-bold leading-tight mt-1">
            {ready ? `${onRent} unit di jalan, ${tersedia} siap sewa` : 'Memuat armada…'}
          </h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={logout} aria-label="Keluar" className="w-10 h-10 grid place-items-center rounded-full bg-white border border-line">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <nav aria-label="Pintasan" className="grid grid-cols-3 gap-2">
        {[['/pesanan', 'Pesanan', ClipboardList], ['/pelanggan', 'Pelanggan', Users], ['/pengaturan', 'Pengaturan', Settings]].map(([h, l, Icon]) => (
          <Link key={h} href={h} className="bg-white border border-line rounded-xl h-14 flex items-center justify-center gap-2 text-sm font-semibold"><Icon size={18} className="text-petrol" />{l}</Link>
        ))}
      </nav>

      <AlertCards vehicles={live} />
      <TodaySchedule bookings={bookings} />
    </main>
  );
}
