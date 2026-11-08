import type { AnalyzedListing } from '../../types/listing';
import { isMtbLike, isRoadBike } from './focus';
import { normalizeText } from '../../utils/text';

/**
 * The scout's selection rules — ONE source of truth used by scripts/scout.ts (to decide) and by the
 * "Selekcja ofert" page (to explain, with the counts of the last run). Change a rule here and both follow.
 */

export const MODERN = /(27[,.]5|\b29\s*(?:["“”″]|''|zoll|er|cali)|\b29er\b|\b(?:xs|s|m|l|xl|xxl)\s*[-/]?\s*29\b|\b29\s*[x×]\s*[12](?:[.,]\d+)?\b|hydraul|tarczow|scheibenbremse|\bdisc\b|e[\s-]?bike|pedelec|carbon|karbon|boost|1x1[12]\b|tubeless)/i;
export const BIKE_HINT = /(rower|bike|mtb|atb|g[oó]ral|g[oó]rsk|fahrrad|\brad\b|rahmen|rama|mountain|bicykl|velo)/i;
export const NOT_MTB = /(tandem|crossow\w*|\bcross\b|trekking\w*|prze[lł]aj\w*|\b28\s*(?:cali|"|''|”|zoll|er)|ko[lł]a\s*28)/i;
export const BIKE_WORD = /(rower|bike|fahrrad|\brad\b|rama|ramy|rahmen|mountain)/i;
export const PART_CODE = /\b(?:fc|rd|fd|st|br|bl|cs|hb|fh|sl|bb)-?[a-z]{0,2}\d{2,4}\b/i;
export const FORK_BRAND = /\b(marzocchi|rock\s*shox|rockshox|manitou|answer|judy|bomber)\b/i;
/** Things that are not bikes but come up in broad searches (fishing rods: blank, Fuji guides…). */
export const NOT_BIKE_ITEM = /(w[eę]dk\w*|ko[lł]owrot\w*|spinning\w*|\bangel\w*|\brute\b|feeder\w*|karpiow\w*|przelotk\w*)/i;
/** Full suspension in the words sellers use (PL / DE / EN). "FS" alone is left out: Stumpjumper FS (1993) = front suspension. */
export const FULL_SUSPENSION = /(\bfully\b|full[\s-]*sus\w*|vollgefedert|vollfederung|dual[\s-]*(?:sus\w*|feder\w*)|hinterbau\w*\s*(?:feder|d[äa]mpf)\w*|(?:d[äa]mpfer|federung)\s*hinten|hinten\s*gefedert|vorne\s*(?:und|u\.|&)\s*hinten\s*gefedert|tyln\w*\s*amortyzator|amortyzator\w*\s*tyln|amortyzator\w*\s*(?:z|na)\s*ty[lł]u|pe[lł]n\w*\s*zawiesz|podw[oó]jn\w*\s*amortyzac|\bsoftail\b|super\s*v\b)/i;
/** Kids' / youth wheel sizes in the title (20" / 24"), unless the number is a frame size ("rama 24\""). */
export const KIDS_WHEELS = /(?<!(?:rama|rahmen|frame|rh)\s*)\b(?:20|24)\s*(?:"|''|”|″|zoll\b)|\bko[lł]\w*\s*(?:20|24)\b|\b(?:20|24)er\s*(?:rad|fahrrad|mtb|mountain)/i;
export const NOT_OFFER = /(gefunden|gestohlen|vermisst|\bsuche\b|szukam|kupi[eę]\b|zagin[aą][lł]|skradzion\w*)/i;
/** "Deore XT/LX" alone is no retro signal (still produced); DX / STX / Exage are 90s-only groups. */
export const RETRO = /(retro|vintage|oldschool|old\s*school|klasyk|kult|\b(?:19[89]\d)\b|lata\s*[89]0|\b[89]0(?:er|s)\b|starrgabel|sztywn\w*\s*widel|cr-?mo|chrom|stahl|stalow|tange|reynolds|columbus|ishiwata|true\s*temper|mufow|muffen|cantilever|biopace|suntour|deore\s*dx|\bstx\b|exage)/i;
export const MAX_YEAR = 2005;
export const MAX_GROUPSET_YEAR = 2002;

export type RejectReason =
  | 'not-mtb'
  | 'not-bike'
  | 'cross-trekking'
  | 'not-offer'
  | 'red-flag'
  | 'full-suspension'
  | 'part'
  | 'part-code'
  | 'modern'
  | 'too-new'
  | 'no-retro';

/** Checked in this order; the first rule that fails decides. */
export const REJECT_RULES: { id: RejectReason; label: string; rule: string }[] = [
  { id: 'not-mtb', label: 'Szosa / nie MTB', rule: 'Rower szosowy (baranek, 700c, „kolarzówka”, Rennrad) albo kategoria, która nie jest MTB/ATB (miejski, trekking) i bez słów MTB / „górski” / koła 26".' },
  { id: 'not-bike', label: 'To nie rower', rule: 'Słowa wędkarskie (wędka, kołowrotek, spinning, przelotki, Angelrute…) albo tytuł bez słowa „rower / bike / MTB / górski / rama / Fahrrad…” i bez producenta ani modelu roweru w samym tytule — producent znaleziony tylko w opisie (np. „Fuji” w przelotkach wędki) nie wystarcza.' },
  { id: 'cross-trekking', label: 'Tandem / cross / trekking / 28"', rule: 'Tytuł mówi o tandemie, rowerze crossowym, trekkingowym, przełajowym albo kołach 28".' },
  { id: 'not-offer', label: 'Nie oferta sprzedaży', rule: 'Ogłoszenia „znaleziony / skradziony / szukam / kupię” (Gefunden, Gestohlen, Suche) albo cena 0.' },
  { id: 'red-flag', label: 'Czerwona flaga', rule: 'Rower dziecięcy / młodzieżowy (także koła 20"/24" w tytule), elektryczny, tani full (rower z marketu) — wykryte w tekście.' },
  { id: 'full-suspension', label: 'Pełne zawieszenie', rule: 'Full / fully, vollgefedert, Dämpfer hinten, tylny amortyzator, pełne zawieszenie, softail… — szukamy sztywnych ram; amortyzowany widelec z przodu jest dozwolony.' },
  { id: 'part', label: 'Pojedyncza część', rule: 'Ogłoszenie dotyczy części (opony, rogi, chwyty, siodło, przerzutka, wieszak, zacisk…), a nie roweru ani ramy.' },
  { id: 'part-code', label: 'Część po kodzie / marce', rule: 'Kod części Shimano („FC-M900”) bez słowa „rower/rama” albo marka amortyzatora („Marzocchi Bomber”, „Rock Shox”) bez rozpoznanego producenta roweru.' },
  { id: 'modern', label: 'Nowoczesny rower', rule: 'Koła 27,5"/29", hamulce tarczowe / hydrauliczne, karbon, Boost, napęd 1x11/1x12, tubeless, e-bike.' },
  { id: 'too-new', label: `Rocznik ≥ ${MAX_YEAR}`, rule: `Podany rok produkcji ${MAX_YEAR} lub nowszy.` },
  { id: 'no-retro', label: 'Brak cech retro', rule: `Żadnej cechy retro: słowa retro/vintage/klasyk/lata 90., rok 198x–199x, stal Cr-Mo / Tange / Reynolds / Columbus / True Temper, mufy, cantilevery, Biopace, SunTour, Deore DX / STX / Exage, kod grupy Shimano do ${MAX_GROUPSET_YEAR} r. — ani modelu z bazy rowerów.` },
];

/**
 * Why the scout drops a listing — null = kept.
 * `titleOnly`: pre-filter on a search card (only the title is known), so the retro signal is not required yet.
 */
export function scoutRejectReason(a: AnalyzedListing, rawText: string, titleOnly = false): RejectReason | null {
  const an = a.analysis;
  const title = a.listing.title;
  if (isRoadBike(a) || !isMtbLike(a)) return 'not-mtb';
  const t = normalizeText(title);
  const named = (s: string | null) => !!s && t.includes(normalizeText(s));
  // A bike maker or a known model must be in the title itself — a "maker" found only in the description
  // (e.g. Fuji guides on a fishing rod) is not enough.
  if (NOT_BIKE_ITEM.test(rawText) || (!BIKE_HINT.test(title) && !named(an.manufacturer) && !named(an.model))) return 'not-bike';
  if (NOT_MTB.test(title)) return 'cross-trekking';
  if (NOT_OFFER.test(rawText) || a.listing.price === 0) return 'not-offer';
  // 20"/24" next to 26" wheels is the frame size ("Peugeot … 26" … 20""), not kids' wheels.
  if (an.redFlags.length || (KIDS_WHEELS.test(title) && !/\b26\s*(?:"|''|”|″|zoll|cal)/i.test(title))) return 'red-flag';
  if (FULL_SUSPENSION.test(rawText)) return 'full-suspension';
  if (an.itemType === 'components') return 'part';
  if (!BIKE_WORD.test(title) && (PART_CODE.test(title) || (!an.manufacturerId && FORK_BRAND.test(title)))) return 'part-code';
  if (MODERN.test(rawText)) return 'modern';
  const y = an.productionYear && /^\d{4}$/.test(an.productionYear) ? Number(an.productionYear) : null;
  if (y && y >= MAX_YEAR) return 'too-new';
  const era = an.groupsetEra?.match(/\d{4}/g)?.map(Number);
  if (era && Math.max(...era) <= MAX_GROUPSET_YEAR) return null;
  if (titleOnly || RETRO.test(rawText) || an.modelId != null) return null;
  return 'no-retro';
}

/** Per-portal funnel of the last scout run (public/data/scout-stats.json). */
export interface ScoutPortalStats {
  file: string;
  name: string;
  queries: number;
  /** Results returned by all queries (with repeats). */
  raw: number;
  /** Unique listings inside the portal's area filter (radius / postcode regions). */
  inArea: number;
  /** Search-card pre-filter (title only). */
  pre: { checked: number; rejected: Partial<Record<RejectReason, number>> };
  /** Ad pages fetched for details this run (new listings only). */
  detailsFetched: number;
  /** Full check (title + description) of this run's candidates. */
  full: { checked: number; rejected: Partial<Record<RejectReason, number>>; manualDuplicates: number };
  added: number;
  /** Listings from earlier runs kept although not in this run's results (≤ keepDays). */
  carried: number;
  /** Earlier listings dropped: not seen for keepDays, or failing the current rules. */
  expired: number;
  rechecked: Partial<Record<RejectReason, number>>;
  published: number;
  errors: number;
  /** Dropped because the URL is on the manual exclusion list (config/scout.json → excluded). */
  excluded?: number;
  /** Earlier listings missing from the results whose ad page was checked, and how many of them had ended / were sold. */
  goneChecked?: number;
  gone?: number;
}

export interface ScoutStats {
  generatedAt: string;
  keepDays: number;
  maxDetailFetches: number;
  portals: ScoutPortalStats[];
}
