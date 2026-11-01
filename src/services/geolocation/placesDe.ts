/**
 * German locations for Kleinanzeigen listings (approximate centres, WGS84).
 *  - DE_CITIES: matched by name → precision 'city'.
 *  - DE_PLZ_REGIONS: first two digits of a German postcode → centre of that postcode region → precision 'region'.
 * Only eastern/northern Germany is covered (realistic driving range from Poznań). Other postcodes stay "unknown".
 */
import type { Place } from './places';

export const DE_CITIES: Record<string, Place> = {
  berlin: { name: 'Berlin', lat: 52.52, lng: 13.405, region: 'Berlin' },
  potsdam: { name: 'Potsdam', lat: 52.391, lng: 13.065, region: 'Brandenburg' },
  'frankfurt (oder)': { name: 'Frankfurt (Oder)', lat: 52.347, lng: 14.551, region: 'Brandenburg' },
  'frankfurt oder': { name: 'Frankfurt (Oder)', lat: 52.347, lng: 14.551, region: 'Brandenburg' },
  cottbus: { name: 'Cottbus', lat: 51.756, lng: 14.333, region: 'Brandenburg' },
  eberswalde: { name: 'Eberswalde', lat: 52.833, lng: 13.818, region: 'Brandenburg' },
  gorlitz: { name: 'Görlitz', lat: 51.153, lng: 14.987, region: 'Sachsen' },
  bautzen: { name: 'Bautzen', lat: 51.181, lng: 14.424, region: 'Sachsen' },
  dresden: { name: 'Dresden', lat: 51.05, lng: 13.738, region: 'Sachsen' },
  leipzig: { name: 'Leipzig', lat: 51.34, lng: 12.375, region: 'Sachsen' },
  chemnitz: { name: 'Chemnitz', lat: 50.833, lng: 12.924, region: 'Sachsen' },
  halle: { name: 'Halle (Saale)', lat: 51.482, lng: 11.97, region: 'Sachsen-Anhalt' },
  magdeburg: { name: 'Magdeburg', lat: 52.12, lng: 11.628, region: 'Sachsen-Anhalt' },
  rostock: { name: 'Rostock', lat: 54.092, lng: 12.099, region: 'Mecklenburg-Vorpommern' },
  schwerin: { name: 'Schwerin', lat: 53.636, lng: 11.401, region: 'Mecklenburg-Vorpommern' },
  neubrandenburg: { name: 'Neubrandenburg', lat: 53.557, lng: 13.261, region: 'Mecklenburg-Vorpommern' },
  greifswald: { name: 'Greifswald', lat: 54.093, lng: 13.387, region: 'Mecklenburg-Vorpommern' },
  hamburg: { name: 'Hamburg', lat: 53.551, lng: 9.993, region: 'Hamburg' },
};

export const DE_PLZ_REGIONS: Record<string, Place> = {
  '01': { name: 'okolice Drezna', lat: 51.05, lng: 13.738, region: 'Sachsen' },
  '02': { name: 'Łużyce (Bautzen/Görlitz)', lat: 51.18, lng: 14.6, region: 'Sachsen' },
  '03': { name: 'okolice Cottbus', lat: 51.756, lng: 14.333, region: 'Brandenburg' },
  '04': { name: 'okolice Lipska', lat: 51.34, lng: 12.375, region: 'Sachsen' },
  '06': { name: 'okolice Halle', lat: 51.482, lng: 11.97, region: 'Sachsen-Anhalt' },
  '08': { name: 'okolice Zwickau', lat: 50.718, lng: 12.496, region: 'Sachsen' },
  '09': { name: 'okolice Chemnitz', lat: 50.833, lng: 12.924, region: 'Sachsen' },
  '10': { name: 'Berlin', lat: 52.52, lng: 13.405, region: 'Berlin' },
  '12': { name: 'Berlin (południe)', lat: 52.45, lng: 13.45, region: 'Berlin' },
  '13': { name: 'Berlin (północ)', lat: 52.57, lng: 13.33, region: 'Berlin' },
  '14': { name: 'okolice Poczdamu', lat: 52.391, lng: 13.065, region: 'Brandenburg' },
  '15': { name: 'okolice Frankfurtu nad Odrą', lat: 52.347, lng: 14.551, region: 'Brandenburg' },
  '16': { name: 'Brandenburgia (północ)', lat: 52.833, lng: 13.818, region: 'Brandenburg' },
  '17': { name: 'Pomorze Przednie', lat: 53.557, lng: 13.261, region: 'Mecklenburg-Vorpommern' },
  '18': { name: 'okolice Rostocku', lat: 54.092, lng: 12.099, region: 'Mecklenburg-Vorpommern' },
  '19': { name: 'okolice Schwerina', lat: 53.636, lng: 11.401, region: 'Mecklenburg-Vorpommern' },
  '39': { name: 'okolice Magdeburga', lat: 52.12, lng: 11.628, region: 'Sachsen-Anhalt' },
};
