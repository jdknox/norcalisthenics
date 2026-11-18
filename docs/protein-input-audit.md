# Protein input audit

Date: 2026-11-18. Source revision: `2cdf74c`.

Scope: `protein-loadout.html` and its storage adapter. Workout recorder and the Wii dashboard are excluded. Findings and line numbers below describe the audited revision; the repair results are recorded at the end.

## Findings

### 1. High: 16 field types replace the active editor on every input event

Every field below calls `renderPreservingFocus()`. That function calls `render()` at line 7747; `render()` replaces `#app.innerHTML` at line 6736, then rebuilds the print reference as well. The helper focuses a newly created field and restores its selection. It does not preserve the original editor, keyboard repeat, composition, or undo history.

The browser probe confirmed that the original input becomes disconnected after one edit in every listed case. These have the same underlying failure as the notes and Search bugs. Actual mobile symptoms depend on the keyboard and browser.

| Fields | Field types | Handler line | Immediate full-data save too? |
| --- | ---: | ---: | --- |
| Protein target and calorie target | 2 | 7868 | Yes |
| Bodyweight | 1 | 7899 | Yes |
| Loadout daily quantity, package units, and price | 3 | 8073 | Yes |
| Custom protein | 1 | 8003 | No; draft only |
| Group rename | 1 | 8034 | No; draft only |
| Add pantry item: scoop grams, protein, kcal | 3 | 8041 | No; draft only |
| Edit pantry item: barcode, scoop grams, protein, kcal | 4 | 8061 | No; draft only |
| Portion editor: grams | 1 | 7980 | No; draft only |

The group rename and edited barcode fields do not need any live dependent display updates. Custom protein only needs to update the estimated kcal field. The numeric editors need updates to their dependent previews and totals, rather than replacement of the form.

### 2. Medium: 10 field types immediately save the entire dataset

`save()` at line 5875 serializes `makeSavePayload()`, synchronously writes local storage and its unsynced flag, increments the revision, and calls `syncPendingChanges()`. It has no general debounce. Sync permits one request sequence at a time, but that does not debounce serialization or local writes.

| Fields | Field types | Handler line | Editor preserved during input? |
| --- | ---: | ---: | --- |
| Protein target, calorie target, bodyweight | 3 | 7868 | No |
| Loadout daily quantity, package units, price | 3 | 8073 | No |
| Calorie cut | 1 | 7888 | Yes |
| Steps, ebike minutes, ebike distance | 3 | 1381 | Yes |

These counts overlap finding 1: six field types have both problems. There are 20 distinct field types with at least one of these two problems.

Calorie cut and activity already demonstrate the desired approach to updating dependent displays in place. Their remaining issue is immediate persistence on every accepted edit. Notes already debounce saves for 400 ms and flush on blur and page lifecycle events.

### 3. Medium: asynchronous replies can remove an editor while it is being used

`lookupOFFForAddItem()` calls `render()` on both successful and unsuccessful replies at lines 2364 and 2373. A browser probe captured the lookup callback, focused the add-item name field, typed text, then delivered a simulated unsuccessful response. The name field was disconnected and lost focus.

This affects even fields whose own input handler is otherwise stable, including the newly fixed Search and notes fields if they are active when the reply arrives. An unsuccessful lookup should only update lookup status. A successful lookup should update the affected draft fields and previews without replacing the active editor or overwriting an edit made after the request began.

The bodyweight pull/push callbacks also call `render()` after network replies (functions at lines 5252 and 5315). This is the same source-level risk; those callbacks were inspected, not exercised with real storage requests.

### 4. Medium: the portion slider rebuilds the page on change

The range input's `input` handler uses `liveScalePreview()` and keeps the slider attached. Its `change` handler at line 8183 calls `render()`.

The browser probe confirmed that the slider survives `input` and is disconnected by `change`. Pointer dragging is protected until release, but keyboard adjustment can emit a change after each step, removing the focused control. Commit the slider draft and update dependent displays in place.

## Complete control inventory

