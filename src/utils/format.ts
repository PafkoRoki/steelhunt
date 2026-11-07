const pln = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

export function formatPrice(v: number | null | undefined, currency = 'PLN'): string {
  if (v == null) return '—';
  const c = (currency || 'PLN').toUpperCase();
  return `${pln.format(v)} ${c === 'PLN' ? 'zł' : c === 'EUR' ? '€' : currency}`;
}

export function formatRange(min: number, max: number): string {
  return `${pln.format(min)}–${pln.format(max)} zł`;
}

export function formatKm(v: number | null | undefined): string {
  if (v == null) return 'nieznana';
  return `${pln.format(v)} km`;
}

export function formatPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v > 0 ? '−' : '+'}${Math.abs(Math.round(v * 100))}%`;
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const diff = (now - Date.parse(iso)) / 1000;
  if (!Number.isFinite(diff)) return '—';
  if (diff < 60) return 'przed chwilą';
  if (diff < 3600) return `${Math.floor(diff / 60)} min temu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} godz. temu`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? 'wczoraj' : `${d} dni temu`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Score → tone used across cards, map markers and rings. */
export function scoreTone(score: number): 'top' | 'good' | 'mid' | 'low' {
  if (score >= 75) return 'top';
  if (score >= 60) return 'good';
  if (score >= 45) return 'mid';
  return 'low';
}

export const TONE_COLOR: Record<ReturnType<typeof scoreTone>, string> = {
  top: '#8fc08f',
  good: '#c9b45a',
  mid: '#c98a4a',
  low: '#8a8f8e',
};
