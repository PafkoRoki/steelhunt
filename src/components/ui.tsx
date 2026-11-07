import type { ReactNode } from 'react';
import { AlertTriangle, FlaskConical, Gem, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { ConfidenceLevel, DataOrigin, MarketplaceId } from '../types/listing';
import { CONFIDENCE_LABEL } from '../utils/labels';
import { scoreTone, TONE_COLOR } from '../utils/format';
import { marketplaceName } from '../services/marketplaces/registry';

export function ScoreRing({ value, size = 56, label, stroke = 5 }: { value: number; size?: number; label?: string; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = TONE_COLOR[scoreTone(value)];
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(16,48,72,0.14)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <span className="stat-num absolute inset-0 flex items-center justify-center text-sm font-semibold text-ink-100" style={{ height: size }}>
        {value}
      </span>
      {label && <span className="mt-1 text-center text-[10px] uppercase tracking-wider text-ink-400">{label}</span>}
    </div>
  );
}

export function ScoreBar({ value, label, hint }: { value: number | null; label: string; hint?: string }) {
  const v = value ?? 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-ink-400">{label}</span>
        <span className="stat-num text-ink-200">{value == null ? '?' : value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/55">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: value == null ? '#97c2d9' : TONE_COLOR[scoreTone(v)] }} />
      </div>
      {hint && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const styles: Record<ConfidenceLevel, string> = {
    verified: 'border-moss-400/40 bg-moss-500/15 text-moss-300',
    strong: 'border-moss-500/30 bg-moss-600/15 text-moss-300',
    probable: 'border-brass-500/30 bg-brass-500/10 text-brass-300',
    unverified: 'border-rust-500/30 bg-rust-500/10 text-rust-400',
    unknown: 'border-black/15 bg-white/40 text-ink-400',
  };
  const Icon = level === 'verified' || level === 'strong' ? ShieldCheck : ShieldQuestion;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[level]}`}>
      <Icon size={12} />
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}

export function OriginBadge({ origin }: { origin: DataOrigin }) {
  if (origin === 'demo')
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-brass-500/40 bg-ink-950/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-brass-400">
        <FlaskConical size={11} /> Demo
      </span>
    );
  if (origin === 'import')
    return <span className="rounded-md border border-black/15 bg-ink-950/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-300">Import</span>;
  return <span className="rounded-md border border-moss-500/40 bg-ink-950/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-moss-300">Live</span>;
}

export function MarketplaceTag({ id }: { id: MarketplaceId }) {
  return <span className="chip">{marketplaceName(id)}</span>;
}

export function GemBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-700/30 bg-cyan-600/10 px-2 py-0.5 text-[11px] font-medium text-cyan-800">
      <Gem size={12} /> Unknown Gem
    </span>
  );
}

export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-brass-500/20 bg-brass-500/[0.06] px-2.5 py-1.5 text-[11px] text-brass-300">
      <AlertTriangle size={13} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl border border-black/[0.09] bg-white/40 p-4 text-moss-400">{icon}</div>
      <h3 className="font-display text-xl uppercase tracking-wide">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-ink-400">{children}</div>}
    </div>
  );
}

export function StatTile({ label, value, sub, icon, accent }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? 'border-moss-500/25 bg-moss-900/30' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="section-title !text-[11px]">{label}</span>
        <span className={accent ? 'text-moss-300' : 'text-ink-500'}>{icon}</span>
      </div>
      <div className="stat-num mt-2 text-2xl font-semibold text-ink-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
