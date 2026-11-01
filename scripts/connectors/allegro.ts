/**
 * Allegro connector — official REST API only (https://developer.allegro.pl).
 *
 * Auth: OAuth2 client_credentials with ALLEGRO_CLIENT_ID / ALLEGRO_CLIENT_SECRET (GitHub Actions secrets).
 * Search: GET /offers/listing. Allegro may restrict this endpoint to approved applications; when access is
 * denied the connector reports the HTTP error — it never falls back to scraping.
 */
import type { MarketplaceConnector } from '../../src/services/marketplaces/types';
import type { SourceListing } from '../../src/types/listing';
import { resolvePlace } from '../../src/services/geolocation/geo';

const AUTH_URL = 'https://allegro.pl/auth/oauth/token?grant_type=client_credentials';
const API = 'https://api.allegro.pl';

interface AllegroItem {
  id: string;
  name: string;
  sellingMode?: { price?: { amount?: string; currency?: string } };
  images?: { url: string }[];
  location?: { city?: string; province?: string };
  publication?: { startingAt?: string };
}

export function createAllegroConnector(cfg: { categoryId?: string }): MarketplaceConnector {
  const id = process.env.ALLEGRO_CLIENT_ID;
  const secret = process.env.ALLEGRO_CLIENT_SECRET;
  let token: string | null = null;

  async function getToken(): Promise<string> {
    if (token) return token;
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
    });
    if (!res.ok) throw new Error(`Allegro auth HTTP ${res.status}`);
    const json = (await res.json()) as { access_token: string };
    token = json.access_token;
    return token;
  }

  return {
    id: 'allegro',
    isConfigured: () => (id && secret ? { ok: true } : { ok: false, reason: 'Brak ALLEGRO_CLIENT_ID / ALLEGRO_CLIENT_SECRET w sekretach' }),
    async search(queries, { maxResults }) {
      const t = await getToken();
      const out: SourceListing[] = [];
      const nowIso = new Date().toISOString();
      for (const q of queries) {
        const params = new URLSearchParams({ phrase: q, limit: String(Math.min(maxResults, 60)) });
        if (cfg.categoryId) params.set('category.id', cfg.categoryId);
        const res = await fetch(`${API}/offers/listing?${params}`, {
          headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.allegro.public.v1+json' },
        });
        if (!res.ok) throw new Error(`Allegro /offers/listing HTTP ${res.status} (zapytanie: "${q}")`);
        const json = (await res.json()) as { items?: { promoted?: AllegroItem[]; regular?: AllegroItem[] } };
        const items = [...(json.items?.promoted ?? []), ...(json.items?.regular ?? [])];
        for (const it of items) {
          const city = it.location?.city ?? null;
          const place = resolvePlace(city);
          const price = it.sellingMode?.price?.amount ? Number(it.sellingMode.price.amount) : null;
          out.push({
            id: `allegro:${it.id}`,
            externalId: it.id,
            marketplace: 'allegro',
            sourceUrl: `https://allegro.pl/oferta/${it.id}`,
            title: it.name,
            description: '',
            price,
            currency: it.sellingMode?.price?.currency ?? 'PLN',
            images: (it.images ?? []).map((i) => i.url),
            locationName: city,
            latitude: place?.lat ?? null,
            longitude: place?.lng ?? null,
            geoPrecision: place ? 'city' : 'none',
            postedAt: it.publication?.startingAt ?? null,
            discoveredAt: nowIso,
            lastSeenAt: nowIso,
            status: 'active',
            priceHistory: price != null ? [{ date: nowIso, price }] : [],
            declared: { shippingAvailable: true },
            origin: 'live',
          });
        }
        await new Promise((r) => setTimeout(r, 1200)); // be gentle with rate limits
      }
      return out;
    },
  };
}
