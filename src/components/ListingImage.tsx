import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { AnalyzedListing } from '../types/listing';

/**
 * Real listing photo. If a photo fails to load, the next one is tried; with no usable photo an honest
 * "no photo" placeholder is shown — never a drawing that could pass for the bike.
 */
export function ListingImage({ item, className = '' }: { item: AnalyzedListing; className?: string }) {
  const images = item.listing.images;
  const [idx, setIdx] = useState(0);
  const src = images[idx];
  if (src) {
    return (
      <img
        key={src}
        src={src}
        alt={item.listing.title}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setIdx((i) => i + 1)}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  const hadPhotos = images.length > 0;
  return (
    <div
      role="img"
      aria-label={hadPhotos ? 'Zdjęcie niedostępne' : 'Brak zdjęcia'}
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-ink-900 text-ink-500"
    >
      <ImageOff size={34} strokeWidth={1.5} aria-hidden />
      <span className="text-[11px] uppercase tracking-wider">{hadPhotos ? 'zdjęcie niedostępne' : 'brak zdjęcia'}</span>
    </div>
  );
}
