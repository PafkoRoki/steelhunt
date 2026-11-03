import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import '@google/model-viewer';
import { PageHeader } from '../components/ui';

/** <model-viewer> web component (Google), typed for JSX. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        poster?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        'auto-rotate-delay'?: string;
        'rotation-per-second'?: string;
        'camera-orbit'?: string;
        'min-camera-orbit'?: string;
        'max-camera-orbit'?: string;
        'field-of-view'?: string;
        'shadow-intensity'?: string;
        'shadow-softness'?: string;
        exposure?: string;
        'environment-image'?: string;
        'interaction-prompt'?: string;
        'touch-action'?: string;
        loading?: string;
      };
    }
  }
}

const SOURCE = 'https://bikalog.org/c/specialized/1990-spec-bikes90';

const FROM_CATALOG: [string, string][] = [
  ['Rury', 'DirectDrive / Tange Prestige, cieniowane Cr-Mo'],
  ['Rura górna', 'Ø 31,8 mm'],
  ['Tylne widełki dolne', 'DirectDrive, owalne, stożkowe'],
  ['Tylne widełki górne', 'podwójnie stożkowe'],
  ['Haki', 'kute'],
  ['Obejma sztycy', 'odlew (investment casting)'],
  ['Wzmocnienie rury podsiodłowej', 'STR'],
  ['Mufa suportu', '73 mm'],
  ['Długość tylnych widełek', '429 mm'],
  ['Kąt rury podsiodłowej', '73°'],
  ['Kąt główki', '71°'],
  ['Wysokość suportu', '294 mm'],
  ['Wyprzedzenie widelca', '42 mm'],
  ['Lakier', 'biały'],
];
const FROM_PHOTO: [string, string][] = [
  ['Rozmiar', '18" (rura podsiodłowa 457 mm do góry obejmy)'],
  ['Główka', '100 mm'],
  ['Front center', '620 mm'],
  ['Rura górna', 'opada ok. 6° ku tyłowi'],
];
const ESTIMATED: [string, string][] = [
  ['Rura dolna', 'Ø 31,8 mm'],
  ['Rura podsiodłowa', 'Ø 28,6 mm'],
  ['Główka', 'Ø 35 mm'],
  ['Mufa suportu', 'Ø 38 mm'],
  ['Rozstaw haków', '130 mm'],
  ['Przekroje widełek, położenie lutowanych uchwytów', 'typowe dla epoki'],
];
const DETAILS = [
  'spoiny TIG z charakterystycznym „łuskowaniem” na wszystkich połączeniach',
  'owalne, zwężające się tylne widełki z przegięciem pod oponę',
  'kute haki z hakiem przerzutki (prawy) i pionowym wycięciem na oś',
  'obejma sztycy z uszami, szczeliną i śrubą imbusową; tuleja wzmocnienia STR',
  'cantilevery na widełkach (z otworami na sprężynę), mostek widełek z oparciem pancerza',
  'trzy prowadnice linek na rurze górnej, oporniki linek na rurze dolnej, prowadnica pod suportem',
  'po dwa mocowania koszyka na rurze dolnej i podsiodłowej',
  'mostek tylnych widełek dolnych, gwintowana mufa suportu, otwarta główka',
  'naklejka SPECIALIZED na rurze górnej i napis „Stumpjumper” z cieniem na rurze dolnej, po obu stronach (z grafik dodanych przez właściciela strony)',
];

function Table({ title, rows, note }: { title: string; rows: [string, string][]; note?: string }) {
  return (
    <div className="card p-4">
      <h3 className="section-title mb-2">{title}</h3>
      <dl className="divide-y divide-ink-800/80 text-sm">
        {rows.map(([k, v]) => (
          <div key={k + v} className="flex justify-between gap-4 py-1.5">
            <dt className="text-ink-400">{k}</dt>
            <dd className="text-right text-ink-100">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-2 text-[12px] text-ink-500">{note}</p>}
    </div>
  );
}

export default function FrameModelPage() {
  return (
    <>
      <Link to="/frames" className="tap mb-3 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft size={15} /> Baza ram
      </Link>
      <PageHeader
        title="Stumpjumper Comp 1990 — rama 3D"
        subtitle="Specialized Stumpjumper Comp z 1990 r., rozmiar 18&quot;, sama rama. Model zbudowany parametrycznie w Blenderze na podstawie oryginalnego katalogu i zdjęcia z katalogu."
      />

      <div className="card overflow-hidden">
        <model-viewer
          src="models/stumpjumper-comp-1990.glb"
          poster="models/stumpjumper-comp-1990-poster.jpg"
          alt="Model 3D ramy Specialized Stumpjumper Comp 1990, biała"
          camera-controls
          touch-action="pan-y"
          auto-rotate
          auto-rotate-delay="4000"
          rotation-per-second="12deg"
          camera-orbit="35deg 75deg auto"
          min-camera-orbit="auto auto 0.25m"
          field-of-view="22deg"
          shadow-intensity="0.6"
          shadow-softness="0.9"
          exposure="0.95"
          environment-image="neutral"
          interaction-prompt="auto"
          loading="eager"
          style={{ width: '100%', height: 'min(70vh, 620px)', background: 'radial-gradient(ellipse at 50% 40%, #232627 0%, #121314 75%)' }}
        />
        <p className="border-t border-white/[0.05] px-4 py-2.5 text-xs text-ink-400">
          Przeciągnij, aby obrócić · kółko myszy lub dwa palce, aby przybliżyć — mikrodetale (spoiny, haki, uchwyty) najlepiej widać z bliska.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Table title="Z katalogu Specialized 1990" rows={FROM_CATALOG} />
        <Table title="Zmierzone na zdjęciu z katalogu" rows={FROM_PHOTO} note="Skala z opony 26 × 1,95 (≈ 1,44 mm/px); dokładność ok. ±1 cm." />
        <Table title="Szacowane (nie ma w katalogu)" rows={ESTIMATED} note="Typowe wymiary z epoki — do poprawienia po zmierzeniu prawdziwej ramy (parametry na początku skryptu)." />
      </div>

      <section className="card mt-4 p-5">
        <h3 className="section-title mb-2">Co jest wymodelowane</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-300">
          {DETAILS.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-500">
          Bez widelca. Kolory naklejek dobrane do białej ramy (bordowe litery, ciemny cień). Skrypt: <code>design/3d/stumpjumper_comp_1990.py</code> — każdy wymiar to parametr.
        </p>
        <a href={SOURCE} target="_blank" rel="noreferrer" className="tap mt-2 inline-flex items-center gap-1.5 text-sm text-moss-300 hover:underline">
          Katalog Specialized 1990 (bikalog.org) <ExternalLink size={13} />
        </a>
      </section>
    </>
  );
}
