import { useState } from 'react';
import { FileCode2, FileJson, FileSpreadsheet, Link2, X } from 'lucide-react';
import { useAppData } from '../../hooks/AppData';
import { importCsv, importJson, normalizeImportRecord } from '../../services/marketplaces/importer';
import { detectMarketplace, marketplaceName } from '../../services/marketplaces/registry';
import { extractListingFromHtml } from '../../services/marketplaces/htmlExtract';
import { z } from 'zod';

type Tab = 'url' | 'json' | 'csv';

const CSV_EXAMPLE = `url,title,price,location,description,condition,itemType,shipping
https://www.olx.pl/d/oferta/przyklad-ID123abc.html,GT Karakoram 1993,500,Gniezno,"Rama Tange Cr-Mo, sztywny widelec",good,complete,false`;

const JSON_EXAMPLE = `[
  {
    "url": "https://www.olx.pl/d/oferta/przyklad-ID123abc.html",
    "title": "GT Karakoram 1993",
    "price": 500,
    "location": "Gniezno",
    "description": "Rama Tange Cr-Mo, sztywny widelec",
    "condition": "good",
    "images": ["https://…/foto.jpg"]
  }
]`;

const EMPTY_FORM = { url: '', title: '', price: '', currency: '', location: '', description: '', condition: '', itemType: '', shipping: false, images: '' };

