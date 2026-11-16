# Protein powders by day — diary export through November 5, 2026

Scanned all 128 dates in `data/backups/food-diary-export-2026-11-05.txt` (2026-07-01 through 2026-11-05). July and August contain calorie-import placeholders rather than itemized foods, so their powder consumption is unknown.

Accounted for **711.59 g powder**, supplying **581.87 g protein**, across 61 direct powder entries and 11 recipe entries reconstructed from matching saved ingredients. **18 additional recipe entries cannot be quantified** from the available snapshots. Excluded 6 deleted powder/recipe entries. These are incomplete recorded totals, not a complete measure of lifetime consumption.

## Powder totals accounted for

| Powder / brand | Powder mass (g) | Protein supplied (g) | Pantry protein / serving |
|---|---:|---:|---:|
| Peanut Protein Powder — Once Again | 154.10 | 113.01 | 11.0000 g / 15 g |
| Protein — Just One Ingredient | 454.60 | 390.20 | 10.3000 g / 12 g |
| Whey protein — simply tera's | 76.39 | 57.30 | 7.5000 g / 10 g |
| Whey Protein, Vanilla — Ascent | 26.50 | 21.37 | 25.0015 g / 31 g |

## Interpretation and method

- Powder grams mean the mass of the four specified powders. Protein grams mean only the protein those powders supply; yogurt, soy milk, fish, cereal, eggs and other recipe proteins are excluded.
- Direct entries use the powder mass printed in the text export. Protein is calculated with the pantry ratios rather than summing rounded diary protein labels. Logged masses themselves may have been rounded by the export.
- Recipe ingredient records came from `data/shared-storage.json` and the two `data/backups/protein-loadout-export-2026-11-02*.tsv` backups. These are supplemental sources because the requested text export has no recipe ingredients.
- A saved recipe is used only when its computed full-meal protein matches the logged protein at the consumed mass. Full-precision Nov 2 backup log values are used where available; otherwise the text export permits up to 0.5 g rounding difference. The ingredient amounts are scaled by consumed mass / finished batch mass, including nested recipes.
- Matching nutrition supports reconstruction but does not prove the original composition: the app saves current recipe ingredients and retains only mass/nutrition in historical log entries. No unmatched recipe is silently estimated from a different recipe version.
- Blank CSV values for July–August mean unknown. Zeros on itemized days mean no identified use in the available logs, not proof of no consumption. An unresolved day reports the amount accounted for so far; more powder may be present in its unresolved recipe meals.
- MB Shake, Almond Butter Balls and Peanut wheat germ crumble have food entries but no ingredient records establishing any of these four powders. They are listed separately below and in the CSV; their powder content is unknown.

## Recipes containing the specified powders in saved snapshots

| Recipe | Powders found across saved versions | Logged meals | Reconstructed | Unresolved |
|---|---|---:|---:|---:|
| mlechen 2.0 | Once Again, Just One Ingredient | 0 | 0 | 0 |
| .knox Greek yogurt bowl | Once Again, Just One Ingredient, simply tera's | 9 | 2 | 7 |
| Whey skyr bowl | Ascent | 1 | 1 | 0 |
| Grilled salmon pita mix | Just One Ingredient | 1 | 0 | 1 |
| Soy milk bowl | Just One Ingredient | 3 | 1 | 2 |
| Spanish Rice w/TVP and Soyrizo | Just One Ingredient | 2 | 2 | 0 |
| Spanish rice and egg | Just One Ingredient | 4 | 1 | 3 |
| Greek yogurt premix | simply tera's | 0 | 0 | 0 |
| .knox Greek bowl 2 | Just One Ingredient, simply tera's | 4 | 2 | 2 |
| Carrot protein | simply tera's | 5 | 2 | 3 |

## Daily list

All quantities below are grams. Product columns show the amounts accounted for. “Partial” means additional powder in one or more meals cannot be resolved. Recipe amounts on “Reconstructed” days depend on matching saved ingredients. Full per-entry evidence and source line numbers are in the companion `-entries.csv`.

July 1–August 31: **unknown on all 62 days** (calorie imports only). The daily CSV retains a separate row for every date.

