/**
 * STEELHUNT scoring engine — four independent scores:
 *   1. Frame Quality   — tubing/material quality only (not condition).
 *   2. XBiking Potential — conversion / customization potential.
 *   3. Location        — proximity to the origin (Poznań by default).
 *   4. Deal            — weighted: price vs market, frame, location, condition, negotiation.
 * All weights and bands come from AppSettings. Pure functions — usable in browser and Node.
 */
import type { ListingCondition, ScoreBreakdownItem, SourceListing } from '../../types/listing';
import type { AppSettings } from '../../types/settings';
import type { BikeDatabase } from '../../services/database/db';
import { tubingSpecificity } from '../../services/database/db';
import type { TextFacts } from '../../services/analysis/textAnalyzer';
import { clamp } from '../../utils/text';
import { PRICE_CONF_LABEL } from '../../utils/labels';

// ---------------- Frame quality ----------------

export function scoreFrameQuality(facts: TextFacts, db: BikeDatabase, settings: AppSettings): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const t = facts.tubing;
  const spec = t.tubingId ? db.tubingById.get(t.tubingId) ?? null : null;

  if (spec) {
    let score = settings.frameScoreOverrides[spec.id] ?? spec.score;
    reasons.push(`${spec.manufacturer === 'Generic' ? '' : spec.manufacturer + ' '}${spec.series}: bazowo ${score} pkt.`);
    const fromModelDb = t.evidence[0]?.source === 'model-db';
    if (fromModelDb) {
      score -= 10;
      reasons.push('−10: rury przypisane z bazy modeli, nie potwierdzone w ogłoszeniu.');
    } else if (t.confidence === 'probable' && tubingSpecificity(spec) === 2) {
      score -= 5;
      reasons.push('−5: brak potwierdzenia, że oznaczenie dotyczy ramy.');
    }
    if (t.scope === 'main-tubes') {
      score -= 8;
      reasons.push('−8: tylko rury główne.');
    }
    if (tubingSpecificity(spec) === 0 && spec.material === 'crmo' && facts.butted) {
      score += 8;
      reasons.push('+8: rury cieniowane (butted) wg opisu.');
    }
    return { score: clamp(Math.round(score)), reasons };
  }

  switch (facts.frameMaterial) {
    case 'aluminium':
      reasons.push('Rama aluminiowa — poza głównym celem (stal).');
      return { score: 35, reasons };
    case 'carbon':
      reasons.push('Rama karbonowa — poza głównym celem.');
      return { score: 35, reasons };
    case 'titanium':
      reasons.push('Rama tytanowa (do weryfikacji).');
      return { score: 85, reasons };
    case 'steel-unknown': {
      const rep = facts.manufacturer?.steelReputation ?? 0;
      const score = rep >= 80 ? 55 : 45;
      reasons.push(`Stal bez specyfikacji rur${rep >= 80 ? ' (marka z dobrą reputacją)' : ''}.`);
      return { score, reasons };
    }
    default: {
      const rep = facts.manufacturer?.steelReputation;
      if (rep != null) {
        const score = Math.round(30 + rep * 0.25);
        reasons.push(`Brak informacji o materiale — szacunek z reputacji marki (${rep}).`);
        return { score, reasons };
      }
      reasons.push('Brak informacji o materiale ramy.');
      return { score: 35, reasons };
    }
  }
}

// ---------------- XBiking potential ----------------

const CATEGORY_BASE: Record<string, number> = {
  'vintage-mtb': 70,
  'retro-mtb': 55,
  atb: 62,
  touring: 72,
  'gravel-conversion': 70,
  randonneur: 75,
  'vintage-road': 60,
  utility: 45,
  city: 38,
  frameset: 62,
  components: 30,
  unknown: 45,
};

export function scoreXbiking(facts: TextFacts): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = CATEGORY_BASE[facts.category] ?? 45;
  reasons.push(`Kategoria: bazowo ${s}.`);
  const add = (v: number, why: string) => {
    s += v;
    reasons.push(`${v > 0 ? '+' : ''}${v}: ${why}`);
  };
  switch (facts.frameMaterial) {
    case 'steel-premium': add(15, 'stal premium'); break;
    case 'steel-crmo': add(10, 'stal Cr-Mo'); break;
    case 'steel-unknown': add(3, 'stal (bez specyfikacji)'); break;
    case 'steel-hiten': add(-20, 'stal Hi-Ten (ciężka)'); break;
    case 'aluminium': add(-15, 'aluminium'); break;
    case 'carbon': add(-25, 'karbon'); break;
    case 'titanium': add(10, 'tytan'); break;
  }
  const f = new Set(facts.features);
  if (f.has('Sztywny widelec')) add(8, 'sztywny widelec');
  else if (f.has('Widelec amortyzowany') && (facts.category === 'vintage-mtb' || facts.category === 'retro-mtb')) add(-5, 'amortyzator (do wymiany na sztywny)');
  if (facts.wheelSize === '26"' && /mtb|atb|touring/.test(facts.category)) add(4, 'koła 26" — dostępne opony, szeroki prześwit');
  if (facts.wheelSize?.includes('700c') && /touring|atb|gravel|randonneur/.test(facts.category)) add(3, 'koła 700c');
  if (f.has('Mocowania bagażnika')) add(4, 'mocowania bagażnika');
  if (f.has('Mocowania błotników')) add(3, 'mocowania błotników');
  if (f.has('Mocowania koszyka')) add(2, 'mocowania koszyka');
  if (f.has('Hamulce cantilever')) add(4, 'cantilevery (duży prześwit, klasyka)');
  if (facts.construction === 'lugged') add(6, 'rama mufowana');
  if (facts.construction === 'fillet-brazed') add(6, 'rama lutowana (fillet brazed)');
  if (f.has('Oryginalny lakier')) add(3, 'oryginalny lakier');
  const good = facts.components.filter((c) => c.tier >= 4).length;
  if (good) add(Math.min(8, good * 4), 'wartościowe komponenty epoki');
  if (facts.redFlags.length) add(-30, `czerwone flagi: ${facts.redFlags.join(', ')}`);
  return { score: clamp(Math.round(s)), reasons };
}

