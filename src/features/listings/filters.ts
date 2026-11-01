import type { AnalyzedListing, BicycleCategory, ConfidenceLevel, FrameMaterial, ItemType, ListingCondition, MarketplaceId } from '../../types/listing';
import { normalizeText } from '../../utils/text';

export type SortKey = 'deal' | 'price' | 'frame' | 'distance' | 'xbiking' | 'newest';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'deal', label: 'Najlepsza okazja' },
  { value: 'price', label: 'Najniższa cena' },
  { value: 'frame', label: 'Najlepsza rama' },
  { value: 'distance', label: 'Najbliżej Poznania' },
  { value: 'xbiking', label: 'Największy potencjał XBiking' },
  { value: 'newest', label: 'Najnowsze' },
];

export interface FilterState {
  query: string;
  priceMin: number | null;
  priceMax: number | null;
  maxDistance: number | null; // overrides radius when set
  manufacturer: string; // id or ''
  model: string;
  tubingManufacturer: string; // 'Tange' | 'Reynolds' | ...
  materials: FrameMaterial[];
  minFrameScore: number;
  wheelSize: string;
  categories: BicycleCategory[];
  conditions: ListingCondition[];
  minDealScore: number;
  onlyNew: boolean;
  onlyGems: boolean;
  onlyBargains: boolean;
  itemTypes: ItemType[];
  marketplaces: MarketplaceId[];
  minConfidence: ConfidenceLevel | '';
  hideRedFlags: boolean;
  hideDuplicates: boolean;
}

export const EMPTY_FILTERS: FilterState = {
  query: '',
  priceMin: null,
  priceMax: null,
  maxDistance: null,
  manufacturer: '',
  model: '',
  tubingManufacturer: '',
  materials: [],
  minFrameScore: 0,
  wheelSize: '',
  categories: [],
  conditions: [],
  minDealScore: 0,
  onlyNew: false,
  onlyGems: false,
  onlyBargains: false,
  itemTypes: [],
  marketplaces: [],
  minConfidence: '',
  hideRedFlags: false,
  hideDuplicates: true,
};

const CONF_RANK: Record<ConfidenceLevel, number> = { verified: 4, strong: 3, probable: 2, unverified: 1, unknown: 0 };

export function isNew(l: AnalyzedListing, hours: number, now: number): boolean {
  return now - Date.parse(l.listing.discoveredAt) <= hours * 3600_000;
}

export function applyFilters(items: AnalyzedListing[], f: FilterState, opts: { newHours: number; now: number }): AnalyzedListing[] {
  const q = normalizeText(f.query);
  return items.filter(({ listing: l, analysis: a }) => {
    if (q) {
      const hay = normalizeText(`${l.title} ${l.description} ${a.manufacturer ?? ''} ${a.model ?? ''} ${l.locationName ?? ''}`);
      if (!q.split(' ').every((t) => hay.includes(t))) return false;
    }
    if (f.priceMin != null && (a.pricePln ?? 0) < f.priceMin) return false;
    if (f.priceMax != null && (a.pricePln ?? Infinity) > f.priceMax) return false;
    if (f.maxDistance != null && (a.distanceKm == null || a.distanceKm > f.maxDistance)) return false;
    if (f.manufacturer && a.manufacturerId !== f.manufacturer) return false;
    if (f.model && a.modelId !== f.model) return false;
    if (f.tubingManufacturer && a.tubing.manufacturer !== f.tubingManufacturer) return false;
    if (f.materials.length && !f.materials.includes(a.frameMaterial)) return false;
    if (a.frameQualityScore < f.minFrameScore) return false;
    if (f.wheelSize && a.wheelSize !== f.wheelSize) return false;
    if (f.categories.length && !f.categories.includes(a.bicycleCategory)) return false;
    if (f.conditions.length && !f.conditions.includes(a.condition)) return false;
    if (a.dealScore < f.minDealScore) return false;
    if (f.onlyNew && !isNew({ listing: l, analysis: a }, opts.newHours, opts.now)) return false;
    if (f.onlyGems && !a.isUnknownGem) return false;
    if (f.onlyBargains && !a.isBargain) return false;
    if (f.itemTypes.length && !f.itemTypes.includes(a.itemType)) return false;
    if (f.marketplaces.length && !f.marketplaces.includes(l.marketplace)) return false;
    if (f.minConfidence && CONF_RANK[a.tubing.confidence] < CONF_RANK[f.minConfidence]) return false;
    if (f.hideRedFlags && a.redFlags.length) return false;
    if (f.hideDuplicates && l.duplicateOf) return false;
    return true;
  });
}

export function sortListings(items: AnalyzedListing[], key: SortKey): AnalyzedListing[] {
  const s = [...items];
  const dist = (x: AnalyzedListing) => x.analysis.distanceKm ?? 1e9;
  switch (key) {
    case 'deal':
      return s.sort((a, b) => b.analysis.dealScore - a.analysis.dealScore);
    case 'price':
      return s.sort((a, b) => (a.analysis.pricePln ?? 1e9) - (b.analysis.pricePln ?? 1e9));
    case 'frame':
      return s.sort((a, b) => b.analysis.frameQualityScore - a.analysis.frameQualityScore || b.analysis.dealScore - a.analysis.dealScore);
    case 'distance':
      return s.sort((a, b) => dist(a) - dist(b));
    case 'xbiking':
      return s.sort((a, b) => b.analysis.xbikingPotentialScore - a.analysis.xbikingPotentialScore);
    case 'newest':
      return s.sort((a, b) => Date.parse(b.listing.discoveredAt) - Date.parse(a.listing.discoveredAt));
  }
}

export function activeFilterCount(f: FilterState): number {
  let n = 0;
  (Object.keys(f) as (keyof FilterState)[]).forEach((k) => {
    const v = f[k];
    const d = EMPTY_FILTERS[k];
    if (Array.isArray(v) ? v.length : v !== d) n++;
  });
  return n;
}
