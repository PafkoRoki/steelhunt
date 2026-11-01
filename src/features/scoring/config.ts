import type { AppSettings } from '../../types/settings';

/** Initial configuration defaults — every value is editable in Settings. */
export const DEFAULT_SETTINGS: AppSettings = {
  origin: { name: 'Poznań', lat: 52.4064, lng: 16.9252 },
  radiusKm: 150,
  distanceBands: [
    { maxKm: 30, score: 100 },
    { maxKm: 60, score: 90 },
    { maxKm: 100, score: 80 },
    { maxKm: 150, score: 65 },
    { maxKm: 250, score: 40 },
    { maxKm: 100000, score: 15 },
  ],
  dealWeights: { price: 0.4, frame: 0.25, location: 0.2, condition: 0.1, negotiation: 0.05 },
  dealThresholdPct: 30,
  fuelCostPerKm: 0.8,
  roadFactor: 1.25,
  courierCost: 140,
  demoMode: false,
  mtbOnly: true,
  settingsVersion: 3,
  newListingHours: 48,
  frameScoreOverrides: {},
};

export const RADIUS_OPTIONS: { value: AppSettings['radiusKm']; label: string }[] = [
  { value: 30, label: '30 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: 150, label: '150 km' },
  { value: 250, label: '250 km' },
  { value: 0, label: 'Cała Polska' },
];
