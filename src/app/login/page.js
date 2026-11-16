'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

const PESAN = {
  'auth/invalid-credential': 'Email atau kata sandi salah.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
  'auth/network-request-failed': 'Tidak ada sinyal. Periksa koneksi lalu coba lagi.',
};

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  useEffect(() => { if (user) router.replace('/'); }, [user, router]);

  async function lupa() {
    setError(''); setInfo('');
    if (!email) return setError('Isi email dulu, lalu tekan “Lupa sandi”.');
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo('Tautan reset sandi dikirim ke email tersebut. Periksa juga folder spam.');
    } catch (err) { setError(err.code === 'auth/invalid-email' ? 'Format email tidak valid.' : 'Tautan reset gagal dikirim. Coba lagi.'); }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); }
    catch (err) { setError(PESAN[err.code] || 'Gagal masuk. Coba lagi.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-petrol text-white grid place-items-center mb-6">
        <Car size={28} />
      </div>
      <h1 className="font-display text-3xl font-bold leading-tight">Masuk ke armada Anda</h1>
      <p className="text-ink/70 mt-2 mb-8">Kelola jadwal, serah terima, dan laporan dari satu tempat.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full h-12 rounded-xl border border-line bg-white px-4 focus:outline-none focus:ring-2 focus:ring-petrol" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Kata sandi</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full h-12 rounded-xl border border-line bg-white px-4 focus:outline-none focus:ring-2 focus:ring-petrol" />
        </label>
        {error && <p role="alert" className="text-sm text-signal bg-signal-soft rounded-lg px-3 py-2">{error}</p>}
        <button disabled={busy} className="w-full h-12 rounded-xl bg-petrol text-white font-semibold active:bg-petrol-dark disabled:opacity-60">
          {busy ? 'Memproses…' : 'Masuk'}
        </button>
        {info && <p className="text-sm text-petrol-dark bg-petrol-soft rounded-lg px-3 py-2">{info}</p>}
        <button type="button" onClick={lupa} className="w-full text-sm font-semibold text-petrol py-2">Lupa sandi?</button>
      </form>
    </main>
  );
}
