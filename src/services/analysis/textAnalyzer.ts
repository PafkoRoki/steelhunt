/**
 * Heuristic text analysis — works without AI.
 * Extracts manufacturer, model, tubing (with scope + confidence), material, construction,
 * wheel size, category, features, components, condition, item type and red flags
 * from the listing title + description. Everything returned here is DERIVED data.
 */
import type {
  BicycleCategory,
  ConfidenceLevel,
  Evidence,
  FrameConstruction,
  FrameMaterial,
  ItemType,
  ListingCondition,
  SourceListing,
  TubingIdentification,
  TubingScope,
} from '../../types/listing';
import type { BikeModel, Manufacturer, TubingSpec } from '../../types/database';
import { tubingSpecificity, type BikeDatabase } from '../database/db';
import { aliasRegex, normalizeText } from '../../utils/text';

export interface TextFacts {
  manufacturer: Manufacturer | null;
  manufacturerEvidence: Evidence | null;
  model: BikeModel | null;
  tubing: TubingIdentification;
  tubingSpec: TubingSpec | null;
  forkTubing: TubingSpec | null;
  butted: boolean;
  frameMaterial: FrameMaterial;
  construction: FrameConstruction;
  wheelSize: string | null;
  category: BicycleCategory;
  itemType: ItemType;
  condition: ListingCondition;
  year: string | null;
  features: string[];
  components: { name: string; tier: number }[];
  redFlags: string[];
  negotiationSignals: string[];
  warnings: string[];
  hasDecalMention: boolean;
}

/** Model aliases distinctive enough to identify the bike even without a brand mention. */
const DISTINCTIVE_MODEL_ALIASES = new Set([
  'stumpjumper', 'stump jumper', 'rockhopper', 'rock hopper', 'karakoram', 'tequesta', 'lava dome', 'cinder cone',
  'kilauea', 'muirwoods', 'world traveller', 'worldtraveller', 'terraliner', 'yo eddy', 'hoo koo e koo', 'px10', 'px-10',
  'multitrack 750', 'accordo',
]);

const FORK_RE = /\b(widel\w*|fork\w*|amortyzator\w*)\b/;
const FRAME_RE = /\b(ram[aeyi]\w*|frame\w*|rury\w*|tubing|tubeset)\b/;
const MAIN_TUBES_RE = /(main\s*tubes?|rury\s*glown\w*|glown\w*\s*rury|3\s*main|trzy\s*(?:glowne\s*)?rury|main\s*triangle|glowny\s*trojkat)/;
const FRAME_AND_FORK_RE = /(ram[aeyi]\w*\s*(?:i|oraz|and|\+|&|z)\s*widel\w*|widel\w*\s*(?:i|oraz|and|\+|&)\s*ram[aeyi]\w*|frame\s*(?:and|&|\+)\s*fork)/;
const DECAL_RE = /(naklejk\w*|decal\w*|sticker\w*|emblemat\w*|oryginaln\w*\s*oznaczen\w*)/;
const BUTTED_RE = /(double[\s-]*butted|triple[\s-]*butted|\bbutted\b|cieniowan\w*|\bd\.?b\.?\b(?=.{0,10}(?:cr|rur|tub))|\btb\b(?=.{0,10}(?:cr|rur|tub)))/;

// ---------- manufacturer & model ----------

function findManufacturer(title: string, desc: string, db: BikeDatabase) {
  let best: { m: Manufacturer; pos: number; len: number; where: 'title' | 'description'; alias: string } | null = null;
  for (const m of db.manufacturers) {
    for (const alias of m.aliases) {
      const short = alias.replace(/[^a-z0-9]/g, '').length <= 3 || alias === 'orange' || alias === 'fisher';
      const re = aliasRegex(alias);
      const t = re.exec(title);
      let pos = -1;
      let where: 'title' | 'description' = 'title';
      if (t) pos = t.index;
      else if (!short) {
        const d = re.exec(desc);
        if (d) {
          pos = 10000 + d.index;
          where = 'description';
        }
      }
      if (pos < 0) continue;
      if (!best || pos < best.pos || (pos === best.pos && alias.length > best.len)) {
        best = { m, pos, len: alias.length, where, alias };
      }
    }
  }
  return best;
}

