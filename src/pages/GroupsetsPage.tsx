import { useMemo, useState } from 'react';
import { useAppData } from '../hooks/AppData';
import { PageHeader, WarningNote } from '../components/ui';
import { SHIMANO, yearsLabel } from '../services/groupsets/match';
import { normalizeText } from '../utils/text';

const VERIF_LABEL = { documented: 'udokumentowane', 'commonly-reported': 'powszechnie podawane', unverified: 'niezweryfikowane' } as const;
const SOURCE_LABEL: Record<string, string> = { wl: 'Wikipedia (lista grup)', wxt: 'Wikipedia (Deore XT)', mombat: 'MOMBAT', shimano100: 'Shimano – historia' };

/** Timeline axis for the year bars. */
const AXIS_FROM = 1983;
const AXIS_TO = 2006;
const span = AXIS_TO - AXIS_FROM;

/**
 * Shimano MTB groupsets by generation and production years. The same data drives listing analysis:
 * a model code (RD-M732) found in a listing identifies the generation and suggests the bike's era.
 */
export default function GroupsetsPage() {
  const { listings } = useAppData();
  const [family, setFamily] = useState('');
  const [q, setQ] = useState('');

  const families = [...SHIMANO.families].sort((a, b) => a.rank - b.rank);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of listings) for (const c of l.analysis.components) if (c.name.startsWith('Shimano ')) m.set(c.name, (m.get(c.name) ?? 0) + 1);
    return m;
  }, [listings]);
  const countFor = (prefix: string) => [...counts.entries()].filter(([k]) => k.startsWith(prefix)).reduce((s, [, n]) => s + n, 0);

  const rows = SHIMANO.groupsets
    .filter((g) => !family || g.family === family)
    .filter((g) => {
      if (!q) return true;
      const fam = families.find((f) => f.id === g.family)!;
      return normalizeText(`${fam.name} ${g.series} ${g.codes.join(' ')} ${g.yearFrom} ${(g.tech ?? []).join(' ')}`).includes(normalizeText(q));
    })
    .sort((a, b) => (families.find((f) => f.id === a.family)!.rank - families.find((f) => f.id === b.family)!.rank) || a.yearFrom - b.yearFrom);

  return (
    <>
      <PageHeader
        title="Osprzęt Shimano"
        subtitle={`${SHIMANO.groupsets.length} generacji w ${SHIMANO.families.length} grupach MTB, lata 1983–2005. Oznaczenie z ogłoszenia (np. RD-M732) wskazuje generację i przybliżony rocznik roweru.`}
      />
      <div className="mb-4">
        <WarningNote>
          Rok startu pochodzi ze źródeł. Rok końca to szacunek: zwykle rok przed następną generacją. Tam, gdzie źródła podają różne lata, jest to opisane przy pozycji. Osprzęt bywa wymieniany, więc rocznik „wg osprzętu” to wskazówka, a nie dowód.
        </WarningNote>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Szukaj: M732, Rapidfire, 1990…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {[{ id: '', name: 'Wszystkie' }, ...families].map((f) => (
            <button
              key={f.id || 'all'}
              onClick={() => setFamily(f.id)}
              className={`tap inline-flex items-center rounded-full border px-3 py-1 text-xs ${family === f.id ? 'border-moss-500/50 bg-moss-500/15 text-moss-200' : 'border-black/[0.11] text-ink-400'}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {family && (() => {
        const f = families.find((x) => x.id === family)!;
        const n = countFor(`Shimano ${f.name}`);
        return (
          <p className="mb-4 text-sm text-ink-300">
            {f.notes ?? ''} {n > 0 && <span className="text-moss-300">W bieżących ogłoszeniach: {n}.</span>}
          </p>
        );
      })()}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-black/[0.09] text-[11px] uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-3">Grupa / seria</th>
              <th className="px-4 py-3">Lata</th>
              <th className="w-56 px-4 py-3">
                <div className="flex justify-between font-normal normal-case tracking-normal">
                  <span>{AXIS_FROM}</span>
                  <span>1990</span>
                  <span>2000</span>
                </div>
              </th>
              <th className="px-4 py-3">Rzędy</th>
              <th className="px-4 py-3">Technologia i uwagi</th>
              <th className="px-4 py-3">Weryfikacja</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => {
              const fam = families.find((f) => f.id === g.family)!;
              const to = g.yearTo ?? g.yearFrom;
              const left = ((g.yearFrom - AXIS_FROM) / span) * 100;
              const width = Math.max(((to - g.yearFrom + 1) / span) * 100, 3);
              const inListings = counts.get(`Shimano ${fam.name} ${g.series} (${yearsLabel(g)})`) ?? 0;
              return (
                <tr key={g.id} className="border-b border-black/[0.07] align-top last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-100">
                      {fam.name} <span className="text-ink-300">{g.series}</span>
                    </div>
                    {g.codes.length > 0 && <div className="mt-0.5 font-mono text-[10px] text-ink-500">{g.codes.join(' · ')}</div>}
                    {inListings > 0 && <div className="mt-1 text-[11px] text-moss-300">w ogłoszeniach: {inListings}</div>}
                  </td>
                  <td className="stat-num whitespace-nowrap px-4 py-3 text-ink-200">
                    {yearsLabel(g)}
                    {g.yearNote && <div className="mt-0.5 max-w-[11rem] whitespace-normal text-[11px] font-normal text-brass-300">{g.yearNote}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative mt-1.5 h-2 rounded-full bg-white/45">
                      <div
                        className={`absolute inset-y-0 rounded-full ${g.yearTo ? '' : 'opacity-60'}`}
                        style={{ left: `${left}%`, width: `${width}%`, background: fam.tier >= 5 ? '#7fa283' : fam.tier >= 3 ? '#a8a37a' : '#6b6f70' }}
                        title={yearsLabel(g)}
                      />
                    </div>
                  </td>
                  <td className="stat-num px-4 py-3 text-ink-300">{g.speeds}</td>
                  <td className="max-w-sm px-4 py-3 text-xs text-ink-400">
                    {g.tech && g.tech.length > 0 && <div className="text-ink-300">{g.tech.join(' · ')}</div>}
                    {g.notes && <div className="mt-0.5">{g.notes}</div>}
                    {!g.tech?.length && !g.notes && '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400">
                    {VERIF_LABEL[g.verification]}
                    <div className="mt-1 flex flex-col gap-0.5">
                      {g.sources.map((s) => (
                        <a key={s} href={SHIMANO.sources[s]} target="_blank" rel="noreferrer" className="text-[11px] text-moss-300 hover:underline">
                          {SOURCE_LABEL[s] ?? s}
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-500">
        Rozszerzanie bazy: edytuj <code className="text-ink-300">src/data/groupsets/shimano.json</code>. Kody serii (np. M730) są wykrywane także z prefiksem części: RD-, FD-, FC-, ST-, BR-, CS-, HB-, FH-.
      </p>
    </>
  );
}
