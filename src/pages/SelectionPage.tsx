import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../hooks/AppData';
import { PageHeader } from '../components/ui';
import { MetalTierBadge } from '../components/MetalBadge';
import { REJECT_RULES, MAX_GROUPSET_YEAR, type RejectReason, type ScoutStats } from '../features/listings/scoutRules';
import { METAL_ORDER, METAL_TIERS, metalTier, HUNTED_MIN_SCORE, HUNTED_MIN_VALUE_PLN, RECLAIMED_MIN_SCORE } from '../features/scoring/metalTier';
import { MARKETPLACES } from '../services/marketplaces/registry';
import { formatDateTime } from '../utils/format';
import scoutConfig from '../../config/scout.json';

/**
 * "How a listing gets here" — every stage of the selection with the exact rules (taken from the same
 * code that applies them) and the numbers of the last scout run / what is loaded in this browser.
 */

type Tally = Partial<Record<RejectReason, number>>;
const sumTally = (ts: Tally[]): Tally =>
  ts.reduce<Tally>((acc, t) => {
    for (const [k, v] of Object.entries(t)) acc[k as RejectReason] = (acc[k as RejectReason] ?? 0) + (v ?? 0);
    return acc;
  }, {});
const total = (t: Tally) => Object.values(t).reduce((s: number, v) => s + (v ?? 0), 0);

function Stage({ n, title, who, children, count }: { n: number; title: string; who: string; children: ReactNode; count?: ReactNode }) {
  return (
    <section className="card relative p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss-500/15 font-display text-lg text-moss-300">{n}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-xl uppercase tracking-wide text-ink-100">{title}</h2>
            {count != null && <div className="stat-num text-sm text-ink-300">{count}</div>}
          </div>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-ink-500">{who}</p>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-300">{children}</div>
        </div>
      </div>
    </section>
  );
}

