import type { ListingAnalysis } from '../../types/listing';

/**
 * Value tiers named after metal grades (inspired by Team Fortress 2), worst → best:
 *  - scrap      : weak or risky offer (low Deal Score or red flags)
 *  - reclaimed  : decent, ordinary offer
 *  - refined    : a real bargain (meets the "Okazja" rule)
 *  - hunted     : a unicorn — a bargain on a genuinely valuable bike
 */
export type MetalTier = 'scrap' | 'reclaimed' | 'refined' | 'hunted';

/** Estimated market value (PLN, mid) from which a bargain counts as a "hunted" unicorn. */
export const HUNTED_MIN_VALUE_PLN = 1500;
export const HUNTED_MIN_SCORE = 70;
export const RECLAIMED_MIN_SCORE = 45;

export const METAL_TIERS: Record<MetalTier, { label: string; icon: string; hint: string; color: string }> = {
  hunted: {
    label: 'Hunted',
    icon: 'tiers/hunted.svg',
    hint: `Unikat: okazja na rowerze wartym ≥ ${HUNTED_MIN_VALUE_PLN} zł (Deal Score ≥ ${HUNTED_MIN_SCORE}).`,
    color: '#b9a8ff',
  },
  refined: { label: 'Refined', icon: 'tiers/refined.svg', hint: 'Okazja: cena wyraźnie poniżej szacowanej wartości.', color: '#e6e9ea' },
  reclaimed: { label: 'Reclaimed', icon: 'tiers/reclaimed.svg', hint: `Przeciętna oferta (Deal Score ≥ ${RECLAIMED_MIN_SCORE}).`, color: '#a9a29a' },
  scrap: { label: 'Scrap', icon: 'tiers/scrap.svg', hint: 'Słaba lub ryzykowna oferta (niski Deal Score albo czerwone flagi).', color: '#b07a55' },
};

export const METAL_ORDER: MetalTier[] = ['scrap', 'reclaimed', 'refined', 'hunted'];

export function metalTier(a: ListingAnalysis): MetalTier {
  if (a.isBargain && a.dealScore >= HUNTED_MIN_SCORE && a.price.mid >= HUNTED_MIN_VALUE_PLN) return 'hunted';
  if (a.isBargain) return 'refined';
  if (a.redFlags.length === 0 && a.dealScore >= RECLAIMED_MIN_SCORE) return 'reclaimed';
  return 'scrap';
}
