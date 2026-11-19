# Pantry favorites

Tap the star beside an existing food or saved recipe to favorite or unfavorite it. Search matches sort first, followed by selected group tags, then favorites. Within each group, matching items precede favorites, followed by alphabetical order. Flat view uses the same search, selected-tag, and favorite priorities before its ratio or alphabetical ordering. Archived items remain in the archived section.

Favorite state lives separately from item data, keyed by the existing item key. Each change records a timestamp, including removals. Sync and merge imports keep the newer change per item; equal timestamps favor removal. Favorites are included in saved JSON and an optional `[favorites]` TSV section. Replacing from an older backup without favorites clears the favorite state.

Star changes update existing buttons and reorder existing row bundles. The focused row stays attached while surrounding rows move, preserving open editors, raw text, and selection.

## Verification

- `tests/protein-favorites.html`: assertions covering grouping, flat sorting, search and selected-tag priority, recipes in multiple groups, archived and collapsed groups, editor and keyboard focus, exact row order, stale sync data, backups/imports, and existing logging/portion actions.
- `tests/protein-favorites-storage.html`: actual shared-storage requests, a forced 409 retry, separate device changes, remote removals, editor preservation, local cache, and offline reload.
- Existing input, Search, and input-storage regressions also pass at a 390 × 844 browser window size. Physical mobile keyboard behavior remains for device testing.

Serve the first test with a static HTTP server. For the storage test, use the isolated backend setup in [protein-input-audit.md](protein-input-audit.md#running-the-browser-checks), copying `tests/protein-favorites-storage.html` into its temporary `tests` directory too. Open `http://127.0.0.1:8766/tests/protein-favorites-storage.html`; it writes a unique test key into temporary storage.
