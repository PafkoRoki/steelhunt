# data/imports — ręczny kanał danych

Pliki `*.json` i `*.csv` z tego katalogu są wczytywane przy każdym zaplanowanym wyszukiwaniu (`npm run ingest`)
i publikowane na stronie jako ogłoszenia z plakietką **IMPORT**.

To legalna droga dla portali bez publicznego API (OLX, Allegro Lokalnie, Sprzedajemy.pl, Facebook Marketplace):
przepisujesz dane, które widzisz w ogłoszeniu, a STEELHUNT je analizuje. Nic nie jest pobierane z portali automatycznie.

Format — patrz `example.json.sample` i `example.csv.sample` (rozszerzenie `.sample` sprawia, że nie są wczytywane).
Wymagane pola: `url`, `title`. Opcjonalne: `price`, `location`, `description`, `condition`
(`excellent|good|fair|poor|project`), `itemType` (`complete|frameset|frame|components`), `shipping`, `images`,
`latitude`, `longitude`, `postedAt`.

Nie dodawaj tu wymyślonych ogłoszeń — wszystko z tego katalogu trafia na stronę jako prawdziwe dane.
