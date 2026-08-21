# AI Agent Sessions
> [!WARNING]
> ⚠️ **AI-gerenated Document:**

This file records which AI-assisted work streams have useful context for this repo.

It does not store account credentials or transcript contents. It does store local session paths and ids so the relevant transcripts can be found later on this machine.

## Local Agent Stores

- Codex session index: `/home/knox/.codex/session_index.jsonl`
- Codex session transcripts: `/home/knox/.codex/sessions/`
- Codex repo config: `/home/knox/.codex/config.toml`, registered path `/home/knox/prj/tools/workout`
- Claude history index: `/home/knox/.claude/history.jsonl`
- Claude project transcripts, when present: `/home/knox/.claude/projects/`
- Claude session summaries, when present: `/home/knox/.claude/sessions/`

Use `grep -RIlE '/home/knox/prj/tools/workout|workout-recorder|workout_recorder' ~/.codex ~/.claude 2>/dev/null` to rediscover related local records.

## Actual Local Sessions

- Main Codex workout website session:
  - path: `/home/knox/.codex/sessions/2026/07/14/rollout-2026-07-14T20-52-19-019f63b0-828e-7621-87ae-1f5feb2f4a7b.jsonl`
  - session id: `019f63b0-828e-7621-87ae-1f5feb2f4a7b`
  - Codex index name: `Add HTML coding style guide`
  - cwd: `/home/knox/prj/tools/workout`
  - context: main workout app work through the procedural rewrite, file split, editable exercise library, workout navigation, week swatch, Sunday-start week numbering, and doc updates.

- Related Codex session, mostly tooling/sidebar troubleshooting:
  - path: `/home/knox/.codex/sessions/2026/07/14/rollout-2026-07-14T19-44-14-019f6372-2b1d-7c13-bd03-332b5c44b9bf.jsonl`
  - session id: `019f6372-2b1d-7c13-bd03-332b5c44b9bf`
  - cwd: `/home/knox/prj/tools/workout`
  - context: repository cwd matches this project, but the content is mostly Codex extension/sidebar troubleshooting rather than workout app implementation.

- Later Codex workout/server session:
  - path: `/home/knox/.codex/sessions/2026/07/28/rollout-2026-07-28T13-41-10-019faa3e-cd11-7683-9743-bc0f2b2a65ff.jsonl`
  - session id: `019faa3e-cd11-7683-9743-bc0f2b2a65ff`
  - Codex index name: `Assess Forgejo setup needs`
  - cwd: `/home/knox/prj/tools/workout`
  - context: later workout work around `shared-server.py`, `shared-storage.js`, cache-busting, and local shared storage.

- Current Codex session used to locate agent records:
  - path: `/home/knox/.codex/sessions/2026/08/21/rollout-2026-08-21T16-15-12-01a02664-7276-7282-b49b-c886a0971feb.jsonl`
  - session id: `01a02664-7276-7282-b49b-c886a0971feb`
  - Codex index name: `Find workout agent sessions`
  - cwd: `/home/knox/prj/tools/workout`
  - context: finding and documenting the local Claude/Codex session records for this repo.

- Claude direct history hit:
  - index path: `/home/knox/.claude/history.jsonl`
  - history line: `335`
  - session id: `df6a03d7-30e5-43a1-b8c1-eec1160770ef`
  - Claude project: `/p/blender/scripts`
  - prompt context: token-size estimate for `~/prj/tools/workout/workout-recorder-procedural.html`
  - transcript status: no matching transcript file was found under `/home/knox/.claude` during the August 21, 2026 search; only the history row appears to remain locally.

## Claude notes, pre-git through early git

- Main context: original app design, first MVP, calendar/date handling, ring geometry, and early UI cleanup.
- Best local source: [claude_changelog.md](claude_changelog.md).
- Commit anchor: `0645bce` (`Initialize with Claude's MVP and ChatGPT procedural rewrite`).
- Important context: the earliest day boundaries are reconstructed from Claude's notes, not exact git history.

## Codex procedural rewrite and main-file replacement

- Main context: converting the recorder into the current procedural JavaScript style.
- Best local sources: [workout-recorder.js](workout-recorder.js), [workout-render.js](workout-render.js), [workout-sheets.js](workout-sheets.js).
- Commit anchors:
  - `d7696e9` (`Replace workout-recorder.html with the procedural recorder`)
  - `a0c03b9` (`Add backup import and derived set timing`)
- Important context: code style intentionally favors plain script tags, flat functions, explicit loops, `let`, single quotes, and readable old-school JavaScript.

## Codex backup, timing, and Settings work

- Main context: backup import/export, derived timing, workout start/end repair, Settings backup controls, and escaped backup text.
- Best local sources: backup functions in [workout-recorder.js](workout-recorder.js) and the July 23-26 entries in [claude_changelog.md](claude_changelog.md).
- Commit anchors:
  - `1e815da` (`Add backup controls to Settings`)
  - `38b0384` (`Add workout time repair and duration summaries`)
  - `a04a42a` (`Preserve escaped newlines in backup text fields`)
- Important context: full backups are the round-trip format. Human-readable export may flatten text, but backups must preserve tabs, carriage returns, newlines, and backslashes.

## Codex file split and exercise-library work

- Main context: splitting the app into smaller JS files, moving static exercise data out, adding the saved exercise-library editor, and exporting the library as JS.
- Best local sources:
  - [workout-exercises.js](workout-exercises.js)
  - [workout-sheets.js](workout-sheets.js)
  - [workout-render.js](workout-render.js)
  - [workout-recorder.js](workout-recorder.js)
- Commit anchors:
  - `2ae7de2` (`Split workout UI into render and sheet files`)
  - `bc98b3d` (`Add editable exercise library and export tools`)
- Important context: `workout-exercises.js` is the checked-in default library. The edited exercise library lives in browser storage and can be exported back to JS from Settings.

## Codex workout navigation and compact workout UI

- Main context: collapsed workout exercise cards, show/hide all, previous/next logged-day navigation, calendar-by-default home view, and the workout header week marker.
- Best local sources: [workout-render.js](workout-render.js), date helpers in [workout-recorder.js](workout-recorder.js), and CSS in [workout-recorder.html](workout-recorder.html).
- Commit anchors:
  - `40240c0` (`Collapse workout cards and jump between logged days`)
  - `457c17c` (`Add workout week and weekday header swatch`)
- Important context: weeks are Sunday-start, and the workout date arrows jump between logged workout days rather than adjacent calendar dates.

## Current documentation pass

- Main context: documenting repo structure, changelog history, and agent context.
- Best local sources: [README.md](README.md), [claude_changelog.md](claude_changelog.md), and this file.
- Important context: keep the README short and high-level. Put detailed development history in the changelog and agent context here.
