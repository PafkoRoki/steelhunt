/**
 * OPTIONAL AI analysis module (Phase 4) — interface only.
 *
 * STEELHUNT works fully without AI: all scores come from the heuristic text analyzer.
 * An AI provider, when added, must run SERVER-SIDE (scripts/, GitHub Actions) with its key in
 * an environment secret, and write its output to a separate file (e.g. public/data/ai-notes.json)
 * so AI conclusions stay separate from source data and from heuristic analysis.
 *
 * Rules for any implementation:
 *  - never fabricate specifications; return `null` fields when unsure;
 *  - every finding carries a confidence 0..1 and a short explanation;
 *  - decal readings from photos are at most "probable" unless the decal is fully legible.
 */
import type { SourceListing } from '../../types/listing';

export interface AiFinding {
  field: 'manufacturer' | 'model' | 'tubing' | 'construction' | 'components' | 'year' | 'summary';
  value: string | null;
  confidence: number; // 0..1
  explanation: string;
  source: 'image' | 'text';
}

export interface AiListingNotes {
  listingId: string;
  provider: string;
  analyzedAt: string;
  findings: AiFinding[];
  summary: string;
}

export interface AiAnalyzer {
  readonly name: string;
  isConfigured(): boolean;
  analyze(listing: SourceListing): Promise<AiListingNotes | null>;
}

/** Default: AI disabled. Returns nothing, costs nothing. */
export const disabledAiAnalyzer: AiAnalyzer = {
  name: 'disabled',
  isConfigured: () => false,
  analyze: async () => null,
};
