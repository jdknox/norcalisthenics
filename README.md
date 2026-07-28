# workout_recorder
> [!WARNING]
> ⚠️ **AI-gerenated Document:**

Small local workout tracker in plain HTML, CSS, and JavaScript.

## What it does

- logs workouts, exercises, and sets in one page
- supports straight sets, ladders, weighted sets, and timed sets
- runs a rest timer automatically
- stores data locally in the browser
- exports plain text, CSV, and full backups

## Open it

Open [workout-recorder.html](workout-recorder.html) in a browser.

No build step. No server required.

## Files

- [workout-recorder.html](workout-recorder.html): page shell and CSS
- [workout-recorder.js](workout-recorder.js): app state, actions, storage, import/export, boot
- [workout-render.js](workout-render.js): main screen rendering
- [workout-sheets.js](workout-sheets.js): overlay sheets and sheet-only helpers
- [workout-exercises.js](workout-exercises.js): static exercise library and sample data
- [claude_changelog.md](claude_changelog.md): development history

## Data

- normal use stores data in browser local storage
- full backups are text files produced by the app
- backup text format is meant for round-tripping, not for hand editing

## Editing notes

- code style is procedural and intentionally old-school
- plain script tags, no modules
- `render` code lives in `workout-render.js`
- overlay form code lives in `workout-sheets.js`

## Repo notes

- `.codex` is ignored
- `backups/` currently holds sample backup files, not app code
