/**
 * STEELHUNT scout — LOCAL ONLY (run on the owner's computer, e.g. by a scheduled Claude task).
 *
 * Reads public search-result pages of OLX.pl and Kleinanzeigen.de at a low request rate, runs every
 * candidate through the STEELHUNT analyzer and keeps only retro MTB (no road bikes, kids' bikes,
 * e-bikes, parts or modern bikes). Results are written to data/imports/auto-*.json, which the normal
 * ingestion publishes.
 *
 * Published records contain the title, price, location, date, link, up to 3 photo links and a
 * FACT SUMMARY generated from the analysis — never the seller's full description text.
 *
 * Usage: npm run scout            (writes files)
 *        npm run scout -- --dry   (prints summary only)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { normalizeImportRecord } from '../src/services/marketplaces/importer';
import { analyzeListings } from '../src/services/analysis/pipeline';
import { buildDatabase } from '../src/services/database/db';
import { DEFAULT_SETTINGS } from '../src/features/scoring/config';
import { isMtbLike, isRoadBike } from '../src/features/listings/focus';
import { tubingLabel } from '../src/services/analysis/textAnalyzer';
import type { AnalyzedListing } from '../src/types/listing';

const ROOT = resolve(import.meta.dirname, '..');
const IMPORTS = resolve(ROOT, 'data/imports');
const DRY = process.argv.includes('--dry');
const UA = 'steelhunt-scout/0.1 (personal use; low rate; +https://github.com/PafkoRoki/steelhunt)';
const pexec = promisify(execFile);

interface ScoutConfig {
  delayMs: number;
  keepDays: number;
  maxDetailFetches: number;
  olx: { enabled: boolean; radiusKm: number; queries: string[] };
  kleinanzeigen: { enabled: boolean; postcodePrefixes: string[]; queries: string[] };
}

/** Raw candidate as read from a portal (kept in memory only). */
interface Candidate {
  url: string;
  title: string;
  description: string; // full seller text — used for analysis only, never written out
  price: number | null;
  currency: 'PLN' | 'EUR';
  location: string | null;
  latitude?: number;
  longitude?: number;
  postedAt: string | null;
  images: string[];
  shipping?: boolean;
  negotiable?: boolean;
  condition?: string;
}

/** Record written to data/imports/auto-*.json. */
interface AutoRecord {
  url: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  location: string | null;
  latitude?: number;
  longitude?: number;
  coordsApprox?: boolean;
  postedAt: string | null;
  images: string[];
  condition?: string;
  itemType?: string;
  shipping?: boolean;
  firstSeen: string;
  lastSeen: string;
}

const cfg = JSON.parse(readFileSync(resolve(ROOT, 'config/scout.json'), 'utf8')) as ScoutConfig;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log: string[] = [];

/** Plain GET via curl with an honest, identifying User-Agent and a fixed delay between requests. */
async function get(url: string): Promise<string> {
  await sleep(cfg.delayMs);
  try {
    const { stdout } = await pexec('curl', ['-s', '-f', '-L', '--max-time', '30', '-A', UA, '-H', 'Accept-Language: pl,de;q=0.8,en;q=0.5', url], {
      maxBuffer: 30 * 1024 * 1024,
    });
    return stdout;
  } catch (e) {
    throw new Error(`pobranie nie powiodło się (${(e as { code?: number }).code ?? '?'}) ${url}`);
  }
}

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .trim();

// ---------------------------------------------------------------- OLX

// OLX: the public offers endpoint (/api/v1/offers/) is explicitly allowed in olx.pl/robots.txt.
const OLX_POZNAN_CITY_ID = 13983;
const OLX_STATE: Record<string, string> = { damaged: 'poor', new: 'excellent', refurbished: 'good' };

