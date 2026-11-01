import type { BicycleCategory, FrameConstruction } from './listing';

/** How trustworthy a database fact is. */
export type FactVerification = 'documented' | 'commonly-reported' | 'unverified';

export type Region =
  | 'usa'
  | 'canada'
  | 'japan'
  | 'taiwan'
  | 'germany'
  | 'netherlands'
  | 'france'
  | 'uk'
  | 'italy'
  | 'austria'
  | 'poland'
  | 'switzerland'
  | 'other';

export interface Manufacturer {
  id: string;
  name: string;
  /** Lowercase, diacritic-free search aliases. Matched on word boundaries. */
  aliases: string[];
  country: Region;
  /** Brand reputation for vintage steel (0-100). Heuristic; real tubing evidence always wins. */
  steelReputation: number;
  /** Brands that are frequently under-priced in Polish ads. */
  undervaluedInPoland?: boolean;
  notes?: string;
  era?: string;
  sources?: string[];
}

export interface BikeModel {
  id: string;
  manufacturerId: string;
  name: string;
  aliases: string[];
  years?: string;
  category: BicycleCategory;
  /** Typical tubing reported for this model. Years vary — never treated as more than "probable". */
  typicalTubing?: string;
  tubingNote?: string;
  construction?: FrameConstruction;
  verification: FactVerification;
  /** Heuristic asking-price range for a complete bike in fair/good condition, PLN. Editable. */
  marketValuePLN?: { min: number; max: number };
  xbikingNotes?: string;
  /** Known frame material for the model, when documented (e.g. an aluminium 'Hitech' model). */
  frameMaterial?: 'steel' | 'aluminium';
  /** Where the facts come from (URLs). */
  sources?: string[];
}

export type TubingTier = 'top' | 'high' | 'mid' | 'entry' | 'low';

export interface TubingSpec {
  id: string;
  manufacturer: string;
  series: string;
  /** Regex sources, matched case-insensitively against diacritic-free lowercase text. */
  patterns: string[];
  /** Initial heuristic quality score 0..100 — editable, not an official ranking. */
  score: number;
  tier: TubingTier;
  material: 'crmo' | 'mn-mo' | 'steel' | 'hiten' | 'aluminium';
  butted?: boolean;
  notes?: string;
  verification: FactVerification;
}

export interface ComponentSpec {
  id: string;
  name: string;
  patterns: string[];
  tier: number; // 1..5 desirability
  notes?: string;
}

export interface UserDatabaseAdditions {
  manufacturers: Manufacturer[];
  models: BikeModel[];
}

/** A Shimano MTB groupset family (XT, LX, …) — used when a listing names the group but not the series. */
export interface GroupsetFamily {
  id: string;
  name: string;
  tier: number; // 1..5 desirability
  rank: number; // position in the line-up, 1 = top
  patterns: string[];
  notes?: string;
}

/** One generation of a groupset (e.g. Deore XT M730). Years from public sources; disputes noted in yearNote. */
export interface GroupsetSpec {
  id: string;
  family: string;
  series: string;
  /** Model codes matched in listing text (e.g. "M730" also matches "RD-M730"). */
  codes: string[];
  /** Ambiguous short codes (C50, CT92) — only matched when the family name is also present. */
  contextCodes?: string[];
  yearFrom: number;
  /** Estimated end year (usually the year before the next generation). */
  yearTo?: number;
  yearNote?: string;
  speeds: number | string;
  tech?: string[];
  notes?: string;
  verification: 'documented' | 'commonly-reported' | 'unverified';
  sources: string[];
}

export interface GroupsetDatabase {
  sources: Record<string, string>;
  families: GroupsetFamily[];
  groupsets: GroupsetSpec[];
}
