# Changelog
> [!WARNING]
> ⚠️ **AI-gerenated Document:**
> - all shipped code is hand-written except where noted

This file reconstructs the app's development history from two sources:

- Claude's earlier notes for the pre-git and early-git work
- the local git history from July 16, 2026 through July 28, 2026

For the earliest work, the exact day boundaries are approximate. Starting with the git-backed entries, the dates below are taken from the local commit history.

## 2026-07-11 — first build

- Built the initial workout app from the design doc.
- Added straight sets, ladders, weighted mode, timed mode, auto rest timer, clean/ugly/pain tags, clone-with-progression, local storage, and multiple export formats.
- Fixed the DONE button clipping off-screen on narrow rows.

## 2026-07-12 — calendar and date handling

- Added the calendar view with a month grid, trained-day markers, and a selected-day workout panel.
- Diagnosed the "wrong date" report as a preview-storage reset rather than a date-rewrite bug.
- Made the workout date editable.
- Switched to Sunday-start weeks.
- Standardized visible dates to ISO-8601 format.

## 2026-07-12 through 2026-07-15 — ring geometry and UI cleanup

- Worked through the ring body-angle model and the measurements needed to constrain it.
- Implemented the pushup calculator with rig/profile settings, anchor calibration, per-exercise geometry inputs, live angle readout, and export support.
- Verified the row formula and its non-monotonic behavior in foot distance.
- Changed geometry from an always-on field set to an opt-in dropdown.
- Changed the exercise picker from hard filtering to relevance sorting.
- Cleaned up the geometry wording and notation, including the Rr subscript presentation.

## 2026-07-16 — MVP import, procedural rewrite, and ladder fixes

Source anchor: commit `0645bce` (`Initialize with Claude's MVP and ChatGPT procedural rewrite`)

- Brought the Claude MVP and the procedural rewrite together into the repo.
- Adopted the procedural JavaScript style for the main recorder code.
- Reworked the shared pushup/row solver into explicit reachable, unreachable, and slack states.
- Split the stored body measurements into `shoulderPushup`, `shoulderRow`, and `arm`.
- Fixed phantom ladder rungs by separating rung position from rep target.
- Added custom rung syntax for non-regular ladders.
- Fixed CSV rung ordering and set ordering by walking logical ladder order and normalizing older data.
- Fixed the first-tap `+ rung` strict-mode failure.
- Preserved logged ladder history when editing future planned rungs.
- Turned the logged-rungs warning into a clearer dedicated notice.

## 2026-07-23 — procedural main file and backup/timing system

Source anchors:

- commit `d7696e9` (`Replace workout-recorder.html with the procedural recorder`)
- commit `a0c03b9` (`Add backup import and derived set timing`)

- Promoted the procedural version to become the main `workout-recorder.html`.
- Added full backup export/import using tab-delimited `[globals]`, `[workouts]`, `[exercises]`, and `[sets]` sections.
- Made backup restore merge into existing data instead of replacing everything.
- Added a countdown rest-timer display mode.
- Replaced `restActual` with raw `doneAt` timestamps.
- Derived set timing from inter-set gaps and rest targets instead of storing a misleading precomputed rest value.
- Added timing-derived export fields such as `rest_target`, `cycle_sec`, `work_sec`, and `work_quality`.
- Cleaned up backup/export field naming and stop-reason handling.

## 2026-07-24 — repo cleanup and backup controls in Settings

Source anchors:

- commit `b017ce8` (`ignore .codex`)
- commit `1e815da` (`Add backup controls to Settings`)

- Ignored the local `.codex` tool marker.
- Added backup export and backup-file restore controls directly to the Settings sheet.
- Added copy and download actions for Settings backups so full-state export was available without opening the workout export sheet.

## 2026-07-26 — workout start/end repair, duration display, and backup text round-tripping

Source anchors:

- commit `38b0384` (`Add workout time repair and duration summaries`)
- commit `a04a42a` (`Preserve escaped newlines in backup text fields`)

- Added a single `startedAt` workout timestamp and a `Begin Workout` action.
- Added workout duration in the workout header and in workout summary rows.
- Added a workout `...` menu with `Fix Times` and `Delete Workout`.
- Added manual repair for workout start/end date-times after the fact.
- Standardized the editable repair fields on ISO `YYYY-MM-DD` dates and 24-hour `HH:MM` times.
- Kept visible `began` display static in the workout header while moving editing into the repair overlay.
- Fixed backup text round-tripping for tabs, carriage returns, newlines, and backslashes by escaping them instead of flattening them to spaces.
- Restored the custom backup version marker `workout_recorder_backup\t26.0726.2015`.

## 2026-07-28 — file split, docs, library editor, and workout navigation polish

Source anchors:

- commit `2ae7de2` (`Split workout UI into render and sheet files`)
- commit `3a1b533` (`update changelog; add README; add backups`)
- commit `8beae12` (`fix README links`)
- commit `c328e3c` (`forgot to add warning`)
- commit `bc98b3d` (`Add editable exercise library and export tools`)
- commit `40240c0` (`Collapse workout cards and jump between logged days`)
- commit `457c17c` (`Add workout week and weekday header swatch`)

- Split the inline app script into separate files with plain script tags and no module system.
- Moved the static exercise and sample data into `workout-exercises.js`.
- Moved the main view rendering functions into `workout-render.js`.
- Moved overlay builders and sheet-specific helpers into `workout-sheets.js`.
- Kept the main app flow in `workout-recorder.js`.
- Reduced the size of the main app file so future edits can target a smaller file without changing runtime behavior.
- Added the first repo README and a git-backed changelog, then cleaned up the repo markdown links and warning block.
- Added an AI agent session map so future agents can find which prior work streams have context for the app.
- Added a Settings-based exercise library editor for the saved main exercise list.
- Expanded the library editor so each exercise can edit its full stored data, not just the title.
- Added JS export for the saved exercise library with copy and download actions.
- Pruned stale learned presets when the saved library is edited so removed names stop leaking into the picker.
- Made exercise rows in the library editor start collapsed.
- Made the Settings rigging/profile section collapsible.
- Made workout exercise cards start collapsed and added workout-level `show all` and `hide all` actions.
- Added previous/next logged-day navigation directly on the workout date row.
- Changed the home screen to default to the calendar tab.
- Added a workout-header week marker with Sunday-start `Wnn` plus highlighted `S M T W T F S`.
