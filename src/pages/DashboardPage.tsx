import { Link } from 'react-router-dom';
import { ArrowRight, BadgePercent, Clock, Gem, ListChecks, MapPin, Sparkles, Wallet } from 'lucide-react';
import { useAppData } from '../hooks/AppData';
import { StatTile, ScoreRing, ConfidenceBadge, OriginBadge, GemBadge, EmptyState } from '../components/ui';
import { ListingCard } from '../components/ListingCard';
import { ListingImage } from '../components/ListingImage';
import { formatDateTime, formatKm, formatPct, formatPrice, formatRange, timeAgo } from '../utils/format';
import { isNew } from '../features/listings/filters';
import { MATERIAL_LABEL } from '../utils/labels';
import { SourceStatus } from '../features/dashboard/SourceStatus';

export default function DashboardPage() {
  const { inRadius, settings, now, runLog, live } = useAppData();
  const visible = inRadius.filter((l) => !l.listing.duplicateOf && l.listing.status === 'active');
  const fresh = visible.filter((l) => isNew(l, settings.newListingHours, now));
  const bargains = visible.filter((l) => l.analysis.isBargain).sort((a, b) => b.analysis.dealScore - a.analysis.dealScore);
  const gems = visible.filter((l) => l.analysis.isUnknownGem).sort((a, b) => b.analysis.dealScore - a.analysis.dealScore);
  const near = visible.filter((l) => l.analysis.distanceKm != null && l.analysis.distanceKm <= 30).sort((a, b) => b.analysis.dealScore - a.analysis.dealScore);
  const prices = visible.map((l) => l.listing.price).filter((p): p is number => p != null && p > 0);
  const avg = prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : null;

  // Best deal of the day: best-scored bargain discovered in the last 24 h, otherwise best bargain overall.
  const today = bargains.filter((l) => now - Date.parse(l.listing.discoveredAt) < 86400_000);
  const best = today[0] ?? bargains[0] ?? [...visible].sort((a, b) => b.analysis.dealScore - a.analysis.dealScore)[0];

  const lastSearch = runLog?.lastRunAt ?? live.generatedAt;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-title">Pulpit łowcy</p>
          <h1 className="page-title mt-1">Niedocenione stalowe ramy</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            Szukamy rowerów tańszych niż ich realna wartość — w promieniu {settings.radiusKm === 0 ? 'całej Polski' : `${settings.radiusKm} km`} od {settings.origin.name}.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <Clock size={13} /> Ostatnie wyszukiwanie: <span className="text-ink-300">{lastSearch ? `${formatDateTime(lastSearch)} (${timeAgo(lastSearch, now)})` : 'brak — dane demo / import'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Aktywne" value={visible.length} sub="w promieniu" icon={<ListChecks size={16} />} />
        <StatTile label="Nowe" value={fresh.length} sub={`ostatnie ${settings.newListingHours} h`} icon={<Sparkles size={16} />} />
        <StatTile label="Okazje" value={bargains.length} sub={`≥ ${settings.dealThresholdPct}% poniżej rynku`} icon={<BadgePercent size={16} />} accent />
        <StatTile label="Śr. cena" value={avg ? formatPrice(avg) : '—'} sub="cena ofertowa" icon={<Wallet size={16} />} />
        <StatTile label="Blisko" value={near.length} sub="do 30 km" icon={<MapPin size={16} />} />
        <StatTile label="Unknown Gems" value={gems.length} sub="poza bazą modeli" icon={<Gem size={16} />} />
      </div>

      {best ? <BestDeal item={best} isToday={!!today[0]} /> : <EmptyState icon={<BadgePercent size={22} />} title="Brak ogłoszeń">Dodaj ogłoszenie ręcznie lub włącz tryb demo w ustawieniach.</EmptyState>}

      <Section title="Najlepsze okazje" to="/deals" count={bargains.length}>
        {bargains.slice(0, 3).map((l) => (
          <ListingCard key={l.listing.id} item={l} />
        ))}
      </Section>

      <Section title={`Blisko ${settings.origin.name} (≤ 30 km)`} to="/map" count={near.length}>
        {near.slice(0, 3).map((l) => (
          <ListingCard key={l.listing.id} item={l} />
        ))}
      </Section>

      <Section
        title="Unknown Gems"
        to="/deals?gems=1"
        count={gems.length}
        intro="Ciekawe rowery spoza bazy modeli — sygnały jakości (rury, mufy, komponenty) przy nierozpoznanej marce lub modelu. To tropy, nie pewniki."
      >
        {gems.slice(0, 3).map((l) => (
          <ListingCard key={l.listing.id} item={l} />
        ))}
      </Section>

      <SourceStatus />
    </div>
  );
}

