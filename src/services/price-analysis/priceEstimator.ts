/**
 * Market value estimation.
 *
 * IMPORTANT: every number here is an ESTIMATE built from heuristic ranges (editable in models.json)
 * and from other listings' ASKING prices. Asking prices are not transaction prices — the estimator
 * discounts them and always reports its confidence and reasoning.
 */
import type { ItemType, ListingCondition, PriceEstimate, SourceListing } from '../../types/listing';
import type { TextFacts } from '../analysis/textAnalyzer';
import { median, round } from '../../utils/text';
import { CONDITION_LABEL } from '../../utils/labels';

export const CONDITION_VALUE_FACTOR: Record<ListingCondition, number> = {
  excellent: 1.2,
  good: 1.0,
  fair: 0.85,
  poor: 0.65,
  project: 0.45,
  unknown: 0.9,
};

export const RESTORATION_COST: Record<ListingCondition, number> = {
  excellent: 0,
  good: 100,
  fair: 250,
  poor: 500,
  project: 900,
  unknown: 250,
};

const ITEM_TYPE_FACTOR: Record<ItemType, number> = { complete: 1, frameset: 0.55, frame: 0.45, components: 1 };

/** Baseline complete-bike value (PLN) by frame quality when no model/brand data exists. */
function valueFromFrameQuality(frameScore: number): number {
  if (frameScore >= 95) return 1300;
  if (frameScore >= 85) return 1000;
  if (frameScore >= 75) return 750;
  if (frameScore >= 60) return 500;
  if (frameScore >= 40) return 320;
  return 160;
}

export interface ComparableIndex {
  byModel: Map<string, { id: string; price: number }[]>;
}

export function buildComparableIndex(entries: { id: string; modelId: string | null; price: number | null; itemType: ItemType }[]): ComparableIndex {
  const byModel = new Map<string, { id: string; price: number }[]>();
  for (const e of entries) {
    if (!e.modelId || e.price == null || e.price <= 0 || e.itemType !== 'complete') continue;
    const arr = byModel.get(e.modelId) ?? [];
    arr.push({ id: e.id, price: e.price });
    byModel.set(e.modelId, arr);
  }
  return { byModel };
}

export function estimateMarketValue(
  listing: SourceListing,
  facts: TextFacts,
  frameScore: number,
  comps: ComparableIndex,
): PriceEstimate {
  const basis: string[] = [];
  let min: number;
  let max: number;
  let confidence: PriceEstimate['confidence'];

  if (facts.itemType === 'components') {
    const isGroupset = /(komplet|grupa|groupset|caly\s*naped)/i.test(listing.title + ' ' + listing.description);
    const tierSum = facts.components.reduce((s, c) => s + (c.tier >= 3 ? c.tier * 90 : 0), 0) * (isGroupset ? 2.5 : 1);
    if (!tierSum) {
      return { min: 0, max: 0, mid: 0, confidence: 'none', basis: ['Brak danych do wyceny części.'], comparablesUsed: 0 };
    }
    basis.push('Wycena części na podstawie rozpoznanych komponentów (heurystyka).');
    return { min: round(tierSum * 0.7, 10), max: round(tierSum * 1.3, 10), mid: round(tierSum, 10), confidence: 'low', basis, comparablesUsed: 0 };
  }

  if (facts.model?.marketValuePLN) {
    ({ min, max } = facts.model.marketValuePLN);
    confidence = 'medium';
    basis.push(`Zakres heurystyczny z bazy modeli: ${facts.model.name} (${min}–${max} zł, kompletny, stan dobry).`);
  } else if (facts.manufacturer) {
    const repBase = 200 + facts.manufacturer.steelReputation * 9;
    const fqBase = valueFromFrameQuality(frameScore);
    // Strong tubing evidence in the listing outweighs brand averages.
    const strongTubing = facts.tubing.confidence === 'strong' && facts.tubing.evidence[0]?.source !== 'model-db';
    const mid = Math.max(repBase * 0.8, (repBase + fqBase) / 2, strongTubing ? fqBase * 1.1 : 0);
    min = mid * 0.7;
    max = mid * 1.35;
    confidence = 'low';
    basis.push(`Model nierozpoznany — szacunek z reputacji marki ${facts.manufacturer.name} i jakości ramy.`);
  } else {
    const mid = valueFromFrameQuality(frameScore);
    min = mid * 0.65;
    max = mid * 1.4;
    confidence = frameScore >= 60 ? 'low' : 'none';
    basis.push('Marka i model nierozpoznane — szacunek wyłącznie z jakości ramy. Bardzo niepewny.');
  }

  // Valuable components lift the value (a Rohloff hub can be worth more than the bike).
  const compBonus = facts.components.filter((c) => c.tier >= 4).reduce((s, c) => s + (c.tier === 5 ? 180 : 100), 0);
  if (compBonus) {
    min += compBonus * 0.6;
    max += compBonus;
    basis.push(`+ wartościowe komponenty (${facts.components.filter((c) => c.tier >= 4).map((c) => c.name).join(', ')}).`);
  }

  const cf = CONDITION_VALUE_FACTOR[facts.condition];
  // Premium framesets hold value better than average ones.
  const tf = facts.itemType !== 'complete' && frameScore >= 90 ? ITEM_TYPE_FACTOR[facts.itemType] + 0.2 : ITEM_TYPE_FACTOR[facts.itemType];
  if (cf !== 1) basis.push(`× ${cf} za stan (${CONDITION_LABEL[facts.condition].toLowerCase()}).`);
  if (tf !== 1) basis.push(`× ${tf} — sama rama / rama z widelcem.`);
  min *= cf * tf;
  max *= cf * tf;

  // Blend with comparable asking prices for the same model.
  const peers = (facts.model ? comps.byModel.get(facts.model.id) ?? [] : []).filter((p) => p.id !== listing.id);
  let comparablesUsed = 0;
  if (peers.length >= 2 && facts.itemType === 'complete') {
    const med = median(peers.map((p) => p.price))!;
    const adj = med * 0.9; // asking prices overstate final prices
    min = (min + adj * 0.8) / 2;
    max = (max + adj * 1.15) / 2;
    comparablesUsed = peers.length;
    confidence = peers.length >= 5 ? 'high' : 'medium';
    basis.push(`Uwzględniono ${peers.length} porównywalne oferty (mediana ${round(med, 10)} zł). Ceny ofertowe ≠ ceny transakcyjne (−10%).`);
  }

  min = round(min, 10);
  max = round(Math.max(max, min + 50), 10);
  return { min, max, mid: round((min + max) / 2, 10), confidence, basis, comparablesUsed };
}
