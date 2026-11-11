import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import '@google/model-viewer';
import { PageHeader } from '../components/ui';
import { FRAMES } from './FramesPage';

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
  const { id } = useParams();
  const frame = FRAMES.find((f) => f.id === id);
  const variants = frame?.variants ?? [];
  const [variantId, setVariantId] = useState(variants[0]?.id);
  if (!frame) return <Navigate to="/frames" replace />;
  const v = variants.find((x) => x.id === variantId) ?? null;
  const glb = v?.glb ?? frame.glb;
  const poster = v?.poster ?? frame.poster;
  const alt = v?.alt ?? frame.alt ?? `Model 3D ramy ${frame.title} ${frame.year}`;

  return (
    <>
      <Link to="/frames" className="tap mb-3 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft size={15} /> Baza ram
      </Link>
      <PageHeader title={frame.pageTitle} subtitle={frame.pageSubtitle} />

      <div className="card overflow-hidden">
        {variants.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-4 py-2.5" role="group" aria-label="Malowanie">
            <span className="text-xs text-ink-400">Malowanie:</span>
            {variants.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setVariantId(x.id)}
                aria-pressed={x.id === variantId}
                className={`tap rounded-full px-3 py-1 text-xs font-medium transition ${x.id === variantId ? 'bg-ink-100 text-ink-950' : 'bg-white/[0.06] text-ink-300 hover:text-ink-100'}`}
              >
                {x.label}
              </button>
            ))}
            {v?.fileSizeMb != null && <span className="ml-auto text-xs text-ink-500">{v.fileSizeMb} MB</span>}
          </div>
        )}
        <model-viewer
          key={glb}
          src={glb}
          poster={poster}
          alt={alt}
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
          Przeciągnij, aby obrócić · kółko myszy lub dwa palce, aby przybliżyć — mikrodetale (haki, uchwyty, naklejki) najlepiej widać z bliska.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {frame.tables.map((t) => (
          <Table key={t.title} title={t.title} rows={t.rows} note={t.note} />
        ))}
      </div>

      <section className="card mt-4 p-5">
        <h3 className="section-title mb-2">Co jest wymodelowane</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-300">
          {frame.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-500">{frame.footnote}</p>
        <a href={frame.source} target="_blank" rel="noreferrer" className="tap mt-2 inline-flex items-center gap-1.5 text-sm text-moss-300 hover:underline">
          {frame.sourceLabel} <ExternalLink size={13} />
        </a>
      </section>
    </>
  );
}
