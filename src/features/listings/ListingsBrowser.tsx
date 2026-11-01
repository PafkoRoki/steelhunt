import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownWideNarrow, SlidersHorizontal, X } from 'lucide-react';
import type { AnalyzedListing, BicycleCategory, FrameMaterial, ItemType, ListingCondition, MarketplaceId } from '../../types/listing';
import { useAppData } from '../../hooks/AppData';
import { ListingCard } from '../../components/ListingCard';
import { activeFilterCount, applyFilters, EMPTY_FILTERS, sortListings, SORT_OPTIONS, type FilterState, type SortKey } from './filters';
import { CATEGORY_LABEL, CONDITION_LABEL, CONFIDENCE_LABEL, ITEM_TYPE_LABEL, MATERIAL_LABEL } from '../../utils/labels';
import { marketplaceName } from '../../services/marketplaces/registry';
import { EmptyState } from '../../components/ui';

/** Reusable filter + sort + grid. Pages pass the base set and optional preset filters. */
export function ListingsBrowser({
  items,
  initialFilters,
  initialSort = 'deal',
  empty,
}: {
  items: AnalyzedListing[];
  initialFilters?: Partial<FilterState>;
  initialSort?: SortKey;
  empty?: ReactNode;
}) {
  const { settings, now, db } = useAppData();
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS, ...initialFilters });
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [panelOpen, setPanelOpen] = useState(false);

  const result = useMemo(
    () => sortListings(applyFilters(items, filters, { newHours: settings.newListingHours, now }), sort),
    [items, filters, sort, settings.newListingHours, now],
  );

  const options = useMemo(() => {
    const mfrIds = new Set(items.map((i) => i.analysis.manufacturerId).filter(Boolean) as string[]);
    const modelIds = new Set(items.map((i) => i.analysis.modelId).filter(Boolean) as string[]);
    return {
      manufacturers: db.manufacturers.filter((m) => mfrIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name)),
      models: db.models.filter((m) => modelIds.has(m.id) && (!filters.manufacturer || m.manufacturerId === filters.manufacturer)),
      tubing: [...new Set(items.map((i) => i.analysis.tubing.manufacturer).filter(Boolean) as string[])].sort(),
      wheels: [...new Set(items.map((i) => i.analysis.wheelSize).filter(Boolean) as string[])].sort(),
      marketplaces: [...new Set(items.map((i) => i.listing.marketplace))] as MarketplaceId[],
    };
  }, [items, db, filters.manufacturer]);

  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const toggle = <T,>(k: keyof FilterState, v: T) =>
    setFilters((f) => {
      const arr = f[k] as unknown as T[];
      return { ...f, [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });
  const count = activeFilterCount(filters);

  const panel = (
    <div className="space-y-5">
      <div>
        <label className="label">Szukaj</label>
        <input className="input" placeholder="np. tange, karakoram, mufy…" value={filters.query} onChange={(e) => set('query', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Cena od</label>
          <input className="input" inputMode="numeric" value={filters.priceMin ?? ''} onChange={(e) => set('priceMin', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="label">Cena do</label>
          <input className="input" inputMode="numeric" value={filters.priceMax ?? ''} onChange={(e) => set('priceMax', e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>

      <div>
        <label className="label">Maks. odległość: {filters.maxDistance == null ? 'wg promienia' : `${filters.maxDistance} km`}</label>
        <input type="range" min={0} max={400} step={10} className="w-full accent-moss-500" value={filters.maxDistance ?? 400} onChange={(e) => set('maxDistance', Number(e.target.value) >= 400 ? null : Number(e.target.value))} />
      </div>

      <Range label="Min. Deal Score" value={filters.minDealScore} onChange={(v) => set('minDealScore', v)} />
      <Range label="Min. jakość ramy" value={filters.minFrameScore} onChange={(v) => set('minFrameScore', v)} />

      <div className="grid grid-cols-1 gap-2">
        <Select label="Producent" value={filters.manufacturer} onChange={(v) => setFilters((f) => ({ ...f, manufacturer: v, model: '' }))} options={options.manufacturers.map((m) => [m.id, m.name])} />
        <Select label="Model" value={filters.model} onChange={(v) => set('model', v)} options={options.models.map((m) => [m.id, m.name])} />
        <Select label="Producent rur" value={filters.tubingManufacturer} onChange={(v) => set('tubingManufacturer', v)} options={options.tubing.map((t) => [t, t])} />
        <Select label="Rozmiar kół" value={filters.wheelSize} onChange={(v) => set('wheelSize', v)} options={options.wheels.map((w) => [w, w])} />
        <Select label="Min. pewność rur" value={filters.minConfidence} onChange={(v) => set('minConfidence', v as FilterState['minConfidence'])} options={(['strong', 'probable', 'unverified'] as const).map((c) => [c, CONFIDENCE_LABEL[c]])} />
      </div>

      <div className="space-y-2">
        <Toggle label="Tylko okazje (≥ próg)" checked={filters.onlyBargains} onChange={(v) => set('onlyBargains', v)} />
        <Toggle label="Tylko Unknown Gems" checked={filters.onlyGems} onChange={(v) => set('onlyGems', v)} />
        <Toggle label={`Tylko nowe (${settings.newListingHours} h)`} checked={filters.onlyNew} onChange={(v) => set('onlyNew', v)} />
        <Toggle label="Ukryj czerwone flagi" checked={filters.hideRedFlags} onChange={(v) => set('hideRedFlags', v)} />
        <Toggle label="Ukryj duplikaty" checked={filters.hideDuplicates} onChange={(v) => set('hideDuplicates', v)} />
      </div>

      <ChipGroup label="Typ" values={Object.keys(ITEM_TYPE_LABEL) as ItemType[]} selected={filters.itemTypes} labelOf={(v) => ITEM_TYPE_LABEL[v]} onToggle={(v) => toggle('itemTypes', v)} />
      <ChipGroup label="Materiał" values={Object.keys(MATERIAL_LABEL) as FrameMaterial[]} selected={filters.materials} labelOf={(v) => MATERIAL_LABEL[v]} onToggle={(v) => toggle('materials', v)} />
      <ChipGroup label="Kategoria" values={(Object.keys(CATEGORY_LABEL) as BicycleCategory[]).filter((c) => !['unknown', 'vintage-road', 'randonneur'].includes(c))} selected={filters.categories} labelOf={(v) => CATEGORY_LABEL[v]} onToggle={(v) => toggle('categories', v)} />
      <ChipGroup label="Stan" values={Object.keys(CONDITION_LABEL) as ListingCondition[]} selected={filters.conditions} labelOf={(v) => CONDITION_LABEL[v]} onToggle={(v) => toggle('conditions', v)} />
      <ChipGroup label="Portal" values={options.marketplaces} selected={filters.marketplaces} labelOf={(v) => marketplaceName(v)} onToggle={(v) => toggle('marketplaces', v)} />

      {count > 0 && (
        <button className="btn-ghost w-full" onClick={() => setFilters({ ...EMPTY_FILTERS, ...initialFilters })}>
          <X size={14} /> Wyczyść filtry
        </button>
      )}
    </div>
  );

  return (
    <div className="flex gap-6">
      <aside className="hidden w-72 shrink-0 xl:block">
        <div className="card sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4">{panel}</div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button className="btn-ghost xl:hidden" onClick={() => setPanelOpen(true)}>
            <SlidersHorizontal size={15} /> Filtry {count > 0 && <span className="stat-num rounded-full bg-moss-500/20 px-1.5 text-xs text-moss-300">{count}</span>}
          </button>
          <div className="flex items-center gap-2">
            <ArrowDownWideNarrow size={15} className="text-ink-500" />
            <select className="input !w-auto !py-1.5" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <span className="ml-auto text-sm text-ink-500">
            <span className="stat-num text-ink-200">{result.length}</span> z {items.length}
          </span>
        </div>

        {result.length ? (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {result.map((it) => (
              <ListingCard key={it.listing.id} item={it} />
            ))}
          </div>
        ) : (
          empty ?? <EmptyState icon={<SlidersHorizontal size={22} />} title="Brak wyników">Zmień filtry lub zwiększ promień wyszukiwania.</EmptyState>
        )}
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPanelOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[min(22rem,92vw)] overflow-y-auto bg-ink-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-xl uppercase tracking-wide">Filtry</h3>
              <button onClick={() => setPanelOpen(false)} className="text-ink-400" aria-label="Zamknij filtry">
                <X size={20} />
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </div>
  );
}

function Range({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label">
        {label}: <span className="stat-num text-ink-200">{value}</span>
      </label>
      <input type="range" min={0} max={100} step={5} className="w-full accent-moss-500" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Wszystkie</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ink-300">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-moss-500' : 'bg-ink-700'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink-100 transition ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

function ChipGroup<T extends string>({ label, values, selected, labelOf, onToggle }: { label: string; values: T[]; selected: T[]; labelOf: (v: T) => string; onToggle: (v: T) => void }) {
  if (!values.length) return null;
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button
            key={v}
            onClick={() => onToggle(v)}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${selected.includes(v) ? 'border-moss-500/50 bg-moss-500/15 text-moss-200' : 'border-white/[0.08] text-ink-400 hover:text-ink-200'}`}
          >
            {labelOf(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
