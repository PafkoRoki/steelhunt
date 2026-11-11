import type { AnalyzedListing } from '../../types/listing';
import { normalizeText } from '../../utils/text';
import { buildDatabase } from '../../services/database/db';

const MTB_CATEGORIES = new Set(['vintage-mtb', 'retro-mtb', 'atb']);
const MTB_WORDS = /(\bmtb\b|gorsk|goral|mountain|\batb\b|all[\s-]*terrain|\b26\s*(?:"|cal|zoll|x)|kola?\s*26\b)/;
const NOT_MTB = new Set(['vintage-road', 'randonneur', 'city', 'utility']);

let MODEL_CATEGORY: Map<string, string> | null = null;
/** Category of a model from the bike database (a bare "Rama Kona Explosif" is an MTB frame even without the word MTB). */
function modelCategory(id: string | null | undefined): string | null {
  MODEL_CATEGORY ??= new Map(buildDatabase().models.map((m) => [m.id, m.category]));
  return id ? MODEL_CATEGORY.get(id) ?? null : null;
}

/** "Retro MTB only" focus: MTB/ATB bikes, plus MTB frames and MTB components. */
export function isMtbLike({ listing, analysis: a }: AnalyzedListing): boolean {
  if (MTB_CATEGORIES.has(a.bicycleCategory)) return true;
  if (NOT_MTB.has(a.bicycleCategory)) return false;
  if (MTB_CATEGORIES.has(modelCategory(a.modelId) ?? '')) return true;
  const text = normalizeText(`${listing.title} ${listing.description}`);
  // Touring / city-style bikes count only when the title itself calls them MTB (a 26" wheel is not enough).
  if (a.bicycleCategory === 'touring') return MTB_WORDS.test(normalizeText(listing.title));
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
  // A road word in the title decides, whatever the description mentions ("zamienię na MTB").
  const title = normalizeText(listing.title);
  if (ROAD_WORDS.test(title) && !MTB_WORDS.test(title)) return true;
  return ROAD_WORDS.test(text) && !MTB_WORDS.test(text);
}