| Date | Once Again powder | Just One Ingredient powder | tera’s powder | Ascent powder | Powder accounted for | Protein from powders | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| 2026-09-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry |
| 2026-09-02 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry |
| 2026-09-03 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry |
| 2026-09-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry |
| 2026-09-05 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry |
| 2026-09-06 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry |
| 2026-09-07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry; other prepared-food ingredients unknown |
| 2026-09-08 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry; other prepared-food ingredients unknown |
| 2026-09-09 | 0.00 | 24.00 | 0.00 | 0.00 | 24.00 | 20.60 | Direct entries |
| 2026-09-10 | 0.00 | 12.00 | 0.00 | 0.00 | 12.00 | 10.30 | Direct entries |
| 2026-09-11 | 0.00 | 24.00 | 0.00 | 0.00 | 24.00 | 20.60 | Direct entries |
| 2026-09-12 | 0.00 | 12.00 | 0.00 | 0.00 | 12.00 | 10.30 | Direct entries |
| 2026-09-13 | 0.00 | 12.00 | 0.00 | 0.00 | 12.00 | 10.30 | Direct entries |
| 2026-09-14 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry |
| 2026-09-15 | 0.00 | 15.70 | 0.00 | 0.00 | 15.70 | 13.48 | Direct entries |
| 2026-09-16 | 0.00 | 12.00 | 0.00 | 0.00 | 12.00 | 10.30 | Direct entries |
| 2026-09-17 | 0.00 | 12.00 | 0.00 | 0.00 | 12.00 | 10.30 | Direct entries; other prepared-food ingredients unknown |
| 2026-09-18 | 0.00 | 13.80 | 0.00 | 0.00 | 13.80 | 11.85 | Direct entries; other prepared-food ingredients unknown |
| 2026-09-19 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry; other prepared-food ingredients unknown |
| 2026-09-20 | 0.00 | 12.00 | 0.00 | 0.00 | 12.00 | 10.30 | Direct entries |
| 2026-09-21 | 0.00 | 12.00 | 0.00 | 0.00 | 12.00 | 10.30 | Direct entries |
| 2026-09-22 | 0.00 | 24.00 | 0.00 | 0.00 | 24.00 | 20.60 | Direct entries |
| 2026-09-23 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry; other prepared-food ingredients unknown |
| 2026-09-24 | 0.00 | 12.00 | 0.00 | 0.00 | 12.00 | 10.30 | Direct entries; other prepared-food ingredients unknown |
| 2026-09-25 | 0.00 | 8.00 | 0.00 | 0.00 | 8.00 | 6.87 | Direct entries; other prepared-food ingredients unknown |
| 2026-09-26 | 0.00 | 13.40 | 0.00 | 0.00 | 13.40 | 11.50 | Direct entries |
| 2026-09-27 | 0.00 | 9.00 | 0.00 | 0.00 | 9.00 | 7.72 | Direct entries |
| 2026-09-28 | 0.00 | 13.50 | 0.00 | 0.00 | 13.50 | 11.59 | Direct entries |
| 2026-09-29 | 0.00 | 18.00 | 0.00 | 0.00 | 18.00 | 15.45 | Direct entries |
| 2026-09-30 | 0.00 | 24.00 | 0.00 | 0.00 | 24.00 | 20.60 | Direct entries |
| 2026-10-01 | 0.00 | 12.00 | 0.00 | 0.00 | 12.00 | 10.30 | Direct entries |
| 2026-10-02 | 0.00 | 9.50 | 0.00 | 0.00 | 9.50 | 8.15 | Direct entries; other prepared-food ingredients unknown |
| 2026-10-03 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry; other prepared-food ingredients unknown |
| 2026-10-04 | 0.00 | 3.50 | 0.00 | 0.00 | 3.50 | 3.00 | Direct entries; other prepared-food ingredients unknown |
| 2026-10-05 | 0.00 | 6.00 | 0.00 | 0.00 | 6.00 | 5.15 | Direct entries |
| 2026-10-06 | 0.00 | 14.00 | 0.00 | 0.00 | 14.00 | 12.02 | Direct entries; other prepared-food ingredients unknown |
| 2026-10-07 | 10.50 | 0.00 | 0.00 | 0.00 | 10.50 | 7.70 | Direct entries |
| 2026-10-08 | 8.00 | 6.00 | 0.00 | 0.00 | 14.00 | 11.02 | Direct entries |
| 2026-10-09 | 10.90 | 0.00 | 0.00 | 0.00 | 10.90 | 7.99 | Direct entries |
| 2026-10-10 | 17.00 | 4.50 | 0.00 | 0.00 | 21.50 | 16.33 | Direct entries; other prepared-food ingredients unknown |
| 2026-10-11 | 17.00 | 11.20 | 0.00 | 0.00 | 28.20 | 22.08 | Direct entries |
| 2026-10-12 | 7.50 | 8.30 | 0.00 | 0.00 | 15.80 | 12.62 | Direct entries |
| 2026-10-13 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry |
| 2026-10-14 | 8.00 | 7.50 | 0.00 | 0.00 | 15.50 | 12.30 | Direct entries |
| 2026-10-15 | 17.00 | 6.00 | 0.00 | 0.00 | 23.00 | 17.62 | Direct entries |
| 2026-10-16 | 11.60 | 8.00 | 0.00 | 0.00 | 19.60 | 15.37 | Direct entries |
| 2026-10-17 | 5.00 | 4.50 | 0.00 | 0.00 | 9.50 | 7.53 | Direct entries |
| 2026-10-18 | 11.60 | 7.00 | 0.00 | 0.00 | 18.60 | 14.52 | Direct entries |
| 2026-10-19 | 12.30 | 12.40 | 0.00 | 0.00 | 24.70 | 19.66 | Direct entries |
| 2026-10-20 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | Partial; 1 unresolved meal(s) |
| 2026-10-21 | 10.20 | 3.00 | 0.00 | 0.00 | 13.20 | 10.05 | Partial; 1 unresolved meal(s) |
| 2026-10-22 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | Partial; 1 unresolved meal(s) |
| 2026-10-23 | 7.50 | 8.50 | 0.00 | 0.00 | 16.00 | 12.80 | Reconstructed |
| 2026-10-24 | 0.00 | 0.00 | 0.00 | 15.00 | 15.00 | 12.10 | Partial; 1 unresolved meal(s) |
| 2026-10-25 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | No identified entry |
| 2026-10-26 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | Partial; 1 unresolved meal(s) |
| 2026-10-27 | 0.00 | 21.50 | 0.00 | 0.00 | 21.50 | 18.45 | Partial; 1 unresolved meal(s) |
| 2026-10-28 | 0.00 | 0.23 | 0.00 | 0.00 | 0.23 | 0.19 | Partial; 2 unresolved meal(s) |
| 2026-10-29 | 0.00 | 0.85 | 0.00 | 0.00 | 0.85 | 0.73 | Reconstructed |
| 2026-10-30 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | Partial; 2 unresolved meal(s) |
| 2026-10-31 | 0.00 | 11.73 | 8.50 | 0.00 | 20.23 | 16.44 | Reconstructed |
| 2026-11-01 | 0.00 | 0.00 | 12.92 | 11.50 | 24.42 | 18.97 | Reconstructed |
| 2026-11-02 | 0.00 | 5.00 | 54.97 | 0.00 | 59.97 | 45.52 | Reconstructed |
| 2026-11-03 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | Partial; 3 unresolved meal(s) |
| 2026-11-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | Partial; 2 unresolved meal(s) |
| 2026-11-05 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | Partial; 3 unresolved meal(s) |

