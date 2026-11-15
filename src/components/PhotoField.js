'use client';
import { useEffect, useState } from 'react';
import { Camera, Check } from 'lucide-react';

export default function PhotoField({ label, file, url, onChange, camera = true }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const src = preview || url;
  return (
    <label className="relative block aspect-[4/3] rounded-xl border border-dashed border-ink/30 bg-white overflow-hidden cursor-pointer">
      <input type="file" accept="image/*" {...(camera ? { capture: 'environment' } : {})} className="sr-only"
        onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="w-full h-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-ink/50"><Camera size={26} /></span>
      )}
      <span className="absolute bottom-0 inset-x-0 bg-ink/70 text-white text-xs font-medium px-2 py-1 flex items-center justify-between">
        {label}{src && <Check size={14} />}
      </span>
    </label>
  );
}
