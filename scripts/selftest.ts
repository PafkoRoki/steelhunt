/** Quick sanity check of the analysis pipeline on demo data: `npm run test:scoring`. */
import { loadSampleListings } from '../src/data/sample-listings/loadSamples';
import { analyzeListings } from '../src/services/analysis/pipeline';
import { buildDatabase } from '../src/services/database/db';
import { DEFAULT_SETTINGS } from '../src/features/scoring/config';
import { mergeListings } from '../src/services/deduplication/dedupe';

const now = Date.now();
const merged = mergeListings([], loadSampleListings(now), new Date(now).toISOString());
const out = analyzeListings(merged.merged, DEFAULT_SETTINGS, buildDatabase(), now);
console.table(
  out.map(({ listing: l, analysis: a }) => ({
    title: l.title.slice(0, 34),
    price: l.price,
    mfr: a.manufacturer ?? '-',
    model: a.model ?? '-',
    tubing: a.tubing.series ? `${a.tubing.manufacturer ?? ''} ${a.tubing.series}`.trim().slice(0, 18) : '-',
    conf: a.tubing.confidence,
    scope: a.tubing.scope,
    mat: a.frameMaterial,
    cat: a.bicycleCategory,
    est: `${a.price.min}-${a.price.max}`,
    km: a.distanceKm ?? '?',
    deal: a.dealScore,
    frame: a.frameQualityScore,
    xb: a.xbikingPotentialScore,
    bargain: a.isBargain ? 'Y' : '',
    gem: a.isUnknownGem ? 'G' : '',
    dup: l.duplicateOf ? 'D' : '',
  })),
);
console.log('dupes', merged.duplicates);
