import type { SourceListing } from '../../types/listing';
import { jaccard, tokenize } from '../../utils/text';

/**
 * Duplicate detection.
 *  1. Exact: same marketplace + externalId (or same canonical URL) → same listing (update, not insert).
 *  2. Fuzzy cross-portal: similar title + similar price + same town → flagged `duplicateOf`, kept visible.
 */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\.|^m\./, '')}${u.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function exactKey(l: Pick<SourceListing, 'marketplace' | 'externalId' | 'sourceUrl'>): string {
  return l.externalId ? `${l.marketplace}:${l.externalId}` : `url:${canonicalUrl(l.sourceUrl)}`;
}

export function similarity(a: SourceListing, b: SourceListing): number {
  const t = jaccard(tokenize(a.title), tokenize(b.title));
  const d = jaccard(tokenize(a.description).slice(0, 60), tokenize(b.description).slice(0, 60));
  const priceOk = a.price != null && b.price != null ? Math.abs(a.price - b.price) / Math.max(a.price, b.price, 1) <= 0.1 : false;
  const locOk = !!a.locationName && !!b.locationName && tokenize(a.locationName)[0] === tokenize(b.locationName)[0];
  return t * 0.55 + d * 0.25 + (priceOk ? 0.1 : 0) + (locOk ? 0.1 : 0);
}

/** Same town + price within 10% + clearly similar title, or a very high overall similarity. */
export function isLikelyDuplicate(a: SourceListing, b: SourceListing): boolean {
  const t = jaccard(tokenize(a.title), tokenize(b.title));
  const priceOk = a.price != null && b.price != null && Math.abs(a.price - b.price) / Math.max(a.price, b.price, 1) <= 0.1;
  const locOk = !!a.locationName && !!b.locationName && tokenize(a.locationName)[0] === tokenize(b.locationName)[0];
  return (t >= 0.5 && priceOk && locOk) || similarity(a, b) >= 0.75;
}

export interface MergeResult {
  merged: SourceListing[];
  added: number;
  updated: number;
  duplicates: number;
  priceChanges: { id: string; from: number; to: number }[];
}

/** Merge incoming listings into an existing set, recording price history and fuzzy duplicates. */
export function mergeListings(existing: SourceListing[], incoming: SourceListing[], nowIso: string): MergeResult {
  const byKey = new Map(existing.map((l) => [exactKey(l), { ...l }]));
  let added = 0;
  let updated = 0;
  let duplicates = 0;
  const priceChanges: MergeResult['priceChanges'] = [];

  for (const inc of incoming) {
    const key = exactKey(inc);
    const prev = byKey.get(key);
    if (prev) {
      updated++;
      duplicates++;
      if (inc.price != null && prev.price != null && inc.price !== prev.price) {
        priceChanges.push({ id: prev.id, from: prev.price, to: inc.price });
        prev.priceHistory = [...prev.priceHistory, { date: nowIso, price: inc.price }];
      }
      byKey.set(key, {
        ...prev,
        title: inc.title || prev.title,
        description: inc.description || prev.description,
        price: inc.price ?? prev.price,
        images: inc.images.length ? inc.images : prev.images,
        lastSeenAt: nowIso,
        status: inc.status,
      });
      continue;
    }
    const fresh: SourceListing = {
      ...inc,
      discoveredAt: inc.discoveredAt || nowIso,
      lastSeenAt: nowIso,
      priceHistory: inc.priceHistory.length ? inc.priceHistory : inc.price != null ? [{ date: nowIso, price: inc.price }] : [],
    };
    // Fuzzy cross-portal duplicate?
    for (const other of byKey.values()) {
      if (other.marketplace !== fresh.marketplace && isLikelyDuplicate(other, fresh)) {
        fresh.duplicateOf = other.id;
        duplicates++;
        break;
      }
    }
    byKey.set(key, fresh);
    added++;
  }
  return { merged: [...byKey.values()], added, updated, duplicates, priceChanges };
}
