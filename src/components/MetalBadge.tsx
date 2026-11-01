import type { ListingAnalysis } from '../types/listing';
import { METAL_ORDER, METAL_TIERS, metalTier, type MetalTier } from '../features/scoring/metalTier';

/** Metal grade icon + name for a listing's value tier (scrap → reclaimed → refined → hunted). */
export function MetalBadge({ analysis, size = 'sm' }: { analysis: ListingAnalysis; size?: 'sm' | 'lg' }) {
  return <MetalTierBadge tier={metalTier(analysis)} size={size} />;
}

export function MetalTierBadge({ tier, size = 'sm' }: { tier: MetalTier; size?: 'sm' | 'lg' }) {
  const t = METAL_TIERS[tier];
  const lg = size === 'lg';
  return (
    <span
      title={`${t.label} — ${t.hint}`}
      className={`inline-flex items-center gap-1 rounded-md bg-ink-950/80 font-mono font-bold uppercase tracking-wider backdrop-blur ${lg ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'}`}
      style={{ color: t.color }}
    >
      <img src={t.icon} alt="" width={lg ? 34 : 24} height={lg ? 34 : 24} className="-my-1" />
      {t.label}
    </span>
  );
}

/** Legend of all four tiers, worst → best. */
export function MetalLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-400">
      {METAL_ORDER.map((k) => (
        <span key={k} className="inline-flex items-center gap-2">
          <MetalTierBadge tier={k} />
          <span className="max-w-[16rem]">{METAL_TIERS[k].hint}</span>
        </span>
      ))}
      <span className="w-full text-[10px] text-ink-500">Grafiki stopni metalu: Team Fortress 2 © Valve.</span>
    </div>
  );
}
