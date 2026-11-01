/**
 * Manual import: single URL form, JSON array, CSV.
 * Validates with zod, normalizes into SourceListing, geocodes against the place gazetteer.
 * Nothing is fetched from the marketplace — the user supplies the data they can see.
 */
import { z } from 'zod';
import type { DataOrigin, ListingCondition, SourceListing } from '../../types/listing';
import { resolvePlace } from '../geolocation/geo';
import { detectMarketplace } from './registry';

const conditionEnum = z.enum(['excellent', 'good', 'fair', 'poor', 'project', 'unknown']);
const itemTypeEnum = z.enum(['complete', 'frameset', 'frame', 'components']);

const numberish = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,]/g, '').replace(',', '.'))))
  .refine((v) => Number.isFinite(v) && v >= 0, 'Nieprawidłowa cena');

export const ImportRecordSchema = z.object({
  url: z.string().url('Nieprawidłowy URL'),
  title: z.string().min(3, 'Tytuł jest wymagany'),
  description: z.string().optional().default(''),
  price: numberish.nullable().optional(),
  currency: z.string().optional().default('PLN'),
  location: z.string().optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  images: z.union([z.array(z.string()), z.string()]).optional(),
  postedAt: z.string().optional().nullable(),
  condition: conditionEnum.optional(),
  itemType: itemTypeEnum.optional(),
  shipping: z.union([z.boolean(), z.string()]).optional(),
  externalId: z.string().optional(),
});

export type ImportRecord = z.input<typeof ImportRecordSchema>;

export function normalizeImportRecord(input: unknown, origin: DataOrigin = 'import', nowIso = new Date().toISOString()): SourceListing {
  const r = ImportRecordSchema.parse(input);
  const mk = detectMarketplace(r.url) ?? { id: 'other' as const, externalId: null };
  const externalId = r.externalId || mk.externalId || hashString(r.url);
  const place = r.latitude != null && r.longitude != null ? null : resolvePlace(r.location);
  const images = Array.isArray(r.images) ? r.images : r.images ? r.images.split(/[\s;,]+/).filter((s) => /^https?:\/\//.test(s)) : [];
  const shipping = typeof r.shipping === 'string' ? /^(1|true|tak|yes)$/i.test(r.shipping) : r.shipping;
  return {
    id: `${mk.id}:${externalId}`,
    externalId,
    marketplace: mk.id,
    sourceUrl: r.url,
    title: r.title.trim(),
    description: (r.description ?? '').trim(),
    price: r.price ?? null,
    currency: r.currency ?? 'PLN',
    images,
    locationName: r.location?.trim() || null,
    latitude: r.latitude ?? place?.lat ?? null,
    longitude: r.longitude ?? place?.lng ?? null,
    geoPrecision: r.latitude != null && r.longitude != null ? 'exact' : place ? 'city' : 'none',
    postedAt: r.postedAt ?? null,
    discoveredAt: nowIso,
    lastSeenAt: nowIso,
    status: 'active',
    priceHistory: r.price != null ? [{ date: nowIso, price: r.price }] : [],
    declared: {
      condition: r.condition as ListingCondition | undefined,
      itemType: r.itemType,
      shippingAvailable: shipping,
    },
    origin,
  };
}

export interface ImportOutcome {
  listings: SourceListing[];
  errors: { row: number; message: string }[];
}

export function importJson(text: string, origin: DataOrigin = 'import'): ImportOutcome {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { listings: [], errors: [{ row: 0, message: 'Nieprawidłowy JSON: ' + (e as Error).message }] };
  }
  const arr = Array.isArray(data) ? data : [data];
  return importRecords(arr, origin);
}

export function importCsv(text: string, origin: DataOrigin = 'import'): ImportOutcome {
  const rows = parseCsv(text);
  if (rows.length < 2) return { listings: [], errors: [{ row: 0, message: 'CSV musi mieć nagłówek i co najmniej 1 wiersz.' }] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const records = rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => {
      if (r[i] != null && r[i] !== '') o[h] = r[i];
    });
    return o;
  });
  return importRecords(records, origin);
}

function importRecords(arr: unknown[], origin: DataOrigin): ImportOutcome {
  const listings: SourceListing[] = [];
  const errors: ImportOutcome['errors'] = [];
  arr.forEach((rec, i) => {
    try {
      listings.push(normalizeImportRecord(rec, origin));
    } catch (e) {
      const msg = e instanceof z.ZodError ? e.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') : (e as Error).message;
      errors.push({ row: i + 1, message: msg });
    }
  });
  return { listings, errors };
}

/** RFC-4180-ish CSV parser (quotes, escaped quotes, commas/semicolons, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
