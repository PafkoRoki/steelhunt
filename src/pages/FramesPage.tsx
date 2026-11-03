import { Link } from 'react-router-dom';
import { Box, ExternalLink } from 'lucide-react';
import frames from '../data/frames/frames.json';
import { PageHeader } from '../components/ui';
import { BrandLogo } from '../components/BrandLogo';

export interface FrameEntry {
  id: string;
  manufacturerId: string;
  modelId: string;
  title: string;
  year: number;
  size: string;
  tubing: string;
  construction: string;
  color: string;
  glb: string;
  poster: string;
  fileSizeMb: number;
  triangles: number;
  source: string;
  summary: string;
}

export const FRAMES = frames as FrameEntry[];

/** "Baza ram" — 3D models of classic frames, built parametrically in Blender from period catalogues. */
export default function FramesPage() {
  return (
    <>
      <PageHeader
        title="Baza ram"
        subtitle="Modele 3D klasycznych ram — budowane w Blenderze na podstawie oryginalnych katalogów i zdjęć z epoki. Każdy wymiar ma podane źródło: katalog, pomiar ze zdjęcia albo szacunek."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {FRAMES.map((f) => (
          <article key={f.id} className="card card-hover overflow-hidden">
            <Link to={`/frames/${f.id}`} className="relative block aspect-[16/10] bg-ink-950" aria-label={`Otwórz model 3D: ${f.title} ${f.year}`}>
              <img src={f.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink-950/80 px-2.5 py-1 text-xs font-medium text-moss-200">
                <Box size={13} /> 3D
              </span>
            </Link>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold leading-snug text-ink-100">
                    <Link to={`/frames/${f.id}`} className="hover:text-moss-300">
                      {f.title} {f.year}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-400">
                    rozmiar {f.size} · {f.tubing} · {f.construction} · {f.color}
                  </p>
                </div>
                <BrandLogo id={f.manufacturerId} />
              </div>
              <p className="mt-3 text-sm text-ink-300">{f.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link to={`/frames/${f.id}`} className="btn-primary !py-1.5 text-sm">
                  <Box size={15} /> Otwórz model 3D
                </Link>
                <a href={f.source} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100">
                  Źródło <ExternalLink size={12} />
                </a>
                <span className="ml-auto text-xs text-ink-500">
                  {f.fileSizeMb} MB · ~{Math.round(f.triangles / 1000)} tys. trójkątów
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-6 text-xs text-ink-500">
        Kolejne ramy dochodzą, gdy jest wystarczająco danych (katalog z geometrią albo pomiary prawdziwej ramy). Masz ramę, którą można zmierzyć i sfotografować? Taki model będzie najdokładniejszy.
      </p>
    </>
  );
}
