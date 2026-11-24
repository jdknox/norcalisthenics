# Live pantry drink-water review

Run from the repository root:

```sh
python3 src/protein-drink-water.py > /tmp/protein-drink-water.json
python3 src/protein-drink-water.py --format tsv > /tmp/protein-drink-water.tsv
```

The helper uses the existing `rpi` SSH host and a GET to the Pi's loopback storage
API on port 8010, key `protein-loadout:v1`. It does not read the checkout's
database, send updates, deploy code, or touch the workout storage. SSH, HTTP,
or malformed-response failures stop the command rather than substituting local
data. JSON records the live revision and fetch time; TSV is for visual review.

`candidates` contains simple-drink possibilities; `deferred` contains milk,
cream, protein, concentrated mixes and recipes that need separate work. Archived
items are skipped. This first batch includes juice as requested, even when its
actual water content is substantially below 100%. It does not use a numerical
"nearly all water" cutoff.

The small reference table is [protein-drink-water-estimates.tsv](../data/protein-drink-water-estimates.tsv).
Sources were checked on 2026-11-23. Percentages are grams of water per 100 grams
of finished drink. Apple juice is about 88.24%, not 99.6%; dissolved sugar is
part of the remaining mass. Serving water is `scoop_g * water_percent / 100`.
The report retains the reference precision in JSON and shows one decimal in TSV.

References are generic USDA composition estimates, not manufacturer measurements
of the user's exact products. For example, canned carrot juice is an explicit
proxy for Lakewood and Barsotti juice. ITO EN confirms its Bold green tea contains
purified water, green tea and ascorbic acid; the proposed percentage comes from
the generic unsweetened bottled green-tea reference. Plain Water uses an explicit
100% operational estimate that ignores trace minerals.

Estimates match reviewed item IDs plus their exact name, brand and barcode.
Renamed or replaced products and new drinks stay unestimated until reviewed.
Recipes never receive a generic drink estimate: the user's Barley tea contains
protein powder and soy milk, so it is not equivalent to a plain barley infusion.
Existing water percentages remain visible in the report and are never changed.

No apply/write mode exists. Before implementing one, resolve pantry water-field
merging between devices; the server's revision check alone cannot prevent a
stale browser from later restoring its older item values.

Regression checks:

```sh
python3 tests/protein-drink-water.py
```
