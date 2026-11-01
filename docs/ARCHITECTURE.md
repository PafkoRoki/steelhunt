# Architecture

STEELHUNT is a static React app (GitHub Pages) plus a scheduled Node ingestion job (GitHub Actions).
There is no running backend; the browser loads JSON files and recomputes all analysis locally.

```
                ┌──────────────────────── GitHub Actions (every 6 h) ────────────────────────┐
 config/        │ scripts/ingest.ts                                                           │
 sources.json ─▶│  connectors (isolated) ─▶ normalize ─▶ dedupe/merge ─▶ analyze (counts)     │
 data/imports/ ─▶│  manual-feed, allegro                                  │                   │
                │                                   public/data/listings.json  (SOURCE data)  │
                │                                   public/data/run-log.json   (run history)  │
                └──────────────────────────────────────────────┬──────────────────────────────┘
                                                               │ deploy.yml (workflow_run)
                                                               ▼
 Browser ── fetch ./data/*.json ─┐
 localStorage imports ───────────┼─▶ mergeListings ─▶ analyzeListings(settings, db) ─▶ UI
 demo samples (flagged) ─────────┘
```

## Layers

| Path | Responsibility |
|---|---|
| `src/types/` | `SourceListing` (raw, normalized) vs `ListingAnalysis` (derived). Never mixed in storage. |
| `src/data/` | Knowledge base JSON: manufacturers, models, tubing, components; demo samples. |
| `src/services/analysis/` | `textAnalyzer` (heuristic extraction), `pipeline` (orchestration), `unknownGem`. |
| `src/services/price-analysis/` | Market value estimation, restoration costs, comparables index. |
| `src/features/scoring/` | Four scores + default configuration. Pure functions. |
| `src/services/geolocation/` | Haversine distance, town gazetteer (city-centre precision only). |
| `src/services/deduplication/` | Exact key (marketplace + externalId / canonical URL) and fuzzy cross-portal detection. |
| `src/services/marketplaces/` | Registry (honest integration status), connector contract, manual importer (zod). |
| `src/services/ai-analysis/` | Optional AI interface; disabled by default. |
| `scripts/` | Ingestion runner + server-side connectors (secrets via env). |
| `src/pages`, `src/components`, `src/features/*` | UI. |

## Key design decisions

- **Re-analysis in the browser.** `listings.json` stores source data only. Scores depend on user settings
  (origin, weights, thresholds, tubing overrides), so they are computed client-side in a `useMemo`.
  28–2 000 listings analyze in milliseconds; beyond that, move analysis to a Web Worker.
- **Determinism.** `analyzeListings(listings, settings, db, now)` is pure; the same function runs in Node.
- **Repository upgrade path.** All persistence goes through `AppData` (browser) and `ingest.ts` (server).
  Swapping JSON files for a database (e.g. SQLite/Supabase) means replacing those two adapters only.
- **Honesty constraints** are enforced in code: confidence levels, `geoPrecision`, `origin: 'demo'`,
  integration `status`, price `confidence: 'none'` when there is nothing to base a valuation on.

## Adding a marketplace connector

1. Add/adjust an entry in `src/services/marketplaces/registry.ts` (status, hosts, URL id parser).
2. Implement `MarketplaceConnector` in `scripts/connectors/<name>.ts` using only an official API or
   authorized feed. `isConfigured()` must return `{ ok: false, reason }` when credentials are missing.
3. Register it in `scripts/ingest.ts` and `config/sources.json`.
4. Document access method and limits in `docs/MARKETPLACES.md`.
