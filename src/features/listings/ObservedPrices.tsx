import { useEffect, useState } from 'react';
import type { PriceObservation } from '../../types/run';
import { formatPrice } from '../../utils/format';

let cache: Promise<PriceObservation[]> | null = null;
/** All asking prices the scout has seen for recognised models (kept after the listings expire). */
function loadArchive(): Promise<PriceObservation[]> {
  cache ??= fetch('data/price-archive.json')
    .then((r) => (r.ok ? (r.json() as Promise<PriceObservation[]>) : []))
    .catch(() => []);
  return cache;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** "Our own" price data for a model: asking prices observed so far, same item type (bike vs frame). */
export function ObservedPrices({ modelId, itemType }: { modelId: string | null; itemType: string }) {
  const [rows, setRows] = useState<PriceObservation[]>([]);
  useEffect(() => {
    let live = true;
    loadArchive().then((all) => live && setRows(all.filter((o) => o.modelId === modelId && o.itemType === itemType)));
    return () => {
      live = false;
    };
  }, [modelId, itemType]);
  if (!modelId || rows.length < 2) return null;
  const prices = rows.map((r) => r.pricePln);
  const since = rows.map((r) => r.firstSeen).sort()[0]?.slice(0, 10);
  return (
    <p className="mt-2 text-[11px] text-ink-400">
      Ceny wywoławcze tego modelu w naszych obserwacjach: <b className="text-ink-200">{rows.length}</b> ogłoszeń od {since}, mediana{' '}
      <b className="text-ink-200">{formatPrice(median(prices))}</b> (od {formatPrice(Math.min(...prices))} do {formatPrice(Math.max(...prices))}). To ceny
      z ogłoszeń, nie ceny sprzedaży.
    </p>
  );
}