function findModel(title: string, desc: string, db: BikeDatabase, manufacturer: Manufacturer | null) {
  const candidates = manufacturer ? db.models.filter((m) => m.manufacturerId === manufacturer.id) : db.models;
  let best: { model: BikeModel; len: number; where: 'title' | 'description' } | null = null;
  for (const model of candidates) {
    for (const alias of model.aliases) {
      if (!manufacturer && !DISTINCTIVE_MODEL_ALIASES.has(alias)) continue;
      const re = aliasRegex(alias);
      const where = re.test(title) ? 'title' : re.test(desc) ? 'description' : null;
      if (!where) continue;
      const len = alias.length + (where === 'title' ? 100 : 0);
      if (!best || len > best.len) best = { model, len, where };
    }
  }
  return best;
}

// ---------- tubing ----------

interface TubingHit {
  spec: TubingSpec;
  index: number;
  length: number;
  scope: TubingScope;
  decal: boolean;
  snippet: string;
}

function scopeFor(text: string, index: number, length: number): { scope: TubingScope; decal: boolean } {
  const wide = text.slice(Math.max(0, index - 60), index + length + 60);
  const decal = DECAL_RE.test(wide);
  if (MAIN_TUBES_RE.test(wide)) return { scope: 'main-tubes', decal };
  // "rama i widelec cr-mo" / "frame and fork" → the claim covers the frame too.
  if (FRAME_AND_FORK_RE.test(wide)) return { scope: 'full-frame', decal };
  // Which noun is closest to the tubing mention — "widelec Cr-Mo, rama stalowa" → fork.
  // Clause boundaries (, . ;) count as extra distance so the mention binds to its own clause.
  const forkD = nearestDistance(text, index, length, FORK_RE);
  const frameD = nearestDistance(text, index, length, FRAME_RE);
  if (forkD != null && (frameD == null || forkD < frameD)) return { scope: 'fork-only', decal };
  if (frameD != null) return { scope: 'full-frame', decal };
  return { scope: 'unknown', decal };
}

function nearestDistance(text: string, index: number, length: number, re: RegExp): number | null {
  const lo = Math.max(0, index - 32);
  const hi = Math.min(text.length, index + length + 32);
  const g = new RegExp(re.source, 'g');
  let best: number | null = null;
  let m: RegExpExecArray | null;
  const window = text.slice(lo, hi);
  while ((m = g.exec(window))) {
    const start = lo + m.index;
    const end = start + m[0].length;
    const gap = end <= index ? text.slice(end, index) : text.slice(index + length, start);
    const d = (end <= index ? index - end : start - (index + length)) + (/[,.;]/.test(gap) ? 25 : 0);
    if (start >= index && start < index + length) continue;
    if (best == null || d < best) best = d;
  }
  return best;
}

function findTubing(text: string, db: BikeDatabase): TubingHit[] {
  const hits: TubingHit[] = [];
  for (const spec of db.tubing) {
    for (const pattern of spec.patterns) {
      const re = new RegExp(pattern, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        const { scope, decal } = scopeFor(text, m.index, m[0].length);
        hits.push({
          spec,
          index: m.index,
          length: m[0].length,
          scope,
          decal,
          snippet: text.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25).trim(),
        });
      }
    }
  }
  // Drop generic hits that are fully covered by a more specific hit at the same place.
  return hits.filter(
    (h) =>
      !hits.some(
        (o) =>
          o !== h &&
          tubingSpecificity(o.spec) > tubingSpecificity(h.spec) &&
          o.index <= h.index + h.length &&
          h.index <= o.index + o.length,
      ),
  );
}

function pickFrameHit(hits: TubingHit[]): TubingHit | null {
  const frameHits = hits.filter((h) => h.scope !== 'fork-only' && h.spec.material !== 'aluminium');
  if (!frameHits.length) return null;
  return frameHits.sort((a, b) => {
    const s = tubingSpecificity(b.spec) - tubingSpecificity(a.spec);
    if (s) return s;
    // Two generic claims (e.g. "hi-ten" and "cr-mo") → stay conservative: pick the LOWER score.
    if (tubingSpecificity(a.spec) === 0) return a.spec.score - b.spec.score;
    const scopeRank = (x: TubingHit) => (x.scope === 'full-frame' ? 2 : x.scope === 'main-tubes' ? 1 : 0);
    const sr = scopeRank(b) - scopeRank(a);
    if (sr) return sr;
    return b.length - a.length;
  })[0];
}

