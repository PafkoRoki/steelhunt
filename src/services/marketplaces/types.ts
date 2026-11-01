import type { MarketplaceId, SourceListing } from '../../types/listing';

/**
 * Status of a source integration — shown honestly in the UI.
 *  - `api`       : official API connector implemented (needs credentials server-side).
 *  - `manual`    : no permitted automatic access — use URL / JSON / CSV import.
 *  - `planned`   : under investigation.
 */
export type IntegrationStatus = 'api' | 'manual' | 'planned' | 'scout';

export interface MarketplaceInfo {
  id: MarketplaceId;
  name: string;
  homepage: string;
  status: IntegrationStatus;
  /** Plain-language note about what is and isn't possible. */
  note: string;
  /** Build a search URL the user can open themselves (never scraped by STEELHUNT). */
  searchUrl?: (query: string) => string;
  /** Hostnames used to recognize a pasted listing URL. */
  hosts: string[];
  /** Extract a stable external id from a listing URL, if the URL format allows. */
  parseExternalId?: (url: URL) => string | null;
}

export interface ConnectorRunResult {
  source: MarketplaceId;
  ok: boolean;
  skipped?: boolean;
  listings: SourceListing[];
  error?: string;
  durationMs: number;
}

/** Server-side connector contract (scripts/ingest.ts). Each runs in isolation: one failure never breaks others. */
export interface MarketplaceConnector {
  id: MarketplaceId;
  /** Returns false (with reason) when credentials/config are missing — the run is then skipped, not faked. */
  isConfigured(): { ok: boolean; reason?: string };
  search(queries: string[], opts: { maxResults: number }): Promise<SourceListing[]>;
}
