import { CheckCircle2, CircleDashed, Hand, PlugZap } from 'lucide-react';
import { MARKETPLACES } from '../../services/marketplaces/registry';
import { useAppData } from '../../hooks/AppData';
import { formatDateTime } from '../../utils/format';

/** Honest overview of which sources are wired up — nothing pretends to search. */
export function SourceStatus() {
  const { runLog, liveStatus, live, imports, settings } = useAppData();
  const lastRun = runLog?.runs[0];
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Źródła danych</h2>
          <p className="mt-1 text-xs text-ink-400">
            Dane live: {liveStatus === 'ok' ? `${live.listings.length} ogłoszeń (wygenerowano ${formatDateTime(live.generatedAt)})` : liveStatus === 'loading' ? 'ładowanie…' : 'brak pliku danych — uruchom workflow „Ingest listings”'} · Import ręczny: {imports.length} · Demo: {settings.demoMode ? 'włączone' : 'wyłączone'}
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MARKETPLACES.filter((m) => m.id !== 'other').map((m) => {
          const log = lastRun?.sources.find((s) => s.source === m.id);
          const Icon = m.status === 'api' ? PlugZap : m.status === 'manual' ? Hand : CircleDashed;
          return (
            <div key={m.id} className="rounded-xl border border-white/[0.05] bg-ink-950/40 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-ink-100">
                  <Icon size={15} className={m.status === 'api' ? 'text-moss-400' : 'text-ink-500'} />
                  {m.name}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-ink-500">{m.status === 'api' ? 'API' : m.status === 'manual' ? 'ręcznie' : 'planowane'}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">{m.note}</p>
              {log && (
                <p className={`mt-1.5 flex items-center gap-1 text-[11px] ${log.ok ? 'text-moss-300' : log.skipped ? 'text-ink-500' : 'text-rust-400'}`}>
                  <CheckCircle2 size={11} /> {log.ok ? `ostatnio: ${log.found} ogłoszeń` : log.skipped ? `pominięto: ${log.error ?? 'brak konfiguracji'}` : `błąd: ${log.error}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
