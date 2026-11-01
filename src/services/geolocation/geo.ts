import { normalizeText } from '../../utils/text';
import { PLACES, type Place } from './places';

const EARTH_RADIUS_KM = 6371;

/** Great-circle (straight-line) distance in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Longest keys first so "nowy tomysl" wins over a shorter accidental match.
const PLACE_KEYS = Object.keys(PLACES).sort((a, b) => b.length - a.length);

/**
 * Resolve a free-text location ("Poznań, Jeżyce", "Gniezno - wielkopolskie") to a known town.
 * Returns null when nothing matches — the caller must then treat distance as UNKNOWN.
 */
export function resolvePlace(locationName: string | null | undefined): Place | null {
  const norm = normalizeText(locationName);
  if (!norm) return null;
  for (const key of PLACE_KEYS) {
    const re = new RegExp(`(?:^|[^a-z])${key}(?:[^a-z]|$)`);
    if (re.test(norm)) return PLACES[key];
  }
  // Inflected forms commonly used in ads ("w Poznaniu", "k. Gniezna") — stem match on first 5 letters.
  for (const key of PLACE_KEYS) {
    if (key.length >= 6 && !key.includes(' ') && norm.includes(key.slice(0, 5))) return PLACES[key];
  }
  return null;
}
