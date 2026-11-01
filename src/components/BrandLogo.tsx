import logos from '../data/logos/logos.json';

interface LogoMeta {
  src: string;
  title: string;
  page: string;
  license: string;
  author: string | null;
}

const LOGOS = logos as Record<string, LogoMeta>;

export function brandLogo(manufacturerId: string | null | undefined): LogoMeta | null {
  return (manufacturerId && LOGOS[manufacturerId]) || null;
}

/**
 * Brand logo from Wikimedia Commons (served from public/logos; relative path works because the app is a single page with HashRouter) (src/data/logos/logos.json — file, licence, author per brand).
 * Most logos are black on transparent, so they sit on a light chip to stay readable in the dark theme.
 * Brands without a free logo on Commons render nothing.
 */
export function BrandLogo({ id, size = 'sm', placeholder = false }: { id: string | null | undefined; size?: 'sm' | 'lg'; placeholder?: boolean }) {
  const logo = brandLogo(id);
  const box = size === 'lg' ? 'h-14 w-44 p-2.5' : 'h-8 w-20 p-1.5';
  // Keeps list rows aligned when a brand has no free logo.
  if (!logo) return placeholder ? <span className={`inline-flex shrink-0 rounded-lg border border-dashed border-white/[0.08] ${box}`} aria-hidden /> : null;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-white/90 ${box}`}>
      <img src={logo.src} alt={`Logo ${logo.title}`} loading="lazy" className="max-h-full max-w-full object-contain" />
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
      <a href={logo.page} target="_blank" rel="noreferrer" className="hover:underline">
        {logo.title}
      </a>{' '}
      (Wikimedia Commons{logo.author ? `, ${logo.author}` : ''}, {logo.license}). Znak towarowy należy do właściciela marki. Współczesne logo — naklejki z epoki mogły wyglądać inaczej.
    </p>
  );
}
