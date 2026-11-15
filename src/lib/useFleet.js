'use client';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Realtime vehicles + booking aktif (booked / on_rent). Memakai cache offline Firestore.
export function useFleet() {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'vehicles'), (s) => {
      setVehicles(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      setReady(true);
    }, console.error);
    const u2 = onSnapshot(
      query(collection(db, 'bookings'), where('status', 'in', ['booked', 'on_rent'])),
      (s) => setBookings(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      console.error
    );
    return () => { u1(); u2(); };
  }, []);

  return { vehicles, bookings, ready };
}
