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
  const [scope, setScope] = useState<Scope | 'all'>('europe');
  const rows = ENTRIES.filter((e) => scope === 'all' || e.scope === scope);
  const EUROPE = ['germany', 'austria', 'switzerland', 'uk', 'france', 'italy', 'netherlands'];
  const gems = db.manufacturers.filter((m) => EUROPE.includes(m.country) && m.steelReputation >= 80).sort((a, b) => b.steelReputation - a.steelReputation);

  return (
    <>
      <PageHeader title="Historia MTB" subtitle="Jak rower górski trafił z Kalifornii do Europy i kto budował tu najlepsze stalowe ramy lat 80. i 90. Każdy wpis ma źródło." />

      <div className="mb-5 flex flex-wrap gap-2">
        {(['europe', 'world', 'poland', 'all'] as const).map((s) => (
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
              <li>Najcenniejsze europejskie ramy to małe serie od budowniczych: Roberts, Overbury's, Ferraroli, Mécacycle. W ogłoszeniach często nie mają nazwy modelu — liczy się naklejka rur i sposób łączenia.</li>
              <li>Lutowanie bez muf (fillet brazing) i rury Reynolds 753 / 853 albo Columbus to znak ręcznej roboty, nie produkcji masowej.</li>
              <li>Duże marki (Peugeot, Raleigh, Centurion) robiły głównie rowery seryjne; perłami są ich krótkie serie specjalne, jak Raleigh Dyna-Tech.</li>
              <li>Lata 1988–1996 (Puchar Świata, mistrzostwa świata, igrzyska) to szczyt stalowych ram wyścigowych — te roczniki są najcenniejsze.</li>
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="section-title mb-2">Europejskie perły w bazie</h2>
            <ul className="space-y-2 text-sm">
              {gems.map((m) => (
                <li key={m.id}>
                  <b className="text-ink-100">{m.name}</b>
                  <span className="text-ink-500"> · {db.models.filter((x) => x.manufacturerId === m.id).length} modeli</span>
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
              <li>Włochy, Holandia, Belgia, Hiszpania i Skandynawia — o stalowych MTB z tych krajów jest na razie mało potwierdzonych danych.</li>
              <li>Niemieckie manufaktury (Nöll, Wiesmann, Germans, Marschall) — znane tylko z forów, bez roczników i nazw modeli.</li>
              <li>Widełek cen dla nowo dodanych modeli — pojawią się, gdy scout zbierze własne obserwacje.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
