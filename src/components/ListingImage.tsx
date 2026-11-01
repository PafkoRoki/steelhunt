import { useState } from 'react';
import type { AnalyzedListing } from '../types/listing';
import { BikeIllustration } from './BikeIllustration';

/** Real listing photo when available; otherwise a clearly generic illustration. */
export function ListingImage({ item, className = '' }: { item: AnalyzedListing; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = item.listing.images[0];
  if (src && !failed) {
    return <img src={src} alt={item.listing.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div className={`relative h-full w-full ${className}`}>
      <BikeIllustration
        category={item.analysis.bicycleCategory}
        itemType={item.analysis.itemType}
        color={item.listing.declared?.illustrationColor ?? '#5f8665'}
        className="h-full w-full"
      />
      <span className="absolute bottom-2 right-2 rounded bg-ink-950/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink-500">ilustracja</span>
    </div>
  );
}
