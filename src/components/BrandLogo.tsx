import logos from '../data/logos/logos.json';

interface LogoMeta {
  src: string;
  title: string;
  /** Source page with licence details; null for files added by the site owner. */
  page: string | null;
  license: string | null;
  author: string | null;
  /** Where the file comes from (Wikimedia Commons, de.wikipedia, added by the owner). */
  source: string;
  /** Scale for files with wide empty margins. */
  zoom?: number;
}

const LOGOS = logos as Record<string, LogoMeta>;

export function brandLogo(manufacturerId: string | null | undefined): LogoMeta | null {
  return (manufacturerId && LOGOS[manufacturerId]) || null;
}

/**
 * Brand logo (public/logos; metadata with source, licence and author in src/data/logos/logos.json).
 * Relative paths work because the app is a single page with HashRouter.
 * Most logos are black on transparent, so they sit on a light chip to stay readable in the dark theme.
 * Brands without a logo render nothing.
 */
export function BrandLogo({ id, size = 'sm', placeholder = false }: { id: string | null | undefined; size?: 'sm' | 'lg'; placeholder?: boolean }) {
  const logo = brandLogo(id);
  const box = size === 'lg' ? 'h-14 w-44 p-2.5' : 'h-8 w-20 p-1.5';
  // Keeps list rows aligned when a brand has no free logo.
  if (!logo) return placeholder ? <span className={`inline-flex shrink-0 rounded-lg border border-dashed border-black/[0.11] ${box}`} aria-hidden /> : null;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/90 ${box}`}>
      <img
        src={logo.src}
        alt={`Logo ${logo.title}`}
        loading="lazy"
        className="max-h-full max-w-full object-contain"
        style={logo.zoom ? { transform: `scale(${logo.zoom})` } : undefined}
      />
    </span>
  );
}

/** Attribution line required by the licences (CC BY / BY-SA) and kept for public-domain files too. */
export function BrandLogoCredit({ id }: { id: string | null | undefined }) {
  const logo = brandLogo(id);
  if (!logo) return null;
  return (
    <p className="mt-1 text-[10px] text-ink-500">
      Logo:{' '}
      {logo.page ? (
        <a href={logo.page} target="_blank" rel="noreferrer" className="hover:underline">
          {logo.title}
        </a>
      ) : (
        logo.title
      )}{' '}
      ({[logo.source, logo.author, logo.license].filter(Boolean).join(', ')}). Znak towarowy należy do właściciela marki. Współczesne logo — naklejki z epoki mogły wyglądać inaczej.
    </p>
  );
}
