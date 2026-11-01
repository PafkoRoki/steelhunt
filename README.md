# STEELHUNT

**Inteligentny łowca niedocenionych stalowych rowerów vintage — Poznań i okolice.**

STEELHUNT to nie jest kolejny agregator ogłoszeń. To narzędzie, które w ogłoszeniach z polskich portali szuka
rowerów, ram i komponentów **tańszych niż ich realna wartość** — także wtedy, gdy sprzedający nie wie, co sprzedaje,
źle opisał rower albo nie wspomniał o materiale ramy.

> Nie szukamy drogich rowerów. Szukamy niedocenionych rowerów o wyjątkowym potencjale.

---

## Co potrafi (wersja 0.1)

| Funkcja | Stan |
|---|---|
| Pulpit: aktywne, nowe, okazje, średnia cena, okazja dnia, blisko Poznania, Unknown Gems | ✅ |
| Cztery niezależne oceny: **Deal**, **Jakość ramy**, **Potencjał XBiking**, **Lokalizacja** | ✅ |
| Rozpoznawanie rur (Tange, Reynolds, Columbus, Ishiwata, True Temper, Dedacciai, Vitus, Oria, Kaisei, Cr-Mo/4130/Hi-Ten) z **zakresem** (cała rama / rury główne / tylko widelec) i **poziomem pewności** | ✅ |
| Baza 61 producentów i 318 modeli retro MTB (z linkami do źródeł) (USA, Japonia, Niemcy, Holandia, Francja, UK…), edytowalna bez zmian w kodzie | ✅ |
| Wycena: zakres wartości, oszczędność, koszt renowacji, koszt dojazdu, potencjał netto — zawsze z opisem niepewności | ✅ |
| **Unknown Gem** — ciekawe rowery spoza bazy modeli | ✅ |
| Filtry (cena, odległość, producent, model, rury, jakość ramy, koła, kategoria, stan, Deal Score, nowe, gemy, typ, portal) i 6 sposobów sortowania | ✅ |
| Mapa (Leaflet + OpenStreetMap) z Poznaniem w centrum | ✅ |
| Import ręczny: link + dane, JSON, CSV — z walidacją i wykrywaniem duplikatów | ✅ |
| Obserwowane, historia zmian cen, historia importów i wyszukiwań | ✅ |
| Wszystkie wagi i progi konfigurowalne w Ustawieniach | ✅ |
| Rowery szosowe są zawsze pomijane; tryb **„Tylko retro MTB”** (domyślnie włączony) ukrywa też rowery miejskie i turystyczne | ✅ |
| Zaplanowane wyszukiwanie co 6 h (GitHub Actions) | ✅ (źródła: import repo + Allegro API po podaniu kluczy) |
| Analiza AI zdjęć / naklejek | 🔜 Faza 4 (interfejs przygotowany, aplikacja działa bez AI) |

### Tryb demo

**Tryb demo** jest domyślnie wyłączony. Po włączeniu pokazuje 28 fikcyjnych, realistycznych ogłoszeń, które ilustrują działanie analizy.
Każde ma plakietkę **DEMO**, a jego przycisk prowadzi do *wyszukiwarki* portalu — nigdy do wymyślonej oferty.
Włączysz go w **Ustawienia → Dane → Tryb demo**.

### Skąd biorą się prawdziwe dane

STEELHUNT **nie scrapuje** portali, nie obchodzi CAPTCHA, logowania ani zabezpieczeń. Dostępne kanały:

1. **„Dodaj ogłoszenie”** w aplikacji — wklejasz link i dane widoczne w ogłoszeniu (OLX, Allegro Lokalnie, Sprzedajemy, Facebook…). Zapis tylko w Twojej przeglądarce.
2. **Pliki w `data/imports/`** (JSON/CSV) — wczytywane przez zaplanowane wyszukiwanie i publikowane dla wszystkich.
3. **Allegro REST API** — oficjalne API; wymaga kluczy aplikacji Allegro (patrz niżej).

Szczegóły i ograniczenia każdego portalu: [docs/MARKETPLACES.md](docs/MARKETPLACES.md).

---

## Instalacja (lokalnie)

Wymagania: **Node.js 20.11+** (zalecany 22) i npm.

```bash
git clone <adres-repozytorium> steelhunt
cd steelhunt
npm install
npm run dev
```

Aplikacja wystartuje pod adresem pokazanym w konsoli (domyślnie `http://localhost:5173`).

Przydatne polecenia:

| Polecenie | Opis |
|---|---|
| `npm run dev` | serwer deweloperski z podglądem na żywo |
| `npm run build` | sprawdzenie typów + build produkcyjny do `dist/` |
| `npm run preview` | podgląd buildu produkcyjnego |
| `npm run test:scoring` | tabela kontrolna: analiza i oceny wszystkich ogłoszeń demo |
| `npm run ingest` | jednorazowe wyszukiwanie (to samo, co robi GitHub Actions) |

---

## Wdrożenie na GitHub Pages

1. Utwórz repozytorium na GitHubie i wypchnij kod na gałąź `main`:
   ```bash
   git remote add origin https://github.com/<użytkownik>/steelhunt.git
   git push -u origin main
   ```
