import type { BicycleCategory, ConfidenceLevel, FrameConstruction, FrameMaterial, ItemType, ListingCondition, TubingScope } from '../types/listing';

export const CATEGORY_LABEL: Record<BicycleCategory, string> = {
  'vintage-mtb': 'Vintage MTB',
  'retro-mtb': 'Retro MTB',
  atb: 'ATB',
  touring: 'Turystyczny',
  'gravel-conversion': 'Baza pod gravel',
  randonneur: 'Randonneur',
  'vintage-road': 'Szosa vintage',
  utility: 'Użytkowy',
  city: 'Miejski',
  frameset: 'Rama / frameset',
  components: 'Komponenty',
  unknown: 'Nieokreślony',
};

export const CONDITION_LABEL: Record<ListingCondition, string> = {
  excellent: 'Bardzo dobry',
  good: 'Dobry',
  fair: 'Do poprawek',
  poor: 'Do remontu',
  project: 'Projekt / na części',
  unknown: 'Nieznany',
};

export const MATERIAL_LABEL: Record<FrameMaterial, string> = {
  'steel-premium': 'Stal premium',
  'steel-crmo': 'Stal Cr-Mo',
  'steel-hiten': 'Stal Hi-Ten',
  'steel-unknown': 'Stal (nieokreślona)',
  aluminium: 'Aluminium',
  carbon: 'Karbon',
  titanium: 'Tytan',
  unknown: 'Nieznany',
};

export const CONSTRUCTION_LABEL: Record<FrameConstruction, string> = {
  lugged: 'Mufowana',
  tig: 'Spawana TIG',
  'fillet-brazed': 'Lutowana (fillet)',
  bonded: 'Klejona',
  unknown: 'Nieznana',
};

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  complete: 'Kompletny rower',
  frameset: 'Rama + widelec',
  frame: 'Sama rama',
  components: 'Komponenty',
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  verified: 'Zweryfikowane',
  strong: 'Mocne dowody',
  probable: 'Prawdopodobne',
  unverified: 'Niezweryfikowane',
  unknown: 'Nieznane',
};

export const SCOPE_LABEL: Record<TubingScope, string> = {
  'full-frame': 'Cała rama',
  'main-tubes': 'Tylko rury główne',
  'fork-only': 'Tylko widelec',
  unknown: 'Zakres nieznany',
};

export const PRICE_CONF_LABEL = { high: 'wysoka', medium: 'średnia', low: 'niska', none: 'brak' } as const;
