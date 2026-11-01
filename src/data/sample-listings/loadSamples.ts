/**
 * DEMO DATA. These listings are fictional examples written to exercise the scoring engine.
 * They are flagged `origin: 'demo'` and rendered with a DEMO badge everywhere. Their link points
 * to a marketplace SEARCH page for similar bikes — never to a fabricated listing.
 */
import samples from './sample-listings.json';
import type { ItemType, MarketplaceId, SourceListing } from '../../types/listing';
import { MARKETPLACE_BY_ID } from '../../services/marketplaces/registry';
import { resolvePlace } from '../../services/geolocation/geo';

interface SampleRow {
  externalId: string;
  marketplace: string;
  title: string;
  description: string;
  price: number;
  location: string | null;
  postedDaysAgo: number;
  discoveredHoursAgo: number;
  shipping?: boolean;
  itemType?: string;
  color: string;
  searchQuery: string;
  previousPrice?: number;
}

export function loadSampleListings(now: number = Date.now()): SourceListing[] {
  return (samples as SampleRow[]).map((s) => {
    const mk = s.marketplace as MarketplaceId;
    const place = resolvePlace(s.location);
    const discovered = new Date(now - s.discoveredHoursAgo * 3600_000).toISOString();
    const posted = new Date(now - s.postedDaysAgo * 86400_000).toISOString();
    const info = MARKETPLACE_BY_ID.get(mk);
    return {
      id: `demo:${s.externalId}`,
      externalId: s.externalId,
      marketplace: mk,
      sourceUrl: info?.searchUrl?.(s.searchQuery) ?? 'https://www.olx.pl/sport-hobby/rowery/',
      title: s.title,
      description: s.description,
      price: s.price,
      currency: 'PLN',
      images: [],
      locationName: s.location,
      latitude: place?.lat ?? null,
      longitude: place?.lng ?? null,
      geoPrecision: place ? 'city' : 'none',
      postedAt: posted,
      discoveredAt: discovered,
      lastSeenAt: new Date(now - 3600_000).toISOString(),
      status: 'active',
      priceHistory: s.previousPrice
        ? [
            { date: posted, price: s.previousPrice },
            { date: discovered, price: s.price },
          ]
        : [{ date: discovered, price: s.price }],
      declared: {
        itemType: s.itemType as ItemType | undefined,
        shippingAvailable: s.shipping,
        illustrationColor: s.color,
      },
      origin: 'demo',
    } satisfies SourceListing;
  });
}
