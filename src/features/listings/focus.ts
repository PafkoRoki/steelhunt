import type { AnalyzedListing } from '../../types/listing';
import { normalizeText } from '../../utils/text';

const MTB_CATEGORIES = new Set(['vintage-mtb', 'retro-mtb', 'atb']);
const MTB_WORDS = /(\bmtb\b|gorsk|goral|mountain|\batb\b|all[\s-]*terrain|\b26\s*(?:"|cal|zoll|x)|kola?\s*26\b)/;
const NOT_MTB = new Set(['vintage-road', 'randonneur', 'city', 'utility']);

/** "Retro MTB only" focus: MTB/ATB bikes, plus MTB frames and MTB components. */
export function isMtbLike({ listing, analysis: a }: AnalyzedListing): boolean {
  if (MTB_CATEGORIES.has(a.bicycleCategory)) return true;
  if (NOT_MTB.has(a.bicycleCategory)) return false;
  const text = normalizeText(`${listing.title} ${listing.description}`);
  if (a.bicycleCategory === 'frameset' || a.bicycleCategory === 'components') {
    return MTB_WORDS.test(text) && !/(szos|kolarz|road)/.test(text);
  }
  return a.wheelSize === '26"' || MTB_WORDS.test(text);
}

const ROAD_CATEGORIES = new Set(['vintage-road', 'randonneur']);
const ROAD_WORDS = /(szos|kolarz|kolark|\broad\b|baranek|drop\s*bar|\b700\s*c\b|rennrad|rennlenker)/;

/** Road bikes are out of scope for STEELHUNT entirely — they are never shown. */
export function isRoadBike({ listing, analysis: a }: AnalyzedListing): boolean {
  if (ROAD_CATEGORIES.has(a.bicycleCategory)) return true;
  if (MTB_CATEGORIES.has(a.bicycleCategory)) return false;
  const text = normalizeText(`${listing.title} ${listing.description}`);
  return ROAD_WORDS.test(text) && !MTB_WORDS.test(text);
}
