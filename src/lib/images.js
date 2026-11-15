import imageCompression from 'browser-image-compression';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Kompres ke <= ~160KB (batas aturan: 250KB). Foto disimpan sebagai teks base64 di Firestore,
// jadi tidak perlu Firebase Storage / paket Blaze.
export function compressImage(file) {
  return imageCompression(file, {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 1400,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8,
  });
}

export async function toDataUrl(file) {
  const blob = await compressImage(file);
  const data = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  if (data.length > 350000) throw new Error('Foto terlalu besar setelah dikompres');
  return data;
}

// Tulis Firestore dengan offline persistence: promise baru selesai saat server mengonfirmasi.
// Saat sinyal lemah kita tidak menunggu — data sudah antre di perangkat & tersinkron otomatis.
export const writeSafe = (p, ms = 4000) =>
  Promise.race([p, new Promise((res) => setTimeout(res, ms))]);

// Foto disimpan di koleksi `images` (dokumen terpisah) agar dokumen pelanggan/biaya tetap kecil.
export async function saveImage(id, data, meta = {}) {
  await writeSafe(setDoc(doc(db, 'images', id), { ...meta, data, created_at: Timestamp.now() }));
  return id;
}
export async function loadImage(id) {
  if (!id) return '';
  try { return (await getDoc(doc(db, 'images', id))).data()?.data || ''; } catch { return ''; }
}
