/**
 * Full analysis pipeline: SourceListing[] → AnalyzedListing[].
 * Pure and deterministic given (listings, settings, db, now) — runs in the browser (live re-scoring
 * when settings change) and in Node (scheduled ingestion).
 */
import type { AnalyzedListing, ListingAnalysis, SourceListing } from '../../types/listing';
import type { AppSettings } from '../../types/settings';
import type { BikeDatabase } from '../database/db';
import { analyzeText, type TextFacts } from './textAnalyzer';
import { buildComparableIndex, estimateMarketValue, RESTORATION_COST } from '../price-analysis/priceEstimator';
import { haversineKm } from '../geolocation/geo';
import { scoreDeal, scoreFrameQuality, scoreLocation, scoreXbiking } from '../../features/scoring/engine';
import { detectUnknownGem } from './unknownGem';
import { clamp, round } from '../../utils/text';

export function analyzeListings(
  listings: SourceListing[],
  settings: AppSettings,
  db: BikeDatabase,
  now: number = Date.now(),
): AnalyzedListing[] {
  const facts = listings.map((l) => analyzeText(l, db));
  const comps = buildComparableIndex(
    listings.map((l, i) => ({ id: l.id, modelId: facts[i].model?.id ?? null, price: l.price, itemType: facts[i].itemType })),
  );
  return listings.map((listing, i) => ({ listing, analysis: analyzeOne(listing, facts[i], settings, db, comps, now) }));
}

function analyzeOne(
  listing: SourceListing,
  facts: TextFacts,
  settings: AppSettings,
  db: BikeDatabase,
  comps: ReturnType<typeof buildComparableIndex>,
  now: number,
): ListingAnalysis {
  const warnings = [...facts.warnings, ...facts.tubing.warnings];

  // Material fallback from the model's documented frame material.
  if (facts.frameMaterial === 'unknown' && facts.model?.frameMaterial === 'aluminium') facts.frameMaterial = 'aluminium';
  if (facts.frameMaterial === 'unknown' && facts.model?.frameMaterial === 'steel' && !facts.tubingSpec) facts.frameMaterial = 'steel-unknown';
  // Material fallback from model DB typical tubing.
  if (facts.frameMaterial === 'unknown' && facts.tubingSpec && facts.tubing.evidence[0]?.source === 'model-db') {
    facts.frameMaterial = facts.tubingSpec.material === 'hiten' ? 'steel-hiten' : 'steel-crmo';
  }

  // Distance — only when coordinates exist.
  let distanceKm: number | null = null;
  let drivingDistanceKm: number | null = null;
  if (listing.latitude != null && listing.longitude != null) {
    distanceKm = Math.round(haversineKm(settings.origin.lat, settings.origin.lng, listing.latitude, listing.longitude));
    drivingDistanceKm = Math.round(distanceKm * settings.roadFactor);
  } else {
    warnings.push('Brak rozpoznawalnej lokalizacji — odległość nieznana.');
  }
  if (listing.geoPrecision === 'city') warnings.push('Lokalizacja przybliżona do centrum miejscowości.');

  const frame = scoreFrameQuality(facts, db, settings);
  const xb = scoreXbiking(facts);
  const locationScore = scoreLocation(distanceKm, settings);
  const price = estimateMarketValue(listing, facts, frame.score, comps);
  if (price.confidence === 'low' || price.confidence === 'none') warnings.push('Wycena wartości rynkowej niepewna — mało danych.');

  // Transport: round trip by car, or courier when the seller ships (whichever is cheaper).
  let transportCost: number | null = null;
  if (drivingDistanceKm != null) {
    const drive = drivingDistanceKm < 8 ? 0 : drivingDistanceKm * 2 * settings.fuelCostPerKm;
    transportCost = round(listing.declared?.shippingAvailable ? Math.min(drive, settings.courierCost) : drive, 5);
  } else if (listing.declared?.shippingAvailable) {
    transportCost = settings.courierCost;
  }

  const restorationCost = facts.itemType === 'complete' ? RESTORATION_COST[facts.condition] : 0;
  const hasPrice = listing.price != null && listing.price > 0 && price.confidence !== 'none';
  const potentialSavings = hasPrice ? round(price.mid - listing.price!, 10) : null;
  const netOpportunity = hasPrice ? round(price.mid - listing.price! - restorationCost - (transportCost ?? 0), 10) : null;
  const discountPct = hasPrice && price.mid > 0 ? (price.mid - listing.price!) / price.mid : null;

  if (discountPct != null && discountPct > 0.75) {
    warnings.push('Cena podejrzanie niska względem szacunku — sprawdź, czy to kompletny rower, a nie część, oraz czy oferta jest wiarygodna.');
  }

  const deal = scoreDeal(
    { listing, facts, frameScore: frame.score, locationScore, discount: discountPct, priceConfidence: price.confidence, now },
    settings,
  );

  const gem = detectUnknownGem(listing, facts, frame.score, discountPct);

  const isBargain =
    discountPct != null &&
    discountPct >= settings.dealThresholdPct / 100 &&
    price.confidence !== 'none' &&
    frame.score >= 55 &&
    facts.redFlags.length === 0;

  // Overall data confidence.
  const tubingConf = { verified: 35, strong: 30, probable: 20, unverified: 10, unknown: 0 }[facts.tubing.confidence];
  const confidenceScore = clamp(
    (facts.manufacturer ? 15 : 0) +
      (facts.model ? 15 : 0) +
      tubingConf +
      (distanceKm != null ? 10 : 0) +
      ({ high: 20, medium: 14, low: 6, none: 0 }[price.confidence]) +
      (listing.description.length > 120 ? 6 : 0) +
      (listing.images.length > 0 ? 4 : 0),
  );

  return {
    listingId: listing.id,
    analyzedAt: new Date(now).toISOString(),
    manufacturerId: facts.manufacturer?.id ?? null,
    manufacturer: facts.manufacturer?.name ?? null,
    modelId: facts.model?.id ?? null,
    model: facts.model?.name ?? null,
    productionYear: facts.year,
    bicycleCategory: facts.category,
    itemType: facts.itemType,
    frameMaterial: facts.frameMaterial,
    tubing: facts.tubing,
    frameConstruction: facts.construction,
    wheelSize: facts.wheelSize,
    condition: facts.condition,
    features: facts.features,
    components: facts.components,
    distanceKm,
    drivingDistanceKm,
    price,
    restorationCost,
    transportCost,
    potentialSavings,
    netOpportunity,
    discountPct,
    dealScore: deal.score,
    frameQualityScore: frame.score,
    xbikingPotentialScore: xb.score,
    locationScore,
    confidenceScore,
    dealBreakdown: deal.breakdown,
    frameReasons: frame.reasons,
    xbikingReasons: xb.reasons,
    isBargain,
    isUnknownGem: gem.isGem,
    gemReasons: gem.reasons,
    redFlags: facts.redFlags,
    warnings: [...new Set(warnings)],
    aiNotes: null,
  };
}
