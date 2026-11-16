import { redirect } from 'next/navigation';

// Fitur cadangan sudah pindah ke halaman Laporan (ikon unduh di bagian atas).
export default function CadanganPage() { redirect('/laporan'); }
