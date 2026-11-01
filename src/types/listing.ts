/**
 * Listing data model.
 *
 * Two strictly separated layers:
 *  - `SourceListing`   — what the marketplace / user import actually said. Never modified by analysis.
 *  - `ListingAnalysis` — everything STEELHUNT derived (heuristics, scores, estimates, optional AI notes).
 * `AnalyzedListing` joins both for the UI. All flat spec fields are reachable via `listing.*` / `analysis.*`.
 */

export type MarketplaceId =
  | 'olx'
  | 'allegro'
  | 'allegro-lokalnie'
  | 'sprzedajemy'
  | 'facebook'
  | 'gumtree'
  | 'manual'
  | 'other';

export type ListingStatus = 'active' | 'sold' | 'removed' | 'unknown';

export type ItemType = 'complete' | 'frameset' | 'frame' | 'components';

export type ListingCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'project' | 'unknown';

export type DataOrigin = 'live' | 'import' | 'demo';

export interface PricePoint {
  date: string; // ISO
  price: number;
}

/** Raw-but-normalized marketplace data. */
export interface SourceListing {
  id: string; // internal stable id: `${marketplace}:${externalId}`
  externalId: string;
  marketplace: MarketplaceId;
  sourceUrl: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  images: string[];
  locationName: string | null;
  /** Coordinates only when supplied by the source or resolved from a known place name. Never invented. */
  latitude: number | null;
  longitude: number | null;
  /** How the coordinates were obtained. */
  geoPrecision: 'exact' | 'city' | 'none';
  postedAt: string | null;
  discoveredAt: string;
  lastSeenAt: string;
  status: ListingStatus;
  priceHistory: PricePoint[];
  /** Seller-declared / import-declared hints (optional, raw). */
  declared?: {
    itemType?: ItemType;
    condition?: ListingCondition;
    shippingAvailable?: boolean;
    wheelSize?: string;
    frameSize?: string;
    /** Demo-only: illustration color for the generated placeholder image. */
    illustrationColor?: string;
  };
  origin: DataOrigin;
  /** Id of the listing this one probably duplicates (cross-portal), if detected. */
  duplicateOf?: string | null;
}

export type ConfidenceLevel = 'verified' | 'strong' | 'probable' | 'unverified' | 'unknown';

export type TubingScope = 'full-frame' | 'main-tubes' | 'fork-only' | 'unknown';

export type FrameMaterial =
  | 'steel-premium'
  | 'steel-crmo'
  | 'steel-hiten'
  | 'steel-unknown'
  | 'aluminium'
  | 'carbon'
  | 'titanium'
  | 'unknown';

export type FrameConstruction = 'lugged' | 'tig' | 'fillet-brazed' | 'bonded' | 'unknown';

export type BicycleCategory =
  | 'vintage-mtb'
  | 'retro-mtb'
  | 'atb'
  | 'touring'
  | 'gravel-conversion'
  | 'randonneur'
  | 'vintage-road'
  | 'utility'
  | 'city'
  | 'frameset'
  | 'components'
  | 'unknown';

export interface Evidence {
  label: string;
  source: 'title' | 'description' | 'model-db' | 'manufacturer-db' | 'image-ai' | 'declared';
  snippet?: string;
}

export interface TubingIdentification {
  tubingId: string | null;
  manufacturer: string | null;
  series: string | null;
  scope: TubingScope;
  confidence: ConfidenceLevel;
  evidence: Evidence[];
  warnings: string[];
}

export interface PriceEstimate {
  min: number;
  max: number;
  mid: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  basis: string[];
  comparablesUsed: number;
}

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  value: number; // 0..100 sub-score
  weight: number; // 0..1 normalized
  note?: string;
}

export interface ListingAnalysis {
  listingId: string;
  analyzedAt: string;
  manufacturerId: string | null;
  manufacturer: string | null;
  modelId: string | null;
  model: string | null;
  productionYear: string | null;
  bicycleCategory: BicycleCategory;
  itemType: ItemType;
  frameMaterial: FrameMaterial;
  tubing: TubingIdentification;
  frameConstruction: FrameConstruction;
  wheelSize: string | null;
  condition: ListingCondition;
  features: string[];
  components: { name: string; tier: number }[];

  distanceKm: number | null;
  drivingDistanceKm: number | null;
  price: PriceEstimate;
  restorationCost: number;
  transportCost: number | null;
  potentialSavings: number | null;
  netOpportunity: number | null;
  discountPct: number | null;

  dealScore: number;
  frameQualityScore: number;
  xbikingPotentialScore: number;
  locationScore: number | null;
  confidenceScore: number;
  dealBreakdown: ScoreBreakdownItem[];
  frameReasons: string[];
  xbikingReasons: string[];

  isBargain: boolean;
  isUnknownGem: boolean;
  gemReasons: string[];
  redFlags: string[];
  warnings: string[];
  aiNotes?: { provider: string; summary: string; confidence: number } | null;
}

export interface AnalyzedListing {
  listing: SourceListing;
  analysis: ListingAnalysis;
}
