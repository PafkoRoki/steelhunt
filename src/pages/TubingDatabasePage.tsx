import { useMemo, useState } from 'react';
import { useAppData } from '../hooks/AppData';
import { PageHeader, WarningNote } from '../components/ui';
import { scoreTone, TONE_COLOR } from '../utils/format';
import { normalizeText } from '../utils/text';

const VERIF_LABEL = { documented: 'udokumentowane', 'commonly-reported': 'powszechnie podawane', unverified: 'niezweryfikowane' } as const;
const MATERIAL = { crmo: 'Cr-Mo', 'mn-mo': 'Mn-Mo', steel: 'stal', hiten: 'Hi-Ten', aluminium: 'aluminium' } as const;

export default function TubingDatabasePage() {
  const { db, settings, updateSettings } = useAppData();
  const [q, setQ] = useState('');
  const [maker, setMaker] = useState('');
  const makers = [...new Set(db.tubing.map((t) => t.manufacturer))];
  const rows = useMemo(
    () =>
      db.tubing.filter(
        (t) => (!maker || t.manufacturer === maker) && (!q || normalizeText(`${t.manufacturer} ${t.series} ${t.notes ?? ''}`).includes(normalizeText(q))),
      ),
    [db.tubing, q, maker],
  );

  const setScore = (id: string, v: number | null) => {
    const next = { ...settings.frameScoreOverrides };
    if (v == null) delete next[id];
    else next[id] = v;
    updateSettings({ frameScoreOverrides: next });
  };

  return (
    <>
      <PageHeader
        title="Baza rur ramowych"
        subtitle="Rozpoznawane serie rur, wzorce tekstowe i heurystyczne oceny jakości. Oceny możesz zmienić — przeliczenie wszystkich ogłoszeń jest natychmiastowe."
      />
      <div className="mb-4">
        <WarningNote>
          Wyniki to wartości startowe (heurystyka), nie oficjalny ranking materiałów. Ta sama nazwa serii bywa używana na widelcu lub tylko na rurach głównych — dlatego analiza zawsze podaje zakres i poziom pewności.
        </WarningNote>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Szukaj serii…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {['', ...makers].map((m) => (
            <button
              key={m || 'all'}
              onClick={() => setMaker(m)}
              className={`tap inline-flex items-center rounded-full border px-3 py-1 text-xs ${maker === m ? 'border-moss-500/50 bg-moss-500/15 text-moss-200' : 'border-black/[0.11] text-ink-400'}`}
            >
              {m || 'Wszystkie'}
            </button>
          ))}
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-black/[0.09] text-[11px] uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-3">Producent / seria</th>
              <th className="px-4 py-3">Materiał</th>
              <th className="px-4 py-3">Ocena</th>
              <th className="px-4 py-3">Weryfikacja</th>
              <th className="px-4 py-3">Uwagi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const override = settings.frameScoreOverrides[t.id];
              const score = override ?? t.score;
              return (
                <tr key={t.id} className="border-b border-black/[0.07] align-top last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-100">
                      {t.manufacturer === 'Generic' ? '' : t.manufacturer + ' '}
                      {t.series}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-ink-500">{t.patterns.slice(0, 2).join('  |  ')}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-300">
                    {MATERIAL[t.material]}
                    {t.butted && <span className="ml-1 text-[11px] text-ink-500">· cieniowane</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="input stat-num !w-16 !px-2 !py-1"
                        style={{ color: TONE_COLOR[scoreTone(score)] }}
                        value={score}
                        onChange={(e) => setScore(t.id, e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))))}
                      />
                      {override != null && (
                        <button className="text-[11px] text-ink-500 hover:text-ink-200" onClick={() => setScore(t.id, null)} title={`Domyślnie ${t.score}`}>
                          reset
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400">{VERIF_LABEL[t.verification]}</td>
                  <td className="max-w-sm px-4 py-3 text-xs text-ink-400">{t.notes ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-500">
        Rozszerzanie bazy: edytuj <code className="text-ink-300">src/data/tubing/tubing.json</code> (wzorce to wyrażenia regularne dopasowywane do tekstu bez polskich znaków).
      </p>
    </>
  );
}
