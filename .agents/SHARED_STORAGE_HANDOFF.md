# Shared Storage Handoff

Date: 2026-08-21

## Goal

This branch of work adds a local shared-storage mode for the workout app so multiple browser sessions can use one shared data file on disk instead of only per-browser `localStorage`.

## Canonical files

Use these files, not the older `workout-shared-*` names:

- `shared-server.py`
- `shared-storage.js`
- `shared-storage.json`
- `workout-recorder.html`
- `workout-recorder.js`
- `workout-render.js`

There are stale older files in git status:

- `workout-shared-server.py`
- `workout-shared-storage.js`

Those were the earlier names before the files were simplified/renamed. They should be treated as obsolete.

## Current architecture

### Browser side

`shared-storage.js` installs `window.storage` with:

- `get(key)` -> `GET /api/storage?key=...`
- `set(key, value)` -> `POST /api/storage?key=...`

It also tries to report storage status with:

- `storage: checking`
- `storage: server`
- `storage: browser fallback`

### App side

`workout-recorder.js` still uses its existing storage abstraction:

- primary path: `window.storage`
- fallback path: browser `localStorage`

Important key:

- `storage_key = 'wr:data:v1'`

The wrapper key was kept intentionally for future format/version changes.

### Server side

`shared-server.py`:

- serves `workout-recorder.html` at `/`
- serves the local JS/CSS/assets as static files
- exposes `/api/storage`
- persists data to `shared-storage.json`

The server was changed so the on-disk file stores real JSON objects instead of a JSON string nested inside JSON.

Current disk shape is intended to be:

```json
{
  "wr:data:v1": {
    "workouts": [],
    "settings": {},
    "rig": {},
    "profile": {}
  }
}
```

not:

```json
{
  "wr:data:v1": "{\"workouts\":[]}"
}
```

## HTML/script order

Important load order at the bottom of `workout-recorder.html`:

1. `shared-storage.js`
2. `workout-exercises.js`
3. `workout-sheets.js`
4. `workout-render.js`
5. `workout-recorder.js`

This matters because earlier the adapter loaded too late and the app booted into `localStorage` fallback on startup.

## Storage status UI

A status pill was added in the top bar.

Relevant code:

- markup/CSS in `workout-recorder.html`
- rendering in `workout-render.js`
- status state updates in `shared-storage.js` and `workout-recorder.js`

Intent:

- unobtrusive normal state when server storage works
- visible warning when browser fallback is used

## Anti-cache work already attempted

The app had a stubborn issue where the pill stayed on `CHECKING` unless browser cache was manually disabled.

Work already done:

- `shared-server.py` now sends aggressive no-cache headers:
  - `Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private`
  - `Pragma: no-cache`
  - `Expires: 0`
  - `Surrogate-Control: no-store`
  - `Vary: *`
- HTML includes no-cache meta tags
- `/` and `/workout-recorder.html` are served dynamically, not as a raw static file
- every HTML response rewrites script URLs with a fresh `?v=<nonce>` query
- HTML response also sends `Clear-Site-Data: "cache"`

The purpose was to make stale JS practically impossible during testing.

## Current unresolved issue

Even after the anti-cache work, the user reported:

- site behavior mostly works
- shared storage itself appears to work
- but the storage-status pill can still remain on `CHECKING` forever unless browser cache is manually hard-disabled

That means one of these is still true:

1. the browser is still somehow executing stale JS despite the anti-cache work
2. the status update path is being skipped/hung even while storage reads and writes succeed
3. the status pill is rendering from one code path while the actual storage requests are coming from another cached/runtime state

This was not fully resolved in the current chat.

## Important observations from previous debugging

- At one point the app clearly ran while the server was down because the app silently fell back to browser `localStorage`.
- The fallback behavior is still present by design.
- The server process can be running from VS Code while the browser tab continues to show behavior that does not match the latest edited files, which is why cache became a major suspect.
- `shared-storage.json` is now readable and no longer double-encoded.

## How to run

From the repo root:

```bash
python3 shared-server.py
```

Then open:

```text
http://localhost:8010/
```

## What a new chat should verify first

1. Confirm the browser is loading the current `shared-storage.js`, `workout-render.js`, and `workout-recorder.js` from the live server response.
2. Confirm the `GET /api/storage?key=wr:data:v1` request resolves successfully in the browser network panel.
3. Confirm whether `notifyStorageStatus(...)` in `shared-storage.js` actually runs on success/failure in the live browser runtime.
4. If storage requests succeed but the pill still says `checking`, instrument the runtime directly rather than assuming cache again.

## Current repo state notes

As of this handoff:

- `shared-server.py` and `shared-storage.js` are untracked new files
- `shared-storage.json` is added/modified
- `workout-recorder.html`, `workout-recorder.js`, and `workout-render.js` are modified
- `README.md` and `claude_changelog.md` were already modified in the worktree and were not part of this storage handoff work

