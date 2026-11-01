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
    status: 'manual',
    note: 'Brak publicznego API wyszukiwania. Import ręczny (URL / JSON / CSV).',
    hosts: ['allegrolokalnie.pl', 'www.allegrolokalnie.pl'],
    searchUrl: (q) => `https://allegrolokalnie.pl/oferty/rowery?phrase=${enc(q)}`,
    parseExternalId: (u) => u.pathname.match(/([a-f0-9-]{20,}|\d{6,})\/?$/)?.[1] ?? null,
  },
  {
    id: 'olx',
    name: 'OLX',
    homepage: 'https://www.olx.pl',
    status: 'manual',
    note: 'Partner API OLX służy do zarządzania własnymi ogłoszeniami, nie do wyszukiwania cudzych. Automatyczne pobieranie wyników wyszukiwania nie jest wdrożone. Import ręczny.',
    hosts: ['olx.pl', 'www.olx.pl', 'm.olx.pl'],
    searchUrl: (q) => `https://www.olx.pl/sport-hobby/rowery/q-${enc(slug(q))}/`,
    parseExternalId: (u) => u.pathname.match(/-ID([A-Za-z0-9]+)\.html/)?.[1] ?? null,
  },
  {
    id: 'sprzedajemy',
    name: 'Sprzedajemy.pl',
    homepage: 'https://sprzedajemy.pl',
    status: 'manual',
    note: 'Brak publicznego API. Import ręczny.',
    hosts: ['sprzedajemy.pl', 'www.sprzedajemy.pl'],
    searchUrl: (q) => `https://sprzedajemy.pl/sport-i-turystyka/rowery?inp_text%5Bv%5D=${enc(q)}`,
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
