import { useState } from 'react';
import { Link } from 'react-router-dom';
import timeline from '../data/history/timeline.json';
import { useAppData } from '../hooks/AppData';
import { PageHeader } from '../components/ui';

type Scope = 'world' | 'europe' | 'poland';
type Confidence = 'confirmed' | 'sources-differ' | 'single-source';
interface Entry {
  year: string;
  scope: Scope;
  title: string;
  text: string;
  confidence: Confidence;
  sources: string[];
}

const ENTRIES = timeline as Entry[];
const SCOPE_LABEL: Record<Scope, string> = { world: 'Świat', europe: 'Europa', poland: 'Polska' };
const SCOPE_TONE: Record<Scope, string> = { world: 'text-ink-300', europe: 'text-sky-300', poland: 'text-moss-300' };
const CONF_LABEL: Record<Confidence, string> = {
  confirmed: 'potwierdzone w źródłach',
  'sources-differ': 'źródła się różnią',
  'single-source': 'jedno źródło / data wyliczona',
};
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

export default function MtbHistoryPage() {
  const { db } = useAppData();
  const [scope, setScope] = useState<Scope | 'all'>('all');
  const rows = ENTRIES.filter((e) => scope === 'all' || e.scope === scope);
  const regional = db.manufacturers.filter((m) => ['poland', 'czechia', 'slovakia'].includes(m.country));

  return (
    <>
      <PageHeader title="Historia MTB" subtitle="Od Kalifornii do Krynicy: jak rower górski trafił do Europy i do Polski. Każdy wpis ma źródło." />

      <div className="mb-5 flex flex-wrap gap-2">
        {(['all', 'poland', 'europe', 'world'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setScope(s)} aria-pressed={scope === s} className={scope === s ? 'btn-primary' : 'btn-ghost'}>
            {s === 'all' ? 'Wszystko' : SCOPE_LABEL[s]} · {s === 'all' ? ENTRIES.length : ENTRIES.filter((e) => e.scope === s).length}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ol className="space-y-3">
          {rows.map((e) => (
            <li key={e.year + e.title} className="card p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="stat-num text-lg text-ink-100">{e.year}</span>
                <span className={`text-xs font-semibold uppercase tracking-wide ${SCOPE_TONE[e.scope]}`}>{SCOPE_LABEL[e.scope]}</span>
                {e.confidence !== 'confirmed' && <span className="text-xs text-rust-400">{CONF_LABEL[e.confidence]}</span>}
              </div>
              <h2 className="mt-1 text-base font-semibold text-ink-100">{e.title}</h2>
              <p className="mt-1 text-sm text-ink-300">{e.text}</p>
              <p className="mt-2 text-[11px] text-ink-500">
                Źródła:{' '}
                {e.sources.map((s, i) => (
                  <span key={s}>
                    {i > 0 && ' · '}
                    <a href={s} target="_blank" rel="noreferrer" className="text-ink-400 underline decoration-white/20 hover:text-ink-200">
                      {host(s)}
                    </a>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ol>

        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="section-title mb-2">Co z tego wynika dla łowcy</h2>
            <p className="mb-2 text-[11px] text-ink-500">To wnioski z osi czasu, nie fakty ze źródeł.</p>
            <ul className="space-y-2 text-sm text-ink-300">
              <li>
                Polska weszła w MTB późno: seria wyścigów od 1992, mistrzostwa od 1993. Rower górski sprzed 1990 r. w polskim ogłoszeniu to prawie zawsze
                import.
              </li>
              <li>
                Polskie marki lat 90. (Romet, Kross, Unibike) robiły proste rowery masowe. Scout traktuje je jak rowery bez marki: samo „retro” w opisie nie
                wystarcza.
              </li>
              <li>
                Stal z wyższej półki przyjeżdżała z Niemiec, Wielkiej Brytanii i Francji, a tam pochodziła głównie z Japonii i Tajwanu. Dlatego warto czytać
                naklejki rur, a nie tylko markę.
              </li>
              <li>Lata 1988–1996 (Puchar Świata, mistrzostwa świata, igrzyska) to szczyt stalowych ram wyścigowych — te roczniki są najcenniejsze.</li>
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="section-title mb-2">Marki z Polski, Czech i Słowacji w bazie</h2>
            <ul className="space-y-2 text-sm">
              {regional.map((m) => (
                <li key={m.id}>
                  <b className="text-ink-100">{m.name}</b>
                  {m.era && <span className="text-ink-500"> · {m.era}</span>}
                  <div className="text-xs text-ink-400">{m.notes}</div>
                </li>
              ))}
            </ul>
            <Link to="/bikes" className="mt-3 inline-block text-sm text-moss-300">
              Cała baza rowerów
            </Link>
          </section>

          <section className="card p-4">
            <h2 className="section-title mb-2">Czego jeszcze brakuje</h2>
            <ul className="space-y-1 text-sm text-ink-400">
              <li>Nazw i roczników pierwszych górskich modeli Rometu — źródła podają tylko zakład (Kowalewo).</li>
              <li>Dokładnego roku startu Grand Prix MTB i Bike Maratonu — daty są wyliczone z numerów edycji.</li>
              <li>Historii polskiej prasy MTB i importu używanych rowerów z Niemiec w latach 90.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
