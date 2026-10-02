'use client';
// นับการเปิดหน้า (1 ครั้งต่อแท็บ) — ใส่ในหน้า server component ของ /farewell ได้เลย
import { useEffect } from 'react';
import { trackOncePerTab, type FarewellEvent } from '../track';

export default function TrackView({ type }: { type: Extract<FarewellEvent, 'VISIT' | 'JOURNEY_VIEW'> }) {
  useEffect(() => trackOncePerTab(type, type), [type]);
  return null;
}