/**
 * Manual import — the legally safe default for portals without an API.
 * The user pastes what they see; STEELHUNT does not fetch or scrape the URL.
 */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { addImports } = useAppData();
  const [tab, setTab] = useState<Tab>('url');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [text, setText] = useState('');
  const [fromFile, setFromFile] = useState<{ name: string; found: string[]; missing: string[]; brand: string | null } | null>(null);

  /** A page the user saved in their own browser — parsed locally, nothing is fetched. */
  const onHtmlFile = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    try {
      const x = extractListingFromHtml(await f.text());
      if (!x.title && !x.url) {
        setFromFile(null);
        setMsg({ ok: false, text: 'Nie znalazłem w tym pliku danych ogłoszenia. Zapisz stronę samego ogłoszenia (Ctrl+S → „Strona internetowa, kompletna” lub „tylko HTML”).' });
        return;
      }
      setForm({
        ...EMPTY_FORM,
        url: x.url,
        title: x.title,
        price: x.price == null ? '' : String(x.price),
        currency: x.currency && x.currency !== 'PLN' ? x.currency : '',
        location: x.location,
        description: x.description,
        condition: x.condition,
        images: x.images.join(' '),
      });
      setFromFile({ name: f.name, found: x.found, missing: x.missing, brand: x.brand });
    } catch (e) {
      setMsg({ ok: false, text: `Nie udało się odczytać pliku: ${(e as Error).message}` });
    }
  };

  const detected = form.url ? detectMarketplace(form.url) : null;

  const submitUrl = () => {
    try {
      const l = normalizeImportRecord({
        url: form.url,
        title: form.title,
        price: form.price === '' ? null : form.price,
        currency: form.currency || undefined,
        location: form.location || null,
        description: form.description,
        condition: form.condition || undefined,
        itemType: form.itemType || undefined,
        shipping: form.shipping,
        images: form.images,
      });
      const ev = addImports([l], 'url', 0);
      setMsg({ ok: true, text: ev.added ? 'Dodano ogłoszenie i przeanalizowano.' : 'To ogłoszenie już istnieje — zaktualizowano dane.' });
      setForm(EMPTY_FORM);
      setFromFile(null);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof z.ZodError ? e.issues.map((i) => i.message).join(', ') : (e as Error).message });
    }
  };

  const submitBulk = () => {
    const res = tab === 'json' ? importJson(text) : importCsv(text);
    if (!res.listings.length) {
      setMsg({ ok: false, text: res.errors.map((e) => `wiersz ${e.row}: ${e.message}`).join(' · ') || 'Brak danych.' });
      return;
    }
    const ev = addImports(res.listings, tab, res.errors.length);
    setMsg({
      ok: true,
      text: `Dodano ${ev.added}, zaktualizowano ${ev.updated}, duplikaty ${ev.duplicates}${res.errors.length ? `, błędy: ${res.errors.length} (${res.errors.slice(0, 3).map((e) => `w.${e.row}: ${e.message}`).join('; ')})` : ''}.`,
    });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
    setTab(f.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none !bg-ink-900 p-5 sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl uppercase tracking-wide">Dodaj ogłoszenie</h2>
            <p className="mt-1 text-xs text-ink-400">
              Wklej dane, które widzisz w ogłoszeniu. STEELHUNT nie pobiera stron portali — analiza działa na tym, co wpiszesz. Dane zapisywane są tylko w tej przeglądarce.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-100" aria-label="Zamknij">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-ink-950/60 p-1">
          {(
            [
              ['url', 'Link + dane', Link2],
              ['json', 'JSON', FileJson],
              ['csv', 'CSV', FileSpreadsheet],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => {
                setTab(k);
                setMsg(null);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm ${tab === k ? 'bg-ink-800 text-ink-100' : 'text-ink-400'}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === 'url' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="btn-ghost w-full cursor-pointer gap-2">
                <FileCode2 size={16} /> Wczytaj zapisaną stronę ogłoszenia (.htm / .html)
                <input type="file" accept=".htm,.html,text/html" className="hidden" onChange={(e) => { onHtmlFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <p className="mt-1 text-[11px] text-ink-500">
                Otwórz ogłoszenie (Vinted, OLX, Kleinanzeigen, Facebook…), zapisz je Ctrl+S i wybierz plik tutaj — pola uzupełnią się same. Plik czytany jest tylko w tej przeglądarce.
              </p>
              {fromFile && (
                <div className="mt-2 rounded-xl bg-ink-950/60 px-3 py-2 text-[12px] text-ink-300">
                  Odczytano <span className="text-ink-100">{fromFile.name}</span>
                  {fromFile.found.length ? ` (${fromFile.found.join(', ')})` : ''}
                  {fromFile.brand ? ` · marka: ${fromFile.brand}` : ''}.{' '}
                  {fromFile.missing.length ? (
                    <span className="text-rust-400">Uzupełnij: {fromFile.missing.join(', ')}.</span>
                  ) : (
                    'Sprawdź pola i dodaj.'
                  )}
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="label">Link do ogłoszenia *</label>
              <input className="input" placeholder="https://www.olx.pl/d/oferta/…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              {detected && <p className="mt-1 text-[11px] text-ink-500">Rozpoznano: {marketplaceName(detected.id)}{detected.externalId ? ` · ID ${detected.externalId}` : ''}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="label">Tytuł *</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Cena ({form.currency || 'zł'})</label>
              <input className="input" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Lokalizacja (miejscowość)</label>
              <input className="input" placeholder="np. Gniezno" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Opis (im więcej, tym lepsza analiza)</label>
              <textarea className="input min-h-[110px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Stan</label>
              <select className="input" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                <option value="">wykryj z opisu</option>
                <option value="excellent">bardzo dobry</option>
                <option value="good">dobry</option>
                <option value="fair">do poprawek</option>
                <option value="poor">do remontu</option>
                <option value="project">projekt / na części</option>
              </select>
            </div>
            <div>
              <label className="label">Typ</label>
              <select className="input" value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value })}>
                <option value="">wykryj z opisu</option>
                <option value="complete">kompletny rower</option>
                <option value="frameset">rama + widelec</option>
                <option value="frame">sama rama</option>
                <option value="components">komponenty</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Linki do zdjęć (opcjonalnie, oddzielone spacją)</label>
              <input className="input" value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-300 sm:col-span-2">
              <input type="checkbox" className="accent-moss-500" checked={form.shipping} onChange={(e) => setForm({ ...form, shipping: e.target.checked })} />
              Sprzedający oferuje wysyłkę
            </label>
            <div className="sm:col-span-2">
              <button className="btn-primary w-full" onClick={submitUrl}>
                Dodaj i przeanalizuj
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="btn-ghost w-full cursor-pointer">
              Wybierz plik .{tab}
              <input type="file" accept=".json,.csv,application/json,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <textarea className="input min-h-[200px] font-mono text-xs" placeholder={tab === 'json' ? JSON_EXAMPLE : CSV_EXAMPLE} value={text} onChange={(e) => setText(e.target.value)} />
            <p className="text-[11px] text-ink-500">
              Wymagane pola: <code>url</code>, <code>title</code>. Opcjonalne: price, location, description, condition, itemType, shipping, images, latitude, longitude, postedAt.
            </p>
            <button className="btn-primary w-full" onClick={submitBulk} disabled={!text.trim()}>
              Importuj
            </button>
          </div>
        )}

        {msg && <div className={`mt-4 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-moss-500/10 text-moss-300' : 'bg-rust-500/10 text-rust-400'}`}>{msg.text}</div>}
      </div>
    </div>
  );
}
