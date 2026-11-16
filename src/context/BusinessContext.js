'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const Ctx = createContext({});
export const useBusiness = () => useContext(Ctx);

// Profil usaha (nama, alamat, telepon, logo, rekening) dari dokumen settings/business
export function BusinessProvider({ children }) {
  const [biz, setBiz] = useState({});
  useEffect(() => onSnapshot(doc(db, 'settings', 'business'), (s) => setBiz(s.data() || {}), () => {}), []);
  return <Ctx.Provider value={biz}>{children}</Ctx.Provider>;
}
