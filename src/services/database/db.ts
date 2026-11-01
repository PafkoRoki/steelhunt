import manufacturersJson from '../../data/manufacturers/manufacturers.json';
import modelsJson from '../../data/models/models.json';
import tubingJson from '../../data/tubing/tubing.json';
import componentsJson from '../../data/components/components.json';
import type { BikeModel, ComponentSpec, Manufacturer, TubingSpec, UserDatabaseAdditions } from '../../types/database';

/**
 * Bicycle knowledge base. Data lives in JSON files under src/data — edit those (or add entries
 * in the app's "Baza rowerów" page, stored per-browser) to extend it without touching code.
 */
export interface BikeDatabase {
  manufacturers: Manufacturer[];
  models: BikeModel[];
  tubing: TubingSpec[];
  components: ComponentSpec[];
  manufacturerById: Map<string, Manufacturer>;
  modelById: Map<string, BikeModel>;
  tubingById: Map<string, TubingSpec>;
}

export const BASE_MANUFACTURERS = manufacturersJson as Manufacturer[];
export const BASE_MODELS = modelsJson as BikeModel[];
export const BASE_TUBING = tubingJson as TubingSpec[];
export const BASE_COMPONENTS = componentsJson as ComponentSpec[];

export function buildDatabase(additions?: Partial<UserDatabaseAdditions>): BikeDatabase {
  const manufacturers = mergeById(BASE_MANUFACTURERS, additions?.manufacturers ?? []);
  const models = mergeById(BASE_MODELS, additions?.models ?? []);
  return {
    manufacturers,
    models,
    tubing: BASE_TUBING,
    components: BASE_COMPONENTS,
    manufacturerById: new Map(manufacturers.map((m) => [m.id, m])),
    modelById: new Map(models.map((m) => [m.id, m])),
    tubingById: new Map(BASE_TUBING.map((t) => [t.id, t])),
  };
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const map = new Map(base.map((x) => [x.id, x]));
  extra.forEach((x) => map.set(x.id, x));
  return [...map.values()];
}

/** Generic/unspecified tubing entries rank below named series when several match. */
export function tubingSpecificity(t: TubingSpec): number {
  if (t.id === 'generic-4130') return 1; // a defined steel grade beats a bare "Cr-Mo" claim
  if (t.manufacturer === 'Generic') return 0;
  if (t.id.endsWith('-generic') || t.id === 'tange-crmo') return 1;
  return 2;
}
