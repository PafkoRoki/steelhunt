import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bookmark, Database, Gauge, History, Layers, Map as MapIcon, Menu, Plus, Settings, Sparkles, Trophy, X } from 'lucide-react';
import { useAppData } from '../hooks/AppData';
import { RADIUS_OPTIONS } from '../features/scoring/config';
import type { RadiusOption } from '../types/settings';
import { ImportDialog } from '../features/listings/ImportDialog';

const NAV = [
  { to: '/', label: 'Pulpit', icon: Gauge, end: true },
  { to: '/deals', label: 'Najlepsze okazje', icon: Trophy },
  { to: '/map', label: 'Mapa', icon: MapIcon },
  { to: '/new', label: 'Nowe ogłoszenia', icon: Sparkles },
  { to: '/watchlist', label: 'Obserwowane', icon: Bookmark },
  { to: '/bikes', label: 'Baza rowerów', icon: Database },
  { to: '/tubing', label: 'Baza rur', icon: Layers },
  { to: '/history', label: 'Historia', icon: History },
  { to: '/settings', label: 'Ustawienia', icon: Settings },
];

export function Logo() {
  return (
    <div className="text-xl font-bold leading-none tracking-[0.08em] text-ink-100">STEELHUNT</div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { settings, updateSettings, watchlist } = useAppData();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
              isActive ? 'bg-moss-500/10 text-moss-200 ring-1 ring-inset ring-moss-500/25' : 'text-ink-400 hover:bg-white/[0.04] hover:text-ink-100'
            }`
          }
        >
          <Icon size={17} className="shrink-0" />
          <span className="flex-1">{label}</span>
          {to === '/watchlist' && watchlist.length > 0 && <span className="stat-num rounded-full bg-white/[0.06] px-1.5 text-[11px] text-ink-300">{watchlist.length}</span>}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.05] bg-ink-950/70 px-4 py-5 backdrop-blur lg:flex">
        <Logo />
        <div className="mt-8 flex-1">{nav}</div>
        {settings.demoMode && (
          <div className="rounded-xl border border-brass-500/25 bg-brass-500/[0.06] p-3 text-[11px] leading-relaxed text-brass-300">
            <b className="font-semibold">Tryb demo włączony.</b> Ogłoszenia z plakietką DEMO są fikcyjnymi przykładami. Wyłączysz je w Ustawieniach.
          </div>
        )}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-ink-900 px-4 py-5 shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} className="text-ink-400" aria-label="Zamknij menu">
                <X size={20} />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-white/[0.05] bg-ink-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <button onClick={() => setOpen(true)} className="text-ink-300 lg:hidden" aria-label="Otwórz menu">
            <Menu size={22} />
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="hidden items-center gap-2 text-xs text-ink-400 sm:flex">
              Promień od {settings.origin.name}
              <select
                className="input !w-auto !py-1.5"
                value={settings.radiusKm}
                onChange={(e) => updateSettings({ radiusKm: Number(e.target.value) as RadiusOption })}
              >
                {RADIUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-primary !py-1.5" onClick={() => setImportOpen(true)}>
              <Plus size={16} /> <span className="hidden sm:inline">Dodaj ogłoszenie</span>
            </button>
          </div>
        </div>
      </header>

      <main key={loc.pathname} className="mx-auto max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        {children}
      </main>

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}