“Preserved” below describes the control's own input handler. Finding 3 can still interrupt an otherwise stable control. Repeated food rows and recipe ingredient rows share the same handler and are counted as field types, rather than separate controls.

| Area | Controls | Input behavior | Persistence |
| --- | --- | --- | --- |
| Targets | g/day, kcal/day | Replaces editor | Immediate full save |
| Targets | Calorie cut | Preserved; nutrition summary replaced separately | Immediate full save |
| Bodyweight | Bodyweight | Replaces editor | Immediate full save |
| Loadout | Daily amount, package units, price | Replaces editor | Immediate full save |
| Logged entries | Notes and Custom names | Preserved while typing; label layout normalizes on blur | Debounced, with lifecycle flush |
| Custom | Protein | Replaces editor to update estimated kcal | Draft until `+` |
| Custom | Kcal, mass in grams | Preserved | Draft until `+` |
| Pantry | Search | Preserved; only pantry result rows replaced | No save |
| Pantry groups | Rename | Replaces editor | Draft until save |
| Add item | Barcode, name, brand, tags | Preserved; tags update suggestions; textareas resize | Draft until save |
| Add item | Scoop grams, protein, kcal | Replaces editor | Draft until save |
| Edit item | Name, brand, volume, tags | Preserved | Draft until save |
| Edit item | Barcode, scoop grams, protein, kcal | Replaces editor | Draft until save |
| Portion editor | Slider | Preserved during input; replaced on change | Draft until log |
| Portion editor | Grams | Replaces editor | Draft until log |
| Portion editor | Protein, kcal | Preserved | Draft until log |
| Recipe | Name, tags, serving grams, finished-weight override | Preserved; updates preview nodes and placeholders | Draft until explicit action |
| Recipe | Ingredient grams | Preserved; updates previews and pantry totals | Draft until explicit action |
| Recipe | Save modifications checkbox | Preserved | Draft flag |
| Water | Volume slider and numeric volume field | Preserved; update their paired control | Draft until log |
| Activity | Steps, ebike minutes, ebike distance | Preserved; updates summary nodes | Immediate full save |
| New mass event | Time, body mass, food mass, water-loss checkbox, anchor checkbox | Preserved | Draft until save |
| Edit mass event | Time, body mass, water volume, food mass, water-loss checkbox, anchor checkbox | Preserved | Draft until save |
| Temporary meals | Entry selection checkboxes | Preserved; only meal subtotals replaced on change | Session only |
| Import | Full-backup and mass-import textareas | Preserved; update pending import text | No save until apply |
| Import | Full-backup and mass-import file selectors | Reads selected file on change | No save until apply |
| Export | Full-backup textarea and three mass export textareas | Read-only; no typing handler | No input save |

No select elements or additional editable input families were found in the protein page. Macro-mode controls and other action buttons were followed where they open or change these forms; their intentional action-triggered renders are outside the per-keystroke count.

Recipe name and tag edits also recalculate both nutrition previews even though they do not change nutrition. This is unnecessary work, but the editor remains attached and no database save occurs. No timing evidence was collected to establish a user-visible delay there.

## Verification

- Inspected every generated input, textarea, input/change/focus handler, and the helpers they call.
- Ran isolated headless Chromium probes at a 390 × 844 window size across 16 form configurations: pantry, loadout, add/edit item, portion editor, rename, recipe, mass overview, three new-event variants, four event-edit variants, and meal selection.
- Checked 181 rendered input instances, covering 69 distinct selectors and 57 field types after collapsing repeated food rows. File selectors and read-only exports were inspected separately.
- Recorded whether each original DOM node stayed connected and focused, the number of full renders, and local JSON writes immediately after one input event. The 16 replacement types each triggered one full render; the 10 immediate-save types each triggered one local JSON write.
- Used synthetic input/change events and a captured lookup callback. Storage writes and sync were intercepted; user data was not changed. Physical mobile key repeat, keyboard composition, server latency, and performance with a large personal dataset were not measured.

## Repair order

