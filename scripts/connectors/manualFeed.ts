/**
 * Manual feed connector — reads JSON/CSV files committed to `data/imports/`.
 * This is the authorized path for portals without an API (OLX, Allegro Lokalnie, Sprzedajemy, Facebook):
 * a person collects listing data they can legitimately see and commits it; the pipeline analyzes it.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { MarketplaceConnector } from '../../src/services/marketplaces/types';
import { importCsv, importJson } from '../../src/services/marketplaces/importer';
import type { SourceListing } from '../../src/types/listing';

export function createManualFeedConnector(cfg: { dir: string }, onRowErrors: (msg: string) => void): MarketplaceConnector {
  return {
    id: 'manual',
    isConfigured: () => (existsSync(cfg.dir) ? { ok: true } : { ok: false, reason: `Brak katalogu ${cfg.dir}` }),
    async search() {
      const files = readdirSync(cfg.dir).filter((f) => /\.(json|csv)$/i.test(f));
      const out: SourceListing[] = [];
      for (const f of files) {
        const text = readFileSync(join(cfg.dir, f), 'utf8');
        const res = f.toLowerCase().endsWith('.csv') ? importCsv(text, 'import') : importJson(text, 'import');
        out.push(...res.listings);
        res.errors.forEach((e) => onRowErrors(`${f} wiersz ${e.row}: ${e.message}`));
      }
      return out;
    },
  };
}
