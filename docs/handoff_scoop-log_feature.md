# Handoff: scoop-log feature for `protein-loadout.html`

## Context
Single-file, local-first HTML tool (localStorage, no backend/accounts). Muratori/Handmade code style: flat data, explicit loops, `let`, snake_case locals, camelCase functions, `switch` over if-chains, `==` over `===`, single quotes. Existing tool models a *planned* daily loadout (7 foods, package sizes, prices, 128 g/day target). This adds *actual* logging.

## Step 1 — scoop log (no network)

Add a second table: measured pantry items, one row each.

Fields per item: `barcode`, `name`, `brand`, `scoop_g`, `protein_g`, `kcal`.

Seed data (verified):
- Trader Joe's Cashew Pieces — `00505154`, 48 g, 8 g, 272 kcal
- P.E. granola; M.A.B. — 40 g, 4 g, 175 kcal
- siggi's skyr; plain, 0% — 250 g, 28 g, 150 kcal

Behavior: tap a row to add one scoop to today's tally; long-press or a `−` to remove. Running totals at top: protein g and kcal, protein shown against the 128 g target. Log keyed by ISO date, persisted alongside existing state. Yesterday's totals viewable; no charts.

Print view: a plain list of barcode / name / scoop / protein / kcal for the fridge.

## Step 2 — OFF pre-population

Given rows that carry a barcode but no macros, fetch `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`, read `product.nutriments.proteins_100g` and `energy-kcal_100g`, scale by `scoop_g / 100`, write into the row.

Constraints:
- Manual button per row, not automatic on load — the tool must work offline.
- Set a custom `User-Agent`; OFF asks reusers to identify their app.
- Values are user-editable after fetch and never overwrite a filled row without confirmation. OFF data is crowdsourced and label-rounded (the cashew figures are a 30 g panel scaled ×3.33, so ±10% on protein).
- Store-internal barcodes (Restricted Circulation Numbers, e.g. `00505154`) are not globally unique — treat a fetch miss or a name mismatch as expected, not an error state.

## Not in scope
Camera scanning. `BarcodeDetector` is Chrome-Android-only and adds a permission prompt per item; tap-to-log is fewer actions for a fixed rotation. Revisit only if the item list outgrows one screen.

## To start
Upload `protein-loadout.html` — it isn't in this project.