function RuleTable({ tally, note }: { tally?: Tally; note?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead className="text-[11px] uppercase tracking-wider text-ink-500">
          <tr>
            <th className="py-1.5 pr-3 font-normal">#</th>
            <th className="py-1.5 pr-3 font-normal">Powód odrzucenia</th>
            <th className="py-1.5 pr-3 font-normal">Reguła</th>
            {tally && <th className="py-1.5 text-right font-normal">Odrzucone</th>}
          </tr>
        </thead>
        <tbody>
          {REJECT_RULES.map((r, i) => (
            <tr key={r.id} className="border-t border-ink-800/80 align-top">
              <td className="py-2 pr-3 text-ink-500">{i + 1}</td>
              <td className="py-2 pr-3 font-medium text-ink-100">{r.label}</td>
              <td className="py-2 pr-3 text-ink-400">{r.rule}</td>
              {tally && <td className="stat-num py-2 text-right text-ink-200">{tally[r.id] ?? 0}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="mt-2 text-[11px] text-ink-500">{note}</p>}
    </div>
  );
}

export default function SelectionPage() {
  const { live, liveStatus, listings, focused, inRadius, settings } = useAppData();
  const [stats, setStats] = useState<ScoutStats | null | 'missing'>(null);

  useEffect(() => {
    fetch('./data/scout-stats.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : 'missing'))
      .then((j) => setStats(j && j !== 'missing' && Array.isArray(j.portals) ? (j as ScoutStats) : 'missing'))
      .catch(() => setStats('missing'));
  }, []);

  const s = stats && stats !== 'missing' ? stats : null;
  const portals = s?.portals ?? [];
  const sum = (f: (p: ScoutStats['portals'][number]) => number) => portals.reduce((a, p) => a + f(p), 0);
  const preTally = sumTally(portals.map((p) => p.pre.rejected));
  const fullTally = sumTally(portals.map((p) => p.full.rejected));
  const recheckTally = sumTally(portals.map((p) => p.rechecked));

  const liveCount = live.listings.length;
  const withPhotoNotes = live.listings.filter((l) => l.photo).length;
  const tiers = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of inRadius) m[metalTier(l.analysis)] = (m[metalTier(l.analysis)] ?? 0) + 1;
    return m;
  }, [inRadius]);
  // Published listings hidden by the browser's out-of-scope rule (road bikes, single parts).
  const dropped = useMemo(() => {
    const shown = new Set(listings.map((l) => l.listing.id));
    return live.listings.filter((l) => !shown.has(l.id)).length;
  }, [live.listings, listings]);

  const w = settings.dealWeights;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const scoutPortals = MARKETPLACES.filter((m) => m.status === 'scout');
  const manualPortals = MARKETPLACES.filter((m) => m.status !== 'scout' && m.id !== 'other');

  return (
    <>
      <PageHeader
        title="Selekcja ofert"
        subtitle="Dokładny przebieg: skąd biorą się ogłoszenia, które odpadają i dlaczego, oraz jak liczony jest wynik. Reguły poniżej pochodzą z tego samego kodu, który je stosuje."
      />

      <div className="mb-5 flex flex-wrap gap-2 text-xs text-ink-400">
        <span className="chip">
          Ostatni scout: {s ? formatDateTime(s.generatedAt) : stats === 'missing' ? 'brak statystyk (pojawią się po najbliższym uruchomieniu)' : '…'}
        </span>
        <span className="chip">Dane na stronie: {liveStatus === 'ok' ? formatDateTime(live.generatedAt) : liveStatus === 'missing' ? 'brak' : '…'}</span>
      </div>

      <div className="space-y-4">
        <Stage
          n={1}
          title="Wyszukiwanie na portalach"
          who="Scout — skrypt na komputerze właściciela, uruchamiany ręcznie"
          count={s ? <>{sum((p) => p.raw)} wyników → {sum((p) => p.inArea)} unikalnych w obszarze</> : undefined}
        >
          <p>
            Skrypt wysyła zapytania tylko tam, gdzie pozwala na to robots.txt, z jawnym User-Agentem, przerwą {scoutConfig.delayMs / 1000} s między
            zapytaniami i bez logowania, CAPTCHA czy proxy. Gdy portal odmawia (np. HTTP 429), pomija go do następnego uruchomienia.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { id: 'olx', area: `Poznań ± ${scoutConfig.olx.radiusKm} km (filtr API OLX, kategoria Rowery)`, q: scoutConfig.olx.queries, file: 'auto-olx.json' },
              { id: 'sprzedajemy', area: 'Poznań ± 150 km (filtr portalu)', q: scoutConfig.sprzedajemy.queries, file: 'auto-sprzedajemy.json' },
              { id: 'kleinanzeigen', area: `wschodnie Niemcy — kody pocztowe ${scoutConfig.kleinanzeigen.postcodePrefixes.join(', ')}xxx; ceny EUR × ${settings.eurToPln}`, q: scoutConfig.kleinanzeigen.queries, file: 'auto-kleinanzeigen.json' },
            ].map((p) => {
              const st = portals.find((x) => x.file === p.file);
              const info = scoutPortals.find((m) => m.id === p.id);
              return (
                <div key={p.id} className="rounded-xl bg-ink-950/50 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-ink-100">{info?.name ?? p.id}</span>
                    {st && (
                      <span className="stat-num text-xs text-ink-400">
                        {st.raw} → {st.inArea}
                        {st.errors ? <span className="text-rust-400"> · błędy {st.errors}</span> : null}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-400">Obszar: {p.area}</p>
                  <p className="mt-1 text-xs text-ink-500">Zapytania ({p.q.length}): {p.q.join(' · ')}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink-500">
            Bez automatu: {manualPortals.map((m) => m.name).join(', ')} — regulaminy lub brak API. Takie ogłoszenia dodajesz ręcznie przez „Dodaj ogłoszenie” (np. z zapisanej strony).
          </p>
        </Stage>

        <Stage
          n={2}
          title="Wstępny filtr po tytule"
          who="Scout — na karcie wyników, zanim pobierze stronę ogłoszenia"
          count={s ? <>sprawdzone {sum((p) => p.pre.checked)} · odrzucone {total(preTally)}</> : undefined}
        >
          <p>
            Te same reguły co w kroku 4, ale znany jest tylko tytuł — dlatego nie wymaga się jeszcze „cechy retro” (może być dopiero w opisie). OLX
            pomija ten krok, bo API od razu zwraca pełny opis.
          </p>
          {s && total(preTally) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {REJECT_RULES.filter((r) => preTally[r.id]).map((r) => (
                <span key={r.id} className="chip">
                  {r.label}: <span className="stat-num ml-1 text-ink-100">{preTally[r.id]}</span>
                </span>
              ))}
            </div>
          )}
        </Stage>

        <Stage
          n={3}
          title="Pobranie szczegółów"
          who="Scout — tylko dla nowych ogłoszeń"
          count={s ? <>pobrane strony: {sum((p) => p.detailsFetched)}</> : undefined}
        >
          <p>
            Dla ogłoszeń, których jeszcze nie ma w bazie, skrypt pobiera stronę ogłoszenia (opis, zdjęcia, data) — najwyżej {scoutConfig.maxDetailFetches}{' '}
            stron na portal w jednym uruchomieniu. Znane ogłoszenia odświeża tylko z karty wyników (cena, miejscowość). Pełny opis sprzedającego służy
            wyłącznie do analizy i nie jest publikowany — na stronę trafia podsumowanie faktów.
          </p>
        </Stage>

        <Stage
          n={4}
          title="Pełna kontrola: tytuł + opis"
          who="Scout — o odrzuceniu decyduje pierwsza niespełniona reguła, w tej kolejności"
          count={s ? <>sprawdzone {sum((p) => p.full.checked)} · odrzucone {total(fullTally)} · nowe {sum((p) => p.added)}</> : undefined}
        >
          <RuleTable
            tally={s ? fullTally : undefined}
            note={`Wyjątek: kod grupy Shimano z rocznika do ${MAX_GROUPSET_YEAR} (np. RD-M732) od razu zalicza ogłoszenie, o ile wcześniejsze reguły (1–9) nie odrzuciły go. Ogłoszenia już dodane ręcznie są pomijane${s ? ` (${sum((p) => p.full.manualDuplicates)})` : ''}.`}
          />
        </Stage>

        <Stage
          n={5}
          title="Przegląd starszych ogłoszeń"
          who={`Scout — ogłoszenia z wcześniejszych przebiegów trzymane ${scoutConfig.keepDays} dni`}
          count={s ? <>zakończone/sprzedane {sum((p) => p.gone ?? 0)} · zostaje {sum((p) => p.carried)} · usunięte {sum((p) => p.expired)} · opublikowane razem {sum((p) => p.published)}</> : undefined}
        >
          <p>
            Ogłoszenie, którego nie ma w wynikach tego przebiegu, jest sprawdzane na swojej stronie (raz, do 15 na portal): jeśli portal zwraca 404
            albo pisze, że jest niedostępne / zakończone (np. „Dostępność: niedostępne”, „nicht mehr verfügbar”), znika od razu
            {s ? ` (ostatnio sprawdzone: ${sum((p) => p.goneChecked ?? 0)})` : ''}. Pozostałe zostają jeszcze {scoutConfig.keepDays} dni od ostatniego
            zobaczenia — bo czasem wypadają tylko z pierwszej strony wyników — i za każdym razem są ponownie sprawdzane aktualnymi regułami.
            Ogłoszenia odrzucone ręcznie (lista <code>excluded</code> w <code>config/scout.json</code>) nie wracają nigdy.
            {s && total(recheckTally) > 0 && <> Przy ostatnim przeglądzie odpadły: {REJECT_RULES.filter((r) => recheckTally[r.id]).map((r) => `${r.label} ${recheckTally[r.id]}`).join(', ')}.</>}
          </p>
        </Stage>

        <Stage n={6} title="Odczyt zdjęć" who="Claude na komputerze właściciela — po każdym scoucie, do 10 ogłoszeń" count={<>ogłoszenia z odczytem zdjęć: {withPhotoNotes}</>}>
          <p>
            Claude ogląda do 3 zdjęć ogłoszenia i spisuje, co jest na rowerze napisane: naklejki ramy (marka, model), naklejki rur (Tange, Columbus,
            Reynolds…), oznaczenia osprzętu (Deore XT, RD-M735…). Nic nie jest zgadywane: odczyt „czytelny” wchodzi do analizy jako dowód „zdjęcie”,
            „prawdopodobny” jest tylko pokazywany na stronie ogłoszenia.
          </p>
        </Stage>

        <Stage n={7} title="Publikacja" who="GitHub Actions — „Ingest listings”, potem „Deploy to GitHub Pages”" count={<>na stronie: {liveCount}</>}>
          <p>
            Pliki scouta i ręczne importy z repozytorium są łączone, duplikaty scalane (ten sam link = to samo ogłoszenie; zmiany ceny zapisywane w
            historii), dołączane są odczyty zdjęć. Ogłoszenia niewidziane od 14 dni dostają status „usunięte”.
          </p>
        </Stage>

        <Stage
          n={8}
          title="Analiza w przeglądarce"
          who="Twoja przeglądarka — przy każdym otwarciu strony"
          count={<>odrzucone jako szosa / część: {Math.max(0, dropped)}</>}
        >
          <p>
            Z tekstu (i odczytów zdjęć) rozpoznawane są: producent i model (baza rowerów), rury ramy (baza rur), konstrukcja, widelec, osprzęt i jego
            rocznik, rozmiar kół, stan, czerwone flagi. Na tej podstawie liczone są:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b className="text-ink-100">Jakość ramy</b> — wynik serii rur (np. Tange Prestige 100, Cr-Mo bez nazwy 60, Hi-Ten 20); rury znane tylko z bazy modeli −10.
            </li>
            <li>
              <b className="text-ink-100">Wartość rynkowa</b> — zakres z bazy modeli albo marka × jakość ramy, korekta za osprzęt, stan i typ (rama 45%, rama+widelec 55%).
            </li>
            <li>
              <b className="text-ink-100">Deal Score</b> = cena vs wartość {pct(w.price)} + jakość ramy {pct(w.frame)} + odległość {pct(w.location)} + stan{' '}
              {pct(w.condition)} + sygnały negocjacji {pct(w.negotiation)}; czerwona flaga mnoży wynik × 0,6.
            </li>
            <li>
              <b className="text-ink-100">Okazja</b> — co najmniej {settings.dealThresholdPct}% poniżej wyceny, wycena istnieje, jakość ramy ≥ 55, brak czerwonych flag.
            </li>
          </ul>
          <p className="text-xs text-ink-500">
            Zawsze ukrywane: rowery szosowe i pojedyncze części. Szczegóły punktacji każdego ogłoszenia: sekcja „Dlaczego taki wynik” na jego stronie.
          </p>
        </Stage>

        <Stage
          n={9}
          title="Co widzisz na liście"
          who="Twoje ustawienia"
          count={
            <>
              {listings.length} → {focused.length} → {inRadius.length}
            </>
          }
        >
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Wszystkie ogłoszenia po analizie: <span className="stat-num text-ink-100">{listings.length}</span>
            </li>
            <li>
              Tylko retro MTB ({settings.mtbOnly ? 'włączone' : 'wyłączone'}): <span className="stat-num text-ink-100">{focused.length}</span>
            </li>
            <li>
              W promieniu {settings.radiusKm === 0 ? 'bez limitu' : `${settings.radiusKm} km`} od {settings.origin.name} (nieznana lokalizacja zostaje,
              oznaczona): <span className="stat-num text-ink-100">{inRadius.length}</span>
            </li>
          </ol>
          <p>Każde ogłoszenie dostaje stopień metalu:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...METAL_ORDER].reverse().map((t) => (
              <div key={t} className="flex items-center gap-3 rounded-xl bg-ink-950/50 p-3">
                <MetalTierBadge tier={t} />
                <div className="min-w-0 flex-1 text-xs text-ink-400">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-ink-100">{METAL_TIERS[t].label}</span>
                    <span className="stat-num text-ink-200">{tiers[t] ?? 0}</span>
                  </div>
                  {t === 'hunted' && `Okazja, Deal Score ≥ ${HUNTED_MIN_SCORE} i wartość roweru ≥ ${HUNTED_MIN_VALUE_PLN} zł.`}
                  {t === 'refined' && 'Okazja (warunki z kroku 8).'}
                  {t === 'reclaimed' && `Bez czerwonych flag i Deal Score ≥ ${RECLAIMED_MIN_SCORE}.`}
                  {t === 'scrap' && 'Wszystko pozostałe.'}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-500">
            Dalsze zawężanie (cena, marka, rury, stan…) robisz filtrami w <Link to="/deals" className="text-moss-300 hover:underline">Najlepszych okazjach</Link>. Promień i
            tryb „tylko retro MTB” zmieniasz w <Link to="/settings" className="text-moss-300 hover:underline">Ustawieniach</Link>.
          </p>
        </Stage>
      </div>
    </>
  );
}
