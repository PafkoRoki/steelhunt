/**
 * STEELHUNT scout — LOCAL ONLY (run on the owner's computer, e.g. by a scheduled Claude task).
 *
 * Reads public search-result pages of OLX.pl, Allegro Lokalnie, Sprzedajemy.pl and Kleinanzeigen.de
 * at a low request rate (only paths robots.txt allows), runs every
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
import { haversineKm, resolveLocation } from '../src/services/geolocation/geo';
import type { AnalyzedListing } from '../src/types/listing';

const ROOT = resolve(import.meta.dirname, '..');
const IMPORTS = resolve(ROOT, 'data/imports');
const DRY = process.argv.includes('--dry');
/** `--only=ebay,olx` runs just those portals (CI runs `--only=ebay`, the API source that needs secrets). */
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',') ?? null;
const run = (name: string) => !ONLY || ONLY.includes(name);
const UA = 'steelhunt-scout/0.1 (personal use; low rate; +https://github.com/PafkoRoki/steelhunt)';
const pexec = promisify(execFile);

interface ScoutConfig {
  delayMs: number;
  keepDays: number;
  maxDetailFetches: number;
  olx: { enabled: boolean; radiusKm: number; queries: string[] };
  kleinanzeigen: { enabled: boolean; postcodePrefixes: string[]; queries: string[] };
  allegroLokalnie?: { enabled: boolean; radiusKm: number; delayMs?: number; queries: string[] };
  sprzedajemy?: { enabled: boolean; radiusKm: number; delayMs?: number; queries: string[] };
  ebay?: { enabled: boolean; marketplaceId: string; categoryIds?: string; limit?: number; postcodePrefixes?: string[]; queries: string[] };
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

// ---------------------------------------------------------------- Polish card portals (Allegro Lokalnie, Sprzedajemy)

/** Search-result card shared by the HTML portals. */
interface CardStub {
  url: string;
  title: string;
  price: number | null;
  location: string;
  image?: string;
  negotiable?: boolean;
}

const POZNAN = { lat: 52.4064, lng: 16.9252 };

/** Distance from Poznań by the town gazetteer; null when the town is unknown (kept, flagged in the app). */
function kmFromPoznan(location: string): number | null {
  const p = resolveLocation(location);
  return p ? haversineKm(POZNAN.lat, POZNAN.lng, p.lat, p.lng) : null;
}

function plPrice(s: string | undefined): number | null {
  if (!s || !/\d/.test(s)) return null;
  const n = Number(s.replace(/&nbsp;|\s/g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Allegro Lokalnie: /oferty/... search pages are allowed by robots.txt (only /oferty/wystaw/ is disallowed).
function parseAllegroLokalnie(html: string): CardStub[] {
  const out: CardStub[] = [];
  for (const block of html.split(/<a\b(?=[^>]*class="mlc-card mlc-itembox")/).slice(1)) {
    const card = block.split('</article>')[0];
    const href = card.match(/href="(\/oferta\/[^"?#]+)/)?.[1];
    if (!href) continue;
    out.push({
      url: `https://allegrolokalnie.pl${href}`,
      title: decode(card.match(/mlc-itembox__title"[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? ''),
      price: plPrice(card.match(/ml-offer-price__dollars">([^<]+)</)?.[1]),
      location: decode(card.match(/<address[^>]*>([^<]*)<\/address>/)?.[1] ?? ''),
      image: card.match(/<img src="([^"]+)"/)?.[1]?.replace('/s180x180/', '/original/'),
      negotiable: /do negocjacji/.test(card),
    });
  }
  return out;
}

async function allegroLokalnieDetail(s: CardStub): Promise<Partial<Candidate>> {
  const html = await get(s.url);
  const desc = decode(html.match(/mlc-offer__description">([\s\S]*?)<\/div>/)?.[1] ?? '');
  const imgs = [...new Set([...html.matchAll(/https:\/\/a\.allegroimg\.com\/original\/[0-9a-f]+\/[0-9a-f]+/g)].map((m) => m[0]))].slice(0, 3);
  return { description: desc, images: imgs.length ? imgs : s.image ? [s.image] : [] };
}

// Sprzedajemy: /szukaj and offer pages are allowed by robots.txt.
function parseSprzedajemy(html: string): CardStub[] {
  const out: CardStub[] = [];
  for (const block of html.split('<article').slice(1)) {
    const card = block.split('</article>')[0].replace(/<script[\s\S]*?<\/script>/g, ' ');
    const href = card.match(/href="(\/[^"]+-nr\d+)"/)?.[1];
    if (!href) continue;
    out.push({
      url: `https://sprzedajemy.pl${href}`,
      title: decode(card.match(/<h2 class="title[^"]*">([\s\S]*?)<\/h2>/)?.[1] ?? ''),
      price: plPrice(card.match(/<span class="price[^"]*">([^<]+)</)?.[1]),
      location: decode(card.match(/<strong class="city">([^<]*)<\/strong>/)?.[1] ?? ''),
      image: card.match(/<img src="([^"]+)"/)?.[1]?.replace('/350x250c/', '/1000x901c/'),
    });
  }
  return out;
}

async function sprzedajemyDetail(s: CardStub): Promise<Partial<Candidate>> {
  const html = await get(s.url);
  const desc = decode(html.match(/class="offerDescription">([\s\S]*?)<\/div>/)?.[1] ?? '');
  const imgs = [...new Set([...html.matchAll(/https:\/\/thumbs\.img-sprzedajemy\.pl\/1000x901c\/[^"\s)]+/g)].map((m) => m[0]))].slice(0, 3);
  return { description: desc, images: imgs.length ? imgs : s.image ? [s.image] : [] };
}

async function scoutCards(
  name: string,
  conf: { radiusKm: number; queries: string[]; delayMs?: number },
  /** Drop cards whose town the gazetteer doesn't know (for nationwide searches). */
  dropUnknown: boolean,
  searchUrl: (q: string) => string,
  parse: (html: string) => CardStub[],
  detail: (s: CardStub) => Promise<Partial<Candidate>>,
  known: Set<string>,
  previous: Map<string, AutoRecord>,
): Promise<Candidate[]> {
  const stubs = new Map<string, CardStub>();
  for (const q of conf.queries) {
    try {
      await sleep(conf.delayMs ?? 0); // extra, per-portal pause on top of the global delay
      const found = parse(await get(searchUrl(q)));
      let kept = 0;
      for (const s of found) {
        const km = kmFromPoznan(s.location);
        if (stubs.has(s.url) || (km == null ? dropUnknown : km > conf.radiusKm)) continue;
        stubs.set(s.url, s);
        kept++;
      }
      log.push(`${name} „${q}”: ${found.length} (w promieniu ${conf.radiusKm} km: ${kept})`);
    } catch (e) {
      // An error here is usually the portal limiting requests (HTTP 429). Respect it: stop this portal
      // for this run instead of retrying.
      log.push(`${name} „${q}”: BŁĄD ${(e as Error).message} — pomijam portal do następnego uruchomienia`);
      break;
    }
  }

  // Cheap pre-filter on the card title before spending detail requests.
  const db = buildDatabase();
  const pre = [...stubs.values()].filter((s) => {
    const probe = normalizeImportRecord({ url: s.url, title: s.title || 'x x x', description: '', price: s.price, currency: 'PLN', location: s.location });
    return keep(analyzeListings([probe], DEFAULT_SETTINGS, db)[0], s.title, true);
  });

  const out: Candidate[] = [];
  let details = 0;
  for (const s of pre) {
    const prev = previous.get(s.url);
    const base: Candidate = { url: s.url, title: s.title, description: '', price: s.price, currency: 'PLN', location: s.location || null, postedAt: null, images: s.image ? [s.image] : [], negotiable: s.negotiable };
    if (prev || known.has(s.url) || details >= cfg.maxDetailFetches) {
      // Already known: refresh price/location from the card, keep stored facts.
      if (prev) out.push({ ...base, description: prev.description, postedAt: prev.postedAt, images: prev.images });
      continue;
    }
    try {
      details++;
      await sleep(conf.delayMs ?? 0);
      out.push({ ...base, ...(await detail(s)) });
    } catch (e) {
      log.push(`${name} szczegóły: BŁĄD ${(e as Error).message} — kończę pobieranie szczegółów`);
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- eBay (official Browse API only)

// eBay's User Agreement forbids robots/scrapers on its pages, so eBay is read ONLY through the official
// Browse API (https://developer.ebay.com/api-docs/buy/browse/overview.html) with an application token
// (OAuth client credentials). Keys: EBAY_CLIENT_ID / EBAY_CLIENT_SECRET — GitHub Actions secrets or the
// local environment, never in the repo or the frontend.

interface EbaySummary {
  itemId: string;
  legacyItemId?: string;
  title: string;
  price?: { value: string; currency: string };
  buyingOptions?: string[];
  image?: { imageUrl: string };
  additionalImages?: { imageUrl: string }[];
  itemWebUrl?: string;
  itemLocation?: { city?: string; postalCode?: string; country?: string };
  itemCreationDate?: string;
  condition?: string;
}

interface EbayItem extends EbaySummary {
  shortDescription?: string;
  description?: string;
  localizedAspects?: { name: string; value: string }[];
}

let ebayToken: string | null = null;

async function ebayAuth(): Promise<string> {
  if (ebayToken) return ebayToken;
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  if (!res.ok) throw new Error(`eBay auth HTTP ${res.status}`);
  ebayToken = ((await res.json()) as { access_token: string }).access_token;
  return ebayToken;
}

async function ebayGet<T>(path: string, marketplaceId: string): Promise<T> {
  const res = await fetch(`https://api.ebay.com/buy/browse/v1${path}`, {
    headers: { Authorization: `Bearer ${await ebayAuth()}`, 'X-EBAY-C-MARKETPLACE-ID': marketplaceId, 'Accept-Language': 'de-DE' },
  });
  if (!res.ok) throw new Error(`eBay HTTP ${res.status} ${path.split('?')[0]}`);
  return (await res.json()) as T;
}

/** Stable, tracking-free listing URL. */
function ebayUrl(s: EbaySummary): string {
  const legacy = s.legacyItemId ?? s.itemId.split('|')[1];
  return legacy ? `https://www.ebay.de/itm/${legacy}` : (s.itemWebUrl ?? '').split('?')[0];
}

/** Masked postcode ("01***") → 2-digit region, used for the eastern-Germany pickup filter and map position. */
function ebayPlace(loc: EbaySummary['itemLocation']): { location: string; plz: string | null; lat?: number; lng?: number } {
  const plz = loc?.postalCode?.match(/^\d{2}/)?.[0] ?? null;
  const country = loc?.country && loc.country !== 'DE' ? ` (${loc.country})` : '';
  const city = loc?.city?.trim();
  const p = resolveLocation(city ? `${loc?.postalCode ?? ''} ${city}` : plz ? `${plz}000` : null);
  const label = city ? `${plz ? plz + '… ' : ''}${city}${country}` : plz ? `Niemcy, kod ${plz}…` : `eBay${country}`;
  return { location: label, plz, lat: p?.lat, lng: p?.lng };
}

async function scoutEbay(known: Set<string>, previous: Map<string, AutoRecord>): Promise<Candidate[]> {
  const conf = cfg.ebay!;
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    log.push('eBay: pomijam — brak EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (sekrety GitHub Actions)');
    return [];
  }
  const prefixes = conf.postcodePrefixes ?? cfg.kleinanzeigen.postcodePrefixes;
  // Auctions are left out: the current bid is not a final price and would distort the deal score.
  const base = `itemLocationCountry:DE,buyingOptions:{FIXED_PRICE|BEST_OFFER}`;
  const cat = conf.categoryIds ? `&category_ids=${conf.categoryIds}` : '';
  const stubs = new Map<string, { s: EbaySummary; shipsToPl: boolean }>();

  for (const q of conf.queries) {
    // Pass 1: ships to Poland (anywhere in Germany). Pass 2: pickup range (eastern-German postcodes).
    for (const [filter, shipsToPl] of [[`${base},deliveryCountry:PL`, true], [base, false]] as const) {
      try {
        const res = await ebayGet<{ itemSummaries?: EbaySummary[]; total?: number }>(
          `/item_summary/search?q=${encodeURIComponent(q)}${cat}&filter=${encodeURIComponent(filter)}&limit=${conf.limit ?? 100}`,
          conf.marketplaceId,
        );
        let kept = 0;
        for (const s of res.itemSummaries ?? []) {
          const url = ebayUrl(s);
          if (!url) continue;
          const plz = ebayPlace(s.itemLocation).plz;
          if (!shipsToPl && !(plz && prefixes.includes(plz))) continue;
          const had = stubs.get(url);
          if (had) {
            had.shipsToPl ||= shipsToPl;
            continue;
          }
          stubs.set(url, { s, shipsToPl });
          kept++;
        }
        log.push(`eBay „${q}” (${shipsToPl ? 'wysyłka do PL' : 'odbiór, wschodnie Niemcy'}): ${res.itemSummaries?.length ?? 0} z ${res.total ?? 0}, nowych: ${kept}`);
      } catch (e) {
        log.push(`eBay „${q}”: BŁĄD ${(e as Error).message} — pomijam eBay do następnego uruchomienia`);
        return [];
      }
    }
  }

  const db = buildDatabase();
  const priceOf = (s: EbaySummary) => (s.price ? Math.round(Number(s.price.value)) : null);
  const pre = [...stubs.entries()].filter(([url, { s }]) => {
    const probe = normalizeImportRecord({ url, title: s.title || 'x x x', description: '', price: priceOf(s), currency: 'EUR', location: ebayPlace(s.itemLocation).location });
    return keep(analyzeListings([probe], DEFAULT_SETTINGS, db)[0], s.title, true);
  });

  const out: Candidate[] = [];
  let details = 0;
  for (const [url, { s, shipsToPl }] of pre) {
    const place = ebayPlace(s.itemLocation);
    const imgs = [s.image?.imageUrl, ...(s.additionalImages ?? []).map((i) => i.imageUrl)].filter((x): x is string => !!x).slice(0, 3);
    const cand: Candidate = {
      url,
      title: s.title,
      description: '',
      price: priceOf(s),
      currency: 'EUR',
      location: place.location,
      ...(place.lat != null && place.lng != null ? { latitude: place.lat, longitude: place.lng } : {}),
      postedAt: s.itemCreationDate ?? null,
      images: imgs,
      shipping: shipsToPl || undefined,
      negotiable: s.buyingOptions?.includes('BEST_OFFER'),
    };
    const prev = previous.get(url);
    if (prev || known.has(url) || details >= cfg.maxDetailFetches) {
      if (prev) out.push({ ...cand, description: prev.description, postedAt: prev.postedAt ?? cand.postedAt, images: prev.images.length ? prev.images : imgs });
      continue;
    }
    try {
      details++;
      // Item details: seller text + item specifics (Rahmenmaterial, Baujahr…) — used for analysis only.
      const it = await ebayGet<EbayItem>(`/item/${encodeURIComponent(s.itemId)}`, conf.marketplaceId);
      const aspects = (it.localizedAspects ?? []).map((a) => `${a.name}: ${a.value}`).join('. ');
      const full = ebayPlace(it.itemLocation ?? s.itemLocation);
      out.push({
        ...cand,
        description: [aspects, it.shortDescription, decode(it.description ?? '')].filter(Boolean).join('\n'),
        location: full.location,
        ...(full.lat != null && full.lng != null ? { latitude: full.lat, longitude: full.lng } : {}),
        images: [it.image?.imageUrl, ...(it.additionalImages ?? []).map((i) => i.imageUrl)].filter((x): x is string => !!x).slice(0, 3),
      });
    } catch (e) {
      log.push(`eBay szczegóły: BŁĄD ${(e as Error).message} — kończę pobieranie szczegółów`);
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- filtering & fact summary

const MODERN = /(27[,.]5|\b29\s*(?:["“”″]|''|zoll|er|cali)|\b29er\b|hydraul|tarczow|scheibenbremse|\bdisc\b|e[\s-]?bike|pedelec|carbon|karbon|boost|1x1[12]\b|tubeless)/i;

/** `titleOnly`: pre-filter on a search card — the retro signal may only be in the description. */
function keep(a: AnalyzedListing, rawText: string, titleOnly = false): boolean {
  const an = a.analysis;
  if (isRoadBike(a) || !isMtbLike(a)) return false;
  if (an.redFlags.length) return false;
  if (an.itemType === 'components') return false;
  if (MODERN.test(rawText)) return false;
  const y = an.productionYear && /^\d{4}$/.test(an.productionYear) ? Number(an.productionYear) : null;
  if (y && y >= 2005) return false;
  // Needs at least one "retro" signal — otherwise it's just a used MTB.
  const retro = /(retro|vintage|oldschool|old\s*school|klasyk|kult|\b(?:19[89]\d)\b|lata\s*[89]0|\b[89]0(?:er|s)\b|starrgabel|sztywn\w*\s*widel|cr-?mo|chrom|stahl|stalow|tange|reynolds|columbus|ishiwata|true\s*temper|mufow|muffen|cantilever|biopace|deore\s*(?:xt|lx|dx)|suntour)/i;
  // Shimano generations up to 2002 (M7xx XT, M9xx XTR, MT6x Deore, M5xx LX…) are a retro signal too.
  const era = an.groupsetEra?.match(/\d{4}/g)?.map(Number);
  if (era && Math.max(...era) <= 2002) return true;
  return titleOnly || retro.test(rawText) || an.modelId != null;
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

  if (cfg.olx.enabled && run('olx')) {
    const prev = readAuto('auto-olx.json');
    const cands = await scoutOlx();
    results.push({ name: 'auto-olx.json', ...toRecords(cands, prev, known, nowIso) });
  }
  if (cfg.kleinanzeigen.enabled && run('kleinanzeigen')) {
    const prev = readAuto('auto-kleinanzeigen.json');
    const cands = await scoutKleinanzeigen(known, new Map(prev.map((r) => [r.url, r])));
    results.push({ name: 'auto-kleinanzeigen.json', ...toRecords(cands, prev, known, nowIso) });
  }

  const al = cfg.allegroLokalnie;
  if (al?.enabled && run('allegro-lokalnie')) {
    const prev = readAuto('auto-allegro-lokalnie.json');
    const url = (q: string) => `https://allegrolokalnie.pl/oferty/rowery-i-akcesoria/rowery-16420/q/${encodeURIComponent(q)}`;
    const cands = await scoutCards('Allegro Lokalnie', al, true, url, parseAllegroLokalnie, allegroLokalnieDetail, known, new Map(prev.map((r) => [r.url, r])));
    results.push({ name: 'auto-allegro-lokalnie.json', ...toRecords(cands, prev, known, nowIso) });
  }
  const sp = cfg.sprzedajemy;
  if (sp?.enabled && run('sprzedajemy')) {
    const prev = readAuto('auto-sprzedajemy.json');
    // The portal's own Poznań + distance filter (150 km is one of its options).
    const url = (q: string) => `https://sprzedajemy.pl/poznan?inp_text=${encodeURIComponent(q).replace(/%20/g, '+')}&inp_distance=150`;
    const cands = await scoutCards('Sprzedajemy', sp, false, url, parseSprzedajemy, sprzedajemyDetail, known, new Map(prev.map((r) => [r.url, r])));
    results.push({ name: 'auto-sprzedajemy.json', ...toRecords(cands, prev, known, nowIso) });
  }
  const eb = cfg.ebay;
  if (eb?.enabled && run('ebay')) {
    const prev = readAuto('auto-ebay.json');
    const cands = await scoutEbay(known, new Map(prev.map((r) => [r.url, r])));
    // Without keys the source is skipped and the existing file is left untouched.
    if (process.env.EBAY_CLIENT_ID) results.push({ name: 'auto-ebay.json', ...toRecords(cands, prev, known, nowIso) });
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
