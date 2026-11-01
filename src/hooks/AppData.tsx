/**
 * Central app state: settings, data sources (live JSON, user imports, demo), watchlist, user DB additions.
 * Analysis is recomputed in-memory whenever inputs change, so settings edits re-score instantly.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AnalyzedListing, SourceListing } from '../types/listing';
import type { AppSettings } from '../types/settings';
import type { BikeModel, Manufacturer, UserDatabaseAdditions } from '../types/database';
import type { LiveDataFile, RunLog } from '../types/run';
import { DEFAULT_SETTINGS } from '../features/scoring/config';
import { buildDatabase, type BikeDatabase } from '../services/database/db';
import { analyzeListings } from '../services/analysis/pipeline';
import { loadSampleListings } from '../data/sample-listings/loadSamples';
import { mergeListings } from '../services/deduplication/dedupe';
import { loadJson, saveJson } from '../utils/storage';
import { isMtbLike, isRoadBike } from '../features/listings/focus';

export interface ImportEvent {
  at: string;
  method: 'url' | 'json' | 'csv';
  added: number;
  updated: number;
  duplicates: number;
  errors: number;
}

interface AppDataValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
  db: BikeDatabase;
  userDb: UserDatabaseAdditions;
  addManufacturer: (m: Manufacturer) => void;
  addModel: (m: BikeModel) => void;
  removeUserEntry: (kind: 'manufacturers' | 'models', id: string) => void;
  listings: AnalyzedListing[];
  /** Listings after the focus filter (retro MTB only when enabled). */
  focused: AnalyzedListing[];
  /** Listings within the selected radius (unknown-distance ones included, flagged). */
  inRadius: AnalyzedListing[];
  byId: Map<string, AnalyzedListing>;
  live: LiveDataFile;
  liveStatus: 'loading' | 'ok' | 'missing';
  runLog: RunLog | null;
  imports: SourceListing[];
  addImports: (items: SourceListing[], method: ImportEvent['method'], errors: number) => ImportEvent;
  removeImport: (id: string) => void;
  clearImports: () => void;
  importHistory: ImportEvent[];
  watchlist: string[];
  toggleWatch: (id: string) => void;
  now: number;
}

const Ctx = createContext<AppDataValue | null>(null);

const EMPTY_LIVE: LiveDataFile = { generatedAt: null, listings: [] };

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = loadJson<Partial<AppSettings>>('settings', {});
    // v2: demo mode is off by default — older saved settings had it on implicitly.
    if ((stored.settingsVersion ?? 1) < 2) stored.demoMode = false;
    // v3: retro-MTB focus on by default.
    if ((stored.settingsVersion ?? 1) < 3) stored.mtbOnly = true;
    // v4: Kleinanzeigen (eastern Germany) — widen the old 150 km default.
    if ((stored.settingsVersion ?? 1) < 4 && (stored.radiusKm ?? 150) === 150) stored.radiusKm = 400;
    return { ...DEFAULT_SETTINGS, ...stored, settingsVersion: DEFAULT_SETTINGS.settingsVersion };
  });
  const [userDb, setUserDb] = useState<UserDatabaseAdditions>(() => loadJson('userDb', { manufacturers: [], models: [] }));
  const [imports, setImports] = useState<SourceListing[]>(() => loadJson('imports', []));
  const [importHistory, setImportHistory] = useState<ImportEvent[]>(() => loadJson('importHistory', []));
  const [watchlist, setWatchlist] = useState<string[]>(() => loadJson('watchlist', []));
  const [live, setLive] = useState<LiveDataFile>(EMPTY_LIVE);
  const [liveStatus, setLiveStatus] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [runLog, setRunLog] = useState<RunLog | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    saveJson('settings', settings);
  }, [settings]);
  useEffect(() => {
    saveJson('userDb', userDb);
  }, [userDb]);
  useEffect(() => {
    saveJson('imports', imports);
  }, [imports]);
  useEffect(() => {
    saveJson('importHistory', importHistory);
  }, [importHistory]);
  useEffect(() => {
    saveJson('watchlist', watchlist);
  }, [watchlist]);

  // Live data published by the scheduled GitHub Action. Absent/empty is a normal state.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('./data/listings.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('./data/run-log.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([l, r]) => {
      if (cancelled) return;
      if (l && Array.isArray(l.listings)) {
        setLive({ generatedAt: l.generatedAt ?? null, listings: (l.listings as SourceListing[]).map((x) => ({ ...x, origin: x.origin === 'import' ? 'import' : 'live' })) });
        setLiveStatus('ok');
      } else setLiveStatus('missing');
      if (r && Array.isArray(r.runs)) setRunLog(r as RunLog);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const db = useMemo(() => buildDatabase(userDb), [userDb]);
  const samples = useMemo(() => (settings.demoMode ? loadSampleListings(now) : []), [settings.demoMode, now]);

  const listings = useMemo(() => {
    const nowIso = new Date(now).toISOString();
    const merged = mergeListings([], [...live.listings, ...imports, ...samples], nowIso).merged;
    // Out of scope, dropped before anything is shown: road bikes and single parts (tyres, bar ends, saddles…).
    return analyzeListings(merged, settings, db, now).filter((l) => !isRoadBike(l) && l.analysis.itemType !== 'components');
  }, [live.listings, imports, samples, settings, db, now]);

  /** Listings matching the user's focus (retro MTB only, by default). */
  const focused = useMemo(() => (settings.mtbOnly ? listings.filter(isMtbLike) : listings), [listings, settings.mtbOnly]);

  const inRadius = useMemo(
    () => (settings.radiusKm === 0 ? focused : focused.filter((l) => l.analysis.distanceKm == null || l.analysis.distanceKm <= settings.radiusKm)),
    [focused, settings.radiusKm],
  );

  const byId = useMemo(() => new Map(listings.map((l) => [l.listing.id, l])), [listings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const addImports = useCallback(
    (items: SourceListing[], method: ImportEvent['method'], errors: number): ImportEvent => {
      const nowIso = new Date().toISOString();
      const res = mergeListings(imports, items, nowIso);
      setImports(res.merged);
      const ev: ImportEvent = { at: nowIso, method, added: res.added, updated: res.updated, duplicates: res.duplicates, errors };
      setImportHistory((h) => [ev, ...h].slice(0, 100));
      return ev;
    },
    [imports],
  );

  const value: AppDataValue = {
    settings,
    updateSettings,
    resetSettings,
    db,
    userDb,
    addManufacturer: (m) => setUserDb((u) => ({ ...u, manufacturers: [...u.manufacturers.filter((x) => x.id !== m.id), m] })),
    addModel: (m) => setUserDb((u) => ({ ...u, models: [...u.models.filter((x) => x.id !== m.id), m] })),
    removeUserEntry: (kind, id) => setUserDb((u) => ({ ...u, [kind]: (u[kind] as { id: string }[]).filter((x) => x.id !== id) })),
    listings,
    focused,
    inRadius,
    byId,
    live,
    liveStatus,
    runLog,
    imports,
    addImports,
    removeImport: (id) => setImports((xs) => xs.filter((x) => x.id !== id)),
    clearImports: () => setImports([]),
    importHistory,
    watchlist,
    toggleWatch: (id) => setWatchlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id])),
    now,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppDataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData must be used within AppDataProvider');
  return v;
}
