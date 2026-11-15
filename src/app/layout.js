import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import RegisterSW from '@/components/RegisterSW';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body' });

export const metadata = {
  title: 'Rental Mobil',
  description: 'Manajemen rental mobil untuk owner-operator',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Rental Mobil', statusBarStyle: 'default' },
  icons: { apple: '/icons/icon-192.png' },
};
export const viewport = {
  themeColor: '#0E5A52',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans antialiased">
        <RegisterSW />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
