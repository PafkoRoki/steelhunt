import { RotateCcw } from 'lucide-react';
import { useAppData } from '../hooks/AppData';
import { PageHeader, WarningNote } from '../components/ui';
import { RADIUS_OPTIONS } from '../features/scoring/config';
import type { DealWeights, RadiusOption } from '../types/settings';
import { PLACES } from '../services/geolocation/places';

const WEIGHT_LABELS: Record<keyof DealWeights, string> = {
  price: 'Cena vs wartość rynkowa',
  frame: 'Jakość ramy',
  location: 'Odległość',
  condition: 'Stan i kompletność',
  negotiation: 'Potencjał negocjacji',
};

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useAppData();
  const wSum = Object.values(settings.dealWeights).reduce((s, v) => s + v, 0);

  return (
    <>
      <PageHeader
        title="Ustawienia"
        subtitle="Wszystkie parametry oceny są konfigurowalne. Zmiany przeliczają wyniki od razu i zapisują się w tej przeglądarce."
        actions={
          <button className="btn-ghost" onClick={() => confirm('Przywrócić ustawienia domyślne?') && resetSettings()}>
            <RotateCcw size={15} /> Domyślne
          </button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Lokalizacja i promień">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Punkt odniesienia</label>
              <select
                className="input"
                value={Object.keys(PLACES).find((k) => PLACES[k].name === settings.origin.name) ?? 'poznan'}
                onChange={(e) => {
                  const p = PLACES[e.target.value];
                  updateSettings({ origin: { name: p.name, lat: p.lat, lng: p.lng } });
                }}
              >
                {Object.entries(PLACES)
                  .sort((a, b) => a[1].name.localeCompare(b[1].name, 'pl'))
                  .map(([k, p]) => (
                    <option key={k} value={k}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Domyślny promień</label>
              <select className="input" value={settings.radiusKm} onChange={(e) => updateSettings({ radiusKm: Number(e.target.value) as RadiusOption })}>
                {RADIUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <div className="label">Punkty za odległość</div>
            <div className="space-y-2">
              {settings.distanceBands.map((b, i) => {
                const prev = i === 0 ? 0 : settings.distanceBands[i - 1].maxKm;
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="stat-num w-28 text-ink-400">
                      {prev}–{b.maxKm >= 100000 ? '∞' : b.maxKm} km
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      className="flex-1 accent-moss-500"
                      value={b.score}
                      onChange={(e) => {
                        const bands = settings.distanceBands.map((x, j) => (j === i ? { ...x, score: Number(e.target.value) } : x));
                        updateSettings({ distanceBands: bands });
                      }}
                    />
                    <span className="stat-num w-8 text-right text-ink-200">{b.score}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card title="Wagi Deal Score">
          <div className="space-y-3">
            {(Object.keys(WEIGHT_LABELS) as (keyof DealWeights)[]).map((k) => (
              <div key={k} className="flex items-center gap-3 text-sm">
                <span className="w-44 text-ink-300">{WEIGHT_LABELS[k]}</span>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  className="flex-1 accent-moss-500"
                  value={Math.round(settings.dealWeights[k] * 100)}
                  onChange={(e) => updateSettings({ dealWeights: { ...settings.dealWeights, [k]: Number(e.target.value) / 100 } })}
                />
                <span className="stat-num w-14 text-right text-ink-200">{Math.round((settings.dealWeights[k] / (wSum || 1)) * 100)}%</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-500">Wagi są normalizowane do 100%. Domyślnie: 40 / 25 / 20 / 10 / 5.</p>
        </Card>

        <Card title="Próg okazji">
          <div className="flex flex-wrap gap-2">
            {([20, 30, 40, 50] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateSettings({ dealThresholdPct: t })}
                className={`rounded-xl border px-4 py-2 text-sm ${settings.dealThresholdPct === t ? 'border-moss-500/50 bg-moss-500/15 text-moss-200' : 'border-white/[0.08] text-ink-400'}`}
              >
                ≥ {t}% poniżej rynku
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-500">Okazja wymaga też jakości ramy ≥ 55, istniejącej wyceny i braku czerwonych flag — sama niska cena nie wystarczy.</p>
        </Card>

        <Card title="Koszty dojazdu">
          <div className="grid grid-cols-3 gap-3">
            <Num label="Koszt / km (zł)" step={0.05} value={settings.fuelCostPerKm} onChange={(v) => updateSettings({ fuelCostPerKm: v })} />
            <Num label="Współczynnik drogowy" step={0.05} value={settings.roadFactor} onChange={(v) => updateSettings({ roadFactor: v })} />
            <Num label="Kurier (zł)" step={10} value={settings.courierCost} onChange={(v) => updateSettings({ courierCost: v })} />
          </div>
          <p className="mt-3 text-[11px] text-ink-500">Dojazd liczony w obie strony: odległość w linii prostej × współczynnik drogowy × 2 × koszt/km. Gdy sprzedawca wysyła — tańsza opcja.</p>
        </Card>

        <Card title="Dane">
          <label className="flex items-center justify-between gap-3 text-sm text-ink-200">
            <span>
              Tryb demo
              <span className="block text-[11px] text-ink-500">Pokazuje fikcyjne przykładowe ogłoszenia (oznaczone DEMO).</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-moss-500" checked={settings.demoMode} onChange={(e) => updateSettings({ demoMode: e.target.checked })} />
          </label>
          <div className="mt-4">
            <Num label="„Nowe” = wykryte w ciągu (godz.)" step={6} value={settings.newListingHours} onChange={(v) => updateSettings({ newListingHours: Math.max(1, v) })} />
          </div>
        </Card>

        <Card title="Bezpieczeństwo i źródła">
          <WarningNote>
            Aplikacja działa w całości w przeglądarce (GitHub Pages). Klucze API (np. Allegro) trzymane są wyłącznie w sekretach GitHub Actions i nigdy nie trafiają do kodu frontendu. STEELHUNT nie obchodzi zabezpieczeń portali ani nie scrapuje stron.
          </WarningNote>
        </Card>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="section-title mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Num({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" step={step} className="input stat-num" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
