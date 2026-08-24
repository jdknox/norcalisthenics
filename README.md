# workout_recorder
> [!WARNING]
> ⚠️ **AI-gerenated Document:**

Small local workout tracker in plain HTML, CSS, and JavaScript.

## What it does

- logs workouts, exercises, and sets in one page
- supports straight sets, ladders, weighted sets, and timed sets
- runs a rest timer automatically
- lets you repair workout start/end times after the fact
- lets you edit the saved exercise library in Settings and export it as JS
- can store data locally in the browser, or through a local shared server
- exports plain text, CSV, and full backups

## Open it

Open [workout-recorder.html](workout-recorder.html) in a browser.

No build step is required.

If you only open the HTML file directly, the app uses browser storage. That is
fine for one browser on one machine, but it is not shared and does not update a
canonical data file on disk.

For shared local use, run the Python server and open the site through it. The
server should own the data file on disk so every browser sees the same workout
data.

## Files

- [workout-recorder.html](workout-recorder.html): page shell and CSS
- [workout-recorder.js](workout-recorder.js): app state, actions, storage, import/export, boot
- [workout-render.js](workout-render.js): main screen rendering
- [workout-sheets.js](workout-sheets.js): overlay sheets and sheet-only helpers
- [workout-exercises.js](workout-exercises.js): static exercise library and sample data
- [claude_changelog.md](claude_changelog.md): development history
- [AI_AGENT_SESSIONS.md](AI_AGENT_SESSIONS.md): AI-assisted work streams and context anchors

## Data

- direct-file use stores data in browser local storage
- shared use should store data through the local Python server
- the intended RPi/shared direction is to use the TSV backup format as the
  canonical data file
- full backups are text files produced by the app
- backup text format is meant for round-tripping, not for hand editing
- workout library defaults come from `workout-exercises.js`, but the editable saved library lives in browser storage

## Local server direction

Use Python for the local/RPi server unless there is a specific reason to keep a
compiled C daemon. Python's standard library can serve the files, disable
browser caching, and handle the simple data-file operations this app needs:

- `GET` returns the current TSV data file
- `PUT` or `POST` writes a new TSV body to a temporary file
- the previous TSV is rotated to a backup
- the temporary file is renamed into place atomically

The C server in [src/workout-server.c](src/workout-server.c) is optional
experimental work. It could eventually replace the Python server.

## Editing notes

- code style is procedural and intentionally old-school
- plain script tags, no modules
- `render` code lives in `workout-render.js`
- overlay form code lives in `workout-sheets.js`

## Repo notes

- `.codex` is ignored
- `backups/` currently holds sample backup files, not app code
- runtime data files such as `shared-storage.json` are ignored because they are
  machine-local user data, not source
