import type { ListingAnalysis } from '../../types/listing';

/**
 * Value tiers named after metal grades (Team Fortress 2; icons are the TF2 item images, © Valve), worst → best:
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
    icon: 'tiers/hunted.png',
    hint: `Unikat: okazja na rowerze wartym ≥ ${HUNTED_MIN_VALUE_PLN} zł (Deal Score ≥ ${HUNTED_MIN_SCORE}).`,
    color: '#4b33a8',
  },
  refined: { label: 'Refined', icon: 'tiers/refined.png', hint: 'Okazja: cena wyraźnie poniżej szacowanej wartości.', color: '#2f3a40' },
  reclaimed: { label: 'Reclaimed', icon: 'tiers/reclaimed.png', hint: `Przeciętna oferta (Deal Score ≥ ${RECLAIMED_MIN_SCORE}).`, color: '#4f4a44' },
  scrap: { label: 'Scrap', icon: 'tiers/scrap.png', hint: 'Słaba lub ryzykowna oferta (niski Deal Score albo czerwone flagi).', color: '#7a3f1c' },
};

export const METAL_ORDER: MetalTier[] = ['scrap', 'reclaimed', 'refined', 'hunted'];

export function metalTier(a: ListingAnalysis): MetalTier {
  if (a.isBargain && a.dealScore >= HUNTED_MIN_SCORE && a.price.mid >= HUNTED_MIN_VALUE_PLN) return 'hunted';
  if (a.isBargain) return 'refined';
  if (a.redFlags.length === 0 && a.dealScore >= RECLAIMED_MIN_SCORE) return 'reclaimed';
  return 'scrap';
}
