/** Print the analysis of the published live data: `npx tsx scripts/report.ts`. */
import { readFileSync } from 'node:fs';
import { analyzeListings } from '../src/services/analysis/pipeline';
import { buildDatabase } from '../src/services/database/db';
import { DEFAULT_SETTINGS } from '../src/features/scoring/config';
import type { LiveDataFile } from '../src/types/run';

const data = JSON.parse(readFileSync('public/data/listings.json', 'utf8')) as LiveDataFile;
const out = analyzeListings(data.listings, DEFAULT_SETTINGS, buildDatabase());
console.table(
  out
    .sort((a, b) => b.analysis.dealScore - a.analysis.dealScore)
    .map(({ listing: l, analysis: a }) => ({
      title: l.title.slice(0, 32),
      price: l.price,
      mfr: a.manufacturer ?? '-',
      tubing: a.tubing.series ? `${a.tubing.manufacturer ?? ''} ${a.tubing.series}`.trim().slice(0, 16) : '-',
      conf: a.tubing.confidence,
      scope: a.tubing.scope,
      est: a.price.confidence === 'none' ? '-' : `${a.price.min}-${a.price.max}`,
      km: a.distanceKm ?? '?',
      deal: a.dealScore,
      frame: a.frameQualityScore,
      bargain: a.isBargain ? 'Y' : '',
      gem: a.isUnknownGem ? 'G' : '',
    })),
);
