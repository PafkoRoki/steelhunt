import { resolvePlace } from '../geolocation/geo';

/**
 * Reads a listing page the USER saved in their own browser (File → Save page as… → .htm/.html)
 * and pre-fills the "add listing" form. Nothing is fetched from the portal: we only parse the file
 * the user hands us, in the browser. Works for any site that publishes standard metadata
 * (schema.org JSON-LD, Open Graph); Vinted / OLX / Kleinanzeigen get a few extra hints.
 */
export interface ExtractedListing {
  url: string;
  title: string;
  price: number | null;
  currency: string | null;
  description: string;
  location: string;
  images: string[];
  condition: '' | 'excellent' | 'good' | 'fair' | 'poor' | 'project';
  brand: string | null;
  /** Which sources the fields came from — shown so the user knows what to double-check. */
  found: string[];
  /** Fields we could not find and the user should fill in. */
  missing: string[];
}

type Json = Record<string, unknown>;

const SITE_SUFFIX = /\s*[|–—-]\s*(vinted|olx(?:\.pl)?|kleinanzeigen(?:\.de)?|sprzedajemy(?:\.pl)?|allegro(?: lokalnie)?|facebook|marketplace|ebay(?:\.\w+)?)\s*$/i;

function textOf(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
}

function meta(doc: Document, key: string): string {
  const el = doc.querySelector(`meta[property="${key}"], meta[name="${key}"], meta[itemprop="${key}"]`);
  return el?.getAttribute('content')?.trim() ?? '';
}

/** All JSON-LD objects on the page, flattened (@graph, arrays). Malformed blocks are skipped. */
function jsonLd(doc: Document): Json[] {
  const out: Json[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const o = v as Json;
      out.push(o);
      if (o['@graph']) walk(o['@graph']);
    }
  };
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(s.textContent ?? ''));
    } catch {
      /* ignore broken JSON-LD */
    }
  }
  return out;
}

const isType = (o: Json, t: string) => {
  const ty = o['@type'];
  return Array.isArray(ty) ? ty.includes(t) : ty === t;
};

function imageList(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(imageList);
  if (typeof v === 'object') return imageList((v as Json).url ?? (v as Json).contentUrl);
  return [];
}

function parsePrice(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = textOf(v).replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!s) return null;
  // "1.200,50" / "1 200" / "1200.00"
  const norm = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/** Vinted / OLX condition labels → our scale. Schema.org only says "Used", which tells us nothing. */
function mapCondition(label: string): ExtractedListing['condition'] {
  const l = label.toLowerCase();
  if (/nowy|new|neu|bardzo dobry|sehr gut|very good|wie neu/.test(l)) return 'excellent';
  if (/zadowalaj|akzeptabel|satisfactory|fair/.test(l)) return 'fair';
  if (/dobry|good|gut/.test(l)) return 'good';
  if (/uszkodz|defekt|broken|na części|for parts/.test(l)) return 'project';
  return '';
}

/** Town the seller names in the text ("odbiór w Mogilanach / Krakowie") — only from pickup/location sentences. */
function locationFromText(text: string): string {
  const sentences = text.split(/[\n.!?]+/).filter((s) => /(odbi[oó]r|odebra|lokaliz|miejscowo|okolic|\bk\.\s|abholung|standort|\bin\s+\d{5})/i.test(s));
  for (const s of sentences) {
    const p = resolvePlace(s);
    if (p) return p.name;
  }
  return '';
}

/** Chrome/Edge add `<!-- saved from url=(0062)https://… -->` at the top of a saved page. */
function savedFromUrl(html: string): string {
  return html.match(/saved from url=\(\d+\)(https?:\/\/[^\s>]+)/i)?.[1] ?? '';
}

export function extractListingFromHtml(html: string): ExtractedListing {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const found: string[] = [];
  const ld = jsonLd(doc);
  const product = ld.find((o) => isType(o, 'Product')) ?? ld.find((o) => isType(o, 'Offer') || isType(o, 'IndividualProduct'));
  if (product) found.push('dane strukturalne (schema.org)');
  const og = !!meta(doc, 'og:title');
  if (og) found.push('Open Graph');

  // URL
  const offers = (Array.isArray(product?.offers) ? product?.offers[0] : product?.offers) as Json | undefined;
  const url =
    doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ||
    meta(doc, 'og:url') ||
    textOf(offers?.url) ||
    textOf(product?.url) ||
    savedFromUrl(html);

  // Title
  const title = (textOf(product?.name) || meta(doc, 'og:title') || doc.title || '').replace(SITE_SUFFIX, '').trim();

  // Price
  let price = parsePrice(offers?.price ?? offers?.lowPrice);
  let currency = textOf(offers?.priceCurrency) || null;
  if (price == null) {
    price = parsePrice(meta(doc, 'product:price:amount') || meta(doc, 'og:price:amount'));
    currency = currency || meta(doc, 'product:price:currency') || meta(doc, 'og:price:currency') || null;
  }

  // Description: JSON-LD is the full text; og/meta descriptions are often truncated.
  const description = textOf(product?.description) || meta(doc, 'og:description') || meta(doc, 'description');

  // Images: JSON-LD + og:image + large Vinted photos of this item (f800), deduplicated.
  const imgs = [...imageList(product?.image), meta(doc, 'og:image')];
  if (/vinted\./i.test(url)) {
    for (const m of html.matchAll(/https:\/\/images\d*\.vinted\.net\/t\/[^"'\s)<>]+?\/f800\/[^"'\s)<>]+/g)) imgs.push(m[0].replace(/&amp;/g, '&'));
  }
  const seen = new Set<string>();
  const images = imgs
    .filter((s) => /^https?:\/\//.test(s))
    .filter((s) => {
      const k = s.split('?')[0];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 12);

  // Condition: portal's own label (Vinted "Dobry", OLX "Stan: Używane" is too vague → skipped).
  const statusLabel =
    doc.querySelector('[data-testid="item-attributes-status"]')?.textContent?.trim() ||
    doc.querySelector('[itemprop="itemCondition"]')?.getAttribute('content') ||
    '';
  const condition = mapCondition(statusLabel);

  // Location: structured address first, then the seller's own words.
  const addr = (offers?.availableAtOrFrom as Json | undefined)?.address ?? (product?.areaServed as Json | undefined)?.address ?? product?.address;
  const locality = typeof addr === 'object' && addr ? textOf((addr as Json).addressLocality) : textOf(addr);
  const location =
    locality ||
    doc.querySelector('[data-testid="location-text"], [data-testid="item-attributes-location"], #viewad-locality')?.textContent?.trim() ||
    locationFromText(description);

  const brandRaw = product?.brand;
  const brand = typeof brandRaw === 'object' && brandRaw ? textOf((brandRaw as Json).name) || null : textOf(brandRaw) || null;

  const missing: string[] = [];
  if (!url) missing.push('link');
  if (!title) missing.push('tytuł');
  if (price == null) missing.push('cena');
  if (!location) missing.push('lokalizacja');
  if (!description) missing.push('opis');
  if (!images.length) missing.push('zdjęcia');

  return { url, title, price, currency, description, location, images, condition, brand, found, missing };
}
