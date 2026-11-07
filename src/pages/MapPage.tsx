import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { useAppData } from '../hooks/AppData';
import { PageHeader } from '../components/ui';
import { formatKm, formatPrice, scoreTone, TONE_COLOR } from '../utils/format';
import { MATERIAL_LABEL } from '../utils/labels';
import { RADIUS_OPTIONS } from '../features/scoring/config';
import type { RadiusOption } from '../types/settings';

/**
 * Map of geolocated listings. Only listings with real or gazetteer-resolved coordinates are drawn —
 * coordinates are never invented. Listings sharing a town are fanned out slightly for visibility
 * (the popup states the precision).
 */
export default function MapPage() {
  const { focused: listings, settings, updateSettings } = useAppData();
  const [minDeal, setMinDeal] = useState(0);
  const radius = settings.radiusKm;

  const located = listings.filter((l) => l.listing.latitude != null && l.listing.longitude != null && !l.listing.duplicateOf);
  const shown = located.filter((l) => l.analysis.dealScore >= minDeal && (radius === 0 || (l.analysis.distanceKm ?? 0) <= radius));
  const unknown = listings.filter((l) => l.listing.latitude == null && !l.listing.duplicateOf).length;

  const positioned = useMemo(() => {
    const groups = new Map<string, number>();
    return shown.map((l) => {
      const key = `${l.listing.latitude!.toFixed(3)},${l.listing.longitude!.toFixed(3)}`;
      const n = groups.get(key) ?? 0;
      groups.set(key, n + 1);
      const angle = n * 2.4;
      const off = n === 0 ? 0 : 0.012 * Math.sqrt(n);
      return { item: l, lat: l.listing.latitude! + Math.sin(angle) * off, lng: l.listing.longitude! + Math.cos(angle) * off * 1.6 };
    });
  }, [shown]);

  return (
    <>
      <PageHeader
        title="Mapa"
        subtitle={`${shown.length} ogłoszeń na mapie · ${unknown} bez lokalizacji (nie pokazane). Kolor znacznika = Deal Score.`}
        actions={
          <>
            <select className="input !w-auto" value={radius} onChange={(e) => updateSettings({ radiusKm: Number(e.target.value) as RadiusOption })}>
              {RADIUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select className="input !w-auto" value={minDeal} onChange={(e) => setMinDeal(Number(e.target.value))}>
              <option value={0}>Wszystkie</option>
              <option value={60}>Deal ≥ 60</option>
              <option value={75}>Deal ≥ 75</option>
            </select>
          </>
        }
      />
      <div className="card overflow-hidden p-0">
        <div className="h-[calc(100vh-15rem)] min-h-[420px] w-full">
          <MapContainer center={[settings.origin.lat, settings.origin.lng]} zoom={radius && radius <= 50 ? 10 : radius && radius <= 150 ? 8 : radius && radius <= 250 ? 7 : 6} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              className="steel-tiles"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {radius !== 0 && <Circle center={[settings.origin.lat, settings.origin.lng]} radius={radius * 1000} pathOptions={{ color: '#a9adae', weight: 1, dashArray: '6 6', fillOpacity: 0.04 }} />}
            {[30, 60, 100].filter((r) => radius === 0 || r < radius).map((r) => (
              <Circle key={r} center={[settings.origin.lat, settings.origin.lng]} radius={r * 1000} pathOptions={{ color: '#5a5f60', weight: 0.6, fill: false, dashArray: '2 6' }} />
            ))}
            <CircleMarker center={[settings.origin.lat, settings.origin.lng]} radius={7} pathOptions={{ color: '#ecede9', weight: 2, fillColor: '#141516', fillOpacity: 1 }}>
              <Tooltip direction="top" permanent className="!border-0 !bg-transparent !shadow-none">
                <span className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">{settings.origin.name}</span>
              </Tooltip>
            </CircleMarker>
            {positioned.map(({ item, lat, lng }) => {
              const a = item.analysis;
              const color = TONE_COLOR[scoreTone(a.dealScore)];
              return (
                <CircleMarker
                  key={item.listing.id}
                  center={[lat, lng]}
                  radius={a.isBargain ? 10 : 7}
                  pathOptions={{ color: a.isUnknownGem ? '#7dd3fc' : '#0e0f0f', weight: a.isUnknownGem ? 2.5 : 1.5, fillColor: color, fillOpacity: 0.9 }}
                >
                  <Popup>
                    <div className="w-56 space-y-1">
                      <div className="font-semibold text-ink-100">{item.listing.title}</div>
                      <div className="text-xs text-ink-400">
                        {item.listing.locationName} · {formatKm(a.distanceKm)}
                        {item.listing.geoPrecision === 'city' && ' (centrum miejscowości)'}
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="stat-num text-base font-semibold text-ink-100">{formatPrice(item.listing.price)}</span>
                        <span className="stat-num text-xs" style={{ color }}>
                          Deal {a.dealScore}
                        </span>
                      </div>
                      <div className="text-xs text-ink-300">
                        {MATERIAL_LABEL[a.frameMaterial]} · rama {a.frameQualityScore}
                        {item.listing.origin === 'demo' && <span className="ml-1 text-brass-400">· DEMO</span>}
                      </div>
                      <Link to={`/listing/${encodeURIComponent(item.listing.id)}`} className="inline-block pt-1 text-xs font-medium text-moss-300">
                        Szczegóły →
                      </Link>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-400">
        {(['top', 'good', 'mid', 'low'] as const).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE_COLOR[t] }} />
            {t === 'top' ? 'Hunted: Deal ≥ 75' : t === 'good' ? 'Refined: 60–74' : t === 'mid' ? 'Reclaimed: 45–59' : 'Scrap: < 45'}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-sky-300" /> Unknown Gem
        </span>
        <span>Większy znacznik = okazja</span>
      </div>
    </>
  );
}