2. W repozytorium: **Settings → Pages → Build and deployment → Source: „GitHub Actions”**.
3. Workflow **„Deploy to GitHub Pages”** zbuduje i opublikuje stronę przy każdym pushu na `main`.
   Adres: `https://<użytkownik>.github.io/steelhunt/`.
4. Aplikacja używa względnych ścieżek i routera opartego na `#`, więc działa pod dowolną nazwą repozytorium — bez dodatkowej konfiguracji.

### Zaplanowane wyszukiwanie (co 6 godzin)

Workflow **„Ingest listings”** (`.github/workflows/ingest.yml`):

- uruchamia się automatycznie co 6 h oraz ręcznie: **Actions → Ingest listings → Run workflow**,
- odpytuje każde skonfigurowane źródło osobno (awaria jednego nie zatrzymuje pozostałych),
- normalizuje, usuwa duplikaty, zapisuje zmiany cen, aktualizuje `public/data/listings.json` i `public/data/run-log.json`,
- commituje dane, po czym workflow wdrożenia publikuje nową wersję strony.

Upewnij się, że w **Settings → Actions → General → Workflow permissions** zaznaczone jest **„Read and write permissions”**.

Harmonogram i zapytania zmienisz w `.github/workflows/ingest.yml` (cron) i `config/sources.json` (frazy, limity).

### Klucze Allegro (opcjonalnie)

1. Zarejestruj aplikację na <https://apps.developer.allegro.pl/> (typ: aplikacja działająca bez użytkownika / client credentials).
2. W repozytorium: **Settings → Secrets and variables → Actions → New repository secret**:
   - `ALLEGRO_CLIENT_ID`
   - `ALLEGRO_CLIENT_SECRET`
3. Allegro może ograniczać dostęp do wyszukiwania ofert (`/offers/listing`) dla niezweryfikowanych aplikacji. Jeśli tak się stanie, błąd pojawi się w zakładce **Historia** — konektor nie próbuje niczego obchodzić.

### Klucze eBay (opcjonalnie)

eBay jest czytany wyłącznie przez oficjalne **Browse API** (regulamin eBay zabrania czytania stron automatem).

1. Załóż darmowe konto deweloperskie na <https://developer.ebay.com/> i utwórz aplikację (**Application Keys → Production keyset**). Aby klucze produkcyjne działały, eBay wymaga skonfigurowania zgłoszeń o usunięciu konta (*Marketplace account deletion*) albo zadeklarowania zwolnienia z nich (aplikacja nie przechowuje danych użytkowników eBay).
2. W repozytorium dodaj sekrety: `EBAY_CLIENT_ID` (App ID) i `EBAY_CLIENT_SECRET` (Cert ID).
3. Przy każdym uruchomieniu workflow „Ingest listings” krok eBay szuka ofert z Niemiec: z wysyłką do Polski albo z kodów pocztowych wschodnich Niemiec (do odbioru). Aukcje są pomijane. Wynik trafia do `data/imports/auto-ebay.json`. Bez sekretów krok jest pomijany.

Frazy i kody pocztowe ustawisz w `config/scout.json` → `ebay`.

Klucze **nigdy** nie trafiają do kodu frontendu (nie używaj prefiksu `VITE_`).

---

## Rozbudowa bazy wiedzy

Bez zmian w kodzie:

- **Producenci:** `src/data/manufacturers/manufacturers.json`
- **Modele + heurystyczne zakresy cen:** `src/data/models/models.json`
- **Rury ramowe + wzorce rozpoznawania + oceny:** `src/data/tubing/tubing.json`
- **Osprzęt Shimano MTB (generacje, kody serii, lata produkcji):** `src/data/groupsets/shimano.json`
- **Inne komponenty:** `src/data/components/components.json`
- **Miejscowości (do liczenia odległości):** `src/services/geolocation/places.ts`

Dodatkowo w aplikacji: **Baza rowerów → + Producent / + Model** (zapis w przeglądarce, eksport do JSON)
oraz **Baza rur** — edycja ocen jakości z natychmiastowym przeliczeniem. Zakładka **Osprzęt Shimano** pokazuje oś czasu grup 1983–2005; kod serii z ogłoszenia (np. RD-M732) wskazuje przybliżony rocznik roweru.

---

## Zasady, których pilnuje STEELHUNT

- Sama marka, naklejka na widelcu czy ogólne „Cr-Mo” **nie** oznaczają ramy premium — każda identyfikacja rur ma zakres i poziom pewności (zweryfikowane / mocne dowody / prawdopodobne / niezweryfikowane / nieznane).
- Wyceny to **szacunki** z widocznym uzasadnieniem; ceny ofertowe nie są traktowane jak ceny transakcyjne.
- „Okazja” wymaga ceny poniżej progu **i** przyzwoitej ramy **i** braku czerwonych flag — sama niska cena nie wystarczy.
- Brak lokalizacji = odległość „nieznana”, nigdy zmyślone współrzędne.
- Żadnych fałszywych integracji: źródło bez API jest oznaczone jako „ręcznie”.

Dokumentacja techniczna (EN): [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SCORING.md](docs/SCORING.md), [docs/MARKETPLACES.md](docs/MARKETPLACES.md).
