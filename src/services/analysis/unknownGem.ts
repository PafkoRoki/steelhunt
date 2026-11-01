/**
 * UNKNOWN GEM detection — interesting bikes the model database did NOT recognize.
 * A gem is never "verified": it is a lead worth a closer look (photos, decals, questions to the seller).
 */
import type { SourceListing } from '../../types/listing';
import type { TextFacts } from './textAnalyzer';
import { tubingSpecificity } from '../database/db';

export function detectUnknownGem(
  listing: SourceListing,
  facts: TextFacts,
  frameScore: number,
  discount: number | null,
  pricePln: number | null = listing.price,
): { isGem: boolean; reasons: string[]; signals: number } {
  const reasons: string[] = [];
  if (facts.model) return { isGem: false, reasons, signals: 0 }; // recognized → regular pipeline
  if (facts.redFlags.length) return { isGem: false, reasons, signals: 0 };

  let signals = 0;
  const spec = facts.tubingSpec;
  const fromListing = facts.tubing.evidence[0] && facts.tubing.evidence[0].source !== 'model-db';

  if (spec && fromListing && tubingSpecificity(spec) >= 1 && spec.score >= 70 && spec.material !== 'aluminium') {
    signals += 2;
    reasons.push(`Wzmianka o rurach ${spec.manufacturer} ${spec.series} przy nierozpoznanym modelu.`);
  } else if (spec && fromListing && spec.material === 'crmo' && facts.butted) {
    signals += 1;
    reasons.push('Cr-Mo z rurami cieniowanymi wg opisu.');
  }
  if (facts.construction === 'lugged' && facts.frameMaterial !== 'aluminium') {
    signals += 1;
    reasons.push('Rama mufowana.');
  }
  if (facts.construction === 'fillet-brazed') {
    signals += 1;
    reasons.push('Rama lutowana (fillet brazed) — często ręczna robota.');
  }
  const goodComps = facts.components.filter((c) => c.tier >= 4);
  if (goodComps.length) {
    signals += 1;
    reasons.push(`Komponenty z wyższej półki: ${goodComps.map((c) => c.name).join(', ')}.`);
  }
  if (!facts.manufacturer) {
    reasons.push('Marka nierozpoznana w bazie — sprzedający może nie znać wartości.');
  } else if (facts.manufacturer.undervaluedInPoland) {
    signals += 1;
    reasons.push(`${facts.manufacturer.name} — marka często niedoceniana w polskich ogłoszeniach.`);
  }
  const oldMtb = /vintage-mtb|touring|vintage-road|frameset/.test(facts.category);
  if (oldMtb && pricePln != null && pricePln <= 500 && facts.frameMaterial !== 'steel-hiten' && facts.frameMaterial !== 'aluminium') {
    signals += 1;
    reasons.push('Stary rower w niskiej cenie — warto dopytać o naklejki rur.');
  }
  if (discount != null && discount > 0.3 && frameScore >= 60) {
    signals += 1;
    reasons.push('Cena wyraźnie poniżej szacunku dla tej jakości ramy.');
  }

  return { isGem: signals >= 2, reasons, signals };
}
