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

/** Score step: 0-9 → 0, 10-19 → 1, … 90-99 → 9, 100 → 10. */
export function scoreStep(score: number): number {
  return Math.max(0, Math.min(10, Math.floor(score / 10)));
}

function hsl(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const c = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return '#' + [c(0), c(8), c(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Score colour: the site's burnt orange, more saturated the better the score, in 10-point steps
 * (0-9 almost grey … 100 full orange). Lightness is fixed at 38%, so every step reads at ~4.9:1 on panels.
 */
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return '#b3aa98';
  return hsl(18, 6 + scoreStep(score) * 7.6, 38);
}
