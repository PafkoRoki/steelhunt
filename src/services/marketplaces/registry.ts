import type { MarketplaceId } from '../../types/listing';
import type { MarketplaceInfo } from './types';

const enc = encodeURIComponent;
const slug = (q: string) =>
  q
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

/**
 * Marketplace registry. Statuses reflect what is legitimately possible today — see docs/MARKETPLACES.md.
 * No entry here scrapes anything; `searchUrl` only builds a link the user opens in their own browser.
 */
export const MARKETPLACES: MarketplaceInfo[] = [
  {
    id: 'allegro',
    name: 'Allegro',
    homepage: 'https://allegro.pl',
    status: 'api',
    note: 'Oficjalne REST API (OAuth client credentials). Wyszukiwanie ofert może wymagać zatwierdzenia aplikacji przez Allegro. Klucze tylko w sekretach GitHub Actions.',
    hosts: ['allegro.pl', 'www.allegro.pl'],
    searchUrl: (q) => `https://allegro.pl/kategoria/rowery-i-akcesoria-rowery-16420?string=${enc(q)}`,
    parseExternalId: (u) => u.pathname.match(/-(\d{8,})(?:$|[/?#])/)?.[1] ?? null,
  },
  {
    id: 'allegro-lokalnie',
    name: 'Allegro Lokalnie',
    homepage: 'https://allegrolokalnie.pl',
    status: 'scout',
    note: 'Brak publicznego API. Lokalny skrypt scout czyta publiczne wyniki wyszukiwania w kategorii Rowery (robots.txt na to pozwala). Można też importować ręcznie.',
    hosts: ['allegrolokalnie.pl', 'www.allegrolokalnie.pl'],
    searchUrl: (q) => `https://allegrolokalnie.pl/oferty/rowery-i-akcesoria/rowery-16420/q/${enc(q)}`,
    parseExternalId: (u) => u.pathname.match(/([a-f0-9-]{20,}|\d{6,})\/?$/)?.[1] ?? null,
  },
  {
    id: 'olx',
    name: 'OLX',
    homepage: 'https://www.olx.pl',
    status: 'scout',
    note: 'Lokalny skrypt scout korzysta z publicznego endpointu /api/v1/offers/ (dozwolonego w robots.txt), promień od Poznania. Można też importować ręcznie.',
    hosts: ['olx.pl', 'www.olx.pl', 'm.olx.pl'],
    searchUrl: (q) => `https://www.olx.pl/sport-hobby/rowery/q-${enc(slug(q))}/`,
    parseExternalId: (u) => u.pathname.match(/-ID([A-Za-z0-9]+)\.html/)?.[1] ?? null,
  },
  {
    id: 'sprzedajemy',
    name: 'Sprzedajemy.pl',
    homepage: 'https://sprzedajemy.pl',
    status: 'scout',
    note: 'Brak publicznego API. Lokalny skrypt scout czyta publiczne wyniki wyszukiwania (robots.txt na to pozwala). Można też importować ręcznie.',
    hosts: ['sprzedajemy.pl', 'www.sprzedajemy.pl'],
    searchUrl: (q) => `https://sprzedajemy.pl/szukaj?inp_text=${enc(q).replace(/%20/g, '+')}`,
    parseExternalId: (u) => u.pathname.match(/nr(\d+)/)?.[1] ?? null,
  },
  {
    id: 'facebook',
    name: 'Facebook Marketplace',
    homepage: 'https://www.facebook.com/marketplace',
    status: 'manual',
    note: 'Wymaga logowania, brak API dla wyszukiwania. Tylko ręczne dodawanie linków.',
    hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
    searchUrl: (q) => `https://www.facebook.com/marketplace/poznan/search?query=${enc(q)}`,
    parseExternalId: (u) => u.pathname.match(/marketplace\/item\/(\d+)/)?.[1] ?? null,
  },
  {
    id: 'kleinanzeigen',
    name: 'Kleinanzeigen (DE)',
    homepage: 'https://www.kleinanzeigen.de',
    status: 'scout',
    note: 'Niemiecki portal ogłoszeń (dawniej eBay Kleinanzeigen). Lokalny skrypt scout czyta wyniki wyszukiwania dla wschodnich Niemiec. Ceny w EUR przeliczane na PLN.',
    hosts: ['kleinanzeigen.de', 'www.kleinanzeigen.de'],
    searchUrl: (q) => `https://www.kleinanzeigen.de/s-fahrraeder/${enc(slug(q))}/k0c217`,
    parseExternalId: (u) => u.pathname.match(/\/(\d{6,})-\d+-\d+/)?.[1] ?? null,
  },
  {
    id: 'ebay',
    name: 'eBay.de',
    homepage: 'https://www.ebay.de',
    status: 'api',
    note: 'Oficjalne Browse API (klucze EBAY_CLIENT_ID / EBAY_CLIENT_SECRET w sekretach GitHub Actions). Regulamin eBay zabrania czytania stron automatem, więc tylko API. Oferty z Niemiec z wysyłką do Polski albo z kodów pocztowych wschodnich Niemiec; bez aukcji. Ceny w EUR przeliczane na PLN.',
    hosts: ['ebay.de', 'www.ebay.de', 'ebay.pl', 'www.ebay.pl', 'ebay.com', 'www.ebay.com'],
    searchUrl: (q) => `https://www.ebay.de/sch/i.html?_nkw=${enc(q)}`,
    parseExternalId: (u) => u.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,})/)?.[1] ?? null,
  },
  {
    id: 'other',
    name: 'Inne źródło',
    homepage: '',
    status: 'manual',
    note: 'Dowolny link — dane wpisane ręcznie.',
    hosts: [],
  },
];

export const MARKETPLACE_BY_ID = new Map<MarketplaceId, MarketplaceInfo>(MARKETPLACES.map((m) => [m.id, m]));

export function marketplaceName(id: MarketplaceId): string {
  if (id === 'manual') return 'Import ręczny';
  return MARKETPLACE_BY_ID.get(id)?.name ?? id;
}

export function detectMarketplace(rawUrl: string): { id: MarketplaceId; externalId: string | null } | null {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  for (const m of MARKETPLACES) {
    if (m.hosts.some((h) => host === h || host.endsWith('.' + h))) {
      return { id: m.id, externalId: m.parseExternalId?.(u) ?? null };
    }
  }
  return { id: 'other', externalId: null };
}
