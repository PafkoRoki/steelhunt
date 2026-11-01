import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, Flag, Gem, Info, Search, ShieldAlert } from 'lucide-react';
import { useAppData } from '../hooks/AppData';
import { ConfidenceBadge, EmptyState, GemBadge, MarketplaceTag, OriginBadge, ScoreBar, ScoreRing, WarningNote } from '../components/ui';
import { ListingImage } from '../components/ListingImage';
import { formatDateTime, formatKm, formatPct, formatPrice, formatRange, timeAgo } from '../utils/format';
import { CATEGORY_LABEL, CONDITION_LABEL, CONSTRUCTION_LABEL, ITEM_TYPE_LABEL, MATERIAL_LABEL, PRICE_CONF_LABEL, SCOPE_LABEL } from '../utils/labels';
import { ListingCard } from '../components/ListingCard';

export default function ListingPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { byId, watchlist, toggleWatch, now, db, listings, removeImport } = useAppData();
  const item = byId.get(decodeURIComponent(id));
  if (!item) {
    return (
      <EmptyState icon={<Search size={22} />} title="Nie znaleziono ogłoszenia">
        Mogło zostać usunięte lub pochodzi z wyłączonego trybu demo. <Link to="/deals" className="text-moss-300">Wróć do okazji</Link>
      </EmptyState>
    );
  }
  const { listing: l, analysis: a } = item;
  const watched = watchlist.includes(l.id);
  const spec = a.tubing.tubingId ? db.tubingById.get(a.tubing.tubingId) : null;
  const model = a.modelId ? db.modelById.get(a.modelId) : null;
  const mfr = a.manufacturerId ? db.manufacturerById.get(a.manufacturerId) : null;
  const duplicate = l.duplicateOf ? byId.get(l.duplicateOf) : null;
  const similar = listings
    .filter((x) => x.listing.id !== l.id && !x.listing.duplicateOf && ((a.modelId && x.analysis.modelId === a.modelId) || (a.manufacturerId && x.analysis.manufacturerId === a.manufacturerId)))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100">
        <ArrowLeft size={15} /> Wróć
      </button>

      {l.origin === 'demo' && (
        <WarningNote>
          To jest <b>fikcyjne ogłoszenie demonstracyjne</b> — służy do pokazania działania analizy. Przycisk poniżej otwiera wyszukiwarkę portalu, a nie konkretną ofertę.
        </WarningNote>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="relative aspect-[16/10] bg-ink-950">
              <ListingImage item={item} />
              <div className="absolute left-4 top-4 flex gap-2">
                <OriginBadge origin={l.origin} />
                {a.isBargain && <span className="rounded-md bg-moss-500 px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-ink-950">Okazja</span>}
              </div>
            </div>
            {l.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {l.images.slice(1, 8).map((src) => (
                  <img key={src} src={src} alt="" referrerPolicy="no-referrer" className="h-20 w-28 shrink-0 rounded-lg object-cover" loading="lazy" />
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="section-title mb-3">Opis sprzedającego (dane źródłowe)</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-300">{l.description || <span className="text-ink-500">Brak opisu.</span>}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
              <Meta k="Portal" v={<MarketplaceTag id={l.marketplace} />} />
              <Meta k="ID zewnętrzne" v={<span className="font-mono">{l.externalId}</span>} />
              <Meta k="Wystawione" v={l.postedAt ? timeAgo(l.postedAt, now) : '—'} />
              <Meta k="Wykryte" v={formatDateTime(l.discoveredAt)} />
              <Meta k="Ostatnio widziane" v={formatDateTime(l.lastSeenAt)} />
              <Meta k="Wysyłka" v={l.declared?.shippingAvailable ? 'tak' : 'nie podano'} />
            </dl>
          </div>

          {l.priceHistory.length > 1 && (
            <div className="card p-5">
              <h3 className="section-title mb-3">Historia ceny</h3>
              <ul className="space-y-1 text-sm">
                {l.priceHistory.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-ink-400">{formatDateTime(p.date)}</span>
                    <span className="stat-num text-ink-200">{formatPrice(p.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card p-5">
            <h3 className="section-title mb-3 flex items-center gap-2">
              <Info size={14} /> Dlaczego taki wynik
            </h3>
            <div className="grid gap-5 md:grid-cols-2">
              <Reasons title="Jakość ramy" items={a.frameReasons} />
              <Reasons title="Potencjał XBiking" items={a.xbikingReasons} />
            </div>
            <div className="mt-5">
              <h4 className="mb-2 text-xs font-medium text-ink-400">Składowe Deal Score</h4>
              <div className="space-y-3">
                {a.dealBreakdown.map((b) => (
                  <ScoreBar key={b.key} label={`${b.label} · waga ${Math.round(b.weight * 100)}%`} value={b.value} hint={b.note} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex flex-wrap gap-2">
              <MarketplaceTag id={l.marketplace} />
              {a.isUnknownGem && <GemBadge />}
              <span className="chip">{CATEGORY_LABEL[a.bicycleCategory]}</span>
              <span className="chip">{ITEM_TYPE_LABEL[a.itemType]}</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold leading-tight text-ink-100">{l.title}</h1>
            <p className="mt-1 text-sm text-ink-400">
              {l.locationName ?? 'Lokalizacja nieznana'} · {formatKm(a.distanceKm)} w linii prostej
              {a.drivingDistanceKm != null && ` · ~${formatKm(a.drivingDistanceKm)} drogą (szac.)`}
            </p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <div className="stat-num text-4xl font-semibold text-ink-100">{formatPrice(l.price, l.currency)}</div>
                <div className="text-xs text-ink-500">cena ofertowa{l.currency.toUpperCase() !== 'PLN' && a.pricePln != null ? ` · ≈ ${formatPrice(a.pricePln)}` : ''}</div>
              </div>
              <ScoreRing value={a.dealScore} size={76} label="Deal Score" stroke={6} />
            </div>
            <div className="mt-5 flex gap-2">
              <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-primary flex-1">
                {l.origin === 'demo' ? <Search size={15} /> : <ExternalLink size={15} />}
                {l.origin === 'demo' ? 'Szukaj podobnych na portalu' : 'Otwórz oryginalne ogłoszenie'}
              </a>
              <button className="btn-ghost" onClick={() => toggleWatch(l.id)} aria-label="Obserwuj">
                {watched ? <BookmarkCheck size={16} className="text-moss-300" /> : <Bookmark size={16} />}
              </button>
            </div>
            {l.origin === 'import' && (
              <button
                className="mt-2 text-xs text-ink-500 hover:text-rust-400"
                onClick={() => {
                  removeImport(l.id);
                  nav('/new');
                }}
              >
                Usuń ten import
              </button>
            )}
          </div>

          <div className="card p-5">
            <h3 className="section-title mb-3">Wycena</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Money k="Szacowana wartość" v={a.price.confidence === 'none' ? '—' : formatRange(a.price.min, a.price.max)} />
              <Money k="Vs rynek" v={formatPct(a.discountPct)} accent={a.discountPct != null && a.discountPct > 0} />
              <Money k="Potencjalna oszczędność" v={formatPrice(a.potentialSavings)} />
              <Money k="Renowacja (szac.)" v={formatPrice(a.restorationCost)} />
              <Money k="Dojazd / transport" v={a.transportCost == null ? 'nieznany' : formatPrice(a.transportCost)} />
              <Money k="Potencjał netto" v={formatPrice(a.netOpportunity)} accent={(a.netOpportunity ?? 0) > 0} />
            </div>
            <p className="mt-3 text-[11px] text-ink-500">
              Pewność wyceny: <b className="text-ink-300">{PRICE_CONF_LABEL[a.price.confidence]}</b>. Potencjał netto = wartość − cena − renowacja − transport.
            </p>
            <ul className="mt-2 space-y-1 text-[11px] text-ink-400">
              {a.price.basis.map((b, i) => (
                <li key={i}>• {b}</li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <h3 className="section-title mb-3">Rama i rury</h3>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-ink-100">{MATERIAL_LABEL[a.frameMaterial]}</div>
                <div className="text-sm text-ink-400">{a.tubing.series ? `${a.tubing.manufacturer ?? ''} ${a.tubing.series}`.trim() : 'Specyfikacja rur nieznana'}</div>
              </div>
              <ConfidenceBadge level={a.tubing.confidence} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <Meta k="Zakres specyfikacji" v={SCOPE_LABEL[a.tubing.scope]} />
              <Meta k="Konstrukcja" v={CONSTRUCTION_LABEL[a.frameConstruction]} />
              <Meta k="Koła" v={a.wheelSize ?? '—'} />
              <Meta k="Stan" v={CONDITION_LABEL[a.condition]} />
              <Meta k="Rocznik" v={a.productionYear ?? (a.groupsetEra ? `${a.groupsetEra} (wg osprzętu)` : '—')} />
              <Meta k="Producent / model" v={a.manufacturer ? `${a.manufacturer}${a.model ? ' ' + a.model : ''}` : 'nierozpoznany'} />
            </dl>
            {a.tubing.evidence.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="text-xs font-medium text-ink-400">Dowody</div>
                {a.tubing.evidence.map((e, i) => (
                  <div key={i} className="rounded-lg bg-ink-950/50 px-2.5 py-1.5 text-[11px] text-ink-300">
                    <b>{e.label}</b> <span className="text-ink-500">({e.source === 'model-db' ? 'baza modeli' : e.source === 'title' ? 'tytuł' : e.source === 'image-ai' ? 'zdjęcie' : 'opis'})</span>
                    {e.snippet && <div className="mt-0.5 font-mono text-ink-500">„…{e.snippet}…”</div>}
                  </div>
                ))}
              </div>
            )}
            {l.photo && (
              <div className="mt-4 space-y-1.5">
                <div className="text-xs font-medium text-ink-400">
                  Odczyt ze zdjęć <span className="font-normal text-ink-500">({l.photo.images} zdj., {formatDateTime(l.photo.checkedAt)})</span>
                </div>
                {l.photo.readings.length === 0 && <div className="text-[11px] text-ink-500">Brak czytelnych oznaczeń na zdjęciach.</div>}
                {l.photo.readings.map((r, i) => (
                  <div key={i} className="rounded-lg bg-ink-950/50 px-2.5 py-1.5 text-[11px] text-ink-300">
                    <span className="text-ink-500">{r.where}:</span> <b>{r.text}</b>{' '}
                    <span className={r.confidence === 'legible' ? 'text-moss-300' : 'text-brass-300'}>
                      ({r.confidence === 'legible' ? 'czytelne' : 'prawdopodobne'}{r.image ? `, zdj. ${r.image}` : ''})
                    </span>
                  </div>
                ))}
                {l.photo.summary && <p className="text-[11px] text-ink-400">{l.photo.summary}</p>}
                <p className="text-[10px] text-ink-500">Odczyt automatyczny (Claude). Do analizy wchodzą tylko odczyty „czytelne”.</p>
              </div>
            )}
            {spec?.notes && <p className="mt-3 text-[11px] text-ink-400">ℹ {spec.notes}</p>}
            {model?.tubingNote && <p className="mt-1 text-[11px] text-ink-400">ℹ {model.tubingNote}</p>}
            {mfr?.notes && <p className="mt-1 text-[11px] text-ink-400">ℹ {mfr.notes}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <ScoreRing value={a.frameQualityScore} size={54} label="Rama" />
              <ScoreRing value={a.xbikingPotentialScore} size={54} label="XBiking" />
              {a.locationScore != null ? <ScoreRing value={a.locationScore} size={54} label="Lokalizacja" /> : <div className="text-center text-[11px] text-ink-500">Lokalizacja nieznana</div>}
            </div>
          </div>

          {(a.features.length > 0 || a.components.length > 0) && (
            <div className="card p-5">
              <h3 className="section-title mb-3">Cechy i komponenty</h3>
              <div className="flex flex-wrap gap-1.5">
                {a.features.map((f) => (
                  <span key={f} className="chip">
                    {f}
                  </span>
                ))}
                {a.components.map((c) => (
                  <span key={c.name} className={`chip ${c.tier >= 4 ? '!border-moss-500/40 !text-moss-300' : ''}`}>
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(a.warnings.length > 0 || a.redFlags.length > 0 || a.gemReasons.length > 0) && (
            <div className="card space-y-3 p-5">
              {a.redFlags.length > 0 && (
                <div>
                  <h3 className="section-title mb-2 flex items-center gap-2 !text-rust-400">
                    <Flag size={13} /> Czerwone flagi
                  </h3>
                  {a.redFlags.map((r) => (
                    <p key={r} className="text-sm text-rust-400">
                      • {r}
                    </p>
                  ))}
                </div>
              )}
              {a.isUnknownGem && (
                <div>
                  <h3 className="section-title mb-2 flex items-center gap-2 !text-sky-300">
                    <Gem size={13} /> Dlaczego Unknown Gem
                  </h3>
                  {a.gemReasons.map((r) => (
                    <p key={r} className="text-sm text-ink-300">
                      • {r}
                    </p>
                  ))}
                </div>
              )}
              {a.warnings.length > 0 && (
                <div>
                  <h3 className="section-title mb-2 flex items-center gap-2">
                    <ShieldAlert size={13} /> Niepewności
                  </h3>
                  <div className="space-y-1.5">
                    {a.warnings.map((w) => (
                      <WarningNote key={w}>{w}</WarningNote>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {duplicate && (
            <WarningNote>
              Prawdopodobny duplikat ogłoszenia z innego portalu:{' '}
              <Link className="underline" to={`/listing/${encodeURIComponent(duplicate.listing.id)}`}>
                {duplicate.listing.title}
              </Link>
            </WarningNote>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-2xl uppercase tracking-wide">Porównywalne ogłoszenia</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {similar.map((s) => (
              <ListingCard key={s.listing.id} item={s} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-500">{k}</dt>
      <dd className="mt-0.5 text-ink-200">{v}</dd>
    </div>
  );
}

function Money({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-ink-950/40 p-2.5">
      <div className="text-[11px] text-ink-500">{k}</div>
      <div className={`stat-num mt-0.5 font-semibold ${accent ? 'text-moss-300' : 'text-ink-100'}`}>{v}</div>
    </div>
  );
}

function Reasons({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium text-ink-400">{title}</h4>
      <ul className="space-y-1 text-xs text-ink-300">
        {items.map((r, i) => (
          <li key={i} className="font-mono text-[11px]">
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