async function scoutOlx(): Promise<Candidate[]> {
  const out = new Map<string, Candidate>();
  for (const q of cfg.olx.queries) {
    const url = `https://www.olx.pl/api/v1/offers/?offset=0&limit=40&category_id=767&query=${encodeURIComponent(q)}&city_id=${OLX_POZNAN_CITY_ID}&distance=${cfg.olx.radiusKm}`;
    try {
      const ads: any[] = JSON.parse(await get(url))?.data ?? [];
      for (const ad of ads) {
        if (!ad?.url || out.has(ad.url)) continue;
        const pv = ad.params?.find((p: any) => p.key === 'price')?.value;
        const state = ad.params?.find((p: any) => p.key === 'state')?.value?.key;
        const city = [ad.location?.city?.name, ad.location?.district?.name].filter(Boolean).join(', ');
        out.set(ad.url, {
          url: ad.url,
          title: String(ad.title ?? '').trim(),
          // Seller text + structured params ("Materiał ramy: Aluminium", "Typ hamulca: ...") — analysis only.
          description: [
            decode(String(ad.description ?? '')),
            ...(ad.params ?? []).filter((p: any) => p.key !== 'price').map((p: any) => `${p.name}: ${p.value?.label ?? ''}`),
          ].join('\n'),
          price: typeof pv?.value === 'number' ? pv.value : null,
          currency: 'PLN',
          location: city || null,
          latitude: typeof ad.map?.lat === 'number' ? ad.map.lat : undefined,
          longitude: typeof ad.map?.lon === 'number' ? ad.map.lon : undefined,
          postedAt: ad.created_time ?? null,
          images: (ad.photos ?? []).slice(0, 3).map((p: any) => String(p.link).replace(':443', '').replace('{width}x{height}', '1000x0')),
          shipping: !!ad.delivery?.active,
          negotiable: !!pv?.negotiable,
          condition: state ? OLX_STATE[state] : undefined,
        });
      }
      log.push(`OLX „${q}”: ${ads.length}`);
    } catch (e) {
      log.push(`OLX „${q}”: BŁĄD ${(e as Error).message}`);
    }
  }
  return [...out.values()];
}

// ---------------------------------------------------------------- Kleinanzeigen

interface KaStub {
  id: string;
  url: string;
  title: string;
  snippet: string;
  location: string;
  priceText: string;
  image?: string;
}

function parseKaSearch(html: string): KaStub[] {
  const stubs: KaStub[] = [];
  for (const block of html.split(/<article\b/).slice(1)) {
    const art = block.split('</article>')[0];
    const id = art.match(/data-adid="(\d+)"/)?.[1];
    const href = art.match(/data-href="([^"]+)"/)?.[1];
    if (!id || !href) continue;
    let ld: { title?: string; description?: string; contentUrl?: string } = {};
    const ldRaw = art.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/)?.[1];
    try {
      if (ldRaw) ld = JSON.parse(ldRaw);
    } catch {
      /* ignore */
    }
    const text = decode(art.replace(/<script[\s\S]*?<\/script>/g, ' '));
    const location = text.match(/\b(\d{5}\s+[A-Za-zÄÖÜäöüß.\-() ]+?)(?=\s+(?:Heute|Gestern|\d{2}\.\d{2}\.\d{4}))/)?.[1]?.trim() ?? '';
    const priceText = text.match(/(\d[\d.]*\s*€(?:\s*VB)?|\bVB\b|Zu verschenken)/)?.[1] ?? '';
    stubs.push({ id, url: `https://www.kleinanzeigen.de${href}`, title: decode(ld.title ?? ''), snippet: decode(ld.description ?? ''), location, priceText, image: ld.contentUrl });
  }
  return stubs;
}

function kaPrice(t: string): number | null {
  if (/verschenken/i.test(t)) return 0;
  const m = t.match(/(\d[\d.]*)\s*€/);
  return m ? Number(m[1].replace(/\./g, '')) : null;
}