function Section({ title, to, count, intro, children }: { title: string; to: string; count: number; intro?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">
            {title} <span className="stat-num text-base text-ink-500">({count})</span>
          </h2>
          {intro && <p className="mt-1 max-w-3xl text-xs text-ink-400">{intro}</p>}
        </div>
        <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-sm text-moss-400 hover:text-moss-300">
          Wszystkie <ArrowRight size={14} />
        </Link>
      </div>
      {count ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div> : <p className="text-sm text-ink-500">Brak pozycji.</p>}
    </section>
  );
}

function BestDeal({ item, isToday }: { item: import('../types/listing').AnalyzedListing; isToday: boolean }) {
  const { listing: l, analysis: a } = item;
  const tubing = a.tubing.series ? `${a.tubing.manufacturer ?? ''} ${a.tubing.series}`.trim() : null;
  return (
    <Link to={`/listing/${encodeURIComponent(l.id)}`} className="card card-hover grid overflow-hidden md:grid-cols-[1.15fr_1fr]">
      <div className="relative aspect-[16/10] bg-ink-950 md:aspect-auto md:min-h-[300px]">
        <div className="absolute inset-0">
          <ListingImage item={item} />
        </div>
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-md bg-moss-500 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-950">{isToday ? 'Okazja dnia' : 'Najlepsza okazja'}</span>
          <OriginBadge origin={l.origin} />
        </div>
      </div>
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap gap-2">
            {a.isUnknownGem && <GemBadge />}
            <ConfidenceBadge level={a.tubing.confidence} />
          </div>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-ink-100">{l.title}</h2>
          <p className="mt-1 text-sm text-ink-400">
            {l.locationName ?? 'lokalizacja nieznana'} · {formatKm(a.distanceKm)} od Poznania
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-500">Cena</div>
            <div className="stat-num text-3xl font-semibold text-ink-100">{formatPrice(l.price)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-500">Szacowana wartość</div>
            <div className="stat-num text-lg text-ink-200">{a.price.confidence === 'none' ? '—' : formatRange(a.price.min, a.price.max)}</div>
            {a.discountPct != null && <div className="stat-num text-sm text-moss-300">{formatPct(a.discountPct)} vs rynek</div>}
          </div>
        </div>
        <div className="text-sm text-ink-300">
          {MATERIAL_LABEL[a.frameMaterial]}
          {tubing && ` · ${tubing}`}
          {a.manufacturer && ` · ${a.manufacturer}${a.model ? ' ' + a.model : ''}`}
        </div>
        <div className="mt-auto flex items-center gap-5">
          <ScoreRing value={a.dealScore} size={64} label="Deal" />
          <ScoreRing value={a.frameQualityScore} size={52} label="Rama" />
          <ScoreRing value={a.xbikingPotentialScore} size={52} label="XBiking" />
          {a.locationScore != null && <ScoreRing value={a.locationScore} size={52} label="Lokal." />}
        </div>
        {a.netOpportunity != null && (
          <p className="text-xs text-ink-400">
            Potencjał netto (wartość − cena − renowacja − dojazd): <span className="stat-num text-ink-200">{formatPrice(a.netOpportunity)}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
