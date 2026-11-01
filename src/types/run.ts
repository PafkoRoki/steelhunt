/** Written by scripts/ingest.ts to public/data/run-log.json. */
export interface SourceRunLog {
  source: string;
  ok: boolean;
  skipped: boolean;
  found: number;
  error?: string;
  durationMs: number;
}

export interface RunLogEntry {
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  found: number;
  added: number;
  updated: number;
  duplicates: number;
  analyzed: number;
  priceChanges: { id: string; from: number; to: number }[];
  sources: SourceRunLog[];
}

export interface RunLog {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  runs: RunLogEntry[]; // newest first, capped
}

export interface LiveDataFile {
  generatedAt: string | null;
  listings: import('./listing').SourceListing[];
}
