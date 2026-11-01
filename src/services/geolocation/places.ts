/**
 * Small gazetteer of Polish places (approximate town-centre coordinates, WGS84).
 * Used ONLY to place a listing whose location text names one of these towns.
 * Results are marked `geoPrecision: 'city'` — never presented as the seller's exact address.
 * Extend freely; keys are diacritic-free lowercase names.
 */
export interface Place {
  name: string;
  lat: number;
  lng: number;
  region: string;
}

export const PLACES: Record<string, Place> = {
  poznan: { name: 'Poznań', lat: 52.4064, lng: 16.9252, region: 'wielkopolskie' },
  swarzedz: { name: 'Swarzędz', lat: 52.4122, lng: 17.0789, region: 'wielkopolskie' },
  lubon: { name: 'Luboń', lat: 52.347, lng: 16.878, region: 'wielkopolskie' },
  puszczykowo: { name: 'Puszczykowo', lat: 52.286, lng: 16.855, region: 'wielkopolskie' },
  mosina: { name: 'Mosina', lat: 52.245, lng: 16.847, region: 'wielkopolskie' },
  kornik: { name: 'Kórnik', lat: 52.247, lng: 17.088, region: 'wielkopolskie' },
  srem: { name: 'Śrem', lat: 52.089, lng: 17.015, region: 'wielkopolskie' },
  oborniki: { name: 'Oborniki', lat: 52.648, lng: 16.814, region: 'wielkopolskie' },
  szamotuly: { name: 'Szamotuły', lat: 52.611, lng: 16.58, region: 'wielkopolskie' },
  gniezno: { name: 'Gniezno', lat: 52.535, lng: 17.583, region: 'wielkopolskie' },
  wrzesnia: { name: 'Września', lat: 52.325, lng: 17.565, region: 'wielkopolskie' },
  sroda: { name: 'Środa Wielkopolska', lat: 52.228, lng: 17.277, region: 'wielkopolskie' },
  koscian: { name: 'Kościan', lat: 52.087, lng: 16.645, region: 'wielkopolskie' },
  grodzisk: { name: 'Grodzisk Wielkopolski', lat: 52.227, lng: 16.365, region: 'wielkopolskie' },
  'nowy tomysl': { name: 'Nowy Tomyśl', lat: 52.319, lng: 16.128, region: 'wielkopolskie' },
  wolsztyn: { name: 'Wolsztyn', lat: 52.116, lng: 16.115, region: 'wielkopolskie' },
  leszno: { name: 'Leszno', lat: 51.8406, lng: 16.5749, region: 'wielkopolskie' },
  rawicz: { name: 'Rawicz', lat: 51.609, lng: 16.858, region: 'wielkopolskie' },
  jarocin: { name: 'Jarocin', lat: 51.972, lng: 17.502, region: 'wielkopolskie' },
  pila: { name: 'Piła', lat: 53.151, lng: 16.738, region: 'wielkopolskie' },
  chodziez: { name: 'Chodzież', lat: 52.995, lng: 16.92, region: 'wielkopolskie' },
  wagrowiec: { name: 'Wągrowiec', lat: 52.808, lng: 17.2, region: 'wielkopolskie' },
  czarnkow: { name: 'Czarnków', lat: 52.903, lng: 16.564, region: 'wielkopolskie' },
  trzcianka: { name: 'Trzcianka', lat: 53.041, lng: 16.455, region: 'wielkopolskie' },
  miedzychod: { name: 'Międzychód', lat: 52.601, lng: 15.893, region: 'wielkopolskie' },
  konin: { name: 'Konin', lat: 52.223, lng: 18.251, region: 'wielkopolskie' },
  kalisz: { name: 'Kalisz', lat: 51.761, lng: 18.091, region: 'wielkopolskie' },
  ostrow: { name: 'Ostrów Wielkopolski', lat: 51.655, lng: 17.807, region: 'wielkopolskie' },
  bydgoszcz: { name: 'Bydgoszcz', lat: 53.1235, lng: 18.0084, region: 'kujawsko-pomorskie' },
  torun: { name: 'Toruń', lat: 53.0138, lng: 18.5984, region: 'kujawsko-pomorskie' },
  inowroclaw: { name: 'Inowrocław', lat: 52.793, lng: 18.261, region: 'kujawsko-pomorskie' },
  'zielona gora': { name: 'Zielona Góra', lat: 51.9356, lng: 15.5062, region: 'lubuskie' },
  gorzow: { name: 'Gorzów Wielkopolski', lat: 52.7368, lng: 15.2288, region: 'lubuskie' },
  wroclaw: { name: 'Wrocław', lat: 51.1079, lng: 17.0385, region: 'dolnośląskie' },
  lodz: { name: 'Łódź', lat: 51.7592, lng: 19.456, region: 'łódzkie' },
  warszawa: { name: 'Warszawa', lat: 52.2297, lng: 21.0122, region: 'mazowieckie' },
  krakow: { name: 'Kraków', lat: 50.0647, lng: 19.945, region: 'małopolskie' },
  gdansk: { name: 'Gdańsk', lat: 54.352, lng: 18.6466, region: 'pomorskie' },
  gdynia: { name: 'Gdynia', lat: 54.5189, lng: 18.5305, region: 'pomorskie' },
  szczecin: { name: 'Szczecin', lat: 53.4285, lng: 14.5528, region: 'zachodniopomorskie' },
  katowice: { name: 'Katowice', lat: 50.2649, lng: 19.0238, region: 'śląskie' },
  lublin: { name: 'Lublin', lat: 51.2465, lng: 22.5684, region: 'lubelskie' },
  olsztyn: { name: 'Olsztyn', lat: 53.7784, lng: 20.4801, region: 'warmińsko-mazurskie' },
  rzeszow: { name: 'Rzeszów', lat: 50.0412, lng: 21.9991, region: 'podkarpackie' },
  bialystok: { name: 'Białystok', lat: 53.1325, lng: 23.1688, region: 'podlaskie' },
  opole: { name: 'Opole', lat: 50.6751, lng: 17.9213, region: 'opolskie' },
  kielce: { name: 'Kielce', lat: 50.8661, lng: 20.6286, region: 'świętokrzyskie' },
};