## Recipe entries with missing historical composition

| Date | Meal mass and name | Logged total meal protein (g) |
|---|---|---:|
| 2026-10-20 | .knox Greek yogurt bowl (291 g) | 49 |
| 2026-10-21 | .knox Greek yogurt bowl (268.5 g) | 39 |
| 2026-10-22 | .knox Greek yogurt bowl (371.51 g) | 49 |
| 2026-10-24 | Grilled salmon pita mix (151.9 g) | 31 |
| 2026-10-26 | Soy milk bowl (320.5 g) | 42 |
| 2026-10-27 | .knox Greek yogurt bowl (200 g) | 29 |
| 2026-10-28 | .knox Greek yogurt bowl (78 g) | 11 |
| 2026-10-28 | .knox Greek yogurt bowl (497 g) | 81 |
| 2026-10-30 | Spanish rice and egg (414 g) | 42 |
| 2026-10-30 | .knox Greek yogurt bowl (71.5 g) | 13 |
| 2026-11-03 | Carrot protein (161 g) | 21 |
| 2026-11-03 | .knox Greek bowl 2 (227 g) | 40 |
| 2026-11-03 | Spanish rice and egg (289 g) | 37 |
| 2026-11-04 | Carrot protein (250 g) | 18 |
| 2026-11-04 | .knox Greek bowl 2 (252 g) | 38 |
| 2026-11-05 | Carrot protein (172 g) | 24 |
| 2026-11-05 | Spanish rice and egg (445 g) | 54 |
| 2026-11-05 | Soy milk bowl (466 g) | 60 |

The logged total meal protein above includes all ingredients and cannot be counted entirely as powder protein.

## Other prepared foods without ingredient records

| Date | Food |
|---|---|
| 2026-09-07 | MB Shake |
| 2026-09-08 | MB Shake |
| 2026-09-17 | Almond Butter Balls |
| 2026-09-18 | Almond Butter Balls |
| 2026-09-19 | Almond Butter Balls |
| 2026-09-23 | Almond Butter Balls |
| 2026-09-24 | Almond Butter Balls |
| 2026-09-25 | Almond Butter Balls |
| 2026-10-02 | Almond Butter Balls |
| 2026-10-03 | Almond Butter Balls |
| 2026-10-04 | Almond Butter Balls |
| 2026-10-06 | Almond Butter Balls |
| 2026-10-06 | Peanut wheat germ crumble |
| 2026-10-06 | Peanut wheat germ crumble |
| 2026-10-10 | Peanut wheat germ crumble |
