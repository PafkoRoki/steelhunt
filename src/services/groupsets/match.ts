import data from '../../data/groupsets/shimano.json';
import type { GroupsetDatabase, GroupsetFamily, GroupsetSpec } from '../../types/database';

export const SHIMANO = data as GroupsetDatabase;
const familyById = new Map(SHIMANO.families.map((f) => [f.id, f]));
export const groupsetFamily = (id: string): GroupsetFamily | undefined => familyById.get(id);

export interface GroupsetMatch {
  familyId: string;
  label: string; // "Shimano Deore XT M732"
  tier: number;
  /** Generation identified by its model code (otherwise only the family name was found). */
  spec: GroupsetSpec | null;
  years: string | null; // "1989–1990"
}

export function yearsLabel(g: GroupsetSpec): string {
  return g.yearTo && g.yearTo !== g.yearFrom ? `${g.yearFrom}–${g.yearTo}` : g.yearTo ? `${g.yearFrom}` : `od ${g.yearFrom}`;
}

/** Shimano part prefixes: RD-M730, FC-M732, ST-M735… */
const PREFIX = '(?:rd|fd|fc|st|sl|br|bl|cs|hb|fh|bb|sg|pd)';

/**
 * Finds Shimano MTB groupsets in normalized listing text. A bare model code (M730) counts only when
 * the text also mentions Shimano, a group name or a part prefix — so "M500" in a size or address
 * doesn't become a groupset.
 */
export function matchGroupsets(text: string): GroupsetMatch[] {
  const families = SHIMANO.families.filter((f) => f.patterns.some((p) => new RegExp(p, 'i').test(text)));
  const shimanoContext = /shimano/.test(text) || families.length > 0;
  const out: GroupsetMatch[] = [];
  const seenFamilies = new Set<string>();

  for (const g of SHIMANO.groupsets) {
    const fam = familyById.get(g.family)!;
    const hit =
      g.codes.some((c) => {
        const code = c.toLowerCase();
        if (new RegExp(String.raw`\b${PREFIX}[-\s]?${code}(?!\d)`).test(text)) return true;
        return shimanoContext && new RegExp(String.raw`(?:^|[^a-z0-9])${code}(?!\d)`).test(text);
      }) ||
      (g.contextCodes ?? []).some((c) => families.some((f) => f.id === g.family) && new RegExp(String.raw`\b${c.toLowerCase()}\b`).test(text)) ||
      (g.id === 'exage-lx' && /\b[345]00\s*lx\b/.test(text)) ||
      (g.id === 'gs-200' && /\b(?:200|100|70)\s*gs\b/.test(text));
    if (!hit) continue;
    seenFamilies.add(g.family);
    out.push({ familyId: g.family, label: `Shimano ${fam.name} ${g.series}`, tier: fam.tier, spec: g, years: yearsLabel(g) });
  }

  for (const f of families) {
    if (seenFamilies.has(f.id)) continue;
    const gens = SHIMANO.groupsets.filter((g) => g.family === f.id && g.yearFrom <= 2002);
    const from = Math.min(...gens.map((g) => g.yearFrom));
    out.push({ familyId: f.id, label: `Shimano ${f.name}`, tier: f.tier, spec: null, years: gens.length ? `od ${from}` : null });
  }
  return out;
}

/** Era suggested by identified generations (used when the listing gives no year). */
export function eraFromGroupsets(matches: GroupsetMatch[]): string | null {
  const specs = matches.map((m) => m.spec).filter((s): s is GroupsetSpec => s != null);
  if (!specs.length) return null;
  const from = Math.min(...specs.map((s) => s.yearFrom));
  const to = Math.max(...specs.map((s) => s.yearTo ?? s.yearFrom));
  return from === to ? `ok. ${from}` : `ok. ${from}–${to}`;
}
