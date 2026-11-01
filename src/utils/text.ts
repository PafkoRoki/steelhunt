/** Lowercase, strip Polish/Latin diacritics, unify separators — the canonical form all matchers use. */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_/|•·]+/g, ' ')
    .replace(/[„”"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary-ish matcher that tolerates hyphen/space variants ("mb-1" ≈ "mb 1"). */
export function aliasRegex(alias: string): RegExp {
  const parts = normalizeText(alias)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(escapeRegExp);
  return new RegExp(`(?:^|[^a-z0-9])(${parts.join('[\\s-]*')})(?![a-z0-9])`, 'i');
}

export function tokenize(s: string): string[] {
  return normalizeText(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

export function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  A.forEach((t) => {
    if (B.has(t)) inter++;
  });
  return inter / (A.size + B.size - inter);
}

export function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

export function round(v: number, step = 1): number {
  return Math.round(v / step) * step;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
