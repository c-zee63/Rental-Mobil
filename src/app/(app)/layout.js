'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BottomNav from '@/components/BottomNav';
import HelpGuide from '@/components/HelpGuide';
import { BusinessProvider } from '@/context/BusinessContext';

export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [user, loading, router]);

  if (loading || !user) {
    return <div className="min-h-dvh grid place-items-center text-ink/60">Memuat…</div>;
  }
  return (
    <BusinessProvider>
      <div className="max-w-lg mx-auto min-h-dvh pb-24">
        {children}
        <BottomNav />
        <HelpGuide />
      </div>
    </BusinessProvider>
  );
}