// ---------------- Location ----------------

export function scoreLocation(distanceKm: number | null, settings: AppSettings): number | null {
  if (distanceKm == null) return null;
  const bands = [...settings.distanceBands].sort((a, b) => a.maxKm - b.maxKm);
  for (const b of bands) if (distanceKm < b.maxKm) return b.score;
  return bands[bands.length - 1]?.score ?? 0;
}

// ---------------- Deal ----------------

const CONDITION_SCORE: Record<ListingCondition, number> = {
  excellent: 100,
  good: 85,
  fair: 65,
  poor: 40,
  project: 25,
  unknown: 55,
};

/** Piecewise mapping of discount (0.3 = 30% below market) to a 0..100 price sub-score. */
export function priceSubScore(discount: number): number {
  const pts: [number, number][] = [
    [-0.5, 0],
    [-0.3, 5],
    [0, 30],
    [0.2, 55],
    [0.3, 70],
    [0.5, 90],
    [0.7, 100],
  ];
  if (discount <= pts[0][0]) return 0;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x0, y0] = pts[i - 1];
    if (discount <= x1) return y0 + ((discount - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 100;
}

export interface DealInputs {
  listing: SourceListing;
  facts: TextFacts;
  frameScore: number;
  locationScore: number | null;
  discount: number | null;
  priceConfidence: 'high' | 'medium' | 'low' | 'none';
  now: number;
}

export function scoreDeal(inp: DealInputs, settings: AppSettings): { score: number; breakdown: ScoreBreakdownItem[] } {
  const w = settings.dealWeights;
  const total = w.price + w.frame + w.location + w.condition + w.negotiation || 1;

  // Price
  let price = 35;
  let priceNote = 'Brak ceny lub wyceny — wartość neutralna.';
  if (inp.discount != null && inp.priceConfidence !== 'none') {
    const raw = priceSubScore(inp.discount);
    const shrink = inp.priceConfidence === 'high' ? 1 : inp.priceConfidence === 'medium' ? 0.85 : 0.65;
    price = 35 + (raw - 35) * shrink;
    priceNote = `${Math.round(inp.discount * 100)}% ${inp.discount >= 0 ? 'poniżej' : 'powyżej'} szacowanej wartości (pewność wyceny: ${PRICE_CONF_LABEL[inp.priceConfidence]}).`;
  }

  // Negotiation
  let nego = 25 + inp.facts.negotiationSignals.length * 20;
  const posted = inp.listing.postedAt ? Date.parse(inp.listing.postedAt) : NaN;
  const ageDays = Number.isFinite(posted) ? (inp.now - posted) / 86400000 : null;
  if (ageDays != null && ageDays > 21) nego += 15;
  const hist = inp.listing.priceHistory;
  if (hist.length >= 2 && hist[hist.length - 1].price < hist[0].price) nego += 20;
  nego = clamp(nego);

  const breakdown: ScoreBreakdownItem[] = [
    { key: 'price', label: 'Cena vs wartość rynkowa', value: Math.round(price), weight: w.price / total, note: priceNote },
    { key: 'frame', label: 'Jakość ramy', value: inp.frameScore, weight: w.frame / total },
    {
      key: 'location',
      label: 'Odległość',
      value: inp.locationScore ?? 40,
      weight: w.location / total,
      note: inp.locationScore == null ? 'Lokalizacja nieznana — wartość neutralna.' : undefined,
    },
    { key: 'condition', label: 'Stan i kompletność', value: CONDITION_SCORE[inp.facts.condition], weight: w.condition / total },
    {
      key: 'negotiation',
      label: 'Potencjał negocjacji',
      value: nego,
      weight: w.negotiation / total,
      note: [...inp.facts.negotiationSignals, ageDays != null && ageDays > 21 ? `wystawione ${Math.round(ageDays)} dni temu` : '']
        .filter(Boolean)
        .join(', ') || undefined,
    },
  ];
  let score = breakdown.reduce((s, b) => s + b.value * b.weight, 0);
  if (inp.facts.redFlags.length) score *= 0.6;
  return { score: clamp(Math.round(score)), breakdown };
}