async function scoutKleinanzeigen(known: Set<string>, previous: Map<string, AutoRecord>): Promise<Candidate[]> {
  const stubs = new Map<string, KaStub>();
  for (const q of cfg.kleinanzeigen.queries) {
    const slug = encodeURIComponent(q.trim().toLowerCase().replace(/\s+/g, '-'));
    try {
      const found = parseKaSearch(await get(`https://www.kleinanzeigen.de/s-fahrraeder/${slug}/k0c217`));
      let kept = 0;
      for (const s of found) {
        const plz = s.location.slice(0, 2);
        if (!cfg.kleinanzeigen.postcodePrefixes.includes(plz) || stubs.has(s.id)) continue;
        stubs.set(s.id, s);
        kept++;
      }
      log.push(`Kleinanzeigen „${q}”: ${found.length} (we wschodnich Niemczech: ${kept})`);
    } catch (e) {
      log.push(`Kleinanzeigen „${q}”: BŁĄD ${(e as Error).message}`);
    }
  }

  // Quick pre-filter on title + snippet before spending detail requests.
  const db = buildDatabase();
  const pre = [...stubs.values()].filter((s) => {
    const probe = normalizeImportRecord({ url: s.url, title: s.title || 'x x x', description: s.snippet, price: kaPrice(s.priceText), currency: 'EUR', location: s.location });
    return keep(analyzeListings([probe], DEFAULT_SETTINGS, db)[0], s.title + ' ' + s.snippet);
  });

  const out: Candidate[] = [];
  let details = 0;
  for (const s of pre) {
    const prev = previous.get(s.url);
    if (prev || known.has(s.url) || details >= cfg.maxDetailFetches) {
      // Already known: refresh price/location from the search card, keep stored facts.
      if (prev) out.push({ url: s.url, title: s.title, description: prev.description, price: kaPrice(s.priceText), currency: 'EUR', location: s.location, postedAt: prev.postedAt, images: prev.images, negotiable: /VB/.test(s.priceText) });
      continue;
    }
    try {
      details++;
      const html = await get(s.url);
      const desc = decode(html.match(/id="viewad-description-text"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? s.snippet);
      const imgs = [...new Set([...html.matchAll(/data-imgsrc="([^"]+)"/g)].map((m) => m[1]))].slice(0, 3);
      const date = html.match(/id="viewad-extra-info"[\s\S]*?(\d{2})\.(\d{2})\.(\d{4})/);
      out.push({
        url: s.url,
        title: s.title,
        description: desc,
        price: kaPrice(s.priceText),
        currency: 'EUR',
        location: s.location,
        postedAt: date ? `${date[3]}-${date[2]}-${date[1]}T12:00:00Z` : null,
        images: imgs.length ? imgs : s.image ? [s.image] : [],
        shipping: /Versand möglich/i.test(html),
        negotiable: /VB/.test(s.priceText),
      });
    } catch (e) {
      log.push(`Kleinanzeigen szczegóły ${s.id}: BŁĄD ${(e as Error).message}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- filtering & fact summary

const MODERN = /(27[,.]5|\b29\s*(?:"|''|zoll|er|cali)|\b29er\b|hydraul|tarczow|scheibenbremse|\bdisc\b|e[\s-]?bike|pedelec|carbon|karbon|boost|1x1[12]\b|tubeless)/i;

function keep(a: AnalyzedListing, rawText: string): boolean {
  const an = a.analysis;
  if (isRoadBike(a) || !isMtbLike(a)) return false;
  if (an.redFlags.length) return false;
  if (an.itemType === 'components') return false;
  if (MODERN.test(rawText)) return false;
  const y = an.productionYear && /^\d{4}$/.test(an.productionYear) ? Number(an.productionYear) : null;
  if (y && y >= 2005) return false;
  // Needs at least one "retro" signal — otherwise it's just a used MTB.
  const retro = /(retro|vintage|oldschool|old\s*school|klasyk|kult|\b(?:19[89]\d)\b|lata\s*[89]0|\b[89]0(?:er|s)\b|starrgabel|sztywn\w*\s*widel|cr-?mo|chrom|stahl|stalow|tange|reynolds|columbus|ishiwata|true\s*temper|mufow|muffen|cantilever|biopace|deore\s*(?:xt|lx|dx)|suntour)/i;
  return retro.test(rawText) || an.modelId != null;
}

const NEGO: Record<string, string> = {
  'Cena do negocjacji': 'cena do negocjacji',
  'Możliwa zamiana': 'możliwa zamiana',
  'Pilna sprzedaż': 'sprzedaż pilnie',
  'Przeprowadzka / likwidacja': 'przeprowadzka',
  'Z piwnicy / strychu / garażu': 'z piwnicy / strychu',
};

function factSummary(a: AnalyzedListing, negotiable: boolean): string {
  const an = a.analysis;
  const parts: string[] = [];
  if (an.productionYear) parts.push(/^lata/.test(an.productionYear) ? an.productionYear : `rocznik ${an.productionYear}`);
  const db = buildDatabase();
  const spec = an.tubing.tubingId ? db.tubingById.get(an.tubing.tubingId) : null;
  const fromListing = an.tubing.evidence[0] && an.tubing.evidence[0].source !== 'model-db';
  if (spec && fromListing) parts.push(`rama ${tubingLabel(spec)}${an.tubing.scope === 'main-tubes' ? ' (rury główne)' : ''}`);
  else if (an.frameMaterial === 'aluminium') parts.push('rama aluminiowa');
  else if (an.frameMaterial.startsWith('steel')) parts.push('rama stalowa');
  const fork = an.tubing.evidence.find((e) => e.label.startsWith('Widelec:'));
  if (fork) parts.push(fork.label.replace('Widelec:', 'widelec').trim());
  if (an.frameConstruction === 'lugged') parts.push('rama mufowana');
  if (an.frameConstruction === 'fillet-brazed') parts.push('rama lutowana (fillet brazed)');
  for (const f of an.features) if (f !== 'Rama mufowana') parts.push(f.toLowerCase());
  for (const c of an.components) parts.push(c.name);
  if (an.wheelSize) parts.push(`koła ${an.wheelSize}`);
  const nego = new Set(Object.keys(NEGO).filter((k) => a.analysis.dealBreakdown.some((b) => b.key === 'negotiation' && b.note?.includes(k))).map((k) => NEGO[k]));
  if (negotiable) nego.add('cena do negocjacji');
  parts.push(...nego);
  const facts = parts.length ? parts.join(', ') : 'brak szczegółów technicznych w ogłoszeniu';
  return `${facts}. (Fakty wyciągnięte automatycznie z ogłoszenia — szczegóły w oryginale.)`;
}

// ---------------------------------------------------------------- main

function readAuto(name: string): AutoRecord[] {
  const p = resolve(IMPORTS, name);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as AutoRecord[]) : [];
}

function manualUrls(): Set<string> {
  const urls = new Set<string>();
  for (const f of readdirSync(IMPORTS).filter((f) => f.endsWith('.json') && !f.startsWith('auto-'))) {
    try {
      for (const r of JSON.parse(readFileSync(resolve(IMPORTS, f), 'utf8'))) urls.add(String(r.url).split('?')[0]);
    } catch {
      /* ignore */
    }
  }
  return urls;
}

function toRecords(cands: Candidate[], previous: AutoRecord[], known: Set<string>, nowIso: string): { records: AutoRecord[]; added: number } {
  const db = buildDatabase();
  const prevByUrl = new Map(previous.map((r) => [r.url, r]));
  const records = new Map<string, AutoRecord>();
  let added = 0;

  for (const c of cands) {
    if (known.has(c.url.split('?')[0])) continue; // curated manually already
    const listing = normalizeImportRecord({
      url: c.url,
      title: c.title || 'bez tytułu',
      description: c.description,
      price: c.price,
      currency: c.currency,
      location: c.location,
      postedAt: c.postedAt,
      condition: c.condition as 'good' | undefined,
    });
    const a = analyzeListings([listing], DEFAULT_SETTINGS, db)[0];
    if (!keep(a, `${c.title} ${c.description}`)) continue;
    const prev = prevByUrl.get(c.url);
    if (!prev) added++;
    records.set(c.url, {
      url: c.url,
      title: c.title,
      description: prev && c.description === prev.description ? prev.description : factSummary(a, !!c.negotiable),
      price: c.price,
      currency: c.currency,
      location: c.location,
      ...(c.latitude != null && c.longitude != null ? { latitude: c.latitude, longitude: c.longitude, coordsApprox: true } : {}),
      postedAt: c.postedAt,
      images: c.images,
      condition: a.analysis.condition !== 'unknown' ? a.analysis.condition : undefined,
      itemType: a.analysis.itemType,
      shipping: c.shipping,
      firstSeen: prev?.firstSeen ?? nowIso,
      lastSeen: nowIso,
    });
  }
  // Keep previously found listings for a while even if they fell off the first result page.
  const cutoff = Date.now() - cfg.keepDays * 86400_000;
  // Re-check them against the current filters (filters improve over time).
  for (const r of previous) {
    if (records.has(r.url) || Date.parse(r.lastSeen) < cutoff || known.has(r.url.split('?')[0])) continue;
    // Re-detect the item type from the text (the stored one may come from older, weaker rules).
    const a = analyzeListings([normalizeImportRecord({ ...r, itemType: undefined })], DEFAULT_SETTINGS, db)[0];
    if (keep(a, `${r.title} ${r.description}`)) records.set(r.url, r);
  }
  return { records: [...records.values()], added };
}

async function main() {
  const nowIso = new Date().toISOString();
  const known = manualUrls();
  const results: { name: string; records: AutoRecord[]; added: number }[] = [];

  if (cfg.olx.enabled) {
    const prev = readAuto('auto-olx.json');
    const cands = await scoutOlx();
    results.push({ name: 'auto-olx.json', ...toRecords(cands, prev, known, nowIso) });
  }
  if (cfg.kleinanzeigen.enabled) {
    const prev = readAuto('auto-kleinanzeigen.json');
    const cands = await scoutKleinanzeigen(known, new Map(prev.map((r) => [r.url, r])));
    results.push({ name: 'auto-kleinanzeigen.json', ...toRecords(cands, prev, known, nowIso) });
  }

  console.log(log.join('\n'));
  for (const r of results) {
    console.log(`\n${r.name}: ${r.records.length} ogłoszeń (nowe: ${r.added})`);
    if (!DRY) writeFileSync(resolve(IMPORTS, r.name), '[\n' + r.records.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n]\n', 'utf8');
  }

  // Top deals across everything (for the run report).
  const all = results.flatMap((r) => r.records).map((r) => normalizeImportRecord(r));
  const top = analyzeListings(all, DEFAULT_SETTINGS, buildDatabase())
    .sort((a, b) => b.analysis.dealScore - a.analysis.dealScore)
    .slice(0, 8);
  console.log('\nNajlepsze wg Deal Score:');
  for (const t of top) {
    console.log(`  ${t.analysis.dealScore}  ${t.listing.title.slice(0, 60)} — ${t.listing.price ?? '?'} ${t.listing.currency} — ${t.listing.locationName ?? '?'} ${t.analysis.isBargain ? '[OKAZJA]' : ''}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