function tubingConfidence(hit: TubingHit): ConfidenceLevel {
  const specific = tubingSpecificity(hit.spec) === 2;
  if (specific && (hit.scope === 'full-frame' || hit.scope === 'main-tubes') && hit.decal) return 'strong';
  if (specific && hit.scope === 'full-frame') return 'strong';
  if (specific) return 'probable';
  if (hit.spec.id === 'generic-hiten') return 'probable'; // nobody falsely claims Hi-Ten
  return 'unverified';
}

// ---------- misc extractors ----------

function detectMaterial(text: string, tubing: TubingSpec | null): FrameMaterial {
  const alu = /((?:ram[aeyi]|frame)\s*(?:\S+\s*){0,2}(?:alu\b|alumin\w*|7005|6061)|(?:alu|alumin\w*)\s*(?:\S+\s*){0,1}(?:ram[aeyi]|frame))/;
  const carbon = /((?:ram[aeyi]|frame)\s*(?:\S+\s*){0,2}(?:carbon\w*|karbon\w*)|(?:carbon\w*|karbon\w*)\s*(?:ram[aeyi]|frame))/;
  const ti = /(tytan\w*|titanium)\s*(?:ram|frame)|(?:ram[aeyi]|frame)\s*(?:\S+\s*){0,2}(tytan\w*|titanium)/;
  if (tubing) {
    if (tubing.material === 'hiten') return 'steel-hiten';
    if (tubing.material === 'aluminium') return 'aluminium';
    if (tubing.score >= 85) return 'steel-premium';
    if (tubing.material === 'crmo' || tubing.material === 'mn-mo') return 'steel-crmo';
    return 'steel-unknown';
  }
  if (ti.test(text)) return 'titanium';
  if (carbon.test(text)) return 'carbon';
  if (alu.test(text)) return 'aluminium';
  if (/(stalow\w*\s*ram|ram[aeyi]\s*(?:\S+\s*){0,1}stalow|steel\s*frame|\bstal\b|stalowy)/.test(text)) return 'steel-unknown';
  return 'unknown';
}

function detectConstruction(text: string): FrameConstruction {
  if (/(mufow\w*|\bmuf[ay]\b|lugged|\blugs\b|lugi)/.test(text)) return 'lugged';
  if (/(fillet|lutowan\w*\s*mosi|brazed)/.test(text)) return 'fillet-brazed';
  if (/(\btig\b|spawan\w*)/.test(text)) return 'tig';
  return 'unknown';
}

