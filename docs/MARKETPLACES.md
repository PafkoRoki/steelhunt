# Marketplace access — what is possible and what is not

STEELHUNT does not bypass CAPTCHAs, log in on the user's behalf, or circumvent rate limits or anti-bot
systems. Sources are read through an official API, public pages that the portal's robots.txt allows
(only by the **local scout**, low volume, see [SCOUT.md](SCOUT.md)), or data the user enters/commits manually.
Statuses below are mirrored in the app (Dashboard → “Źródła danych”).

| Source | Status | Method | Notes |
|---|---|---|---|
| **OLX.pl** | scout | `/api/v1/offers/` (Allowed in robots.txt), Poznań ± radius | Also URL/JSON/CSV import. |
| **Kleinanzeigen.de** | scout | Search pages `/s-fahrraeder/<q>/k0c217` + ad pages | Eastern-Germany postcode regions only. EUR → PLN. |
| **Allegro Lokalnie** | scout | Search pages `/oferty/rowery-i-akcesoria/rowery-16420/q/<q>` + ad pages (only `/oferty/wystaw/` is disallowed) | **Rate-limits automated clients (HTTP 429)**: few queries, 8 s pauses, and the run skips the portal as soon as it answers 429. The portal's own city filter ignores distance, so the scout searches nationwide and keeps towns within 200 km of Poznań; unknown towns are dropped. |
| **Sprzedajemy.pl** | scout | `/poznan?inp_text=<q>&inp_distance=150` + ad pages | robots.txt disallows only contact/admin paths. Uses the portal's own Poznań + 150 km filter. |
| **Allegro** | `api` | Official REST API, OAuth2 client credentials, `GET /offers/listing` | Needs `ALLEGRO_CLIENT_ID` / `ALLEGRO_CLIENT_SECRET` secrets. `/offer/` and `/z-drugiej-reki` are disallowed in robots.txt, so there is no page reading — API only. |
| **eBay.de** | `api` | Official Browse API: `item_summary/search` + `item/{id}`, application token (client credentials), marketplace `EBAY_DE` | eBay's User Agreement forbids robots/scrapers, so API only. Needs `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` secrets; runs in GitHub Actions (`scout.ts --only=ebay`). Two passes per query: `itemLocationCountry:DE,deliveryCountry:PL` (ships to Poland) and `itemLocationCountry:DE` limited to the eastern-German postcode regions (pickup). Auctions excluded (current bid ≠ final price). Seller text is used for analysis only; the published record is a fact summary, title, price, link and up to 3 image links. |
| **Facebook Marketplace** | `manual` | URL import only | Requires login; no API for search. |

## Portals checked (November 2026) and not automated

| Portal | Why not (yet) | What you can do |
|---|---|---|
| **Bikemarkt (bikemarkt.mtb-news.de)** | Allowed by robots.txt, but search results are loaded by JavaScript, so a plain request gets no listings. Good source of German classic MTB (Klassiker). | Open the search manually; paste good finds via “Dodaj ogłoszenie”. Worth revisiting if a feed appears. |
| **Vinted** | Allowed paths exist, but the site's own robots.txt text forbids automated agents simulating customer activity, and bikes are rare there. | Manual import only. |
| **Gratka.pl** | No bicycle category any more (404); mostly real estate and cars. | — |
| **Gumtree.pl** | Not reachable (domain no longer serves the site). | — |
| **Sbazar.cz** | robots.txt disallows everything (`Disallow: /`). | — |
| **Bazoš.cz / .sk** | robots.txt disallows search (`/search.php`, `hledat=`). Only browsing category pages would be allowed. Czech Republic is ~250–350 km from Poznań. | Manual import. A category-page reader is possible later. |
| **markt.de, Quoka.de** | Allowed by robots.txt, but few classic MTB listings. | Could be added if Kleinanzeigen is not enough. |
| **retrobike.co.uk (For Sale forum)** | Returns 403 to automated clients; also mostly UK (shipping). | Manual. |
| **Tutti.ch / Anibis.ch / Willhaben.at / Marktplaats.nl** | 403 to automated clients, or too far from Poznań. | — |

## Manual import formats

Required: `url`, `title`. Optional: `price`, `currency`, `location`, `latitude`, `longitude`, `description`,
`images` (array or space/semicolon-separated string), `postedAt` (ISO), `condition`
(`excellent|good|fair|poor|project`), `itemType` (`complete|frameset|frame|components`), `shipping`
(boolean / `tak` / `true`), `externalId`.

- **In the app** (“Dodaj ogłoszenie”): stored in the user's browser only.
- **In the repo** (`data/imports/*.json|*.csv`): picked up by every scheduled run and published.

The marketplace and external id are derived from the URL (`-ID…​.html` for OLX, numeric id for Allegro,
`nr…` for Sprzedajemy, `marketplace/item/…` for Facebook). Re-importing the same URL updates the
listing and records price changes instead of duplicating it.

## Investigation backlog

- Bikemarkt: check for an RSS/JSON feed of saved searches.
- RSS/e-mail alert parsing from user-owned saved searches, if permitted by the portals' terms.
