'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarDays, Plus, MapPin, BarChart3 } from 'lucide-react';

const ITEMS = [
  { href: '/', label: 'Beranda', Icon: Home },
  { href: '/jadwal', label: 'Jadwal', Icon: CalendarDays },
  { href: '/sewa', label: 'Sewa', Icon: Plus, primary: true },
  { href: '/armada', label: 'Armada', Icon: MapPin },
  { href: '/laporan', label: 'Laporan', Icon: BarChart3 },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-[1000] bg-white border-t border-line pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5 max-w-lg mx-auto">
        {ITEMS.map(({ href, label, Icon, primary }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center justify-end h-16 pb-2 gap-0.5 text-xs font-medium">
                {primary ? (
                  <span className="-mt-6 w-14 h-14 rounded-full bg-petrol text-white grid place-items-center shadow-lg ring-4 ring-mist">
                    <Icon size={26} />
                  </span>
                ) : (
                  <Icon size={22} className={active ? 'text-petrol' : 'text-ink/50'} />
                )}
                <span className={active || primary ? 'text-petrol' : 'text-ink/60'}>{primary ? '+Sewa' : label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
