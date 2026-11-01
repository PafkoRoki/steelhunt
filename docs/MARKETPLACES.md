# Marketplace access — what is possible and what is not

STEELHUNT does not scrape, bypass CAPTCHAs, log in on the user's behalf, or circumvent rate limits or
anti-bot systems. Every source is integrated only through an official API, an authorized feed, or data
the user enters/commits manually. Statuses below are mirrored in the app (Dashboard → “Źródła danych”).

| Source | Status | Method | Notes |
|---|---|---|---|
| **Allegro** | `api` | Official REST API, OAuth2 client credentials, `GET /offers/listing` | Needs `ALLEGRO_CLIENT_ID` / `ALLEGRO_CLIENT_SECRET` secrets. Allegro may require application verification for listing search; a 401/403 is logged in History, never worked around. Search results contain title, price, images and (sometimes) seller city, but no description — analysis then relies on the title. |
| **Allegro Lokalnie** | `manual` | URL/JSON/CSV import | No public search API known. |
| **OLX.pl** | `manual` | URL/JSON/CSV import | OLX's partner API is for managing *your own* adverts, not for searching others. Automated retrieval of search results is not implemented. |
| **Sprzedajemy.pl** | `manual` | URL/JSON/CSV import | No public API known. |
| **Facebook Marketplace** | `manual` | URL import only | Requires login; no API for search. Only user-pasted links. |
| **Gumtree / others** | `manual` | URL import (`other`) | Add a registry entry when a permitted method exists. |

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

- Check whether OLX offers a sanctioned data feed/partnership for search results.
- Check Allegro Lokalnie API availability under Allegro's developer program.
- RSS/e-mail alert parsing from user-owned saved searches (user forwards alerts → feed), if permitted by the portals' terms.