1. Remove `renderPreservingFocus()` from all input handlers. Keep each active input attached and update only the totals, labels, paired values, and previews that depend on it.
2. Use a common delayed-save path for persistent field edits, retaining explicit immediate saves for completed actions. Flush pending edits on blur, backgrounding, pagehide, and before unload; preserve sync revision checks.
3. Replace network-completion page renders with updates to the relevant status and affected fields, protecting edits made after a request starts.
4. Keep the portion slider attached on change as well as input.
5. Add a field-family regression sweep asserting DOM identity, focus, and selection during repeated input, alongside save-count checks and asynchronous-response cases. Cursor restoration alone is insufficient.

The recurring causes are the shared full-page rendering helper and immediate-save default. Notes and Search now bypass those paths, but the remaining callers still inherit their behavior.

## Repair results, 2026-11-18

The repair plan is implemented in the working source:

- Removed `renderPreservingFocus()` and all of its input-handler callers. Targets, bodyweight, loadout rows, Custom protein, pantry forms, group rename, and portion grams now keep their editors attached.
- Added updates scoped to nutrition summaries, bodyweight ratios and averages, loadout row totals and costs, paired kcal fields, macro previews, and lookup-button visibility. Intermediate numeric text such as `12.` remains in the active field.
- Replaced the notes-only debounce with `scheduleInputSave()` / `flushPendingInputSave()`. All persistent field edits share a 400 ms pause, with immediate flush on blur, pagehide, backgrounding, and before unload. Completed actions still call `save()` directly. Pending edits advance the local revision immediately, so an older sync cannot acknowledge newer edits.
- Add-item and pantry-item lookup replies update status, untouched fields, and dependent displays without replacing forms. Draft identity, lookup IDs, and edit versions protect newer input. Barcode changes invalidate an older add-item lookup. Lookup debug output remains available.
- Bodyweight pull/push replies update status and displays in place and retain edits made after the request began. A successful pull fills an untouched weight field without disrupting an unrelated active editor.
- The portion slider commits on `change` without replacing the slider or its form.
- Recipe name and tag edits no longer recalculate nutrition previews.

`tests/protein-inputs.html` checks all 181 audited instances at mobile and desktop window sizes. Each receives repeated input events, including a composition event and partial decimal text. Assertions cover node identity, focus, caret, raw values, zero page renders, and zero immediate local JSON writes. It also checks dependent displays, asynchronous lookup success/failure, edits during lookup, barcode changes, slider changes, save debounce/reset, explicit saves, and lifecycle flushes.

`tests/protein-storage-inputs.html` exercises the real storage adapter and existing Python backend with temporary data. It checks bodyweight pull/push races, newer input during an in-flight sync, final shared values, and a successful pull while Search remains focused. Existing notes, Search, independent-target, and version checks also pass. No physical mobile keyboard was tested.

### Running the browser checks

Serve the checkout with a static HTTP server and open `tests/protein-inputs.html`, `tests/protein-notes.html`, `tests/protein-search.html`, and `tests/protein-independent-targets.html` in a browser. The field tests intercept storage and disable startup loading.

The storage integration test requires an isolated server on `127.0.0.1:8766`; it writes a unique regression key. From the repository root, prepare a temporary root and run the existing backend there:

```sh
test_root=$(mktemp -d /tmp/protein-input-test.XXXXXX)
mkdir "$test_root/data" "$test_root/tests"
cp protein-loadout.html protein.css protein-shared-storage.js shared-server.py "$test_root/"
cp tests/protein-storage-inputs.html "$test_root/tests/"
ln -s "$PWD/.git" "$test_root/.git"
cd "$test_root"
python3 -c "import http.server, runpy; backend = runpy.run_path('shared-server.py'); http.server.ThreadingHTTPServer(('127.0.0.1', 8766), backend['WorkoutHandler']).serve_forever()"
```

Open `http://127.0.0.1:8766/tests/protein-storage-inputs.html`. The `.git` link supplies read-only version metadata; the backend writes its data under the temporary root.