function detectWheelSize(text: string, declared?: string): string | null {
  if (declared) return declared;
  if (/(\b26\s*(?:"|''|”|cal\w*|in\b|x\s?\d)|kol\w*\s*26\b|\b559\b)/.test(text)) return '26"';
  if (/(\b700\s*c\b|\b28\s*(?:"|''|”|cal\w*|x\s?\d)|kol\w*\s*28\b|\b622\b)/.test(text)) return '28" / 700c';
  if (/(\b27\s*(?:"|''|”|cal\w*|x\s?1)|\b630\b)/.test(text)) return '27"';
  if (/(\b24\s*(?:"|''|”|cal\w*)|kol\w*\s*24\b)/.test(text)) return '24"';
  if (/(\b20\s*(?:"|''|”|cal\w*)|kol\w*\s*20\b)/.test(text)) return '20"';
  return null;
}

function detectYear(text: string): string | null {
  const y = text.match(/\b(19[5-9]\d|200\d)\b(?!\s*(?:zl|pln|km|g\b|gram))/);
  if (y) return y[1];
  const dec = text.match(/lat(?:a|ach)?\s*(50|60|70|80|90)/);
  if (dec) return `lata ${dec[1]}.`;
  return null;
}

function detectItemType(title: string, text: string, declared?: ItemType): ItemType {
  if (declared) return declared;
  if (/(rama\s*(?:\+|z|i)\s*widel|frameset|komplet\s*rama)/.test(text)) return 'frameset';
  if (/^(rama|frame)\b/.test(title) || /(sama\s*rama|tylko\s*rama|frame\s*only)/.test(text)) return 'frame';
  if (/^(czesci|grupa|osprzet|komponenty|korba|przerzutk|piasta|kola)\b/.test(title)) return 'components';
  return 'complete';
}

function detectCondition(text: string, declared?: ListingCondition): ListingCondition {
  if (declared && declared !== 'unknown') return declared;
  if (/(na\s*czesci|niekompletn\w*|bez\s*kol|brak\s*kol|projekt\b|do\s*odbudowy)/.test(text)) return 'project';
  if (/(do\s*remontu|do\s*renowacji|mocno\s*zardzewial|skorodowan|peknie|pekniet)/.test(text)) return 'poor';
  if (/(drobnych\s*poprawek|slady\s*uzytk|wymaga\s*serwisu|do\s*serwisu|lekka\s*rdza|powierzchown\w*\s*rdz|nalot|rysy)/.test(text)) return 'fair';
  if (/(idealn\w*|jak\s*nowy|perfekcyjn\w*|stan\s*kolekcjonersk)/.test(text)) return 'excellent';
  if (/(dobry\s*stan|bardzo\s*dobr\w*\s*stan|zadban\w*|sprawn\w*|gotow\w*\s*do\s*jazdy|serwisowan)/.test(text)) return 'good';
  return 'unknown';
}

function detectCategory(
  text: string,
  itemType: ItemType,
  model: BikeModel | null,
  year: string | null,
): BicycleCategory {
  if (itemType === 'frame' || itemType === 'frameset') return 'frameset';
  if (itemType === 'components') return 'components';
  if (/randonne/.test(text)) return 'randonneur';
  if (/\bgravel\b/.test(text)) return 'gravel-conversion';
  if (model) return model.category;
  if (/(turystyczn\w*|touring|trekking\w*|wyprawow\w*|sakw)/.test(text)) return 'touring';
  if (/(szosow\w*|kolarzowk\w*|kolark\w*|\bszosa\b|road\s*bike|wyscigow\w*)/.test(text)) return 'vintage-road';
  if (/(transportow\w*|cargo|towarow\w*|dostawcz\w*|listonosz\w*|pocztow\w*)/.test(text)) return 'utility';
  if (/(\batb\b|all[\s-]*terrain|hybryd\w*|crossow\w*)/.test(text)) return 'atb';
  if (/(\bmtb\b|gorsk\w*|goral\w*|mountain)/.test(text)) {
    const old = year && (year.startsWith('lata') ? /(70|80|90)/.test(year) : parseInt(year, 10) <= 1996);
    if (old || /(vintage|retro|stary|starszy|klasyk|oldschool|old\s*school)/.test(text)) return 'vintage-mtb';
    return 'retro-mtb';
  }
  if (/(miejsk\w*|\bcity\b|holender\w*|damk\w*|damsk\w*)/.test(text)) return 'city';
  return 'unknown';
}

const FEATURE_RULES: [string, RegExp][] = [
  ['Sztywny widelec', /(sztywn\w*\s*widel\w*|rigid|bez\s*amortyzac\w*|widel\w*\s*sztywn\w*)/],
  ['Widelec amortyzowany', /(amortyzowan\w*\s*widel|widel\w*\s*amortyzowan|amortyzator\s*przedn|rock\s*shox|manitou|suspension\s*fork)/],
  ['Mocowania bagażnika', /(bagaznik\w*|\brack\b|mocowani\w*\s*(?:pod\s*)?bagaz|eyelet|oczk\w*)/],
  ['Mocowania błotników', /(blotnik\w*|fender\w*)/],
  ['Mocowania koszyka', /(koszyk\w*|bidon\w*|bottle\s*cage)/],
  ['Hamulce cantilever', /(cantilever\w*|\bcanti\b|kantilew\w*)/],
  ['Hamulce V-brake', /(v-?brake|\bv\s*brake)/],
  ['Kierownica baranek', /(baranek|drop\s*bar|kierownic\w*\s*szosow)/],
  ['Oryginalny lakier', /(oryginaln\w*\s*lakier|original\s*paint|fabryczn\w*\s*lakier)/],
  ['Naklejki rur widoczne', DECAL_RE],
  ['Prądnica / oświetlenie', /(pradnic\w*|dynamo|oswietleni)/],
  ['Napęd 3x7 / 3x8', /(3\s*x\s*[78]\b|21\s*bieg|24\s*biegi?)/],
];

const RED_FLAG_RULES: [string, RegExp][] = [
  ['Rower dziecięcy / junior', /(dzieci\w*|dzieciec\w*|junior|\bbmx\b)/],
  ['Rower elektryczny', /(elektryczn\w*|e-?bike|wspomaganie)/],
  ['Tani full suspension (zwykle niska jakość)', /(podwojn\w*\s*amortyzac|pelne\s*zawieszenie|full\s*(?:suspension|sus)|amortyzator\w*\s*tyln)/],
  ['Rower z marketu (BSO)', /(supermarket\w*|z\s*marketu|tesco|carrefour|auchan|biedronk\w*|lidl)/],
  ['Fatbike / niestandard', /fat\s*bike/],
];

const NEGOTIATION_RULES: [string, RegExp][] = [
  ['Cena do negocjacji', /(do\s*negocjacji|do\s*uzgodnienia|do\s*dogadania|negocjuj\w*|\bnegocj\w*)/],
  ['Możliwa zamiana', /zamian\w*|zamienie/],
  ['Pilna sprzedaż', /(pilne|pilnie|szybka\s*sprzedaz|musze\s*sprzedac)/],
  ['Przeprowadzka / likwidacja', /(przeprowadzk\w*|likwidacj\w*|wyprzedaz\w*|porzadki)/],
  ['Z piwnicy / strychu / garażu', /(z\s*piwnicy|ze\s*strychu|z\s*garazu|z\s*szopy|po\s*dziadku|po\s*tacie)/],
];

// ---------- main ----------

export function analyzeText(listing: SourceListing, db: BikeDatabase): TextFacts {
  const title = normalizeText(listing.title);
  const desc = normalizeText(listing.description);
  const text = `${title} . ${desc}`;
  const warnings: string[] = [];

  // Manufacturer
  const mf = findManufacturer(title, desc, db);
  let manufacturer = mf?.m ?? null;
  let manufacturerEvidence: Evidence | null = mf ? { label: mf.m.name, source: mf.where, snippet: mf.alias } : null;
  if (manufacturer && mf?.where === 'description') {
    // Brand only in description near a component word → likely a component brand, not the frame.
    const compRe = new RegExp(`${mf.alias}\\s*(?:\\S+\\s*){0,2}(?:kierownic|mostek|sztyc|opon|kol[ao]|siodl|pedal|stem|bar|tire)`);
    if (compRe.test(desc)) {
      warnings.push(`Marka „${manufacturer.name}” pojawia się przy komponencie — może nie dotyczyć ramy.`);
      manufacturer = null;
      manufacturerEvidence = null;
    }
  }

  // Model
  const md = findModel(title, desc, db, manufacturer);
  const model = md?.model ?? null;
  if (model && !manufacturer) {
    manufacturer = db.manufacturerById.get(model.manufacturerId) ?? null;
    if (manufacturer) manufacturerEvidence = { label: manufacturer.name, source: 'model-db', snippet: model.name };
  }
  if (manufacturer?.notes && /dwie\s|nie mylić|sama naklejka/i.test(manufacturer.notes)) warnings.push(manufacturer.notes);

  // Tubing
  const hits = findTubing(text, db);
  const frameHit = pickFrameHit(hits);
  const forkHit = hits.find((h) => h.scope === 'fork-only') ?? null;
  const butted = BUTTED_RE.test(text);
  let tubing: TubingIdentification;
  let tubingSpec: TubingSpec | null = null;

  if (frameHit) {
    tubingSpec = frameHit.spec;
    const evidence: Evidence[] = [
      { label: tubingLabel(frameHit.spec), source: frameHit.index < title.length ? 'title' : 'description', snippet: frameHit.snippet },
    ];
    const tw: string[] = [];
    if (frameHit.scope === 'main-tubes') tw.push('Specyfikacja dotyczy tylko rur głównych (main tubes) — tylny trójkąt / widelec mogą być z innej stali.');
    if (frameHit.scope === 'unknown') tw.push('Nie wiadomo, czy oznaczenie dotyczy ramy, widelca czy komponentu.');
    if (tubingSpecificity(frameHit.spec) < 2) tw.push('Brak konkretnej serii rur — jakość niezweryfikowana.');
    if (!frameHit.decal && tubingSpecificity(frameHit.spec) === 2) tw.push('Informacja tylko z opisu sprzedającego — poproś o zdjęcie naklejki.');
    tubing = {
      tubingId: frameHit.spec.id,
      manufacturer: frameHit.spec.manufacturer === 'Generic' ? null : frameHit.spec.manufacturer,
      series: frameHit.spec.series,
      scope: frameHit.scope === 'unknown' ? 'unknown' : frameHit.scope,
      confidence: tubingConfidence(frameHit),
      evidence,
      warnings: tw,
    };
  } else if (
    model?.typicalTubing &&
    db.tubingById.get(model.typicalTubing) &&
    // The listing says the frame is NOT steel (e.g. a later aluminium Rockhopper) → don't assume the model's steel tubing.
    !['aluminium', 'carbon', 'titanium'].includes(detectMaterial(text, null))
  ) {
    tubingSpec = db.tubingById.get(model.typicalTubing)!;
    tubing = {
      tubingId: tubingSpec.id,
      manufacturer: tubingSpec.manufacturer === 'Generic' ? null : tubingSpec.manufacturer,
      series: tubingSpec.series,
      scope: 'unknown',
      confidence: model.verification === 'unverified' ? 'unverified' : 'probable',
      evidence: [{ label: `Typowo dla modelu ${model.name}`, source: 'model-db', snippet: model.tubingNote }],
      warnings: ['Rury przypisane na podstawie bazy modeli, nie ogłoszenia. Roczniki się różnią — zweryfikuj naklejkę.'],
    };
  } else {
    tubing = { tubingId: null, manufacturer: null, series: null, scope: 'unknown', confidence: 'unknown', evidence: [], warnings: [] };
  }
  if (forkHit) {
    tubing.evidence.push({ label: `Widelec: ${tubingLabel(forkHit.spec)}`, source: 'description', snippet: forkHit.snippet });
    tubing.warnings.push(`„${tubingLabel(forkHit.spec)}” dotyczy widelca — nie świadczy o rurach ramy.`);
  }

  const frameMaterial = detectMaterial(text, frameHit ? tubingSpec : null);
  const construction = detectConstruction(text) !== 'unknown' ? detectConstruction(text) : model?.construction ?? 'unknown';
  const itemType = detectItemType(title, text, listing.declared?.itemType);
  const year = detectYear(text);
  const category = detectCategory(text, itemType, model, year);
  const condition = detectCondition(text, listing.declared?.condition);
  const wheelSize = detectWheelSize(text, listing.declared?.wheelSize);

  const features = FEATURE_RULES.filter(([, re]) => re.test(text)).map(([f]) => f);
  if (construction === 'lugged') features.push('Rama mufowana');

  const components = db.components
    .filter((c) => c.patterns.some((p) => new RegExp(p, 'i').test(text)))
    .map((c) => ({ name: c.name, tier: c.tier }));

  const redFlags = RED_FLAG_RULES.filter(([, re]) => re.test(text)).map(([f]) => f);
  const negotiationSignals = NEGOTIATION_RULES.filter(([, re]) => re.test(text)).map(([f]) => f);

  return {
    manufacturer,
    manufacturerEvidence,
    model,
    tubing,
    tubingSpec,
    forkTubing: forkHit?.spec ?? null,
    butted,
    frameMaterial,
    construction,
    wheelSize,
    category,
    itemType,
    condition,
    year,
    features,
    components,
    redFlags,
    negotiationSignals,
    warnings,
    hasDecalMention: DECAL_RE.test(text),
  };
}

export function tubingLabel(t: TubingSpec): string {
  return t.manufacturer === 'Generic' ? t.series : `${t.manufacturer} ${t.series}`;
}

