export interface DistanceBand {
  /** Upper bound in km (exclusive). Use 100000 for "and beyond". */
  maxKm: number;
  score: number;
}

export interface DealWeights {
  price: number;
  frame: number;
  location: number;
  condition: number;
  negotiation: number;
}

/** 0 = entire Poland */
export type RadiusOption = 30 | 50 | 100 | 150 | 250 | 0;

export interface AppSettings {
  origin: { name: string; lat: number; lng: number };
  radiusKm: RadiusOption;
  distanceBands: DistanceBand[];
  dealWeights: DealWeights;
  dealThresholdPct: 20 | 30 | 40 | 50;
  /** PLN per km driven (round trip is computed). */
  fuelCostPerKm: number;
  /** Straight-line → estimated driving distance multiplier. */
  roadFactor: number;
  /** Flat courier cost for bikes when the seller ships, PLN. */
  courierCost: number;
  demoMode: boolean;
  /** Show only retro MTB / ATB bikes, MTB frames and MTB components. */
  mtbOnly: boolean;
  /** Bumped when defaults change in a way stored settings must follow. */
  settingsVersion: number;
  newListingHours: number;
  /** tubingId -> custom score */
  frameScoreOverrides: Record<string, number>;
}
