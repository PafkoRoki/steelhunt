import { CheckCircle2, MinusCircle, TrendingDown, TrendingUp, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppData } from '../hooks/AppData';
import { EmptyState, PageHeader } from '../components/ui';
import { formatDateTime, formatPrice } from '../utils/format';

export default function HistoryPage() {
  const { runLog, importHistory, listings } = useAppData();
  const priceChanges = listings
    .filter((l) => l.listing.priceHistory.length > 1)
    .map((l) => {
      const h = l.listing.priceHistory;
      return { item: l, from: h[0].price, to: h[h.length - 1].price, at: h[h.length - 1].date };
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <>
      <PageHeader title="Historia" subtitle="Przebiegi automatycznego wyszukiwania, importy ręczne i zmiany cen." />
      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="section-title mb-3">Automatyczne wyszukiwania (GitHub Actions)</h2>
          {runLog?.runs.length ? (
            <div className="space-y-2">
              <p className="text-xs text-ink-500">
                Ostatnie uruchomienie: {formatDateTime(runLog.lastRunAt)} · ostatnie udane: {formatDateTime(runLog.lastSuccessAt)}
              </p>
              {runLog.runs.slice(0, 30).map((r) => (
                <div key={r.startedAt} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-ink-100">
                      {r.ok ? <CheckCircle2 size={15} className="text-moss-400" /> : <XCircle size={15} className="text-rust-400" />}
                      {formatDateTime(r.startedAt)}
                    </span>
                    <span className="stat-num text-xs text-ink-400">
                      znaleziono {r.found} · nowe {r.added} · zaktual. {r.updated} · duplikaty {r.duplicates} · przeanalizowane {r.analyzed}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.sources.map((s) => (
                      <span key={s.source} className={`chip ${s.ok ? '' : s.skipped ? '!border-dashed !text-ink-400' : '!border-rust-500/40 !text-rust-400'}`} title={s.error}>
                        {s.ok ? <CheckCircle2 size={11} /> : s.skipped ? <MinusCircle size={11} /> : <XCircle size={11} />}
                        {s.source}: {s.ok ? s.found : s.skipped ? 'pominięto' : 'błąd'}
                      </span>
                    ))}
                  </div>
                  {r.sources.filter((s) => s.error && !s.ok).map((s) => (
                    <p key={s.source} className="mt-1 text-[11px] text-ink-500">
                      {s.source}: {s.error}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<MinusCircle size={22} />} title="Brak przebiegów">
              Plik <code>data/run-log.json</code> pojawi się po pierwszym uruchomieniu workflow „Ingest listings” w GitHub Actions.
            </EmptyState>
          )}
        </section>

        <div className="space-y-6">
          <section>
            <h2 className="section-title mb-3">Zmiany cen</h2>
            {priceChanges.length ? (
              <div className="card divide-y divide-white/[0.04]">
                {priceChanges.map(({ item, from, to, at }) => (
                  <Link key={item.listing.id} to={`/listing/${encodeURIComponent(item.listing.id)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/30">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink-100">{item.listing.title}</div>
                      <div className="text-[11px] text-ink-500">{formatDateTime(at)}</div>
                    </div>
                    <div className={`stat-num flex shrink-0 items-center gap-1.5 text-sm ${to < from ? 'text-moss-300' : 'text-rust-400'}`}>
                      {to < from ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                      {formatPrice(from)} → {formatPrice(to)}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">Brak zarejestrowanych zmian cen.</p>
            )}
          </section>

          <section>
            <h2 className="section-title mb-3">Importy ręczne (ta przeglądarka)</h2>
            {importHistory.length ? (
              <div className="card divide-y divide-white/[0.04]">
                {importHistory.map((e) => (
                  <div key={e.at} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-ink-300">
                      {formatDateTime(e.at)} · <span className="uppercase text-ink-500">{e.method}</span>
                    </span>
                    <span className="stat-num text-xs text-ink-400">
                      +{e.added} · zaktual. {e.updated} · dup. {e.duplicates}
                      {e.errors ? ` · błędy ${e.errors}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">Jeszcze nic nie zaimportowano.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
