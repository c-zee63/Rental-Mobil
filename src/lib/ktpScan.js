// Membaca NIK dan nama dari foto KTP langsung di browser (OCR Tesseract.js).
// Mesin OCR dimuat sekali saat dipakai (butuh internet pertama kali), lalu di-cache browser.

// Karakter yang sering salah dibaca OCR saat seharusnya angka
const MIRIP = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', i: '1', '|': '1', '!': '1', Z: '2', z: '2', S: '5', s: '5', B: '8', b: '6', G: '6', g: '9', q: '9' };
const KELAS_ANGKA = '0-9OoDQIil|!ZzSsBbGg';
const keDigit = (s) => s.split('').map((c) => (/\d/.test(c) ? c : MIRIP[c] ?? '')).join('');

const RE_LABEL_NIK = /n\s*[i1l!|]\s*k\b\s*[:;.\-]?/i;
const RE_LABEL_NAMA = /^[^A-Za-z]*n\s*[a4]\s*(?:m|rn|rm)\s*[a4]\b\s*[:;.,\-]?\s*(.*)$/i;
const KATA_LABEL = /(nama|tempat|tgl|lahir|jenis|kelamin|alamat|gol|darah|rt\/?rw|kel\/?desa|kecamatan|agama|status|perkawinan|pekerjaan|kewarganegaraan|berlaku|provinsi|kabupaten|kota|nik)/i;

function bersihkanNama(s) {
  return String(s || '')
    .replace(/[^A-Za-z .,'\-]/g, ' ')
    .replace(/^[\s.,'\-]+|[\s.,'\-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function parseKtp(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // ---- NIK ----
  let nik = '', nikIdx = -1, terbaikSelisih = 99;
  lines.forEach((line, i) => {
    const m = line.match(RE_LABEL_NIK);
    const segmen = (m ? line.slice(m.index + m[0].length) : line).replace(/[\s.:,;\-]/g, '');
    const run = segmen.match(new RegExp(`[${KELAS_ANGKA}]{13,20}`));
    if (!run) return;
    const digit = keDigit(run[0]);
    const angkaAsli = (run[0].match(/\d/g) || []).length;
    if (angkaAsli < run[0].length / 2) return; // kebanyakan huruf: bukan NIK
    const selisih = Math.abs(digit.length - 16) - (m ? 0.5 : 0); // baris berlabel NIK diprioritaskan
    if (selisih < terbaikSelisih) { terbaikSelisih = selisih; nik = digit; nikIdx = i; }
  });
  if (nik.length > 16) nik = nik.slice(0, 16);

  // ---- Nama ----
  let nama = '';
  for (let i = 0; i < lines.length && !nama; i++) {
    const m = lines[i].match(RE_LABEL_NAMA);
    if (!m) continue;
    let v = bersihkanNama(m[1]);
    if (v.length < 3 && lines[i + 1] && !KATA_LABEL.test(lines[i + 1])) v = bersihkanNama(lines[i + 1]);
    if (v.length >= 3) nama = v;
  }
  if (!nama && nikIdx >= 0) { // cadangan: baris berikutnya setelah NIK yang tampak seperti nama
    for (const l of lines.slice(nikIdx + 1, nikIdx + 3)) {
      const v = bersihkanNama(l);
      if (v.length >= 3 && !KATA_LABEL.test(l)) { nama = v; break; }
    }
  }
  return { nik, nama };
}

// ---------- Persiapan gambar ----------
async function muatGambar(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* lanjut ke cara lama */ }
  }
  return new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(u), 1000); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Foto tidak bisa dibuka')); };
    img.src = u;
  });
}

// Skala abu-abu + regangan kontras agar teks lebih tegas dari latar KTP yang bermotif
function siapkanCanvas(img, putar = 0) {
  const k = Math.min(2, 1800 / Math.max(img.width, img.height));
  const w = Math.round(img.width * k), h = Math.round(img.height * k);
  const c = document.createElement('canvas');
  const miring = putar % 180 !== 0;
  c.width = miring ? h : w; c.height = miring ? w : h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.translate(c.width / 2, c.height / 2); x.rotate((putar * Math.PI) / 180);
  x.drawImage(img, -w / 2, -h / 2, w, h);
  x.setTransform(1, 0, 0, 1, 0, 0);

  const id = x.getImageData(0, 0, c.width, c.height), d = id.data, hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0; d[i] = g; hist[g]++; }
  const n = d.length / 4; let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= n * 0.02) { hi = v; break; } }
  const skala = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const g = Math.max(0, Math.min(255, (d[i] - lo) * skala)); d[i] = d[i + 1] = d[i + 2] = g; }
  x.putImageData(id, 0, 0);
  return c;
}

const LABEL_STATUS = {
  'loading tesseract core': 'Memuat mesin pembaca…', 'initializing tesseract': 'Memuat mesin pembaca…',
  'loading language traineddata': 'Mengunduh data bahasa (sekali saja)…', 'initializing api': 'Menyiapkan…',
};

/** Mengembalikan { nik, nama }. nik bisa kurang dari 16 digit bila foto kurang jelas. */
export async function bacaKtp(file, onStatus = () => {}) {
  onStatus('Menyiapkan foto…');
  const img = await muatGambar(file);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onStatus(`Membaca KTP… ${Math.round((m.progress || 0) * 100)}%`);
      else if (LABEL_STATUS[m.status]) onStatus(LABEL_STATUS[m.status]);
    },
  });
  try {
    // Foto tegak (portrait): coba putar 90° / 270° bila NIK belum ketemu
    const urutan = img.height > img.width ? [90, 270, 0] : [0];
    let hasil = { nik: '', nama: '' };
    for (const putar of urutan) {
      const { data } = await worker.recognize(siapkanCanvas(img, putar));
      const r = parseKtp(data.text);
      if (r.nik.length > hasil.nik.length) hasil.nik = r.nik;
      if (!hasil.nama && r.nama) hasil.nama = r.nama;
      if (hasil.nik.length === 16 && hasil.nama) break;
    }
    return hasil;
  } finally {
    await worker.terminate();
    if (img.close) img.close();
  }
}
