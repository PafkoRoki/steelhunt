import type { AnalyzedListing } from '../../types/listing';
import { normalizeText } from '../../utils/text';

const MTB_CATEGORIES = new Set(['vintage-mtb', 'retro-mtb', 'atb']);
const MTB_WORDS = /(\bmtb\b|gorsk|goral|mountain|\batb\b|all[\s-]*terrain|\b26\s*(?:"|cal|x)|kola?\s*26\b)/;
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
