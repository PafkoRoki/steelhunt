/**
 * Photo review helper for the local scout (run by the owner's scheduled Claude task, never in CI).
 *
 *   npm run photos -- todo [--limit=10]   Pick listings whose photos were not checked yet, download up to
 *                                         3 photos each into tmp/photo-cache/ (git-ignored) and write
 *                                         tmp/photo-cache/todo.json for the reviewer.
 *   npm run photos -- save <file.json>    Validate the reviewer's readings and merge them into
 *                                         data/photo-notes.json (picked up by the ingestion).
 *
 * Photos are fetched once, at a low rate, with the scout's honest User-Agent — the same images a visitor
 * sees on the listing. They are kept only locally and deleted on the next `todo`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { z } from 'zod';

const ROOT = resolve(import.meta.dirname, '..');
const IMPORTS = resolve(ROOT, 'data/imports');
const NOTES = resolve(ROOT, 'data/photo-notes.json');
const CACHE = resolve(ROOT, 'tmp', 'photo-cache');
const UA = 'steelhunt-scout/0.1 (personal use; low rate; +https://github.com/PafkoRoki/steelhunt)';
const pexec = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const key = (url: string) => url.split('?')[0];

const ReadingSchema = z.object({
  where: z.string().min(1).max(60),
  text: z.string().min(1).max(120),
  confidence: z.enum(['legible', 'probable']),
  image: z.number().int().min(1).max(10).optional(),
});
const NoteSchema = z.object({
  url: z.string().url(),
  images: z.number().int().min(0).max(10),
  readings: z.array(ReadingSchema).max(20),
  summary: z.string().max(300).optional(),
});
type Note = z.infer<typeof NoteSchema> & { checkedAt: string };

interface ImportRow {
  url: string;
  title: string;
  price?: number | null;
  currency?: string;
  images?: string[] | string;
  firstSeen?: string;
}

function readNotes(): Note[] {
  return existsSync(NOTES) ? (JSON.parse(readFileSync(NOTES, 'utf8')) as Note[]) : [];
}

function writeNotes(notes: Note[]) {
  writeFileSync(NOTES, '[\n' + notes.map((n) => '  ' + JSON.stringify(n)).join(',\n') + '\n]\n', 'utf8');
}

function importRows(): ImportRow[] {
  const rows: ImportRow[] = [];
  for (const f of readdirSync(IMPORTS).filter((f) => f.endsWith('.json'))) {
    try {
      rows.push(...(JSON.parse(readFileSync(resolve(IMPORTS, f), 'utf8')) as ImportRow[]));
    } catch {
      /* not a listing file */
    }
  }
  return rows;
}

function extFor(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.subarray(0, 4).toString('hex') === '89504e47') return 'png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.subarray(0, 3).toString() === 'GIF') return 'gif';
  return null;
}

async function todo(limit: number) {
  rmSync(CACHE, { recursive: true, force: true });
  mkdirSync(CACHE, { recursive: true });
  const done = new Set(readNotes().map((n) => key(n.url)));
  const pending = importRows()
    .filter((r) => !done.has(key(r.url)))
    .map((r) => ({ ...r, imgs: (Array.isArray(r.images) ? r.images : (r.images ?? '').split(/[\s;,]+/)).filter((u) => /^https?:\/\//.test(u)).slice(0, 3) }))
    .filter((r) => r.imgs.length > 0)
    .sort((a, b) => (b.firstSeen ?? '').localeCompare(a.firstSeen ?? ''));

  const out: { n: number; url: string; title: string; price: string; photos: string[] }[] = [];
  for (const [i, r] of pending.slice(0, limit).entries()) {
    const photos: string[] = [];
    for (const [j, img] of r.imgs.entries()) {
      await sleep(1500);
      try {
        const { stdout } = await pexec('curl', ['-s', '-f', '-L', '--max-time', '30', '-A', UA, img], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
        const ext = extFor(stdout);
        if (!ext) continue;
        const p = resolve(CACHE, `${i + 1}-${j + 1}.${ext}`);
        writeFileSync(p, stdout);
        photos.push(p);
      } catch {
        /* photo unavailable — skip */
      }
    }
    out.push({ n: i + 1, url: r.url, title: r.title, price: r.price != null ? `${r.price} ${r.currency ?? 'PLN'}` : '?', photos });
  }
  writeFileSync(resolve(CACHE, 'todo.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log(`Do sprawdzenia: ${out.length} ogłoszeń (oczekuje łącznie: ${pending.length}). Lista: tmp/photo-cache/todo.json`);
  for (const o of out) console.log(`  ${o.n}. ${o.title.slice(0, 60)} — ${o.photos.length} zdj.`);
}

function save(file: string) {
  const input = z.array(NoteSchema).parse(JSON.parse(readFileSync(resolve(file), 'utf8')));
  const now = new Date().toISOString();
  const byUrl = new Map(readNotes().map((n) => [key(n.url), n]));
  for (const n of input) byUrl.set(key(n.url), { ...n, checkedAt: now });
  // Drop notes for listings that are no longer in any import file.
  const live = new Set(importRows().map((r) => key(r.url)));
  const notes = [...byUrl.values()].filter((n) => live.has(key(n.url)));
  writeNotes(notes);
  console.log(`Zapisano ${input.length} odczytów; w pliku: ${notes.length}. Czytelnych odczytów: ${input.flatMap((n) => n.readings).filter((r) => r.confidence === 'legible').length}.`);
}

const [cmd, arg] = process.argv.slice(2);
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? 10);
if (cmd === 'todo') await todo(limit);
else if (cmd === 'save' && arg) save(arg);
else {
  console.error('Użycie: npm run photos -- todo [--limit=10] | save <plik.json>');
  process.exitCode = 1;
}
