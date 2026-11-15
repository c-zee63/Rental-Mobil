'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Chips, inputCls } from '@/components/ui';
import { rupiah } from '@/lib/format';

const JENIS = ['Kerusakan', 'BBM kurang', 'Cuci', 'Lainnya'].map((x) => [x, x]);

// Daftar biaya tambahan saat unit kembali: kerusakan, BBM kurang, cuci, dll.
export default function ExtraFeesEditor({ items, onChange }) {
  const [label, setLabel] = useState('Kerusakan');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  function tambah() {
    const a = Number(amount);
    if (!a) return;
    onChange([...items, { label: note.trim() ? `${label} (${note.trim()})` : label, amount: a }]);
    setAmount(''); setNote('');
  }

  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between bg-mist rounded-lg px-3 py-2 text-sm">
          <span>{it.label}</span>
          <span className="flex items-center gap-3 font-semibold">{rupiah(it.amount)}
            <button type="button" aria-label="Hapus" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-signal"><Trash2 size={16} /></button>
          </span>
        </div>
      ))}
      <Chips options={JENIS} value={label} onChange={setLabel} />
      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} inputMode="numeric" placeholder="Nominal (Rp)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className={inputCls} placeholder="Keterangan" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button type="button" onClick={tambah} className="h-11 w-full rounded-xl border border-petrol text-petrol font-semibold">+ Tambah biaya</button>
    </div>
  );
}
