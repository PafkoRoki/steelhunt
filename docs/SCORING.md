# Scoring

All numbers below are **initial defaults** (`src/features/scoring/config.ts`, `src/data/tubing/tubing.json`)
and can be changed in the Settings / Tubing Database pages. They are heuristics, not official rankings.

## 1. Frame Quality (0–100) — `scoreFrameQuality`

Tubing quality only — independent of condition.

1. Tubing found in the listing text (frame scope) → series score (e.g. Tange Prestige 100, Reynolds 531 100,
   Columbus SL/SLX 100, Tange Champion 95, Cromor/Zona 90, Reynolds 525 85, Tange Infinity 85,
   Tange MTB DB 80, generic 4130 70, unverified Cr-Mo 60, Hi-Ten 20).
   - −5 named series without frame context (could be fork/sticker), −8 main tubes only,
     +8 butted generic Cr-Mo.
2. Tubing only from the model database → typical score −10 (`probable` at best).
3. No tubing: aluminium/carbon 35, titanium 85, steel without spec 45 (55 for high-reputation brands),
   unknown material 35 or `30 + 0.25 × brand reputation`.

Scope detection binds a tubing mention to the nearest noun (“rama/frame” vs “widelec/fork”), with clause
punctuation as a penalty, and recognizes “main tubes / rury główne”. Fork-only mentions never raise the
frame score; they produce a warning instead.

**Confidence**: `strong` = named series + frame context; `probable` = named series, unclear scope, or Hi-Ten;
`unverified` = generic seller claim (“Cr-Mo”); `unknown` = nothing. `verified` is reserved for future
human/AI decal confirmation.

## 2. XBiking Potential (0–100) — `scoreXbiking`

Category base (vintage MTB 70, touring 72, randonneur 75, ATB 62, road 60, city 38…) plus:
material (+15 premium steel … −25 carbon), rigid fork +8, suspension fork −5, 26" +4, rack/fender/bottle
mounts +4/+3/+2, cantilevers +4, lugged/fillet +6, original paint +3, quality components up to +8,
red flags −30.

## 3. Location (0–100 or unknown) — `scoreLocation`

Distance bands from the origin (Poznań): 0–30 km 100, –60 90, –100 80, –150 65, –250 40, 250+ 15.
No resolvable location → `null` (shown as “unknown”, treated as neutral 40 inside Deal Score).
Driving distance = straight line × road factor (1.25). Transport = round trip × cost/km, or courier if cheaper.

## 4. Deal Score (0–100) — `scoreDeal`

Weighted (normalized) sum:

| Component | Default weight | Sub-score |
|---|---:|---|
| Price vs market | 40% | piecewise on discount: −30% → 5, 0% → 30, 20% → 55, 30% → 70, 50% → 90, 70% → 100; shrunk toward 35 for medium (×0.85) / low (×0.65) valuation confidence |
| Frame quality | 25% | Frame Quality score |
| Location | 20% | Location score |
| Condition | 10% | excellent 100 · good 85 · fair 65 · poor 40 · project 25 · unknown 55 |
| Negotiation | 5% | 25 + 20 per signal (“do negocjacji”, “pilne”, “z piwnicy”…), +15 if > 21 days old, +20 after a price drop |

Red flags (kids’ bike, e-bike, cheap full-suspension, supermarket bike) multiply the result by 0.6.

**Bargain** = discount ≥ threshold (default 30%) **and** valuation exists **and** frame ≥ 55 **and** no red flags.

## Market value — `estimateMarketValue`

1. Model range from `models.json` (confidence medium), else brand reputation × frame quality (low),
   else frame quality only (low/none).
2. + valuable components (tier 4–5), × condition factor, × item-type factor (frameset 0.55, frame 0.45;
   +0.2 for premium tubing).
3. With ≥ 2 comparable listings of the same model: blend with median asking price × 0.9
   (asking ≠ sold) → confidence medium/high.

Potential savings = mid − price. Net opportunity = mid − price − restoration − transport.

## Unknown Gem — `detectUnknownGem`

Only for listings whose model was **not** recognized and without red flags. Signals (≥ 2 needed):
named/semi-named tubing ≥ 70 (counts double), butted Cr-Mo, lugged or fillet-brazed construction,
tier 4–5 components, brand often undervalued in Poland, old steel bike ≤ 500 zł, > 30% below estimate.
