/**
 * STEELHUNT scheduled ingestion (run by .github/workflows/ingest.yml, or locally: `npm run ingest`).
 *
 *  1. Query every enabled, configured source (each isolated — one failure never stops the others).
 *  2. Normalize → 3. Deduplicate (exact + cross-portal) → 4–7. Analyze & score (for the run log)
 *  8–10. Save new / update existing listings, record price changes → 11. Write public/data/*.json
 *
 * Output keeps SOURCE data only (listings.json). Scores are recomputed in the browser with the
 * user's own settings, so derived conclusions never overwrite raw marketplace data.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { PhotoNotes, SourceListing } from '../src/types/listing';
import type { LiveDataFile, RunLog, RunLogEntry, SourceRunLog } from '../src/types/run';
import type { MarketplaceConnector } from '../src/services/marketplaces/types';
import { mergeListings } from '../src/services/deduplication/dedupe';
import { analyzeListings } from '../src/services/analysis/pipeline';
import { buildDatabase } from '../src/services/database/db';
import { DEFAULT_SETTINGS } from '../src/features/scoring/config';
import { createAllegroConnector } from './connectors/allegro';
import { createManualFeedConnector } from './connectors/manualFeed';

const ROOT = resolve(import.meta.dirname, '..');
const LISTINGS = resolve(ROOT, 'public/data/listings.json');
const RUNLOG = resolve(ROOT, 'public/data/run-log.json');
const PHOTO_NOTES = resolve(ROOT, 'data/photo-notes.json');

interface SourcesConfig {
  queries: string[];
  maxResultsPerQuery: number;
  markRemovedAfterDays: number;
  sources: {
    'manual-feed'?: { enabled: boolean; dir: string };
    allegro?: { enabled: boolean; categoryId?: string };
  };
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function main() {
  const startedAt = new Date().toISOString();
  const cfg = readJson<SourcesConfig>(resolve(ROOT, 'config/sources.json'), { queries: [], maxResultsPerQuery: 40, markRemovedAfterDays: 14, sources: {} });
  const existing = readJson<LiveDataFile>(LISTINGS, { generatedAt: null, listings: [] });
  const log = readJson<RunLog>(RUNLOG, { lastRunAt: null, lastSuccessAt: null, runs: [] });

  const rowErrors: string[] = [];
  const connectors: MarketplaceConnector[] = [];
  if (cfg.sources['manual-feed']?.enabled) connectors.push(createManualFeedConnector({ dir: resolve(ROOT, cfg.sources['manual-feed'].dir) }, (m) => rowErrors.push(m)));
  if (cfg.sources.allegro?.enabled) connectors.push(createAllegroConnector({ categoryId: cfg.sources.allegro.categoryId }));

  const sourceLogs: SourceRunLog[] = [];
  const incoming: SourceListing[] = [];
  for (const c of connectors) {
    const t0 = Date.now();
    const conf = c.isConfigured();
    if (!conf.ok) {
      sourceLogs.push({ source: c.id, ok: false, skipped: true, found: 0, error: conf.reason, durationMs: 0 });
      console.log(`[skip] ${c.id}: ${conf.reason}`);
      continue;
    }
    try {
      const found = await c.search(cfg.queries, { maxResults: cfg.maxResultsPerQuery });
      incoming.push(...found);
      sourceLogs.push({ source: c.id, ok: true, skipped: false, found: found.length, durationMs: Date.now() - t0 });
      console.log(`[ok]   ${c.id}: ${found.length} listings`);
    } catch (e) {
      const msg = (e as Error).message;
      sourceLogs.push({ source: c.id, ok: false, skipped: false, found: 0, error: msg, durationMs: Date.now() - t0 });
      console.error(`[fail] ${c.id}: ${msg}`);
    }
  }
  if (rowErrors.length) console.warn(`Import row errors:\n  ${rowErrors.join('\n  ')}`);

  const nowIso = new Date().toISOString();
  // data/imports is authoritative: an entry deleted from the files is deleted from the site.
  const manualOk = sourceLogs.some((s) => s.source === 'manual' && s.ok);
  const importedIds = new Set(incoming.filter((l) => l.origin === 'import').map((l) => l.id));
  const base = manualOk ? existing.listings.filter((l) => l.origin !== 'import' || importedIds.has(l.id)) : existing.listings;
  const merged = mergeListings(base, incoming, nowIso);

  // Photo readings (decals, component markings) from the local photo review — see scripts/photos.ts.
  const photoNotes = new Map(readJson<(PhotoNotes & { url: string })[]>(PHOTO_NOTES, []).map(({ url, ...n }) => [url.split('?')[0], n]));
  for (const l of merged.merged) {
    const n = photoNotes.get(l.sourceUrl.split('?')[0]);
    if (n) l.photo = n;
    else delete l.photo;
  }

  // Listings not seen for N days → status "removed" (kept for history, hidden by default).
  const cutoff = Date.now() - cfg.markRemovedAfterDays * 86400_000;
  const okSources = new Set(sourceLogs.filter((s) => s.ok).map((s) => s.source));
  for (const l of merged.merged) {
    const sourceRan = okSources.has(l.marketplace) || (l.origin === 'import' && okSources.has('manual'));
    if (sourceRan && Date.parse(l.lastSeenAt) < cutoff && l.status === 'active') l.status = 'removed';
  }

  const analyzed = analyzeListings(merged.merged, DEFAULT_SETTINGS, buildDatabase());
  const bargains = analyzed.filter((a) => a.analysis.isBargain).length;

  const anyOk = sourceLogs.some((s) => s.ok);
  const entry: RunLogEntry = {
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: anyOk,
    found: incoming.length,
    added: merged.added,
    updated: merged.updated,
    duplicates: merged.duplicates,
    analyzed: analyzed.length,
    priceChanges: merged.priceChanges,
    sources: sourceLogs,
  };

  writeJson(LISTINGS, { generatedAt: nowIso, listings: merged.merged } satisfies LiveDataFile);
  writeJson(RUNLOG, {
    lastRunAt: entry.finishedAt,
    lastSuccessAt: anyOk ? entry.finishedAt : log.lastSuccessAt,
    runs: [entry, ...log.runs].slice(0, 60),
  } satisfies RunLog);

  console.log(
    `Done: found ${incoming.length}, added ${merged.added}, updated ${merged.updated}, duplicates ${merged.duplicates}, ` +
      `price changes ${merged.priceChanges.length}, analyzed ${analyzed.length}, bargains ${bargains}.`,
  );
  if (!existsSync(LISTINGS)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
