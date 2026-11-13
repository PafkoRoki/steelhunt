import type { AnalyzedListing } from '../../types/listing';
import { isMtbLike, isRoadBike } from './focus';
import { aliasRegex, normalizeText } from '../../utils/text';
import { buildDatabase } from '../../services/database/db';

/**
 * The scout's selection rules — ONE source of truth used by scripts/scout.ts (to decide) and by the
 * "Selekcja ofert" page (to explain, with the counts of the last run). Change a rule here and both follow.
 */

export const MODERN = /(27[,.]5|\b29\s*(?:["“”″]|''|zoll|er|cali)|\b29er\b|\b(?:xs|s|m|l|xl|xxl)\s*[-/]?\s*29\b|\b29\s*[x×]\s*[12](?:[.,]\d+)?\b|hydraul|tarczow|scheibenbremse|\bdisc\b|e[\s-]?bike|pedelec|carbon|karbon|boost|1x1[12]\b|tubeless|dual\s*control|hollowtech\s*(?:ii|2)\b)/i;
export const BIKE_HINT = /(rower|bike|mtb|atb|g[oó]ral|g[oó]rsk|fahrrad|\brad\b|rahmen|rama|mountain|bicykl|velo)/i;
export const NOT_MTB = /(tandem|\bcruiser\b|chopp?er|sk[lł]adak\w*|klapprad|faltrad|crossow\w*|\bcross\b|crossbike\w*|crossrad\w*|hybrid\w*|trekking\w*|prze[lł]aj\w*|\b28\s*(?:cali|"|''|”|zoll|er)|ko[lł]a\s*28)/i;
export const BIKE_WORD = /(rower|bike|fahrrad|\brad\b|rama|ramy|rahmen|mountain)/i;
export const PART_CODE = /\b(?:fc|rd|fd|st|br|bl|cs|hb|fh|sl|bb|pd|sp|wh)-?[a-z]{0,2}\d{2,4}\b/i;
export const COMPONENT_LEAD = /^\s*(?:top\s+)?(?:\d+\s*x\s*)?(?:shimano|suntour|sachs|campagnolo|deore|sram|mavic)\b/i;
export const FORK_BRAND = /\b(marzocchi|rock\s*shox|rockshox|manitou|answer|judy|bomber)\b/i;
/** Things that are not bikes but come up in broad searches (fishing rods: blank, Fuji guides…). */
export const NOT_BIKE_ITEM = /(w[eę]dk\w*|ko[lł]owrot\w*|spinning\w*|\bangel\w*|\brute\b|feeder\w*|karpiow\w*|przelotk\w*)/i;
/** Full suspension in the words sellers use (PL / DE / EN). "FS" alone is left out: Stumpjumper FS (1993) = front suspension. */
export const FULL_SUSPENSION = /(\bfully\b|full[\s-]*sus\w*|vollgefedert|vollfederung|dual[\s-]*(?:sus\w*|feder\w*)|hinterbau\w*\s*(?:feder|d[äa]mpf)\w*|(?:d[äa]mpfer|federung)\s*hinten|hinten\s*gefedert|vorne\s*(?:und|u\.|&)\s*hinten\s*gefedert|tyln\w*\s*amortyzator|amortyzator\w*\s*tyln|amortyzator\w*\s*(?:z|na)\s*ty[lł]u|pe[lł]n\w*\s*zawiesz|podw[oó]jn\w*\s*amortyzac|\bsoftail\b|super\s*v\b|pe[lł]n\w*\s*amortyzac\w*|amortyzator\w*\s*:?\s*prz[oó]d\s*(?:i|oraz|\+|\/)\s*ty[lł]|amortyzac\w*\s*prz[oó]d\s*(?:i|oraz|\+|\/)\s*ty[lł])/i;
/** Kids' / youth wheel sizes in the title (20" / 24"), unless the number is a frame size ("rama 24\""). */
export const KIDS_WHEELS = /(?<!(?:rama|rahmen|frame|rh)\s*)\b(?:20|24)\s*(?:"|''|”|″|zoll\b)|\bko[lł]\w*\s*(?:20|24)\b|\b(?:20|24)er\s*(?:rad|fahrrad|mtb|mountain)/i;
export const NOT_OFFER = /(gefunden|gestohlen|vermisst|\bsuche\b|szukam|kupi[eę]\b|zagin[aą][lł]|skradzion\w*)/i;
/** "Deore XT/LX" alone is no retro signal (still produced); DX / STX / Exage are 90s-only groups. */
export const RETRO = /(retro|vintage|oldschool|old\s*school|klasyk|kult|\b(?:19[89]\d)\b|lata\s*[89]0|\b[89]0(?:er|s)\b|starrgabel|sztywn\w*\s*widel|cr-?mo|cro[\s-]?mol?y?|chromo\w*|chrom[\s-]*mol\w*|tange|reynolds|columbus|ishiwata|true\s*temper|mufow|muffen|cantilever|biopace|(?<!\bsr\s)(?<!(?:amortyzator|amortyzatorem|widelec|widelca|gabel|federgabel|fork)\s)suntour(?!\s*(?:xc[tmre]|nex|ncx|nvx|epi\w*|raid\w*|axon|sf\d|m\d{4}|amortyz\w*|widel\w*|gabel|federgabel|fork))|deore\s*dx|\bstx\b|exage)/i;
/** "Steel frame" alone is a retro signal only on a bike from a known maker — no-name steel bikes are market bikes. */
export const STEEL_WORD = /(stahl|stalow)/i;
/** Sales words ("retro", "kultowy") — on a no-name bike they prove nothing unless they are in the title. */
export const SOFT_RETRO = /(retro|vintage|oldschool|old\s*school|klasyk\w*|kult\w*)/gi;
/** Aluminium named on a frame decal read from the photos ("ZR 9000 Custom Alloy", "Alu 7005"). */
export const ALU_DECAL = /(alloy|alumin\w*|\balu\b|\b(?:6061|7005|7020)\b)/i;
/** Part nouns that sellers do not put in the title of a complete bike (unlike "amortyzator", "hamulce", "koła"). */
export const STRONG_PART = /\b(sattel|saddle|siodlo|siodelko|lenker|kierownica|vorbau|mostek|kurbel\w*|korba|kassette|kaseta|kettenbl\w*|bremshebel\w*|brake\s*levers?|u[\s-]?brake|\w*pedale?n?|vorderrad|hinterrad|laufrad\w*|schaltwerk|schalthebel|manetki|klamki|piasta|sztyca|sattelstutze)\b/;
/** Plural "bikes" at the start of the title: a batch ad or a dealer's stock list. */
export const PLURAL_BIKES = /^\s*(?:rowery|fahrr[aä]der|bikes|r[aä]der)\b/i;
/** "dwa rowery", "komplet dwóch rowerów", "zwei Fahrräder", "2x MTB" — more than one bike for one price. */
export const SEVERAL_BIKES = /(dw[aó]ch?\s+rower\w*|dwa\s+rowery|\b2\s*x?\s*rowery|komplet\s+rower[oó]w|para\s+rower[oó]w|zwei\s+(?:fahrr[aä]der|r[aä]der|bikes|mtbs?|mountainbikes?)|\b2\s*x\s*(?:mtb|fahrrad|mountainbike|rower))/i;
let MAKERS: { id: string; res: RegExp[] }[] | null = null;
/** How many different bike makers the title names ("Gary Fisher Univega Kellys Trek" → 3). */
export function makersInTitle(title: string): number {
  MAKERS ??= buildDatabase().manufacturers.map((m) => ({ id: m.id, res: m.aliases.map(aliasRegex) }));
  const t = normalizeText(title);
  return MAKERS.filter((m) => m.res.some((re) => re.test(t))).length;
}
/** Makers of plain mass-market bikes (steelReputation below this) are treated like no-name bikes by the retro rules. */
export const MASS_MARKET_REPUTATION = 30;
function isQualityMaker(id: string | null | undefined): boolean {
  if (!id) return false;
  const m = buildDatabase().manufacturerById.get(id);
  return !m || m.steelReputation >= MASS_MARKET_REPUTATION;
}
export const MAX_YEAR = 2005;
export const MAX_GROUPSET_YEAR = 2002;

export type RejectReason =
  | 'not-mtb'
  | 'not-bike'
  | 'cross-trekking'
  | 'not-offer'
  | 'multi-bike'
  | 'red-flag'
  | 'full-suspension'
  | 'part'
  | 'part-code'
  | 'modern'
  | 'too-new'
  | 'aluminium'
  | 'no-retro';

/** Checked in this order; the first rule that fails decides. */
export const REJECT_RULES: { id: RejectReason; label: string; rule: string }[] = [
  { id: 'not-mtb', label: 'Szosa / nie MTB', rule: 'Rower szosowy (baranek, 700c, „kolarzówka”, Rennrad) albo kategoria, która nie jest MTB/ATB (miejski, trekking) i bez słów MTB / „górski” / koła 26".' },
  { id: 'not-bike', label: 'To nie rower', rule: 'Słowa wędkarskie (wędka, kołowrotek, spinning, przelotki, Angelrute…) albo tytuł bez słowa „rower / bike / MTB / górski / rama / Fahrrad…” i bez producenta ani modelu roweru w samym tytule — producent znaleziony tylko w opisie (np. „Fuji” w przelotkach wędki) nie wystarcza.' },
  { id: 'cross-trekking', label: 'Tandem / cross / trekking / 28"', rule: 'Tytuł mówi o tandemie, cruiserze, chopperze, składaku, rowerze crossowym (Crossbike), hybrydzie, trekkingowym, przełajowym albo kołach 28".' },
  { id: 'not-offer', label: 'Nie oferta sprzedaży', rule: 'Ogłoszenia „znaleziony / skradziony / szukam / kupię” (Gefunden, Gestohlen, Suche) albo cena 0.' },
  { id: 'multi-bike', label: 'Ogłoszenie zbiorcze', rule: 'Tytuł wymienia trzech lub więcej producentów rowerów albo zaczyna się od „Rowery / Fahrräder” i wymienia dwóch, albo mówi wprost o kilku rowerach („dwa rowery”, „zwei Fahrräder”) — to lista kilku rowerów (często handlarz), a nie jedna oferta, więc ceny i opisu nie da się przypisać do konkretnego roweru.' },
  { id: 'red-flag', label: 'Czerwona flaga', rule: 'Rower dziecięcy / młodzieżowy (także koła 20"/24" w tytule), elektryczny, tani full (rower z marketu) — wykryte w tekście.' },
  { id: 'full-suspension', label: 'Pełne zawieszenie', rule: 'Full / fully, vollgefedert, Dämpfer hinten, tylny amortyzator, pełne zawieszenie, softail… — szukamy sztywnych ram; amortyzowany widelec z przodu jest dozwolony.' },
  { id: 'part', label: 'Pojedyncza część', rule: 'Ogłoszenie dotyczy części (opony, rogi, chwyty, dzwonek, buty, kask, koszyk na bidon, błotniki, „części zamienne”, sam wymiar obejmy „31.8”, siodło, przerzutka, wieszak, zacisk…; także część nazwana w tytule bez producenta roweru, np. „Fahrrad Sattel”, „XT Kurbel … Mountainbike”), a nie roweru ani ramy.' },
  { id: 'part-code', label: 'Część po kodzie / marce', rule: 'Kod części Shimano („FC-M900”) bez słowa „rower/rama” albo marka amortyzatora („Marzocchi Bomber”, „Rock Shox”) bez rozpoznanego producenta roweru.' },
  { id: 'modern', label: 'Nowoczesny rower', rule: 'Koła 27,5"/29", hamulce tarczowe / hydrauliczne, karbon, Boost, napęd 1x11/1x12, tubeless, e-bike, klamkomanetki Dual Control, korba Hollowtech II.' },
  { id: 'too-new', label: `Rocznik ≥ ${MAX_YEAR}`, rule: `Podany rok produkcji ${MAX_YEAR} lub nowszy.` },
  { id: 'aluminium', label: 'Aluminium bez cech retro', rule: 'Rama aluminiowa (z opisu, z marki albo z naklejki odczytanej na zdjęciu, np. „Custom Alloy”) zostaje tylko wtedy, gdy tytuł sam mówi o retro / vintage / latach 90. albo podany rocznik to 1999 lub starszy. Sam znany model albo stara grupa osprzętu nie wystarcza — szukamy stali.' },
  { id: 'no-retro', label: 'Brak cech retro', rule: `Żadnej cechy retro (przy rowerze bez rozpoznanego producenta albo marki masowej, jak Romet, Kross czy Unibike, samo słowo „retro / kultowy” w opisie nie wystarcza — musi być w tytule albo musi być twarda cecha): słowa retro/vintage/klasyk/lata 90., rok 198x–199x, stal Cr-Mo / Tange / Reynolds / Columbus / True Temper, „stalowa rama” przy znanym producencie, mufy, cantilevery, Biopace, napęd SunTour (nie widelec SR Suntour), Deore DX / STX / Exage, kod grupy Shimano do ${MAX_GROUPSET_YEAR} r. — ani modelu z bazy rowerów.` },
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
  const makers = makersInTitle(title);
  if (makers >= 3 || (makers >= 2 && PLURAL_BIKES.test(title)) || SEVERAL_BIKES.test(title)) return 'multi-bike';
  // 20"/24" next to 26" wheels is the frame size ("Peugeot … 26" … 20""), not kids' wheels.
  if (an.redFlags.length || (KIDS_WHEELS.test(title) && !/\b26\s*(?:"|''|”|″|zoll|cal)/i.test(title))) return 'red-flag';
  if (FULL_SUSPENSION.test(rawText)) return 'full-suspension';
  if (an.itemType === 'components') return 'part';
  // "Fahrrad Sattel bike saddle…", "Shimano XT Kurbel … Mountainbike MTB": a part noun in a title that names no bike maker —
  // "Fahrrad / Mountainbike" only says what the part is for.
  if (!an.manufacturerId && STRONG_PART.test(normalizeText(title))) return 'part';
  // "SHIMANO Deore DX 075, Deore XT, XTR 900, Mtb, retro": a title that opens with a component brand and names no bike.
  if (!BIKE_WORD.test(title) && !an.manufacturerId && COMPONENT_LEAD.test(title)) return 'part-code';
  if (!BIKE_WORD.test(title) && (PART_CODE.test(title) || (!an.manufacturerId && FORK_BRAND.test(title)))) return 'part-code';
  if (MODERN.test(rawText)) return 'modern';
  const y = an.productionYear && /^\d{4}$/.test(an.productionYear) ? Number(an.productionYear) : null;
  if (y && y >= MAX_YEAR) return 'too-new';
  const decals = (a.listing.photo?.readings ?? []).map((r) => r.text).join(' ');
  if ((an.frameMaterial === 'aluminium' || ALU_DECAL.test(decals)) && !RETRO.test(title) && !(y && y <= 1999)) return 'aluminium';
  const era = an.groupsetEra?.match(/\d{4}/g)?.map(Number);
  if (era && Math.max(...era) <= MAX_GROUPSET_YEAR) return null;
  // OLX's structured "Materiał ramy: stal" line is ticked on any cheap bike — the seller's own words must carry the retro signal.
  const own = rawText.replace(/^\s*(?:Materia[lł] ramy|Rahmenmaterial)\s*:.*$/gim, ' ');
  // A no-name bike: "retro" somewhere in the description is sales talk — it needs the word in the title or a hard sign (year, tubing, parts).
  if (!titleOnly && !isQualityMaker(an.manufacturerId) && an.modelId == null && !RETRO.test(title) && !RETRO.test(own.replace(SOFT_RETRO, ' '))) return 'no-retro';
  if (titleOnly || RETRO.test(own) || an.modelId != null || (isQualityMaker(an.manufacturerId) && STEEL_WORD.test(own))) return null;
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
  /** "Maker model" queries taken from the bike database in this run, and where the rotation continues next time. */
  modelQueries?: string[];
  modelCursor?: number;
  portals: ScoutPortalStats[];
}
