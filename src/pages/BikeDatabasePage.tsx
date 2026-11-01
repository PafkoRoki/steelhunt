import { useMemo, useState } from 'react';
import { BrandLogo, BrandLogoCredit } from '../components/BrandLogo';
import { Download, Plus, Trash2 } from 'lucide-react';
import { useAppData } from '../hooks/AppData';
import { PageHeader } from '../components/ui';
import { CATEGORY_LABEL } from '../utils/labels';
import { normalizeText } from '../utils/text';
import { downloadFile } from '../utils/storage';
import type { BicycleCategory } from '../types/listing';
import type { Region } from '../types/database';

const COUNTRY: Record<Region, string> = {
  usa: 'USA', canada: 'Kanada', japan: 'Japonia', taiwan: 'Tajwan', germany: 'Niemcy', netherlands: 'Holandia', france: 'Francja',
  uk: 'Wlk. Brytania', italy: 'Włochy', austria: 'Austria', poland: 'Polska', switzerland: 'Szwajcaria', other: 'inne / do weryfikacji',
};

const slugify = (s: string) => normalizeText(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function BikeDatabasePage() {
  const { db, userDb, addManufacturer, addModel, removeUserEntry, listings } = useAppData();
  const [q, setQ] = useState('');
  const [onlyUnder, setOnlyUnder] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState<'mfr' | 'model' | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    listings.forEach((l) => l.analysis.manufacturerId && m.set(l.analysis.manufacturerId, (m.get(l.analysis.manufacturerId) ?? 0) + 1));
    return m;
  }, [listings]);

  const userIds = new Set([...userDb.manufacturers.map((m) => m.id), ...userDb.models.map((m) => m.id)]);
  const mfrs = db.manufacturers
    .filter((m) => (!onlyUnder || m.undervaluedInPoland) && (!q || normalizeText(m.name + ' ' + m.aliases.join(' ')).includes(normalizeText(q)) || db.models.some((md) => md.manufacturerId === m.id && normalizeText(md.name).includes(normalizeText(q)))))
    .sort((a, b) => a.name.localeCompare(b.name));
  const sel = selected ? db.manufacturerById.get(selected) : null;
  const models = sel ? db.models.filter((m) => m.manufacturerId === sel.id) : [];

  return (
    <>
      <PageHeader
        title="Baza rowerów"
        subtitle={`${db.manufacturers.length} producentów · ${db.models.length} modeli. Dane w plikach JSON (src/data) + Twoje własne wpisy zapisane w przeglądarce.`}
        actions={
          <>
            <button className="btn-ghost" onClick={() => setShowAdd('mfr')}>
              <Plus size={15} /> Producent
            </button>
            <button className="btn-ghost" onClick={() => setShowAdd('model')}>
              <Plus size={15} /> Model
            </button>
            <button className="btn-ghost" onClick={() => downloadFile('steelhunt-user-db.json', JSON.stringify(userDb, null, 2))} disabled={!userIds.size}>
              <Download size={15} /> Eksport moich wpisów
            </button>
          </>
        }
      />

      {showAdd && <AddForm kind={showAdd} onClose={() => setShowAdd(null)} onAddMfr={addManufacturer} onAddModel={addModel} mfrs={db.manufacturers.map((m) => [m.id, m.name])} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Szukaj marki lub modelu…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-ink-300">
          <input type="checkbox" className="accent-moss-500" checked={onlyUnder} onChange={(e) => setOnlyUnder(e.target.checked)} />
          Tylko marki często niedoceniane w PL
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="card max-h-[70vh] overflow-y-auto p-2">
          {mfrs.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${selected === m.id ? 'bg-moss-500/10 ring-1 ring-inset ring-moss-500/25' : 'hover:bg-white/[0.03]'}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <BrandLogo id={m.id} placeholder />
                <div>
                <div className="font-medium text-ink-100">
                  {m.name} {userIds.has(m.id) && <span className="ml-1 text-[10px] uppercase text-brass-400">własny</span>}
                </div>
                <div className="text-[11px] text-ink-500">
                  {COUNTRY[m.country]} · {db.models.filter((x) => x.manufacturerId === m.id).length} modeli
                  {m.undervaluedInPoland && <span className="text-moss-400"> · niedoceniana w PL</span>}
                </div>
                </div>
              </div>
              <div className="text-right">
                <div className="stat-num text-sm text-ink-200">{m.steelReputation}</div>
                <div className="text-[10px] text-ink-500">{counts.get(m.id) ?? 0} ogł.</div>
              </div>
            </button>
          ))}
        </div>

        <div className="card p-5">
          {!sel ? (
            <p className="text-sm text-ink-400">Wybierz producenta z listy, aby zobaczyć modele, typowe rury i heurystyczne zakresy cen.</p>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <BrandLogo id={sel.id} size="lg" />
                  <h2 className="mt-2 font-display text-3xl uppercase tracking-wide">{sel.name}</h2>
                  <p className="text-xs text-ink-500">
                    {COUNTRY[sel.country]} · reputacja stali (heurystyka): {sel.steelReputation}/100 · aliasy: {sel.aliases.join(', ')}
                  </p>
                </div>
                {userIds.has(sel.id) && (
                  <button className="text-ink-500 hover:text-rust-400" onClick={() => removeUserEntry('manufacturers', sel.id)} aria-label="Usuń">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              {sel.notes && <p className="mt-3 rounded-xl bg-ink-950/50 p-3 text-sm text-ink-300">{sel.notes}</p>}
              <Sources urls={sel.sources} />
              <BrandLogoCredit id={sel.id} />
              <div className="mt-4 space-y-2">
                {models.length === 0 && <p className="text-sm text-ink-500">Brak modeli w bazie — ogłoszenia tej marki mogą trafić do Unknown Gems.</p>}
                {models.map((m) => (
                  <div key={m.id} className="rounded-xl border border-white/[0.05] bg-ink-950/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-ink-100">
                          {m.name} <span className="text-xs font-normal text-ink-500">{m.years}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-ink-500">
                          {CATEGORY_LABEL[m.category]} · {m.verification === 'unverified' ? 'dane niezweryfikowane' : m.verification === 'documented' ? 'udokumentowane' : 'powszechnie podawane'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.marketValuePLN && (
                          <span className="stat-num whitespace-nowrap text-sm text-ink-200">
                            {m.marketValuePLN.min}–{m.marketValuePLN.max} zł
                          </span>
                        )}
                        {userIds.has(m.id) && (
                          <button className="text-ink-500 hover:text-rust-400" onClick={() => removeUserEntry('models', m.id)} aria-label="Usuń model">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {m.tubingNote && <p className="mt-1.5 text-xs text-ink-400">{m.tubingNote}</p>}
                    {m.xbikingNotes && <p className="mt-1 text-xs text-moss-300/80">{m.xbikingNotes}</p>}
                    <Sources urls={m.sources} />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-ink-500">Zakresy cen to heurystyczne ceny ofertowe dla kompletnego roweru w dobrym stanie — nie ceny transakcyjne.</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function AddForm({
  kind,
  onClose,
  onAddMfr,
  onAddModel,
  mfrs,
}: {
  kind: 'mfr' | 'model';
  onClose: () => void;
  onAddMfr: ReturnType<typeof useAppData>['addManufacturer'];
  onAddModel: ReturnType<typeof useAppData>['addModel'];
  mfrs: [string, string][];
}) {
  const [f, setF] = useState({ name: '', aliases: '', country: 'other', rep: '60', under: false, notes: '', mfr: mfrs[0]?.[0] ?? '', category: 'vintage-mtb', years: '', min: '', max: '', tubingNote: '' });
  const save = () => {
    if (!f.name.trim()) return;
    const aliases = [f.name, ...f.aliases.split(',')].map((a) => normalizeText(a)).filter(Boolean);
    if (kind === 'mfr') {
      onAddMfr({ id: slugify(f.name), name: f.name.trim(), aliases, country: f.country as Region, steelReputation: Number(f.rep) || 50, undervaluedInPoland: f.under, notes: f.notes || undefined });
    } else {
      onAddModel({
        id: `${f.mfr}-${slugify(f.name)}`,
        manufacturerId: f.mfr,
        name: f.name.trim(),
        aliases,
        years: f.years || undefined,
        category: f.category as BicycleCategory,
        verification: 'unverified',
        tubingNote: f.tubingNote || undefined,
        marketValuePLN: f.min && f.max ? { min: Number(f.min), max: Number(f.max) } : undefined,
      });
    }
    onClose();
  };
  return (
    <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">
      <div className="sm:col-span-3 font-display text-lg uppercase tracking-wide">{kind === 'mfr' ? 'Nowy producent' : 'Nowy model'}</div>
      {kind === 'model' && (
        <div>
          <label className="label">Producent</label>
          <select className="input" value={f.mfr} onChange={(e) => setF({ ...f, mfr: e.target.value })}>
            {mfrs.map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label">Nazwa *</label>
        <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Aliasy (po przecinku)</label>
        <input className="input" value={f.aliases} onChange={(e) => setF({ ...f, aliases: e.target.value })} />
      </div>
      {kind === 'mfr' ? (
        <>
          <div>
            <label className="label">Kraj</label>
            <select className="input" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
              {Object.entries(COUNTRY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Reputacja stali (0–100)</label>
            <input className="input" inputMode="numeric" value={f.rep} onChange={(e) => setF({ ...f, rep: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-300">
            <input type="checkbox" className="accent-moss-500" checked={f.under} onChange={(e) => setF({ ...f, under: e.target.checked })} /> Niedoceniana w PL
          </label>
          <div className="sm:col-span-3">
            <label className="label">Uwagi</label>
            <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="label">Kategoria</label>
            <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Lata produkcji</label>
            <input className="input" value={f.years} onChange={(e) => setF({ ...f, years: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Wartość min (zł)</label>
              <input className="input" inputMode="numeric" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
            </div>
            <div>
              <label className="label">max (zł)</label>
              <input className="input" inputMode="numeric" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />
            </div>
          </div>
          <div className="sm:col-span-3">
            <label className="label">Uwagi o rurach</label>
            <input className="input" value={f.tubingNote} onChange={(e) => setF({ ...f, tubingNote: e.target.value })} />
          </div>
        </>
      )}
      <div className="flex gap-2 sm:col-span-3">
        <button className="btn-primary" onClick={save}>
          Zapisz
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

function Sources({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <p className="mt-1.5 text-[11px] text-ink-500">
      Źródło:{' '}
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-moss-400 hover:text-moss-300">
          {i > 0 && ', '}
          {new URL(u).hostname}
        </a>
      ))}
    </p>
  );
}
