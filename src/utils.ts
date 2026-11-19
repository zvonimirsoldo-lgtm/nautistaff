import { useEffect, useState } from 'react';

export const CATEGORIES = [
  { id: 'skipper', name: 'Skiper' },
  { id: 'hostess', name: 'Hostesa' },
  { id: 'chef', name: 'Kuhar' },
  { id: 'deckhand', name: 'Mornar' },
  { id: 'cleaner', name: 'Čistačica' },
  { id: 'mechanic', name: 'Serviser' },
  { id: 'basemanager', name: 'Base manager' },
  { id: 'wellness', name: 'Wellness' },
];

export const categoryName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

// Postgres vraća vrijeme s 6 decimala sekunde; skratimo na 3 da ga svaki mobitel sigurno pročita
export function parseTs(value: string | null | undefined): number {
  if (!value) return 0;
  return Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'ISTEKLO';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d} d ${p(h)} h ${p(m)} min`;
  return `${p(h)}:${p(m)}:${p(s)}`;
}

const DAYS = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub'];

export function formatDateTime(value: string): string {
  const d = new Date(parseTs(value));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${DAYS[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}. u ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatPay(amount: number, unit: string): string {
  const label = unit === 'week' ? '/ tjedan' : unit === 'month' ? '/ mjesečno' : '/ dan';
  return `${Math.round(Number(amount))} € ${label}`;
}

// Sat koji "kuca" svake sekunde, za odbrojavanje
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function errorText(e: unknown): string {
  if (!e) return 'Nepoznata greška.';
  if (typeof e === 'string') return e;
  const anyE = e as { message?: string };
  return anyE.message ?? 'Nepoznata greška.';
}

// Supabase ponekad vraća povezani zapis kao objekt, a ponekad kao listu
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}
