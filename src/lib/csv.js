import { toDate, toISODate } from '@/lib/format';

// Pemisah titik koma (;) agar langsung rapi di Excel berbahasa Indonesia.
export function toCsv(rows, cols) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [cols.map((c) => c.h).join(';'), ...rows.map((r) => cols.map((c) => esc(c.f(r))).join(';'))].join('\r\n');
}

export function download(name, text, mime = 'text/csv;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const dt = (v) => {
  const d = toDate(v);
  return d ? `${toISODate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
};
