import { Link } from 'react-router-dom';
import { AlertTriangle, Bookmark, BookmarkCheck, Clock, ExternalLink, MapPin, Search } from 'lucide-react';
import type { AnalyzedListing } from '../types/listing';
import { ConfidenceBadge, GemBadge, MarketplaceTag, OriginBadge, ScoreRing } from './ui';
import { MetalBadge } from './MetalBadge';
import { ListingImage } from './ListingImage';
import { formatKm, formatPct, formatPrice, formatRange, timeAgo } from '../utils/format';
import { CATEGORY_LABEL, MATERIAL_LABEL } from '../utils/labels';
import { useAppData } from '../hooks/AppData';

export function ListingCard({ item, compact = false }: { item: AnalyzedListing; compact?: boolean }) {
  const { watchlist, toggleWatch, now } = useAppData();
  const { listing: l, analysis: a } = item;
  const watched = watchlist.includes(l.id);
  const tubing = a.tubing.series ? `${a.tubing.manufacturer ?? ''} ${a.tubing.series}`.trim() : null;
  const uncertain = a.tubing.confidence === 'unknown' || a.tubing.confidence === 'unverified' || a.price.confidence === 'low' || a.price.confidence === 'none';
  const isDemo = l.origin === 'demo';

  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <Link to={`/listing/${encodeURIComponent(l.id)}`} className="relative block aspect-[16/10] overflow-hidden bg-ink-950">
        <ListingImage item={item} className="transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {isDemo && <OriginBadge origin={l.origin} />}
          <MetalBadge analysis={a} />
          {a.redFlags.length > 0 && <span className="rounded-md bg-rust-500/90 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink-950">Uwaga</span>}
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-ink-950/75 p-1 backdrop-blur">
          <ScoreRing value={a.dealScore} size={50} />
        </div>
        {a.discountPct != null && a.discountPct > 0.05 && (
          <div className="absolute bottom-3 left-3 rounded-lg bg-ink-950/80 px-2 py-1 font-mono text-xs font-semibold text-moss-300 backdrop-blur">
            {formatPct(a.discountPct)} vs rynek
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/listing/${encodeURIComponent(l.id)}`} className="line-clamp-2 font-semibold leading-snug text-ink-100 hover:text-moss-300">
              {l.title}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />
                {l.locationName ?? 'brak lokalizacji'} · {formatKm(a.distanceKm)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {timeAgo(l.discoveredAt, now)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="stat-num whitespace-nowrap text-lg font-semibold text-ink-100">{formatPrice(l.price, l.currency)}</div>
            {l.currency.toUpperCase() !== 'PLN' && a.pricePln != null && <div className="stat-num whitespace-nowrap text-[11px] text-ink-400">≈ {formatPrice(a.pricePln)}</div>}
            {a.price.confidence !== 'none' && (
              <div className="stat-num whitespace-nowrap text-[11px] text-ink-500">
                rynek ~{formatRange(a.price.min, a.price.max)}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <MarketplaceTag id={l.marketplace} />
          {a.manufacturer && <span className="chip text-ink-200">{a.manufacturer}{a.model ? ` ${a.model}` : ''}</span>}
          <span className="chip">{CATEGORY_LABEL[a.bicycleCategory]}</span>
          {a.isUnknownGem && <GemBadge />}
        </div>

        {!compact && (
          <div className="plate px-3 pb-3 pt-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="plate-label">Rama</div>
                <div className="truncate text-sm text-ink-200">
                  {MATERIAL_LABEL[a.frameMaterial]}
                  {tubing && <span className="text-ink-400"> · {tubing}</span>}
                </div>
              </div>
              <ConfidenceBadge level={a.tubing.confidence} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <MiniScore label="Rama" value={a.frameQualityScore} />
              <MiniScore label="XBiking" value={a.xbikingPotentialScore} />
              <MiniScore label="Lokalizacja" value={a.locationScore} />
            </div>
          </div>
        )}

        {uncertain && !compact && (
          <div className="flex items-center gap-1.5 text-[11px] text-brass-300/90">
            <AlertTriangle size={12} />
            {a.tubing.confidence === 'unknown' ? 'Materiał ramy nieznany' : a.tubing.confidence === 'unverified' ? 'Specyfikacja rur niezweryfikowana' : 'Wycena niepewna'}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-3 !py-1.5 text-xs" title={isDemo ? 'Dane demo — link prowadzi do wyszukiwarki portalu' : 'Otwórz oryginalne ogłoszenie'}>
            {isDemo ? <Search size={13} /> : <ExternalLink size={13} />}
            {isDemo ? 'Szukaj podobnych' : 'Ogłoszenie'}
          </a>
          <button
            onClick={() => toggleWatch(l.id)}
            className={`btn !px-2.5 !py-1.5 text-xs ${watched ? 'bg-moss-500/15 text-moss-300' : 'text-ink-400 hover:text-ink-100'}`}
            aria-label={watched ? 'Usuń z obserwowanych' : 'Obserwuj'}
          >
            {watched ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            {watched ? 'Obserwujesz' : 'Obserwuj'}
          </button>
        </div>
      </div>
    </article>
  );
}

function MiniScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="stat-num text-base font-semibold text-ink-100">{value ?? '?'}</div>
      <div className="plate-label !text-[10px]">{label}</div>
    </div>
  );
}
