'use strict';

/*
> [!WARNING]
> ⚠️ **AI-gerenated Code:**
*/

/* ======== pure helpers ======== */
/* Procedural helpers: explicit loops, direct data flow, no hidden pipelines.
   Style target: snake_case variables, camelCase functions, old-school syntax.
*/
let month_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function uid()
{
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(value)
{
  let text = String(value == null ? '' : value);
  let out = '';
  let i;
  let ch;

  for (i = 0; i < text.length; ++i)
  {
    ch = text.charAt(i);

    switch (ch)
    {
      case '&':
        out += '&amp;';
        break;

      case '<':
        out += '&lt;';
        break;

      case '>':
        out += '&gt;';
        break;

      case '"':
        out += '&quot;';
        break;

      case "'":
        out += '&#39;';
        break;

      default:
        out += ch;
        break;
    }
  }

  return out;
}

function fmtRest(sec)
{
  let whole = Math.max(0, Math.round(sec || 0));
  let mins = Math.floor(whole/60);
  let secs = whole % 60;

  return mins + ':' + String(secs).padStart(2, '0');
}

function parseRest(value)
{
  let text;
  let parts;
  let mins;
  let secs;
  let num;

  if (value == null)
  {
    return null;
  }

  text = String(value).trim();
  if (!text)
  {
    return null;
  }

  if (text.indexOf(':') >= 0)
  {
    parts = text.split(':');
    mins = parseInt(parts[0], 10) || 0;
    secs = parseInt(parts[1], 10) || 0;
    return mins*60 + secs;
  }

  num = parseFloat(text);
  if (isNaN(num))
  {
    return null;
  }

  return Math.round(num);
}

/* "8/8/8", "8, 8, 8", "15x8, 10x12" -> [{ reps, load? }] */
function parseTargets(value)
{
  let items;
  let out = [];
  let i;
  let text;
  let match;
  let reps;

  if (!value)
  {
    return out;
  }

  items = String(value).split(/[\/,]+/);

  for (i = 0; i < items.length; ++i)
  {
    text = items[i].trim();
    if (!text)
    {
      continue;
    }

    match = text.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+)$/i);
    if (match)
    {
      out.push({
        reps: parseInt(match[2], 10),
        load: parseFloat(match[1])
      });
      continue;
    }

    reps = parseInt(text, 10);
    if (!isNaN(reps))
    {
      out.push({ reps: reps });
    }
  }

  return out;
}

/* "3 3 2" or "3/3/2" -> [3, 3, 2] */
function parseTops(value)
{
  let items;
  let out = [];
  let i;
  let num;

  if (!value)
  {
    return out;
  }

  items = String(value).split(/[\s\/,]+/);

  for (i = 0; i < items.length; ++i)
  {
    num = parseInt(items[i], 10);
    if (num > 0)
    {
      out.push(num);
    }
  }

  return out;
}

/* ladders as explicit rung lists — the rungs ARE the rep targets, so they can be
   arbitrary (1,2,4,5) rather than forced to 1..top.
     "3 3 2"                  -> [[1,2,3],[1,2,3],[1,2]]   tops shorthand
     "1,2,4,5 / 1,2,3"        -> [[1,2,4,5],[1,2,3]]       explicit
   a string containing ',' or '/' is explicit; anything else is the shorthand. */
function parseLadders(value)
{
  let out = [];
  let text;
  let groups;
  let parts;
  let rungs;
  let tops;
  let i;
  let j;
  let num;

  if (!value)
  {
    return out;
  }

  text = String(value);

  if (text.indexOf(',') < 0 && text.indexOf('/') < 0)
  {
    tops = parseTops(text);
    for (i = 0; i < tops.length; ++i)
    {
      rungs = [];
      for (j = 1; j <= tops[i]; ++j)
      {
        rungs.push(j);
      }
      out.push(rungs);
    }
    return out;
  }

  groups = text.split('/');
  for (i = 0; i < groups.length; ++i)
  {
    parts = groups[i].split(/[\s,]+/);
    rungs = [];

    for (j = 0; j < parts.length; ++j)
    {
      num = parseInt(parts[j], 10);
      if (num > 0)
      {
        rungs.push(num);
      }
    }

    if (rungs.length)
    {
      out.push(rungs);
    }
  }

  return out;
}

/* a ladder is "regular" when its rungs are exactly 1..top */
function laddersRegular(ladder_rungs)
{
  let i;
  let j;
  let rungs;

  for (i = 0; i < ladder_rungs.length; ++i)
  {
    rungs = ladder_rungs[i];
    for (j = 0; j < rungs.length; ++j)
    {
      if (rungs[j] != j + 1)
      {
        return false;
      }
    }
  }

  return true;
}

/* serialize for the edit field. regular ladders keep the familiar "3 3 2"
   shorthand (which always round-trips); custom rung lists round-trip
   explicitly so nothing gets silently regenerated. */
function laddersLabel(ladder_rungs)
{
  let parts = [];
  let text;
  let i;

  if (!ladder_rungs.length)
  {
    return '';
  }

  if (laddersRegular(ladder_rungs))
  {
    for (i = 0; i < ladder_rungs.length; ++i)
    {
      parts.push(ladder_rungs[i].length);
    }
    return parts.join(' ');
  }

  for (i = 0; i < ladder_rungs.length; ++i)
  {
    parts.push(ladder_rungs[i].join(','));
  }
  text = parts.join(' / ');

  /* a lone custom rung ("5") would read back as a top; force explicit parsing */
  if (text.indexOf(',') < 0 && text.indexOf('/') < 0)
  {
    text = text + ' /';
  }

  return text;
}

/* human-facing form: "3 / 3 / 2" when regular, "1·2·4·5 / 1·2·3" when custom */
function laddersDisplay(ladder_rungs)
{
  let parts = [];
  let i;

  if (laddersRegular(ladder_rungs))
  {
    for (i = 0; i < ladder_rungs.length; ++i)
    {
      parts.push(ladder_rungs[i].length);
    }
    return parts.join(' / ');
  }

  for (i = 0; i < ladder_rungs.length; ++i)
  {
    parts.push(ladder_rungs[i].join('·'));
  }

  return parts.join(' / ');
}

function dateHeading(iso)
{
  return iso;
}

function todayISO()
{
  let d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function isoOf(year, month, day)
{
  return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function fmtClockTs(value)
{
  let d;

  if (value == null)
  {
    return '';
  }

  d = new Date(value);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function fmtDateTime(value)
{
  let d;

  if (value == null)
  {
    return '';
  }

  d = new Date(value);
  return d.getFullYear()
    + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0')
    + ' ' + String(d.getHours()).padStart(2, '0')
    + ':' + String(d.getMinutes()).padStart(2, '0');
}

function isoDateOfTimestamp(value)
{
  let d;

  if (value == null)
  {
    return '';
  }

  d = new Date(value);
  return d.getFullYear()
    + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}

function isISODate(iso_date)
{
  let parts;
  let year;
  let month;
  let day;
  let d;

  if (!iso_date)
  {
    return false;
  }

  parts = iso_date.split('-');
  if (parts.length != 3)
  {
    return false;
  }

  year = parseInt(parts[0], 10);
  month = parseInt(parts[1], 10);
  day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day))
  {
    return false;
  }

  d = new Date(year, month - 1, day);
  return isoDateOfTimestamp(d.getTime()) == iso_date;
}

function timestampOfDateTime(iso_date, hhmm)
{
  let date_parts;
  let time_parts;
  let year;
  let month;
  let day;
  let hours;
  let mins;

  if (!iso_date || !hhmm)
  {
    return null;
  }
  if (!isISODate(iso_date))
  {
    return null;
  }

  date_parts = iso_date.split('-');
  time_parts = hhmm.split(':');
  if (date_parts.length != 3 || time_parts.length != 2)
  {
    return null;
  }

  year = parseInt(date_parts[0], 10);
  month = parseInt(date_parts[1], 10);
  day = parseInt(date_parts[2], 10);
  hours = parseInt(time_parts[0], 10);
  mins = parseInt(time_parts[1], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(mins))
  {
    return null;
  }
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59)
  {
    return null;
  }

  return new Date(year, month - 1, day, hours, mins, 0, 0).getTime();
}

function fmtElapsedHM(total_seconds)
{
  let whole;
  let hours;
  let mins;

  if (total_seconds == null)
  {
    return '--:--';
  }

  whole = Math.max(0, Math.floor(total_seconds));
  hours = Math.floor(whole/3600);
  mins = Math.floor((whole % 3600)/60);
  return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
}

function workoutDurationSeconds(workout)
{
  let end_time;

  if (!workout || workout.startedAt == null)
  {
    return null;
  }

  end_time = workout.finishedAt != null ? workout.finishedAt : Date.now();
  return Math.max(0, Math.floor((end_time - workout.startedAt)/1000));
}

function workoutDurationLabel(workout)
{
  return fmtElapsedHM(workoutDurationSeconds(workout));
}

function fmtSummaryDuration(total_seconds)
{
  let whole;
  let hours;
  let mins;

  if (total_seconds == null)
  {
    return '';
  }

  whole = Math.max(0, Math.floor(total_seconds));
  hours = Math.floor(whole/3600);
  mins = Math.floor((whole % 3600)/60);
  if (hours > 0)
  {
    return hours + 'h' + String(mins).padStart(2, '0') + 'm';
  }

  return mins + 'm';
}

function monthName(month)
{
  return month_names[month];
}

function monthCells(year, month)
{
  let start_offset = new Date(year, month, 1).getDay();
  let days_in_month = new Date(year, month + 1, 0).getDate();
  let cells = [];
  let i;
  let day;

  for (i = 0; i < start_offset; ++i)
  {
    cells.push(null);
  }

  for (day = 1; day <= days_in_month; ++day)
  {
    cells.push(day);
  }

  while (cells.length % 7)
  {
    cells.push(null);
  }

  return cells;
}

function workoutsByDate(workouts)
{
  let map = {};
  let i;
  let workout;

  for (i = 0; i < workouts.length; ++i)
  {
    workout = workouts[i];
    if (!map[workout.date])
    {
      map[workout.date] = [];
    }
    map[workout.date].push(workout);
  }

  return map;
}

function workoutSummary(workout)
{
  let set_count = 0;
  let duration_text;
  let out;
  let i;
  let j;

  for (i = 0; i < workout.exercises.length; ++i)
  {
    for (j = 0; j < workout.exercises[i].sets.length; ++j)
    {
      if (isDone(workout.exercises[i].sets[j]))
      {
        ++set_count;
      }
    }
  }

  duration_text = fmtSummaryDuration(workoutDurationSeconds(workout));
  out = workout.exercises.length + (workout.exercises.length == 1 ? ' exercise' : ' exercises') +
    ' · ' + set_count + (set_count == 1 ? ' set' : ' sets');
  if (duration_text)
  {
    out += ' · ' + duration_text;
  }

  return out;
}

function isDone(set)
{
  return set.status == 'done_clean' || set.status == 'done_ugly' || set.status == 'pain';
}

function isPerformed(set)
{
  return isDone(set) || set.status == 'failed' || set.status == 'skipped';
}

function laddersOf(ex)
{
  let map = {};
  let keys;
  let ladders = [];
  let i;
  let ladderIndex;
  let key;

  for (i = 0; i < ex.sets.length; ++i)
  {
    ladderIndex = ex.sets[i].ladderIndex || 1;
    if (!map[ladderIndex])
    {
      map[ladderIndex] = [];
    }
    map[ladderIndex].push(ex.sets[i]);
  }

  keys = Object.keys(map);
  keys.sort(function(a, b)
  {
    return Number(a) - Number(b);
  });

  for (i = 0; i < keys.length; ++i)
  {
    key = keys[i];
    map[key].sort(function(a, b)
    {
      return (a.rungIndex || 0) - (b.rungIndex || 0);
    });
    ladders.push({
      idx: Number(key),
      sets: map[key]
    });
  }

  return ladders;
}

/* the rep targets of each ladder, in rung order: [[1,2,4,5],[1,2,3]] */
function rungsOf(ex)
{
  let ladders = laddersOf(ex);
  let out = [];
  let rungs;
  let value;
  let i;
  let j;

  for (i = 0; i < ladders.length; ++i)
  {
    rungs = [];
    for (j = 0; j < ladders[i].sets.length; ++j)
    {
      value = ladders[i].sets[j].target;
      if (value == null)
      {
        value = ladders[i].sets[j].reps;
      }
      rungs.push(value || 0);
    }
    out.push(rungs);
  }

  return out;
}

function topsOf(ex)
{
  let rung_lists = rungsOf(ex);
  let tops = [];
  let top;
  let i;
  let j;

  for (i = 0; i < rung_lists.length; ++i)
  {
    top = 0;
    for (j = 0; j < rung_lists[i].length; ++j)
    {
      if (rung_lists[i][j] > top)
      {
        top = rung_lists[i][j];
      }
    }
    tops.push(top);
  }

  return tops;
}

/* ladderIndex and rungIndex are ordering keys only — the rep count lives in
   target. deletes and the old max+1 add-rung could leave gaps (1,2,3,5,6),
   which is what made rung_index look wrong in the CSV. renumber by sorted
   position; order is preserved, so this is safe to run on load. */
function normalizeLadders(ex)
{
  let ladders;
  let i;
  let j;

  if (ex.mode != 'ladder')
  {
    return;
  }

  ladders = laddersOf(ex);

  for (i = 0; i < ladders.length; ++i)
  {
    for (j = 0; j < ladders[i].sets.length; ++j)
    {
      ladders[i].sets[j].ladderIndex = i + 1;
      ladders[i].sets[j].rungIndex = j + 1;
    }
  }
}

/* sets in the order they are actually performed — ladders in order, rungs in
   rung order — each tagged with its 1-based position. exports walk this instead
   of the raw insertion-ordered array. */
function orderedSetsOf(ex)
{
  let out = [];
  let ladders;
  let i;
  let j;

  if (ex.mode != 'ladder')
  {
    for (i = 0; i < ex.sets.length; ++i)
    {
      out.push({ set: ex.sets[i], ladder_index: null, rung_pos: null });
    }
    return out;
  }

  ladders = laddersOf(ex);

  for (i = 0; i < ladders.length; ++i)
  {
    for (j = 0; j < ladders[i].sets.length; ++j)
    {
      out.push({ set: ladders[i].sets[j], ladder_index: ladders[i].idx, rung_pos: j + 1 });
    }
  }

  return out;
}

function performedSetsOf(ex)
{
  let out = [];
  let i;

  for (i = 0; i < ex.sets.length; ++i)
  {
    if (isPerformed(ex.sets[i]))
    {
      out.push(ex.sets[i]);
    }
  }

  return out;
}

/* progression suggestions — transparent rules from the design doc */
function suggestForExercise(ex)
{
  let performed = performedSetsOf(ex);
  let any_pain = !!ex.stopped;
  let any_ugly = false;
  let any_fail = false;
  let i;
  let tops;
  let rung_lists;
  let next_ladders;
  let rungs;
  let complete;
  let next;
  let bumped;
  let base_sets;
  let targets = [];
  let all_clean;

  for (i = 0; i < performed.length; ++i)
  {
    if (performed[i].status == 'pain')
    {
      any_pain = true;
    }
    else if (performed[i].status == 'done_ugly')
    {
      any_ugly = true;
    }
    else if (performed[i].status == 'failed' || performed[i].status == 'skipped')
    {
      any_fail = true;
    }
  }

  if (ex.mode == 'ladder')
  {
    rung_lists = rungsOf(ex);
    if (!rung_lists.length)
    {
      rung_lists = [[1]];
    }
    tops = topsOf(ex);
    if (!tops.length)
    {
      tops = [1];
    }

    if (any_pain)
    {
      return { kind: 'ladder', ladders: rung_lists, reason: 'pain — do not progress; consider an easier variation', warn: true };
    }

    complete = performed.length > 0;
    for (i = 0; i < ex.sets.length && complete; ++i)
    {
      if (ex.sets[i].status != 'done_clean')
      {
        complete = false;
      }
    }

    if (!complete)
    {
      return {
        kind: 'ladder',
        ladders: rung_lists,
        reason: performed.length
          ? 'repeat — ' + (any_fail ? 'failed/skipped rung' : any_ugly ? 'ugly reps' : 'partial ladder')
          : 'no data yet — same target'
      };
    }

    next = tops.slice();
    bumped = false;

    for (i = 1; i < next.length; ++i)
    {
      if (next[i] < next[0])
      {
        ++next[i];
        bumped = true;
        break;
      }
    }

    if (!bumped)
    {
      ++next[0];
    }

    /* apply the bump by APPENDING one rung at the new top. for a regular ladder
       this reproduces the old 1..top rebuild exactly; for a custom one it keeps
       the existing rungs untouched instead of regenerating them. */
    next_ladders = [];
    for (i = 0; i < rung_lists.length; ++i)
    {
      rungs = rung_lists[i].slice();
      if (next[i] > tops[i])
      {
        rungs.push(next[i]);
      }
      next_ladders.push(rungs);
    }

    return { kind: 'ladder', ladders: next_ladders, reason: 'all rungs clean — +1 rung' };
  }

  base_sets = performed.length ? performed : ex.sets;
  for (i = 0; i < base_sets.length; ++i)
  {
    targets.push({
      reps: (base_sets[i].target != null ? base_sets[i].target : base_sets[i].reps) || 0,
      load: base_sets[i].load
    });
  }

  if (!targets.length)
  {
    targets.push({ reps: 0 });
  }

  if (any_pain)
  {
    return { kind: 'sets', targets: targets, reason: 'pain — do not progress; consider an easier variation or less volume', warn: true };
  }

  if (any_ugly || any_fail)
  {
    return {
      kind: 'sets',
      targets: targets,
      reason: 'repeat same target — ' + (any_ugly ? 'ugly reps last time' : 'failed/skipped set')
    };
  }

  all_clean = performed.length > 0;
  for (i = 0; i < performed.length && all_clean; ++i)
  {
    if (performed[i].status != 'done_clean' || (performed[i].reps || 0) < (performed[i].target || 0))
    {
      all_clean = false;
    }
  }

  if (all_clean)
  {
    targets = targets.slice();
    targets[0] = { reps: targets[0].reps + 1, load: targets[0].load };
    return { kind: 'sets', targets: targets, reason: 'all sets clean — +1 rep on first set' };
  }

  return { kind: 'sets', targets: targets, reason: performed.length ? 'repeat same target' : 'no data yet — same target' };
}

function targetsLabel(suggestion)
{
  let parts = [];
  let i;

  if (suggestion.kind == 'ladder')
  {
    return 'ladders ' + laddersDisplay(suggestion.ladders);
  }

  for (i = 0; i < suggestion.targets.length; ++i)
  {
    parts.push((suggestion.targets[i].load != null ? suggestion.targets[i].load + 'x' : '') + suggestion.targets[i].reps);
  }

  return parts.join(' / ');
}

/* ---------- derived timings ----------

   doneAt is the only raw fact we record: the moment DONE was tapped. everything
   else follows by subtraction, so nothing is cached and a corrected timestamp
   re-derives cleanly.

     cycle(N)  = doneAt(N+1) - doneAt(N)      the whole gap between two taps
     work(N+1) = cycle(N) - restTarget(N)     what is left after the intended rest

   note WHICH set each belongs to: the rest that follows set N is restTarget(N),
   so subtracting it from that gap leaves the work of set N+1, not of set N. the
   first performed set has no predecessor and therefore no derived work.

   this leans on rest_actual ~= rest_target — i.e. that you start moving at the
   beep. two ways that breaks, each reported distinctly rather than as a number:
   'early' (you went before the beep, so work comes out <= 0) and 'lingered' (you
   rested well past it, so the surplus inflates work past any real set). a TIMED
   set needs none of this — its duration is the logged value, so work is exact
   and rest becomes the exact remainder. */
/* a single set that ran longer than this is not a set — it means the rest-target
   assumption broke, not that you held a five-minute rep */
const MAX_SET_SECONDS = 180;

function setTimings(ex)
{
  let ordered = orderedSetsOf(ex);
  let out = {};
  let prev = null;
  let set;
  let cycle;
  let work;
  let exact;
  let status;
  let i;

  for (i = 0; i < ordered.length; ++i)
  {
    set = ordered[i].set;

    if (!isPerformed(set) || set.doneAt == null)
    {
      continue;
    }

    if (prev != null)
    {
      cycle = Math.round((set.doneAt - prev.doneAt)/1000);

      /* a timed set already RECORDS its duration — no need to infer one, and no
         assumption to break. rest is then the exact remainder. */
      exact = ex.mode == 'timed' && set.reps != null;
      work = exact ? set.reps : cycle - (prev.restTarget || 0);

      if (exact)
      {
        status = 'exact';
      }
      else if (work <= 0)
      {
        status = 'early';        /* started before the beep — rested less than target */
      }
      else if (work > MAX_SET_SECONDS)
      {
        status = 'lingered';     /* rested well past the beep; the surplus is not work */
      }
      else
      {
        status = 'estimate';
      }

      out[set.id] = {
        cycle: cycle,
        work: work,
        rest: exact ? cycle - work : (prev.restTarget || 0),
        rest_target: prev.restTarget || 0,
        status: status
      };
    }

    prev = set;
  }

  return out;
}

/* short durations read better as seconds than as 0:14 */
function fmtDur(sec)
{
  if (sec == null)
  {
    return '';
  }
  if (sec < 60)
  {
    return sec + 's';
  }

  return fmtRest(sec);
}
/* ---------- exports ---------- */
function setLineText(ex, set)
{
  let tag = '';
  let reps = set.reps != null ? set.reps : set.target || 0;

  switch (set.status)
  {
    case 'done_ugly':
      tag = ' ugly';
      break;

    case 'pain':
      tag = ' pain';
      break;

    case 'failed':
      tag = ' failed';
      break;

    case 'skipped':
      tag = ' skipped';
      break;
  }

  if (ex.mode == 'timed')
  {
    return reps + ' sec' + tag;
  }
  if (set.load != null)
  {
    return set.load + ' ' + (set.unit || 'kg') + ' x ' + reps + ' reps' + tag;
  }

  return reps + ' reps' + tag;
}

function buildPlain(workout, rig, profile)
{
  let out = ['Workout - ' + workout.date];
  let i;
  let j;
  let ex;
  let performed;
  let ri;
  let ladders;
  let ladder;
  let rung_texts;
  let set;
  let rung_text;

  if (workout.startedAt != null)
  {
    out.push('Started: ' + fmtDateTime(workout.startedAt));
  }
  out.push('');

  for (i = 0; i < workout.exercises.length; ++i)
  {
    ex = workout.exercises[i];
    performed = performedSetsOf(ex);
    if (!performed.length)
    {
      continue;
    }

    out.push(ex.name);

    if (ex.setup)
    {
      out.push('Setup: ' + ex.setup.replace(/\n+/g, '; '));
    }

    ri = ringInfo(ex, rig, profile);
    if (ri && ri.deg != null)
    {
      out.push('Rings: ' + ri.label + ' ' + ri.deg.toFixed(1) + '° (Rr ' + ri.Rr + ', H ' + (ri.H >= 0 ? '+' : '') + ri.H + ' cm)');
    }

    if (ex.mode == 'ladder')
    {
      ladders = laddersOf(ex);
      for (j = 0; j < ladders.length; ++j)
      {
        ladder = ladders[j];
        rung_texts = [];

        for (let k = 0; k < ladder.sets.length; ++k)
        {
          set = ladder.sets[k];
          if (!isPerformed(set))
          {
            continue;
          }

          rung_text = String(set.reps != null ? set.reps : set.target);
          if (set.status == 'done_ugly')
          {
            rung_text += ' ugly';
          }
          else if (set.status == 'pain')
          {
            rung_text += ' pain';
          }
          else if (set.status == 'failed')
          {
            rung_text += ' failed';
          }
          else if (set.status == 'skipped')
          {
            rung_text += ' skip';
          }

          rung_texts.push(rung_text);
        }

        if (rung_texts.length)
        {
          out.push('Ladder ' + ladder.idx + ': ' + rung_texts.join(' / '));
        }
      }
    }
    else 
    {
      for (j = 0; j < performed.length; ++j)
      {
        out.push(setLineText(ex, performed[j]));
      }
    }

    if (ex.notes)
    {
      out.push('Note: ' + ex.notes.replace(/\n+/g, '; '));
    }

    out.push('');
  }

  if (workout.notes)
  {
    out.push('Notes: ' + workout.notes);
  }

  return out.join('\n').replace(/\n+$/, '') + '\n';
}

function buildCompact(workout, rig, profile)
{
  let out = [];
  let i;
  let j;
  let ex;
  let performed;
  let body_parts;
  let ladder_parts;
  let ladders;
  let set;
  let tag;
  let reps;
  let uses_load;

  if (workout.startedAt != null)
  {
    out.push('Started: ' + fmtDateTime(workout.startedAt));
    out.push('');
  }

  for (i = 0; i < workout.exercises.length; ++i)
  {
    ex = workout.exercises[i];
    performed = performedSetsOf(ex);
    if (!performed.length)
    {
      continue;
    }

    body_parts = [];

    if (ex.mode == 'ladder')
    {
      ladders = laddersOf(ex);
      for (j = 0; j < ladders.length; ++j)
      {
        ladder_parts = [];

        for (let k = 0; k < ladders[j].sets.length; ++k)
        {
          set = ladders[j].sets[k];
          if (!isPerformed(set))
          {
            continue;
          }

          tag = '';
          if (set.status == 'done_ugly')
          {
            tag = 'u';
          }
          else if (set.status == 'pain')
          {
            tag = '!';
          }
          else if (set.status == 'failed')
          {
            tag = 'x';
          }
          else if (set.status == 'skipped')
          {
            tag = '-';
          }

          ladder_parts.push((set.reps != null ? set.reps : set.target) + tag);
        }

        if (ladder_parts.length)
        {
          body_parts.push(ladder_parts.join('.'));
        }
      }
    }
    else 
    {
      uses_load = false;
      for (j = 0; j < ex.sets.length; ++j)
      {
        if (ex.sets[j].load != null)
        {
          uses_load = true;
          break;
        }
      }

      for (j = 0; j < performed.length; ++j)
      {
        set = performed[j];
        reps = set.reps != null ? set.reps : set.target || 0;
        tag = '';

        if (set.status == 'done_ugly')
        {
          tag = ' ugly';
        }
        else if (set.status == 'pain')
        {
          tag = ' pain';
        }
        else if (set.status == 'failed')
        {
          tag = ' failed';
        }
        else if (set.status == 'skipped')
        {
          tag = ' skipped';
        }

        if (ex.mode == 'timed')
        {
          body_parts.push(reps + 's' + tag);
        }
        else if (set.load != null)
        {
          body_parts.push(set.load + ' ' + (set.unit || 'kg') + ' x ' + reps + tag);
        }
        else 
        {
          body_parts.push(reps + tag);
        }
      }

      if (uses_load)
      {
        out.push(ex.name + ': ' + body_parts.join(', '));
        continue;
      }
    }

    out.push(ex.name + ': ' + body_parts.join(' / '));
  }

  return out.join('\n') + '\n';
}

function csvCell(value)
{
  let text = value == null ? '' : String(value);

  if (/[",\n]/.test(text))
  {
    return '"' + text.replace(/"/g, '""') + '"';
  }

  return text;
}

function buildCSV(workout, rig, profile)
{
  let head = ['date', 'workout', 'started_at', 'exercise', 'mode', 'set_index', 'ladder_index', 'rung_index', 'reps', 'load', 'unit', 'clean_status', 'pain', 'rest_target', 'cycle_sec', 'work_sec', 'work_quality', 'setup', 'notes'];
  let rows = [head.join(',')];
  let i;
  let j;
  let ex;
  let ordered;
  let timings;
  let entry;
  let set_index;
  let first;
  let ri;
  let setup_cell;
  let set;
  let status;
  let note;
  let row;

  for (i = 0; i < workout.exercises.length; ++i)
  {
    ex = workout.exercises[i];
    /* walk logical order, not raw insertion order — otherwise set_index counts
       the array as it happens to be stored and looks scrambled next to reps */
    ordered = orderedSetsOf(ex);
    timings = setTimings(ex);
    set_index = 0;
    first = true;
    ri = ringInfo(ex, rig, profile);
    setup_cell = ex.setup || '';

    if (ri && ri.deg != null)
    {
      setup_cell = (setup_cell ? setup_cell + ' | ' : '') + ri.label + ' ' + ri.deg.toFixed(1) + '° (Rr ' + ri.Rr + ', H ' + (ri.H >= 0 ? '+' : '') + ri.H + ')';
    }

    for (j = 0; j < ordered.length; ++j)
    {
      entry = ordered[j];
      set = entry.set;
      if (!isPerformed(set))
      {
        continue;
      }

      ++set_index;

      if (set.status == 'done_clean')
      {
        status = 'clean';
      }
      else if (set.status == 'done_ugly')
      {
        status = 'ugly';
      }
      else if (set.status == 'pain')
      {
        status = '';
      }
      else 
      {
        status = set.status;
      }

      note = set.note || '';
      if (first && ex.notes)
      {
        note = (note ? note + ' | ' : '') + 'ex: ' + ex.notes;
      }
      first = false;

      row = [
        workout.date,
        workout.name || '',
        workout.startedAt != null ? workout.startedAt : '',
        ex.name,
        ex.mode,
        set_index,
        entry.ladder_index != null ? entry.ladder_index : '',
        entry.rung_pos != null ? entry.rung_pos : '',
        set.reps != null ? set.reps : '',
        set.load != null ? set.load : '',
        set.load != null ? (set.unit || 'kg') : '',
        status,
        set.status == 'pain' ? 'yes' : '',
        set.restTarget != null ? set.restTarget : '',
        timings[set.id] ? timings[set.id].cycle : '',
        timings[set.id] && (timings[set.id].status == 'exact' || timings[set.id].status == 'estimate') ? timings[set.id].work : '',
        timings[set.id] ? timings[set.id].status : '',
        setup_cell,
        note
      ];

      for (let k = 0; k < row.length; ++k)
      {
        row[k] = csvCell(row[k]);
      }

      rows.push(row.join(','));
    }
  }

  return rows.join('\n') + '\n';
}

/* ---------- chunked backup: complete, lossless, tab-delimited ----------

   the file is a header line, then typed sections. one section per record type,
   each with its own header row so columns are read by name (adding a field later
   does not break old backups). the file is FLAT and relational — exercises point
   at a workout id, sets at an exercise id — and import re-nests by joining on
   those ids. this is the round-trip pair: buildBackup and parseBackup must stay
   exact inverses, which Claude was asserting with internal fuzzing while
   developing this codec.

   tab-delimited so notes/setup can hold commas without quoting. the row format
   stays simple by escaping only backslash, tab, CR, and LF inside text fields. */

const BACKUP_VERSION = 'workout_recorder_backup\t26.0726.2015';

function bkEncodeText(text)
{
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function bkDecodeText(text)
{
  let out = '';
  let i;
  let ch;
  let next;

  for (i = 0; i < text.length; ++i)
  {
    ch = text.charAt(i);
    if (ch != '\\' || i + 1 >= text.length)
    {
      out += ch;
      continue;
    }

    next = text.charAt(i + 1);
    switch (next)
    {
      case 'n':
        out += '\n';
        ++i;
        break;

      case 'r':
        out += '\r';
        ++i;
        break;

      case 't':
        out += '\t';
        ++i;
        break;

      case '\\':
        out += '\\';
        ++i;
        break;

      default:
        out += next;
        ++i;
        break;
    }
  }

  return out;
}

function bkCell(value)
{
  if (value == null)
  {
    return '-';
  }

  let text = String(value);
  if (text == '')
  {
    return '-';
  }

  return bkEncodeText(text);
}

function bkBool(value)
{
  return value ? 'yes' : 'no';
}

function buildBackup(state)
{
  let lines = [];
  let w;
  let ex;
  let ordered;
  let entry;
  let s;
  let i;
  let j;
  let k;

  lines.push(BACKUP_VERSION);
  lines.push('');

  lines.push('[globals]');
  lines.push(['sound', 'countdown', 'active', 'anchor', 'cal_x', 'cal_y', 'cal_rr', 'toe_shoulder', 'heel_shoulder', 'arm'].join('\t'));
  lines.push([
    bkBool(state.settings.sound),
    bkBool(state.settings.countdown),
    bkCell(state.activeId),
    bkCell(state.rig.anchorHeight),
    bkCell(state.rig.calX),
    bkCell(state.rig.calY),
    bkCell(state.rig.calRr),
    bkCell(state.profile.shoulderPushup),
    bkCell(state.profile.shoulderRow),
    bkCell(state.profile.arm)
  ].join('\t'));
  lines.push('');

  lines.push('[workouts]');
  lines.push(['id', 'date', 'name', 'started_at', 'finished_at', 'finished', 'notes'].join('\t'));
  for (i = 0; i < state.workouts.length; ++i)
  {
    w = state.workouts[i];
    lines.push([bkCell(w.id), bkCell(w.date), bkCell(w.name), bkCell(w.startedAt), bkCell(w.finishedAt), bkBool(w.finished), bkCell(w.notes)].join('\t'));
  }
  lines.push('');

  lines.push('[exercises]');
  lines.push(['id', 'workout', 'name', 'mode', 'rest_set', 'rest_rung', 'stop_reason', 'setup', 'notes', 'ring_type', 'ring_rr', 'foot_dist'].join('\t'));
  for (i = 0; i < state.workouts.length; ++i)
  {
    w = state.workouts[i];
    for (j = 0; j < w.exercises.length; ++j)
    {
      ex = w.exercises[j];
      /* stop_reason does double duty: '-' means not stopped. a stopped exercise
         always carries a reason (stopExercise writes one), so the flag is
         redundant with the reason and would only be a chance to disagree. */
      lines.push([
        bkCell(ex.id),
        bkCell(w.id),
        bkCell(ex.name),
        bkCell(ex.mode),
        bkCell(ex.restSet),
        bkCell(ex.restRung),
        bkCell(ex.stopped ? (ex.stopReason || 'stopped') : null),
        bkCell(ex.setup),
        bkCell(ex.notes),
        bkCell(ex.ring.type),
        bkCell(ex.ring.Rr),
        bkCell(ex.ring.H)
      ].join('\t'));
    }
  }
  lines.push('');

  lines.push('[sets]');
  lines.push(['exercise', 'ladder', 'rung', 'target', 'reps', 'load', 'unit', 'status', 'rest_target', 'done_at', 'note'].join('\t'));
  for (i = 0; i < state.workouts.length; ++i)
  {
    w = state.workouts[i];
    for (j = 0; j < w.exercises.length; ++j)
    {
      ex = w.exercises[j];
      /* emit in logical order so a hand-read file makes sense; import does not
         depend on order (rungIndex/ladderIndex carry position) */
      ordered = orderedSetsOf(ex);
      for (k = 0; k < ordered.length; ++k)
      {
        entry = ordered[k];
        s = entry.set;
        lines.push([
          bkCell(ex.id),
          bkCell(s.ladderIndex),
          bkCell(s.rungIndex),
          bkCell(s.target),
          bkCell(s.reps),
          bkCell(s.load),
          bkCell(s.unit),
          bkCell(s.status),
          bkCell(s.restTarget),
          bkCell(s.doneAt),
          bkCell(s.note)
        ].join('\t'));
      }
    }
  }
  lines.push('');

  return lines.join('\n');
}

/* '-' means null/empty on the way back in */
function bkNum(text)
{
  if (text == '-' || text == '')
  {
    return null;
  }

  let n = parseFloat(text);
  if (isNaN(n))
  {
    throw new Error('expected a number, got "' + text + '"');
  }

  return n;
}

function bkInt(text)
{
  if (text == '-' || text == '')
  {
    return null;
  }

  let n = parseInt(text, 10);
  if (isNaN(n))
  {
    throw new Error('expected an integer, got "' + text + '"');
  }

  return n;
}

function bkStr(text)
{
  if (text == '-')
  {
    return '';
  }

  return bkDecodeText(text);
}

function bkStrOrNull(text)
{
  if (text == '-')
  {
    return null;
  }

  return bkDecodeText(text);
}

/* header row -> { column_name: index }, so rows are read by name not position */
function bkColumns(header_line)
{
  let names = header_line.split('\t');
  let cols = {};
  let i;

  for (i = 0; i < names.length; ++i)
  {
    cols[names[i]] = i;
  }

  return cols;
}

/* parse the whole file into flat section arrays, asserting shape as we go.
   returns { globals, workouts, exercises, sets } as plain records. */
function parseBackup(text)
{
  let raw_lines = text.split(/\r?\n/);
  let lines = [];
  let section = null;
  let cols = null;
  let out = { globals: null, workouts: [], exercises: [], sets: [] };
  let line;
  let fields;
  let i;

  /* drop blank lines but keep the version check on line 0 of the real content */
  for (i = 0; i < raw_lines.length; ++i)
  {
    if (raw_lines[i].trim() != '')
    {
      lines.push(raw_lines[i]);
    }
  }

  if (!lines.length)
  {
    throw new Error('not a workout_recorder backup (file is empty)');
  }

  if (lines[0] != BACKUP_VERSION)
  {
    throw new Error('not a workout_recorder backup (first line is "' + lines[0] + '", expected "' + BACKUP_VERSION + '")');
  }

  for (i = 1; i < lines.length; ++i)
  {
    line = lines[i];

    if (line.charAt(0) == '[')
    {
      section = line;
      cols = null;   /* next line in this section is its header */
      continue;
    }

    if (!section)
    {
      throw new Error('line ' + (i + 1) + ': data outside any [section]');
    }

    if (!cols)
    {
      cols = bkColumns(line);
      continue;
    }

    fields = line.split('\t');

    switch (section)
    {
      case '[globals]':
        out.globals = {
          sound: fields[cols.sound] == 'yes',
          countdown: fields[cols.countdown] == 'yes',
          activeId: bkStrOrNull(fields[cols.active]),
          anchorHeight: bkNum(fields[cols.anchor]),
          calX: bkNum(fields[cols.cal_x]),
          calY: bkNum(fields[cols.cal_y]),
          calRr: bkNum(fields[cols.cal_rr]),
          shoulderPushup: bkNum(fields[cols.toe_shoulder]),
          shoulderRow: bkNum(fields[cols.heel_shoulder]),
          arm: bkNum(fields[cols.arm])
        };
        break;

      case '[workouts]':
        out.workouts.push({
          id: fields[cols.id],
          date: fields[cols.date],
          name: bkStr(fields[cols.name]),
          startedAt: cols.started_at != null ? bkNum(fields[cols.started_at]) : null,
          finishedAt: cols.finished_at != null ? bkNum(fields[cols.finished_at]) : null,
          finished: fields[cols.finished] == 'yes',
          notes: bkStr(fields[cols.notes])
        });
        break;

      case '[exercises]':
        out.exercises.push({
          id: fields[cols.id],
          workout: fields[cols.workout],
          name: bkStr(fields[cols.name]),
          mode: fields[cols.mode],
          restSet: bkInt(fields[cols.rest_set]),
          restRung: bkInt(fields[cols.rest_rung]),
          /* '-' reason means not stopped; any reason implies stopped */
          stopped: fields[cols.stop_reason] != '-',
          stopReason: bkStrOrNull(fields[cols.stop_reason]),
          setup: bkStr(fields[cols.setup]),
          notes: bkStr(fields[cols.notes]),
          ringType: fields[cols.ring_type],
          ringRr: bkNum(fields[cols.ring_rr]),
          ringH: bkNum(fields[cols.foot_dist])
        });
        break;

      case '[sets]':
        out.sets.push({
          exercise: fields[cols.exercise],
          ladderIndex: bkInt(fields[cols.ladder]),
          rungIndex: bkInt(fields[cols.rung]),
          target: bkInt(fields[cols.target]),
          reps: bkInt(fields[cols.reps]),
          load: bkNum(fields[cols.load]),
          unit: bkStrOrNull(fields[cols.unit]),
          status: fields[cols.status],
          restTarget: bkInt(fields[cols.rest_target]),
          doneAt: bkNum(fields[cols.done_at]),
          note: bkStr(fields[cols.note])
        });
        break;

      default:
        throw new Error('line ' + (i + 1) + ': unknown section ' + section);
    }
  }

  return out;
}

/* re-nest the flat sections into workout objects by joining on id.
   returns an array of fully-formed workouts (ready to merge into state). */
function rebuildWorkouts(parsed)
{
  let workouts = [];
  let by_id = {};
  let ex_by_id = {};
  let rec;
  let w;
  let ex;
  let s;
  let i;

  for (i = 0; i < parsed.workouts.length; ++i)
  {
    rec = parsed.workouts[i];
    w = { id: rec.id, date: rec.date, name: rec.name, notes: rec.notes, exercises: [], startedAt: rec.startedAt, finishedAt: rec.finishedAt, finished: rec.finished };
    workouts.push(w);
    by_id[w.id] = w;
  }

  for (i = 0; i < parsed.exercises.length; ++i)
  {
    rec = parsed.exercises[i];
    w = by_id[rec.workout];
    if (!w)
    {
      throw new Error('exercise "' + rec.name + '" points at missing workout ' + rec.workout);
    }

    ex = makeExercise({
      id: rec.id,
      name: rec.name,
      mode: rec.mode,
      setup: rec.setup,
      notes: rec.notes,
      restSet: rec.restSet,
      restRung: rec.restRung,
      stopped: rec.stopped,
      ring: { type: rec.ringType, Rr: rec.ringRr, H: rec.ringH }
    });
    ex.stopReason = rec.stopReason;
    w.exercises.push(ex);
    if (ex_by_id[ex.id])
    {
      throw new Error('duplicate exercise id ' + ex.id + ' — every exercise id must be unique');
    }
    ex_by_id[ex.id] = ex;
  }

  for (i = 0; i < parsed.sets.length; ++i)
  {
    rec = parsed.sets[i];
    ex = ex_by_id[rec.exercise];
    if (!ex)
    {
      throw new Error('a set points at missing exercise ' + rec.exercise);
    }

    s = makeSet({
      ladderIndex: rec.ladderIndex,
      rungIndex: rec.rungIndex,
      target: rec.target,
      reps: rec.reps,
      load: rec.load,
      unit: rec.unit,
      status: rec.status,
      restTarget: rec.restTarget,
      doneAt: rec.doneAt,
      note: rec.note
    });
    ex.sets.push(s);
  }

  return workouts;
}

/* ---------- ring geometry: ONE solver for pushup and row ----------
   pushup: shoulder ≈ ring, so arm_len is 0.
   row:    strap and straight arm are collinear, so they collapse into a single
           tether one arm longer — a virtual ring hanging arm_len below the real
           one. arm_len enters once, in resting_shoulder, and nowhere else.
   status: 'ok' | 'unreachable' | 'slack' | 'incomplete'
*/
/* θ == 0 exactly (the horizontal row, Rr == Arm at H == -S) lands on -1e-16 in
   floating point; without this tolerance it would misreport as slack. */
const SLACK_EPSILON = 1e-9;

function bodyAngle(anchor_height, body_len, pivot_dist, ring_height, arm_len)
{
  let resting_shoulder;
  let tether;
  let k;
  let denom;
  let cos_arg;
  let theta;

  if (anchor_height == null || body_len == null || pivot_dist == null || ring_height == null || arm_len == null)
  {
    return { status: 'incomplete', deg: 0 };
  }
  if (!(anchor_height > 0) || !(body_len > 0))
  {
    return { status: 'incomplete', deg: 0 };
  }

  resting_shoulder = ring_height - arm_len;        /* Rr' — virtual resting shoulder height */
  tether = anchor_height - resting_shoulder;       /* ρ = strap + arm; derived, never cached */

  k = (tether*tether - anchor_height*anchor_height - pivot_dist*pivot_dist - body_len*body_len)/2;
  denom = body_len*Math.hypot(pivot_dist, anchor_height);

  if (denom == 0)
  {
    return { status: 'unreachable', deg: 0 };
  }

  cos_arg = k/denom;
  if (cos_arg < -1 || cos_arg > 1)
  {
    return { status: 'unreachable', deg: 0 };
  }

  /* always the +acos root: signed pivot_dist selects the regime.
     a sin θ >= 0 test does NOT discriminate — both roots clear the floor. */
  theta = Math.atan2(-anchor_height, pivot_dist) + Math.acos(cos_arg);

  if (theta < -SLACK_EPSILON)
  {
    /* shoulder below the floor: rings hang closer than one arm — slack straps.
       a distinct failure from 'unreachable': lower the rings vs move the anchor. */
    return { status: 'slack', deg: theta*180/Math.PI };
  }

  return { status: 'ok', deg: theta*180/Math.PI };
}

function calibrateAnchor(x1, y1, ringRestHeight)
{
  let denom;

  if (x1 == null || y1 == null || ringRestHeight == null)
  {
    return null;
  }
  if (isNaN(x1) || isNaN(y1) || isNaN(ringRestHeight))
  {
    return null;
  }

  denom = 2*(y1 - ringRestHeight);
  if (denom == 0)
  {
    return null;
  }

  return (x1*x1 + y1*y1 - ringRestHeight*ringRestHeight)/denom;
}

/* resolve a geometry-enabled exercise to a display line, given global rig + profile. */
function ringType(ex)
{
  return ex.ring && ex.ring.type ? ex.ring.type : 'none';
}

function ringModeLabel(type)
{
  switch (type)
  {
    case 'pushup':
      return 'ring pushup';

    case 'row':
      return 'ring row';
  }

  return 'rings';
}

/* the pivot is the toe in a pushup, the heel in a row */
function ringPivotWord(type)
{
  switch (type)
  {
    case 'row':
      return 'heel';
  }

  return 'toe';
}

/* which profile numbers a mode needs; arm_len is 0 for a pushup, never missing */
function ringBodyLen(type, profile)
{
  if (!profile)
  {
    return null;
  }

  switch (type)
  {
    case 'pushup':
      return profile.shoulderPushup;

    case 'row':
      return profile.shoulderRow;
  }

  return null;
}

function ringArmLen(type, profile)
{
  switch (type)
  {
    case 'pushup':
      return 0;

    case 'row':
      return profile ? profile.arm : null;
  }

  return null;
}

function ringInfo(ex, rig, profile)
{
  let type = ringType(ex);
  let label;
  let ring_height;
  let pivot_dist;
  let anchor_height;
  let body_len;
  let arm_len;
  let missing;
  let result;
  let signed_pivot;

  switch (type)
  {
    case 'pushup':
    case 'row':
      break;

    default:
      return null;
  }

  label = ringModeLabel(type);
  ring_height = ex.ring.Rr;
  pivot_dist = ex.ring.H;

  if (ring_height == null || pivot_dist == null)
  {
    return { incomplete: true, text: label + ' — enter ring height + ' + ringPivotWord(type) + ' distance' };
  }

  anchor_height = rig ? rig.anchorHeight : null;
  body_len = ringBodyLen(type, profile);
  arm_len = ringArmLen(type, profile);

  missing = [];
  if (anchor_height == null)
  {
    missing.push('anchor height');
  }
  if (body_len == null)
  {
    missing.push(ringPivotWord(type) + '-to-shoulder');
  }
  if (arm_len == null)
  {
    missing.push('arm length');
  }
  if (missing.length)
  {
    return { incomplete: true, text: label + ' — set ' + missing.join(' + ') + ' in ⚙ setup' };
  }

  result = bodyAngle(anchor_height, body_len, pivot_dist, ring_height, arm_len);
  signed_pivot = (pivot_dist >= 0 ? '+' : '') + pivot_dist;

  switch (result.status)
  {
    case 'incomplete':
      return { incomplete: true, text: label + ' — incomplete' };

    case 'unreachable':
      return {
        impossible: true,
        label: label,
        Rr: ring_height,
        H: pivot_dist,
        text: label + ' — impossible configuration (can\'t reach) · Rr ' + ring_height + ' · H ' + signed_pivot
      };

    case 'slack':
      return {
        slack: true,
        label: label,
        Rr: ring_height,
        H: pivot_dist,
        text: label + ' — rings too low (slack straps) · Rr ' + ring_height + ' · H ' + signed_pivot
      };
  }

  return {
    deg: result.deg,
    label: label,
    Rr: ring_height,
    H: pivot_dist,
    text: label + ' ∠ ' + result.deg.toFixed(1) + '° · Rr ' + ring_height + ' · H ' + signed_pivot + ' cm'
  };
}

/* colour class for the card line: failures red, missing inputs grey */
function ringLineClass(ri)
{
  if (ri.impossible || ri.slack)
  {
    return ' bad';
  }
  if (ri.incomplete)
  {
    return ' faint';
  }

  return '';
}

/* ======== storage (artifact window.storage → localStorage fallback) ======== */
let storage_key = 'wr:data:v1';
let store = {
  load: function()
  {
    function readLocal()
    {
      try 
      {
        let stored_value = localStorage.getItem(storage_key);
        return stored_value ? JSON.parse(stored_value) : null;
      }
      catch (e)
      {
        return null;
      }
    }

    if (window.storage && window.storage.get)
    {
      return window.storage.get(storage_key).then(function(result)
      {
        if (result && result.value)
        {
          return JSON.parse(result.value);
        }

        return null;
      }, function()
      {
        return readLocal();
      });
    }

    return Promise.resolve(readLocal());
  },
  _t:null,
  save: function(data)
  {
    clearTimeout(this._t);
    let self_ref = this;
    this._t = setTimeout(function()
    {
      self_ref.flush(data); 
    }, 400);
    this._pending = data;
  },
  flush: function(data)
  {
    function writeLocal(json_text)
    {
      try 
      {
        localStorage.setItem(storage_key, json_text);
      }
      catch (e)
      {}
      return Promise.resolve();
    }

    data = data || this._pending;
    if (!data) return Promise.resolve();

    let json_text;
    try 
    {
      json_text = JSON.stringify(data); 
    }
    catch(e)
    {
      return Promise.resolve(); 
    }

    if (window.storage && window.storage.set)
    {
      return window.storage.set(storage_key, json_text).then(function()
      {
        return null;
      }, function()
      {
        return writeLocal(json_text);
      });
    }

    return writeLocal(json_text);
  }
};
document.addEventListener('visibilitychange', function()
{
  if (document.visibilityState=='hidden') store.flush(); 
});
window.addEventListener('pagehide', function()
{
  store.flush(); 
});

/* ======== state ======== */
let state = { workouts: [], presets: {}, settings: { sound:true }, rig: { anchorHeight:null, calX:null, calY:null, calRr:null }, profile: { shoulderPushup:null, shoulderRow:null, arm:null }, activeId: null, exerciseLibrary: null };
let ui = {
  view: 'home',            // home | workout
  homeTab: 'calendar',         // list | calendar
  calY: new Date().getFullYear(),
  calM: new Date().getMonth(),
  calSel: null,            // selected iso date in calendar
  overlay: null,           // {type:'addex'|'export'|'clone', ...}
  editSetId: null,
  menuExId: null,
  notesExId: null,
  painExId: null,
  expFmt: 'plain',
  importMsg: null,
  sectionOpen: {}
};

function sectionIsOpen(key, default_open)
{
  if (ui.sectionOpen[key] == null)
  {
    return default_open;
  }

  return !!ui.sectionOpen[key];
}

function toggleSection(key, default_open)
{
  ui.sectionOpen[key] = !sectionIsOpen(key, default_open);
}

function setSectionOpen(key, open)
{
  ui.sectionOpen[key] = !!open;
}

function workoutExerciseSectionKey(workout_id, ex_id)
{
  return 'workout-ex-' + workout_id + '-' + ex_id;
}

function setWorkoutExercisesOpen(workout, open)
{
  let i;

  if (!workout)
  {
    return;
  }

  for (i = 0; i < workout.exercises.length; ++i)
  {
    setSectionOpen(workoutExerciseSectionKey(workout.id, workout.exercises[i].id), open);
  }
}

function rawExerciseLibrary()
{
  if (window.workout_exercise_library)
  {
    return window.workout_exercise_library;
  }

  return { exercises: [], sampleWorkout: null };
}

function cloneLibraryTargets(targets)
{
  let out = [];
  let src;
  let i;

  if (!targets)
  {
    return out;
  }

  for (i = 0; i < targets.length; ++i)
  {
    src = targets[i] || {};
    out.push({ reps: src.reps, load: src.load });
  }

  return out;
}

function cloneLibraryLadders(ladders)
{
  let out = [];
  let rung_list;
  let i;
  let j;

  if (!ladders)
  {
    return out;
  }

  for (i = 0; i < ladders.length; ++i)
  {
    rung_list = [];
    for (j = 0; j < ladders[i].length; ++j)
    {
      rung_list.push(ladders[i][j]);
    }
    out.push(rung_list);
  }

  return out;
}

function cloneLibraryExercises(exercises)
{
  let out = [];
  let src;
  let ring;
  let i;

  if (!exercises)
  {
    return out;
  }

  for (i = 0; i < exercises.length; ++i)
  {
    src = exercises[i] || {};
    ring = src.ring ? { type: src.ring.type, Rr: src.ring.Rr, H: src.ring.H } : null;
    out.push({
      name: src.name || '',
      mode: src.mode || 'straight',
      setup: src.setup || '',
      restSet: src.restSet != null ? src.restSet : 150,
      restRung: src.restRung != null ? src.restRung : 20,
      defaultTargets: cloneLibraryTargets(src.defaultTargets),
      defaultLadders: cloneLibraryLadders(src.defaultLadders),
      targets: cloneLibraryTargets(src.targets),
      ladders: cloneLibraryLadders(src.ladders),
      unit: src.unit || null,
      ring: ring
    });
  }

  return out;
}

function libraryExercises()
{
  if (!state.exerciseLibrary)
  {
    state.exerciseLibrary = cloneLibraryExercises(rawExerciseLibrary().exercises);
  }

  return state.exerciseLibrary;
}

function exerciseLibrary()
{
  return { exercises: libraryExercises(), sampleWorkout: rawExerciseLibrary().sampleWorkout };
}

function libraryExerciseNames()
{
  let lib = exerciseLibrary();
  let names = [];
  let i;

  for (i = 0; i < lib.exercises.length; ++i)
  {
    names.push(lib.exercises[i].name);
  }

  return names;
}

function findLibraryExercise(name)
{
  let lib = exerciseLibrary();
  let key;
  let i;

  if (!name)
  {
    return null;
  }

  key = name.trim().toLowerCase();
  for (i = 0; i < lib.exercises.length; ++i)
  {
    if ((lib.exercises[i].name || '').trim().toLowerCase() == key)
    {
      return lib.exercises[i];
    }
  }

  return null;
}

function applyLibraryExerciseToDraft(d)
{
  let ex = findLibraryExercise(d.name);

  if (!ex)
  {
    return;
  }

  d.mode = ex.mode || d.mode;
  d.setup = ex.setup || d.setup;
  if (ex.restSet != null) d.rest = fmtRest(ex.restSet);
  if (ex.restRung != null) d.rrest = fmtRest(ex.restRung);
  if (ex.mode == 'ladder' && ex.defaultLadders && ex.defaultLadders.length) d.tops = laddersLabel(ex.defaultLadders);
  else if (ex.defaultTargets && ex.defaultTargets.length)
  {
    d.targets = ex.defaultTargets.map(function(t)
    {
      return (t.load != null ? t.load + 'x' : '') + t.reps;
    }).join(' / ');
  }
  if (ex.ring)
  {
    d.ringType = ex.ring.type || 'pushup';
    d.ringRr = ex.ring.Rr != null ? String(ex.ring.Rr) : '';
    d.ringH = ex.ring.H != null ? String(ex.ring.H) : '';
  }
}

function save()
{
  store.save(state); 
}

function buildFixTimesDraft(workout)
{
  return {
    startedDate: workout && workout.startedAt != null ? isoDateOfTimestamp(workout.startedAt) : (workout ? workout.date : todayISO()),
    startedTime: workout && workout.startedAt != null ? fmtClockTs(workout.startedAt) : '',
    finishedDate: workout && workout.finishedAt != null ? isoDateOfTimestamp(workout.finishedAt) : (workout ? workout.date : todayISO()),
    finishedTime: workout && workout.finishedAt != null ? fmtClockTs(workout.finishedAt) : ''
  };
}

function deleteWorkout(workout)
{
  let next_workout;

  if (!workout)
  {
    return;
  }

  state.workouts = state.workouts.filter(function(w)
  {
    return w.id != workout.id;
  });
  next_workout = state.workouts.length ? state.workouts[0] : null;
  state.activeId = next_workout ? next_workout.id : null;
  ui.view = 'home';
  ui.overlay = null;
  stopTimer();
  save();
  render();
}

function setWorkoutDate(workout, iso_date)
{
  if (!workout)
  {
    return false;
  }
  if (!isISODate(iso_date))
  {
    return false;
  }

  workout.date = iso_date;
  save();
  render();
  return true;
}

function adjacentLoggedDayWorkout(workout, direction)
{
  let target_date = null;
  let candidate;
  let i;

  if (!workout || !isISODate(workout.date))
  {
    return null;
  }

  for (i = 0; i < state.workouts.length; ++i)
  {
    candidate = state.workouts[i];

    if (!candidate || !isISODate(candidate.date) || candidate.date == workout.date)
    {
      continue;
    }

    if (direction < 0)
    {
      if (candidate.date < workout.date && (target_date == null || candidate.date > target_date))
      {
        target_date = candidate.date;
      }
    }
    else if (candidate.date > workout.date && (target_date == null || candidate.date < target_date))
    {
      target_date = candidate.date;
    }
  }

  if (target_date == null)
  {
    return null;
  }

  for (i = 0; i < state.workouts.length; ++i)
  {
    if (state.workouts[i].date == target_date)
    {
      return state.workouts[i];
    }
  }

  return null;
}

function saveFixTimes(workout, draft)
{
  let started_at;
  let finished_at;

  if (!workout || !draft)
  {
    return;
  }

  if ((draft.startedDate && !draft.startedTime) || (!draft.startedDate && draft.startedTime))
  {
    alert('Enter both began date and time, or leave both blank.');
    return;
  }
  if ((draft.finishedDate && !draft.finishedTime) || (!draft.finishedDate && draft.finishedTime))
  {
    alert('Enter both ended date and time, or leave both blank.');
    return;
  }

  started_at = draft.startedDate && draft.startedTime ? timestampOfDateTime(draft.startedDate, draft.startedTime) : null;
  finished_at = draft.finishedDate && draft.finishedTime ? timestampOfDateTime(draft.finishedDate, draft.finishedTime) : null;
  if (draft.startedDate && draft.startedTime && started_at == null)
  {
    alert('Enter a valid began date and time.');
    return;
  }
  if (draft.finishedDate && draft.finishedTime && finished_at == null)
  {
    alert('Enter a valid ended date and time.');
    return;
  }
  if (finished_at != null && started_at == null)
  {
    alert('Set a began date and time before setting an ended time.');
    return;
  }
  if (started_at != null && finished_at != null && finished_at < started_at)
  {
    alert('Ended time must be after began time.');
    return;
  }

  workout.startedAt = started_at;
  workout.finishedAt = finished_at;
  workout.finished = finished_at != null;
  if (started_at != null)
  {
    workout.date = isoDateOfTimestamp(started_at);
  }
  if (finished_at != null || started_at == null)
  {
    stopTimer();
  }
  ui.overlay = null;
  save();
  render();
}

function findWorkout(id)
{
  return state.workouts.find(function(w)
  {
    return w.id==id; 
  }); 
}
function activeWorkout()
{
  return findWorkout(state.activeId); 
}
function findEx(w, exId)
{
  return w && w.exercises.find(function(e)
  {
    return e.id==exId; 
  }); 
}
function findSet(w, setId)
{
  if (!w) return null;
  for (let i=0; i<w.exercises.length; ++i)
  {
    let ex = w.exercises[i];
    let s = ex.sets.find(function(x)
    {
      return x.id==setId; 
    });
    if (s) return { ex:ex, set:s };
  }
  return null;
}

/* preset upkeep: remember setup, rests, last targets per exercise name */
function touchPreset(ex)
{
  let k = ex.name.trim().toLowerCase(); if (!k) return;
  state.presets[k] = {
    name: ex.name.trim(), mode: ex.mode,
    restSet: ex.restSet, restRung: ex.restRung,
    setup: ex.setup || '',
    lastTargets: ex.mode=='ladder' ? null : ex.sets.map(function(s)
    {
      return { reps: s.target!=null?s.target:s.reps, load: s.load }; 
    }),
    lastLadders: ex.mode=='ladder' ? rungsOf(ex) : null,
    unit: (ex.sets.find(function(s)
    {
      return s.unit; 
    })||{}).unit || 'kg',
    ring: ringType(ex) != 'none' ? { type:ex.ring.type, Rr:ex.ring.Rr, H:ex.ring.H } : null
  };
}

function collectExerciseNameKeysFromHistory()
{
  let found = {};
  let name;
  let i;
  let j;

  for (i = 0; i < state.workouts.length; ++i)
  {
    for (j = 0; j < state.workouts[i].exercises.length; ++j)
    {
      name = (state.workouts[i].exercises[j].name || '').trim().toLowerCase();
      if (name)
      {
        found[name] = true;
      }
    }
  }

  return found;
}

function collectExerciseNameKeysFromLibrary()
{
  let found = {};
  let name;
  let list = libraryExercises();
  let i;

  for (i = 0; i < list.length; ++i)
  {
    name = (list[i].name || '').trim().toLowerCase();
    if (name)
    {
      found[name] = true;
    }
  }

  return found;
}

function pruneStalePresets()
{
  let keep = collectExerciseNameKeysFromHistory();
  let from_library = collectExerciseNameKeysFromLibrary();
  let keys = Object.keys(state.presets);
  let i;

  for (i = 0; i < keys.length; ++i)
  {
    if (from_library[keys[i]])
    {
      keep[keys[i]] = true;
    }
  }

  for (i = 0; i < keys.length; ++i)
  {
    if (!keep[keys[i]])
    {
      delete state.presets[keys[i]];
    }
  }
}

function buildExerciseEditorDraft()
{
  let source = libraryExercises();
  let out = [];
  let ex;
  let targets_text;
  let i;

  for (i = 0; i < source.length; ++i)
  {
    ex = source[i];
    targets_text = '';

    if (ex.defaultTargets && ex.defaultTargets.length)
    {
      targets_text = ex.defaultTargets.map(function(t)
      {
        return (t.load != null ? t.load + 'x' : '') + t.reps;
      }).join(' / ');
    }

    out.push({
      name: ex.name || '',
      mode: ex.mode || 'straight',
      setup: ex.setup || '',
      rest: fmtRest(ex.restSet != null ? ex.restSet : 150),
      rrest: fmtRest(ex.restRung != null ? ex.restRung : 20),
      targets: targets_text,
      ladders: ex.defaultLadders && ex.defaultLadders.length ? laddersLabel(ex.defaultLadders) : '',
      unit: ex.unit || '',
      ringType: ex.ring && ex.ring.type ? ex.ring.type : 'none',
      ringRr: ex.ring && ex.ring.Rr != null ? String(ex.ring.Rr) : '',
      ringH: ex.ring && ex.ring.H != null ? String(ex.ring.H) : ''
    });
  }

  return out;
}

function normalizeExerciseEditorDraft(draft)
{
  let cleaned = [];
  let seen = {};
  let item;
  let out;
  let rest_set;
  let rest_rung;
  let ring_rr;
  let ring_h;
  let key;
  let i;

  for (i = 0; i < draft.length; ++i)
  {
    item = draft[i];
    item.name = (item.name || '').trim();
    if (!item.name)
    {
      continue;
    }

    key = item.name.toLowerCase();
    if (seen[key])
    {
      continue;
    }

    seen[key] = true;
    rest_set = parseRest(item.rest);
    rest_rung = parseRest(item.rrest);
    ring_rr = parseFloat(item.ringRr);
    ring_h = parseFloat(item.ringH);
    out = {
      name: item.name,
      mode: item.mode || 'straight',
      setup: item.setup || '',
      restSet: rest_set != null ? rest_set : 150,
      restRung: rest_rung != null ? rest_rung : 20,
      defaultTargets: [],
      defaultLadders: [],
      unit: (item.unit || '').trim() || null,
      ring: null
    };

    if (out.mode == 'ladder')
    {
      out.defaultLadders = parseLadders(item.ladders);
      if (!out.defaultLadders.length)
      {
        out.defaultLadders = [[1, 2, 3]];
      }
    }
    else
    {
      out.defaultTargets = parseTargets(item.targets);
      if (!out.defaultTargets.length)
      {
        out.defaultTargets = [{ reps: 0 }];
      }
    }

    if ((item.ringType || 'none') != 'none' || !isNaN(ring_rr) || !isNaN(ring_h))
    {
      out.ring = {
        type: item.ringType || 'none',
        Rr: isNaN(ring_rr) ? null : ring_rr,
        H: isNaN(ring_h) ? null : ring_h
      };
    }

    cleaned.push(out);
  }

  return cleaned;
}

function saveExerciseEditor(draft)
{
  let cleaned = normalizeExerciseEditorDraft(draft);

  state.exerciseLibrary = cleaned;
  pruneStalePresets();
  ui.overlay = { type: 'settings' };
  save();
  render();
}

function jsString(value)
{
  return JSON.stringify(value == null ? '' : value);
}

function buildExerciseLibraryJS(exercise_list)
{
  let lines = [];
  let list = exercise_list || libraryExercises();
  let ex;
  let item_lines;
  let sample_source = rawExerciseLibrary().sampleWorkoutSource;
  let i;
  let j;

  lines.push("'use strict';");
  lines.push('');
  lines.push('window.workout_exercise_library = {');
  lines.push('  exercises: [');

  for (i = 0; i < list.length; ++i)
  {
    ex = list[i];
    item_lines = [];
    item_lines.push('      name: ' + jsString(ex.name));
    item_lines.push('      mode: ' + jsString(ex.mode || 'straight'));
    if (ex.setup)
    {
      item_lines.push('      setup: ' + jsString(ex.setup));
    }
    if (ex.restSet != null)
    {
      item_lines.push('      restSet: ' + ex.restSet);
    }
    if (ex.restRung != null && ex.mode == 'ladder')
    {
      item_lines.push('      restRung: ' + ex.restRung);
    }
    if (ex.unit)
    {
      item_lines.push('      unit: ' + jsString(ex.unit));
    }
    if (ex.ring)
    {
      item_lines.push('      ring: { type: ' + jsString(ex.ring.type || 'none') + ', Rr: ' + (ex.ring.Rr == null ? 'null' : ex.ring.Rr) + ', H: ' + (ex.ring.H == null ? 'null' : ex.ring.H) + ' }');
    }
    if (ex.defaultTargets && ex.defaultTargets.length)
    {
      lines.push('    {');
      for (j = 0; j < item_lines.length; ++j)
      {
        lines.push(item_lines[j] + ',');
      }
      lines.push('      defaultTargets: [');
      for (j = 0; j < ex.defaultTargets.length; ++j)
      {
        if (ex.defaultTargets[j].load != null)
        {
          lines.push('        { reps: ' + ex.defaultTargets[j].reps + ', load: ' + ex.defaultTargets[j].load + ' }' + (j + 1 < ex.defaultTargets.length ? ',' : ''));
        }
        else
        {
          lines.push('        { reps: ' + ex.defaultTargets[j].reps + ' }' + (j + 1 < ex.defaultTargets.length ? ',' : ''));
        }
      }
      lines.push('      ]');
      lines.push('    }' + (i + 1 < list.length ? ',' : ''));
      continue;
    }
    if (ex.defaultLadders && ex.defaultLadders.length)
    {
      lines.push('    {');
      for (j = 0; j < item_lines.length; ++j)
      {
        lines.push(item_lines[j] + ',');
      }
      lines.push('      defaultLadders: ' + JSON.stringify(ex.defaultLadders));
      lines.push('    }' + (i + 1 < list.length ? ',' : ''));
      continue;
    }

    lines.push('    {');
    for (j = 0; j < item_lines.length; ++j)
    {
      lines.push(item_lines[j] + (j + 1 < item_lines.length ? ',' : ''));
    }
    lines.push('    }' + (i + 1 < list.length ? ',' : ''));
  }

  lines.push('  ],');
  if (sample_source)
  {
    lines.push('  sampleWorkout: ' + sample_source);
  }
  else
  {
    lines.push('  sampleWorkout: ' + JSON.stringify(rawExerciseLibrary().sampleWorkout, null, 2).replace(/^/gm, '  '));
  }
  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

function downloadExerciseLibraryJS()
{
  refreshOverlayOutputs();
  downloadTextAreaValue('exercise_js_out', 'workout-exercises.js', 'text/javascript');
}

function refreshOverlayOutputs()
{
  let o = ui.overlay;
  let out;
  let w;
  let list;

  if (!o)
  {
    return;
  }

  switch (o.type)
  {
    case 'settings':
      out = document.getElementById('settings_backup_out');

      if (out)
      {
        out.value = buildBackup(state);
      }
      return;

    case 'export':
      w = activeWorkout() || findWorkout(o.wid);
      out = document.getElementById('expout');

      if (out && ui.expFmt == 'backup')
      {
        out.value = buildBackup(state);
      }
      else if (out && w)
      {
        switch (ui.expFmt)
        {
          case 'backup':
            out.value = buildBackup(state);
            break;

          case 'csv':
            out.value = buildCSV(w, state.rig, state.profile);
            break;

          case 'compact':
            out.value = buildCompact(w, state.rig, state.profile);
            break;

          default:
            out.value = buildPlain(w, state.rig, state.profile);
            break;
        }
      }
      return;

    case 'exercise-editor':
      out = document.getElementById('exercise_js_out');

      if (out)
      {
        list = normalizeExerciseEditorDraft(o.draft);
        out.value = buildExerciseLibraryJS(list);
      }
      return;
  }
}

/* ======== builders ======== */
function makeSet(o)
{
  return Object.assign({ id: uid(), ladderIndex:null, rungIndex:null, target:null, reps:null,
    load:null, unit:null, status:'planned', restTarget:null, doneAt:null, note:'' }, o||{});
}
function makeExercise(o)
{
  let ex = Object.assign({ id: uid(), name:'', mode:'straight', setup:'', notes:'',
    restSet:150, restRung:20, stopped:false, ring:{ type:'none', Rr:null, H:null }, sets:[] }, o||{});
  if (!ex.ring) ex.ring = { type:'none', Rr:null, H:null };
  if (ex.ring.type == null) ex.ring.type = ex.ring.enabled ? 'pushup' : 'none';  // migrate old shape
  return ex;
}
function buildSetsFromTargets(targets, unit)
{
  return targets.map(function(t)
  {
    return makeSet({ target:t.reps, load: t.load!=null ? t.load : null, unit: t.load!=null ? (unit||'kg') : null });
  });
}
/* rebuild a ladder's sets from an edited rung list.

   performed rungs are history: they keep their recorded reps, keep their order,
   and are never deleted. they pack to the front of the ladder — in normal use
   they already ARE a prefix (skip and fail both count as performed), so packing
   changes nothing; a planned rung stranded between performed ones is anomalous,
   and packing heals it.

   the list supplies targets for the PLANNED tail only. the previous approach
   matched the list against each set's existing rungIndex, which broke the moment
   the list length changed: a position left by a removed rung simply got refilled
   from the list, so the ladder could never shrink. */
function rebuildLadderSets(ex, ladder_rungs)
{
  let ladders = laddersOf(ex);
  let out = [];
  let count = Math.max(ladder_rungs.length, ladders.length);
  let ladder_no = 0;
  let done;
  let rungs;
  let i;
  let j;

  for (i = 0; i < count; ++i)
  {
    done = [];
    if (i < ladders.length)
    {
      for (j = 0; j < ladders[i].sets.length; ++j)
      {
        if (isPerformed(ladders[i].sets[j]))
        {
          done.push(ladders[i].sets[j]);
        }
      }
    }

    rungs = i < ladder_rungs.length ? ladder_rungs[i] : [];

    /* a ladder with neither logged nor planned rungs disappears */
    if (!done.length && !rungs.length)
    {
      continue;
    }

    ++ladder_no;

    for (j = 0; j < done.length; ++j)
    {
      done[j].ladderIndex = ladder_no;
      done[j].rungIndex = j + 1;
      out.push(done[j]);
    }

    for (j = done.length; j < rungs.length; ++j)
    {
      out.push(makeSet({ ladderIndex: ladder_no, rungIndex: j + 1, target: rungs[j] }));
    }
  }

  return out;
}
/* rungIndex is the POSITION in the ladder (contiguous); target is the rep count.
   keeping them separate is what allows arbitrary rungs like 1,2,4,5. */
function buildLadderSets(ladder_rungs)
{
  let sets = [];
  let i;
  let j;

  for (i = 0; i < ladder_rungs.length; ++i)
  {
    for (j = 0; j < ladder_rungs[i].length; ++j)
    {
      sets.push(makeSet({ ladderIndex: i + 1, rungIndex: j + 1, target: ladder_rungs[i][j] }));
    }
  }

  return sets;
}
function newWorkout(name)
{
  let w = { id: uid(), date: todayISO(), name: name || 'Workout', notes:'', exercises: [], startedAt:null, finishedAt:null, finished:false };
  state.workouts.unshift(w);
  state.activeId = w.id;
  return w;
}

function ensureWorkoutStarted(workout, when)
{
  if (!workout)
  {
    return;
  }
  if (workout.startedAt == null)
  {
    workout.startedAt = when != null ? when : Date.now();
  }
}

function latestDoneAtOfWorkout(workout)
{
  let latest = null;
  let i;
  let j;
  let ex;
  let set;

  if (!workout)
  {
    return null;
  }

  for (i = 0; i < workout.exercises.length; ++i)
  {
    ex = workout.exercises[i];
    for (j = 0; j < ex.sets.length; ++j)
    {
      set = ex.sets[j];
      if (set.doneAt != null && (latest == null || set.doneAt > latest))
      {
        latest = set.doneAt;
      }
    }
  }

  return latest;
}

/* import a backup, MERGING into current data (not replacing). a workout whose id
   already exists is overwritten by the imported copy; new ids are added. globals
   (rig, profile, sound) are only filled where the current value is unset, so an
   import never clobbers settings you already tuned on this device.

   returns a summary { added, replaced } for the confirmation message. throws on a
   malformed file — the caller shows the message and nothing is changed, because
   the parse happens before any mutation. */
function applyBackup(text)
{
  let parsed = parseBackup(text);
  let incoming = rebuildWorkouts(parsed);
  let g = parsed.globals;
  let existing_ids = {};
  let added = 0;
  let replaced = 0;
  let w;
  let i;

  for (i = 0; i < state.workouts.length; ++i)
  {
    existing_ids[state.workouts[i].id] = i;
  }

  for (i = 0; i < incoming.length; ++i)
  {
    w = incoming[i];
    if (existing_ids[w.id] != null)
    {
      state.workouts[existing_ids[w.id]] = w;
      ++replaced;
    }
    else
    {
      state.workouts.push(w);
      ++added;
    }
  }

  /* keep newest first, matching how newWorkout unshifts */
  state.workouts.sort(function(a, b)
  {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return 0;
  });

  if (g)
  {
    if (state.rig.anchorHeight == null) state.rig.anchorHeight = g.anchorHeight;
    if (state.rig.calX == null) state.rig.calX = g.calX;
    if (state.rig.calY == null) state.rig.calY = g.calY;
    if (state.rig.calRr == null) state.rig.calRr = g.calRr;
    if (state.profile.shoulderPushup == null) state.profile.shoulderPushup = g.shoulderPushup;
    if (state.profile.shoulderRow == null) state.profile.shoulderRow = g.shoulderRow;
    if (state.profile.arm == null) state.profile.arm = g.arm;
  }

  /* presets are derived — rebuild them from the merged set of workouts */
  for (i = 0; i < state.workouts.length; ++i)
  {
    state.workouts[i].exercises.forEach(touchPreset);
  }

  return { added: added, replaced: replaced };
}

/* ======== rest timer ======== */
let timer = null; /* { since, target, label, setId } */
let tick_handle = null, beeped = false, audio_ctx = null;
let workout_duration_handle = null;
function beep()
{
  if (!state.settings.sound) return;
  try
  {
    audio_ctx = audio_ctx || new (window.AudioContext || window.webkitAudioContext)();
    let oscillator = audio_ctx.createOscillator();
    let gain = audio_ctx.createGain();
    oscillator.type = 'square'; oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, audio_ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio_ctx.currentTime + 0.35);
    oscillator.connect(gain); gain.connect(audio_ctx.destination);
    oscillator.start(); oscillator.stop(audio_ctx.currentTime + 0.36);
  }
  catch(e)
  {}
  if (navigator.vibrate) 
  {
    try
    {
      navigator.vibrate(200); 
    }
    catch(e)
    {} 
  }
}
function startTimer(target, label, setId)
{
  timer = { since: Date.now(), target: target, label: label, setId: setId };
  beeped = false;
  document.getElementById('timerbar').classList.remove('hidden');
  if (!tick_handle) tick_handle = setInterval(tick, 250);
  tick();
}
function stopTimer()
{
  timer = null;
  document.getElementById('timerbar').classList.add('hidden');
  if (tick_handle)
  {
    clearInterval(tick_handle); tick_handle = null; 
  }
  save();
}
function tick()
{
  if (!timer) return;
  let el = Math.floor((Date.now() - timer.since)/1000);
  let remaining = timer.target - el;
  let bar = document.getElementById('timerbar');
  let over = el >= timer.target;
  let frac = Math.min(100, (el/Math.max(1, timer.target))*100);
  bar.classList.toggle('over', over);
  document.getElementById('tlab').textContent = timer.label;

  if (state.settings.countdown)
  {
    /* remaining time, then overtime once it passes zero */
    document.getElementById('tmain').textContent = over ? '+' + fmtRest(-remaining) : fmtRest(remaining);
    document.getElementById('ttarget').textContent = over ? 'over ' + fmtRest(timer.target) : 'of ' + fmtRest(timer.target);
    /* the bar drains toward empty, matching the countdown */
    document.getElementById('tfill').style.width = (100 - frac) + '%';
  }
  else
  {
    document.getElementById('tmain').textContent = over ? '+' + fmtRest(el - timer.target) : fmtRest(el);
    document.getElementById('ttarget').textContent = over ? 'rested ' + fmtRest(timer.target) : '/ ' + fmtRest(timer.target);
    document.getElementById('tfill').style.width = frac + '%';
  }

  if (over && !beeped)
  {
    beeped = true; beep(); 
  }
}

function updateWorkoutDurationLabel()
{
  let workout = activeWorkout();
  let label = document.getElementById('workout_duration_label');

  if (!label || !workout)
  {
    return;
  }

  label.textContent = workoutDurationLabel(workout);
}

function syncWorkoutDurationHandle()
{
  let workout = activeWorkout();
  let should_tick = ui.view == 'workout' && workout && workout.startedAt != null && !workout.finished;

  if (should_tick)
  {
    if (!workout_duration_handle)
    {
      workout_duration_handle = setInterval(updateWorkoutDurationLabel, 1000);
    }
  }
  else if (workout_duration_handle)
  {
    clearInterval(workout_duration_handle);
    workout_duration_handle = null;
  }

  updateWorkoutDurationLabel();
}

/* ======== actions on sets ======== */
function completeSet(setId)
{
  let w = activeWorkout(); let hit = findSet(w, setId); if (!hit) return;
  let ex = hit.ex, s = hit.set;
  let now = Date.now();
  ensureWorkoutStarted(w, now);
  if (s.reps == null) s.reps = s.target != null ? s.target : 0;
  s.status = 'done_clean';
  s.doneAt = now;   /* the raw fact; cycle and work are derived from it */
  let isRung = ex.mode=='ladder';
  let target = ex.restSet, label = ex.name + ' · set rest';
  if (isRung)
  {
    let more = ex.sets.some(function(x)
    {
      return x.ladderIndex==s.ladderIndex && (x.rungIndex||0) > (s.rungIndex||0) && x.status=='planned'; 
    });
    if (more)
    {
      target = ex.restRung; label = ex.name + ' · rung rest'; s.restTarget = ex.restRung; 
    }
    else 
    {
      target = ex.restSet; label = ex.name + ' · ladder rest'; s.restTarget = ex.restSet; 
    }
  }
  else 
  {
    s.restTarget = ex.restSet;
  }
  startTimer(target, label, s.id);
  touchPreset(ex);
  save(); render();
}
function setStatus(setId, status)
{
  let w = activeWorkout(); let hit = findSet(w, setId); if (!hit) return;
  let s = hit.set;
  let now;
  if (!isDone(s) && (status=='done_ugly' || status=='pain'))
  {
    if (s.reps==null) s.reps = s.target||0; 
  }
  s.status = status;
  /* stamp the first transition into a performed state; re-tagging clean->ugly
     later must not move the timestamp, or the derived cycle would shift */
  if (isPerformed(s) && s.doneAt == null)
  {
    now = Date.now();
    ensureWorkoutStarted(w, now);
    s.doneAt = now;
  }
  if (status=='pain')
  {
    ui.painExId = hit.ex.id; 
  }
  if (status=='failed' || status=='skipped')
  {
    if (s.reps==null) s.reps = 0; 
  }
  save(); render();
}

/* ======== clone / sample ======== */
function cloneWorkout(srcId, applyProg)
{
  let src = findWorkout(srcId); if (!src) return;
  let w = newWorkout(src.name);
  src.exercises.forEach(function(sx)
  {
    let ex = makeExercise({ name:sx.name, mode:sx.mode, setup:sx.setup, restSet:sx.restSet, restRung:sx.restRung,
      ring: sx.ring ? { type:(sx.ring.type||(sx.ring.enabled?'pushup':'none')), Rr:sx.ring.Rr, H:sx.ring.H } : { type:'none', Rr:null, H:null } });
    let sug = suggestForExercise(sx);
    if (sx.mode=='ladder')
    {
      ex.sets = buildLadderSets(applyProg ? sug.ladders : (rungsOf(sx).length ? rungsOf(sx) : [[1]]));
    }
    else 
    {
      let unit = (sx.sets.find(function(s)
      {
        return s.unit;
      })||{}).unit || 'kg';
      let targets = applyProg ? sug.targets
        : sx.sets.map(function(s)
        {
          return { reps: s.target!=null?s.target:(s.reps||0), load: s.load }; 
        });
      if (!targets.length) targets = [{reps:0}];
      ex.sets = buildSetsFromTargets(targets, unit);
    }
    if (applyProg && sug.warn) ex.notes = '⚠ ' + sug.reason;
    w.exercises.push(ex);
  });
  ui.view = 'workout'; ui.overlay = null;
  save(); render(); window.scrollTo(0,0);
}
function loadSample()
{
  let sample = exerciseLibrary().sampleWorkout;
  let w;
  let ex;
  let src;
  let unit;
  let i;

  if (!sample || !sample.exercises || !sample.exercises.length)
  {
    return;
  }

  w = newWorkout(sample.name || 'Sample Workout');
  w.exercises = [];
  for (i = 0; i < sample.exercises.length; ++i)
  {
    src = sample.exercises[i];
    ex = makeExercise({
      name: src.name,
      mode: src.mode,
      setup: src.setup,
      restSet: src.restSet,
      restRung: src.restRung,
      ring: src.ring ? { type: src.ring.type || 'none', Rr: src.ring.Rr, H: src.ring.H } : { type:'none', Rr:null, H:null }
    });
    if (src.mode == 'ladder')
    {
      ex.sets = buildLadderSets(src.ladders && src.ladders.length ? src.ladders : [[1]]);
    }
    else
    {
      unit = src.unit || 'kg';
      ex.sets = buildSetsFromTargets(src.targets && src.targets.length ? src.targets : [{ reps: 0 }], unit);
    }
    w.exercises.push(ex);
  }
  w.exercises.forEach(touchPreset);
  ui.view = 'workout';
  save(); render(); window.scrollTo(0,0);
}

/* ======== add-exercise helpers ======== */
function openAddEx(editExId, prefillName)
{
  let w = activeWorkout();
  let d = { name: prefillName||'', mode:'straight', targets:'8 / 8 / 8', tops:'3 3 2', rest:'2:30', rrest:'0:20', setup:'', ringType:'none', ringRr:'', ringH:'' };
  if (editExId && w)
  {
    let ex = findEx(w, editExId);
    if (ex)
    {
      d.name = ex.name; d.mode = ex.mode; d.setup = ex.setup;
      d.rest = fmtRest(ex.restSet); d.rrest = fmtRest(ex.restRung);
      d.ringType = (ex.ring && ex.ring.type) ? ex.ring.type : (ex.ring && ex.ring.enabled ? 'pushup' : 'none');
      d.ringRr = ex.ring && ex.ring.Rr!=null ? String(ex.ring.Rr) : '';
      d.ringH = ex.ring && ex.ring.H!=null ? String(ex.ring.H) : '';
      if (ex.mode=='ladder') d.tops = laddersLabel(rungsOf(ex));
      else d.targets = ex.sets.map(function(s)
      {
        return (s.load!=null? s.load+'x':'')+(s.target!=null?s.target:(s.reps||0)); 
      }).join(' / ');
    }
  }
  ui.overlay = { type:'addex', editExId: editExId||null, draft: d, afterExId: null };
  render();
}
function applyPresetToDraft(d)
{
  let p = state.presets[(d.name||'').trim().toLowerCase()];
  if (!p)
  {
    applyLibraryExerciseToDraft(d);
    return;
  }
  d.mode = p.mode || d.mode;
  d.setup = p.setup || d.setup;
  if (p.restSet!=null) d.rest = fmtRest(p.restSet);
  if (p.restRung!=null) d.rrest = fmtRest(p.restRung);
  if (p.mode=='ladder' && p.lastLadders && p.lastLadders.length) d.tops = laddersLabel(p.lastLadders);
  else if (p.mode=='ladder' && p.lastTops && p.lastTops.length) d.tops = p.lastTops.join(' ');  /* pre-rung-list preset */
  else if (p.lastTargets && p.lastTargets.length)
  {
    d.targets = p.lastTargets.map(function(t)
    {
      return (t.load!=null? t.load+'x':'')+t.reps; 
    }).join(' / ');
  }
  if (p.ring)
  {
    d.ringType = p.ring.type || 'pushup'; d.ringRr = p.ring.Rr!=null?String(p.ring.Rr):''; d.ringH = p.ring.H!=null?String(p.ring.H):''; 
  }
}
function draftRing(d)
{
  let Rr = parseFloat(d.ringRr), H = parseFloat(d.ringH);
  return { type: d.ringType || 'none', Rr: isNaN(Rr) ? null : Rr, H: isNaN(H) ? null : H };
}
function saveAddEx()
{
  let o = ui.overlay; if (!o || o.type!='addex') return;
  let w = activeWorkout(); if (!w)
  {
    w = newWorkout('Workout'); ui.view='workout'; 
  }
  let d = o.draft;
  let name = (d.name||'').trim(); if (!name) return;
  let restSet = parseRest(d.rest); if (restSet==null) restSet = 150;
  let restRung = parseRest(d.rrest); if (restRung==null) restRung = 20;

  if (o.editExId)
  {
    let ex = findEx(w, o.editExId); if (!ex) return;
    ex.name = name; ex.setup = d.setup; ex.restSet = restSet; ex.restRung = restRung;
    ex.ring = draftRing(d);
    /* keep performed sets, rebuild the planned remainder from the edited targets */
    let performed = ex.sets.filter(isPerformed);
    {
      ex.mode = d.mode;
      let fresh;
      if (d.mode=='ladder')
      {
        let ladder_rungs = parseLadders(d.tops); if (!ladder_rungs.length) ladder_rungs=[[1]];
        ex.sets = rebuildLadderSets(ex, ladder_rungs);
      }
      else 
      {
        let tg = parseTargets(d.targets); if (!tg.length) tg=[{reps:0}];
        fresh = buildSetsFromTargets(tg.slice(performed.length), 'kg');
        if (d.mode!='weighted') fresh.forEach(function(s)
        {
          if (!performed.length) 
          {
            s.load=null; s.unit=null; 
          } 
        });
        ex.sets = performed.concat(fresh);
      }
    }
    touchPreset(ex);
  }
  else 
  {
    let nx = makeExercise({ name:name, mode:d.mode, setup:d.setup, restSet:restSet, restRung:restRung, ring:draftRing(d) });
    if (d.mode=='ladder')
    {
      let ladder_rungs = parseLadders(d.tops); if (!ladder_rungs.length) ladder_rungs=[[1]];
      nx.sets = buildLadderSets(ladder_rungs);
    }
    else 
    {
      let tt = parseTargets(d.targets); if (!tt.length) tt=[{reps: d.mode=='timed'?30:8}];
      nx.sets = buildSetsFromTargets(tt, 'kg');
    }
    if (o.afterExId)
    {
      let i = w.exercises.findIndex(function(e)
      {
        return e.id==o.afterExId; 
      });
      w.exercises.splice(i+1, 0, nx);
    }
    else w.exercises.push(nx);
    touchPreset(nx);
  }
  ui.overlay = null; ui.painExId = null;
  save(); render();
}

/* ======== event wiring ======== */
function closeOverlay()
{
  ui.overlay = null;
}

function openWorkoutById(id)
{
  state.activeId = id;
  ui.view = 'workout';
  save();
  render();
  window.scrollTo(0, 0);
}

function shiftCalendarMonth(delta)
{
  ui.calM += delta;

  if (ui.calM < 0)
  {
    ui.calM = 11;
    --ui.calY;
  }
  else if (ui.calM > 11)
  {
    ui.calM = 0;
    ++ui.calY;
  }

  ui.calSel = null;
  render();
}

function lastDoneSetOf(ex)
{
  let i;

  for (i = ex.sets.length - 1; i >= 0; --i)
  {
    if (isDone(ex.sets[i]))
    {
      return ex.sets[i];
    }
  }

  return null;
}

function deleteExerciseFromWorkout(workout, exId)
{
  let keep = [];
  let i;

  for (i = 0; i < workout.exercises.length; ++i)
  {
    if (workout.exercises[i].id != exId)
    {
      keep.push(workout.exercises[i]);
    }
  }

  workout.exercises = keep;
}

function moveExercise(workout, exId, delta)
{
  let i;
  let j;
  let tmp;

  for (i = 0; i < workout.exercises.length; ++i)
  {
    if (workout.exercises[i].id != exId)
    {
      continue;
    }

    j = i + delta;
    if (j < 0 || j >= workout.exercises.length)
    {
      return;
    }

    tmp = workout.exercises[i];
    workout.exercises[i] = workout.exercises[j];
    workout.exercises[j] = tmp;
    return;
  }
}

function copyExportText()
{
  copyTextAreaValue('expout', 'copymsg');
}

function copyTextAreaValue(out_id, msg_id)
{
  let out = document.getElementById(out_id);
  let msg = document.getElementById(msg_id);

  function ok()
  {
    if (msg)
    {
      msg.textContent = 'copied ✓';
    }
  }

  function fail()
  {
    if (!out)
    {
      return;
    }

    out.focus();
    out.select();

    try 
    {
      document.execCommand('copy');
      ok();
    }
    catch (e)
    {
      if (msg)
      {
        msg.textContent = 'select & copy manually';
      }
    }
  }

  if (!out)
  {
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText)
  {
    navigator.clipboard.writeText(out.value).then(ok, fail);
    return;
  }

  fail();
}

function downloadTextAreaValue(out_id, name, mime_type)
{
  let out = document.getElementById(out_id);
  let blob;
  let link;

  if (!out)
  {
    return;
  }

  blob = new Blob([out.value], {
    type: mime_type
  });

  link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(function()
  {
    URL.revokeObjectURL(link.href);
  }, 4000);
}

/* read a chosen backup file and merge it. FileReader is genuinely async I/O, so
   this is the one place a callback is unavoidable. errors from a bad file are
   caught HERE, at the boundary, and shown to the user — parseBackup asserts, so a
   malformed file throws before any state is touched and nothing gets half-imported. */
function importBackupFile(input)
{
  let reader;

  if (!input.files || !input.files.length)
  {
    return;
  }

  reader = new FileReader();
  reader.onload = function()
  {
    let result;

    try
    {
      result = applyBackup(reader.result);
    }
    catch (e)
    {
      ui.importMsg = { text: 'import failed: ' + e.message, kind: 'bad' };
      input.value = '';   /* let the same file be re-picked after a fix */
      render();
      return;
    }

    save();
    input.value = '';
    ui.importMsg = { text: 'imported — ' + result.added + ' added, ' + result.replaced + ' replaced', kind: 'ok' };
    render();
  };

  reader.readAsText(input.files[0]);
}

function downloadExportText(workout)
{
  let ext;
  let name;

  if (ui.expFmt == 'backup')
  {
    ext = 'txt';
    name = 'workout-backup-' + todayISO() + '.' + ext;
  }
  else
  {
    if (!workout)
    {
      return;
    }
    ext = ui.expFmt == 'csv' ? 'csv' : 'txt';
    name = 'workout-' + workout.date + '.' + ext;
  }

  downloadTextAreaValue('expout', name, ext == 'csv' ? 'text/csv' : 'text/plain');
}

function downloadSettingsBackup()
{
  downloadTextAreaValue('settings_backup_out', 'workout-backup-' + todayISO() + '.txt', 'text/plain');
}

document.addEventListener('click', function(ev)
{
  let target = ev.target.closest('[data-a]');
  let action;
  let workout = activeWorkout();
  let draft;
  let ex;
  let hit;
  let i;
  let rungIndex;
  let ladder_index;
  let rung_count;
  let value;
  let top;
  let ladders;
  let next_ladder;
  let rest_anchor;

  if (!target)
  {
    if (ev.target.id == 'overlay')
    {
      closeOverlay();
      render();
    }
    return;
  }

  action = target.dataset.a;

  switch (action)
  {
    case 'sound-toggle':
      state.settings.sound = !state.settings.sound;
      save();
      render();
      return;

    case 'settings-open':
      ui.overlay = { type: 'settings' };
      render();
      return;

    case 'section-toggle':
      toggleSection(target.dataset.key, target.dataset.default == 'open');
      render();
      return;

    case 'exercise-editor-open':
      ui.overlay = { type: 'exercise-editor', draft: buildExerciseEditorDraft(), openIdx: -1 };
      render();
      return;

    case 'exercise-editor-add':
      if (ui.overlay && ui.overlay.type == 'exercise-editor')
      {
        ui.overlay.draft.push({
          name: '',
          mode: 'straight',
          setup: '',
          rest: '2:30',
          rrest: '0:20',
          targets: '8 / 8 / 8',
          ladders: '3 3 2',
          unit: '',
          ringType: 'none',
          ringRr: '',
          ringH: ''
        });
        ui.overlay.openIdx = ui.overlay.draft.length - 1;
        render();
      }
      return;

    case 'exercise-editor-toggle':
      if (ui.overlay && ui.overlay.type == 'exercise-editor')
      {
        if (ui.overlay.openIdx == parseInt(target.dataset.idx, 10))
        {
          ui.overlay.openIdx = -1;
        }
        else
        {
          ui.overlay.openIdx = parseInt(target.dataset.idx, 10);
        }
        render();
      }
      return;

    case 'exercise-editor-delete':
      if (ui.overlay && ui.overlay.type == 'exercise-editor')
      {
        let deleted_idx = parseInt(target.dataset.idx, 10);
        ui.overlay.draft.splice(deleted_idx, 1);
        if (ui.overlay.openIdx == deleted_idx)
        {
          ui.overlay.openIdx = -1;
        }
        else if (ui.overlay.openIdx > deleted_idx)
        {
          --ui.overlay.openIdx;
        }
        render();
      }
      return;

    case 'exercise-editor-cancel':
      ui.overlay = { type: 'settings' };
      render();
      return;

    case 'exercise-editor-save':
      if (ui.overlay && ui.overlay.type == 'exercise-editor')
      {
        saveExerciseEditor(ui.overlay.draft);
      }
      return;

    case 'workout-show-all':
      if (workout)
      {
        setWorkoutExercisesOpen(workout, true);
        render();
      }
      return;

    case 'workout-hide-all':
      if (workout)
      {
        setWorkoutExercisesOpen(workout, false);
        render();
      }
      return;

    case 'exercise-toggle':
      if (workout)
      {
        toggleSection(workoutExerciseSectionKey(workout.id, target.dataset.ex), false);
        render();
      }
      return;

    case 'workout-day-prev':
    case 'workout-day-next':
      if (workout)
      {
        let target_workout = adjacentLoggedDayWorkout(workout, action == 'workout-day-prev' ? -1 : 1);

        if (target_workout)
        {
          openWorkoutById(target_workout.id);
        }
      }
      return;

    case 'exercise-js-copy':
      refreshOverlayOutputs();
      copyTextAreaValue('exercise_js_out', 'exercise_js_copymsg');
      return;

    case 'exercise-js-download':
      downloadExerciseLibraryJS();
      return;

    case 'timer-dir':
      state.settings.countdown = target.dataset.d == 'down';
      save();
      render();
      tick();
      return;

    case 'ex-pick':
      if (!ui.overlay || ui.overlay.type != 'addex')
      {
        return;
      }
      draft = ui.overlay.draft;
      draft.name = target.dataset.name;
      if (!ui.overlay.editExId)
      {
        applyPresetToDraft(draft);
      }
      render();
      return;

    case 'cal-apply':
      rest_anchor = calibrateAnchor(state.rig.calX, state.rig.calY, state.rig.calRr);
      if (rest_anchor != null && !isNaN(rest_anchor) && rest_anchor > 0)
      {
        state.rig.anchorHeight = Math.round(rest_anchor*10)/10;
        save();
        render();
      }
      return;

    case 'nav-home':
      ui.view = 'home';
      ui.menuExId = null;
      ui.editSetId = null;
      render();
      return;

    case 'new-workout':
      newWorkout('Workout');
      ui.view = 'workout';
      save();
      render();
      return;

    case 'begin-workout':
      if (workout)
      {
        ensureWorkoutStarted(workout);
        save();
        render();
      }
      return;

    case 'workout-menu-open':
      if (workout)
      {
        ui.overlay = { type: 'workout-menu', wid: workout.id };
        render();
      }
      return;

    case 'fix-times-open':
      if (workout)
      {
        ui.overlay = { type: 'fix-times', wid: workout.id, draft: buildFixTimesDraft(workout) };
        render();
      }
      return;

    case 'fix-times-back':
      if (workout)
      {
        ui.overlay = { type: 'workout-menu', wid: workout.id };
        render();
      }
      return;

    case 'fix-times-save':
      if (workout && ui.overlay && ui.overlay.type == 'fix-times')
      {
        saveFixTimes(workout, ui.overlay.draft);
      }
      return;

    case 'workout-delete':
      if (workout && confirm('Delete this workout and all of its exercises and sets?'))
      {
        deleteWorkout(workout);
      }
      return;

    case 'sample':
      loadSample();
      return;

    case 'open-workout':
      openWorkoutById(target.dataset.id);
      return;

    case 'home-tab':
      ui.homeTab = target.dataset.t;
      render();
      return;

    case 'cal-prev':
      shiftCalendarMonth(-1);
      return;

    case 'cal-next':
      shiftCalendarMonth(1);
      return;

    case 'cal-day':
      ui.calSel = ui.calSel == target.dataset.d ? null : target.dataset.d;
      render();
      return;

    case 'finish-workout':
      if (workout)
      {
        let now = Date.now();
        ensureWorkoutStarted(workout, now);
        workout.finishedAt = now;
        workout.finished = true;
        stopTimer();
        ui.view = 'home';
        save();
        render();
      }
      return;

    case 'reopen-workout':
      if (workout)
      {
        workout.finishedAt = null;
        workout.finished = false;
        save();
        render();
      }
      return;

    case 'clone-open':
      ui.overlay = { type: 'clone', srcId: state.workouts[0] && state.workouts[0].id, prog: true };
      render();
      return;

    case 'clone-start':
      cloneWorkout(target.dataset.src, ui.overlay && ui.overlay.prog);
      return;

    case 'export-open':
      ui.importMsg = null;
      ui.overlay = { type: 'export', wid: workout && workout.id };
      render();
      return;

    case 'exp-fmt':
      ui.expFmt = target.dataset.f;
      render();
      return;

    case 'exp-copy':
      copyExportText();
      return;

    case 'exp-download':
      downloadExportText(workout);
      return;

    case 'import-pick':
      if (document.getElementById('importfile'))
      {
        document.getElementById('importfile').click();
      }
      return;

    case 'settings-backup-copy':
      copyTextAreaValue('settings_backup_out', 'settings_copymsg');
      return;

    case 'settings-backup-download':
      downloadSettingsBackup();
      return;

    case 'settings-import-pick':
      if (document.getElementById('settings_importfile'))
      {
        document.getElementById('settings_importfile').click();
      }
      return;

    case 'addex-open':
      openAddEx(null);
      return;

    case 'ax-mode':
      if (ui.overlay)
      {
        ui.overlay.draft.mode = target.dataset.m;
        render();
      }
      return;

    case 'ax-save':
      saveAddEx();
      return;

    case 'overlay-close':
      closeOverlay();
      render();
      return;

    case 'ex-menu':
      ui.menuExId = ui.menuExId == target.dataset.ex ? null : target.dataset.ex;
      render();
      return;

    case 'ex-menu-close':
      ui.menuExId = null;
      render();
      return;

    case 'ex-edit':
      ui.menuExId = null;
      openAddEx(target.dataset.ex);
      return;

    case 'ex-delete':
      if (workout && confirm('Delete this exercise and its sets?'))
      {
        deleteExerciseFromWorkout(workout, target.dataset.ex);
        ui.menuExId = null;
        save();
        render();
      }
      return;

    case 'ex-up':
      if (workout)
      {
        moveExercise(workout, target.dataset.ex, -1);
        save();
        render();
      }
      return;

    case 'ex-down':
      if (workout)
      {
        moveExercise(workout, target.dataset.ex, 1);
        save();
        render();
      }
      return;

    case 'convert-ladder':
      ex = findEx(workout, target.dataset.ex);
      if (ex)
      {
        ex.mode = 'ladder';
        rungIndex = 1;
        for (i = 0; i < ex.sets.length; ++i)
        {
          if (ex.sets[i].ladderIndex == null)
          {
            ex.sets[i].ladderIndex = 1;
            ex.sets[i].rungIndex = rungIndex;
            ++rungIndex;
          }
        }
        ui.menuExId = null;
        save();
        render();
      }
      return;

    case 'convert-straight':
      ex = findEx(workout, target.dataset.ex);
      if (ex)
      {
        ex.mode = 'straight';
        for (i = 0; i < ex.sets.length; ++i)
        {
          ex.sets[i].ladderIndex = null;
          ex.sets[i].rungIndex = null;
        }
        ui.menuExId = null;
        save();
        render();
      }
      return;

    case 'stop-ex':
      ex = findEx(workout, target.dataset.ex);
      if (ex)
      {
        ex.stopped = true;
        ex.stopReason = 'pain';
        ui.painExId = ex.id;
        ui.menuExId = null;
        save();
        render();
      }
      return;

    case 'unstop-ex':
      ex = findEx(workout, target.dataset.ex);
      if (ex)
      {
        ex.stopped = false;
        ex.stopReason = null;
        ui.painExId = null;
        ui.menuExId = null;
        save();
        render();
      }
      return;

    case 'backoff':
      ex = findEx(workout, target.dataset.ex);
      if (ex)
      {
        ui.menuExId = null;
        ui.painExId = null;
        openAddEx(null, '');
        ui.overlay.afterExId = ex.id;
        ui.overlay.draft.setup = 'backoff of ' + ex.name;
        ui.overlay.draft.mode = ex.mode == 'ladder' ? 'straight' : ex.mode;
        render();
      }
      return;

    case 'pain-dismiss':
      ui.painExId = null;
      render();
      return;

    case 'notes-toggle':
      ui.notesExId = ui.notesExId == target.dataset.ex ? null : target.dataset.ex;
      render();
      return;

    case 'add-set':
      ex = findEx(workout, target.dataset.ex);
      if (ex)
      {
        let last = ex.sets[ex.sets.length - 1];
        ex.sets.push(makeSet({
          target: last ? (last.target != null ? last.target : last.reps) : 8,
          load: last ? last.load : null,
          unit: last ? last.unit : null
        }));
        save();
        render();
      }
      return;

    case 'repeat':
      ex = findEx(workout, target.dataset.ex);
      if (ex)
      {
        let last_done = lastDoneSetOf(ex);
        let now;
        if (last_done)
        {
          now = Date.now();
          ensureWorkoutStarted(workout, now);
          let repeated = makeSet({
            target: last_done.reps,
            reps: last_done.reps,
            load: last_done.load,
            unit: last_done.unit,
            status: 'done_clean'
          });
          repeated.doneAt = now;
          ex.sets.push(repeated);
          repeated.restTarget = ex.restSet;
          startTimer(ex.restSet, ex.name + ' · set rest', repeated.id);
          save();
          render();
        }
      }
      return;

    case 'add-rung':
      ex = findEx(workout, target.dataset.ex);
      if (ex)
      {
        ladder_index = parseInt(target.dataset.l, 10);
        rung_count = 0;
        top = 0;

        for (i = 0; i < ex.sets.length; ++i)
        {
          if (ex.sets[i].ladderIndex != ladder_index)
          {
            continue;
          }

          /* rung_count is the highest existing POSITION, top the highest REP
             target — the two are independent once rungs can be arbitrary */
          if ((ex.sets[i].rungIndex || 0) > rung_count)
          {
            rung_count = ex.sets[i].rungIndex || 0;
          }

          value = ex.sets[i].target != null ? ex.sets[i].target : ex.sets[i].reps;
          if ((value || 0) > top)
          {
            top = value || 0;
          }
        }

        /* sort the new rung last, then let normalizeLadders renumber: that is the
           single place guaranteeing contiguous positions, so a gap inherited from
           older data can't collide with the new rung's index */
        ex.sets.push(makeSet({
          ladderIndex: ladder_index,
          rungIndex: rung_count + 1,
          target: top + 1
        }));
        normalizeLadders(ex);
        save();
        render();
      }
      return;

    case 'add-ladder':
      ex = findEx(workout, target.dataset.ex);
      if (ex)
      {
        ladders = laddersOf(ex);
        next_ladder = (ladders.length ? ladders[ladders.length - 1].idx : 0) + 1;
        top = 3;

        if (ladders.length)
        {
          top = 0;
          for (i = 0; i < ladders[ladders.length - 1].sets.length; ++i)
          {
            if ((ladders[ladders.length - 1].sets[i].rungIndex || 1) > top)
            {
              top = ladders[ladders.length - 1].sets[i].rungIndex || 1;
            }
          }
        }

        for (i = 1; i <= top; ++i)
        {
          ex.sets.push(makeSet({
            ladderIndex: next_ladder,
            rungIndex: i,
            target: i
          }));
        }

        save();
        render();
      }
      return;

    case 'set-done':
      completeSet(target.dataset.set);
      return;

    case 'set-status':
      setStatus(target.dataset.set, target.dataset.st);
      return;

    case 'set-fail':
      setStatus(target.dataset.set, 'failed');
      return;

    case 'set-skip':
      setStatus(target.dataset.set, 'skipped');
      return;

    case 'set-unmark':
      hit = findSet(workout, target.dataset.set);
      if (hit)
      {
        hit.set.status = 'planned';
        hit.set.reps = null;
        hit.set.doneAt = null;
        ui.editSetId = null;
        save();
        render();
      }
      return;

    case 'set-edit':
      ui.editSetId = ui.editSetId == target.dataset.set ? null : target.dataset.set;
      render();
      return;

    case 'set-edit-close':
      ui.editSetId = null;
      save();
      render();
      return;

    case 'set-delete':
      hit = findSet(workout, target.dataset.set);
      if (hit)
      {
        hit.ex.sets = hit.ex.sets.filter(function(set)
        {
          return set.id != target.dataset.set;
        });
        normalizeLadders(hit.ex);   /* keep rungIndex contiguous — no gaps to inherit later */
        ui.editSetId = null;
        save();
        render();
      }
      return;

    case 'tgt-inc':
    case 'ed-inc':
    case 'tgt-dec':
    case 'ed-dec':
      hit = findSet(workout, target.dataset.set);
      if (hit)
      {
        let delta = action == 'tgt-inc' || action == 'ed-inc' ? 1 : -1;
        if (hit.set.status == 'planned')
        {
          hit.set.target = Math.max(0, (hit.set.target || 0) + delta);
        }
        else 
        {
          hit.set.reps = Math.max(0, (hit.set.reps || 0) + delta);
        }
        save();
        render();
      }
      return;

    case 'timer-stop':
      stopTimer();
      render();
      return;
  }
});

/* inputs (change + input events) */
document.addEventListener('input', function(ev)
{
  let target = ev.target;
  let field = target.dataset && target.dataset.field;
  let workout = activeWorkout();
  let ex;
  let draft;
  let ring_readout;
  let cal_readout;
  let hit;
  let num;

  function parseMaybeNumber(value)
  {
    let parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  if (!field)
  {
    return;
  }

  switch (field)
  {
    case 'wname':
      if (workout)
      {
        workout.name = target.value;
        save();
      }
      return;

    case 'exnotes':
      if (workout)
      {
        ex = findEx(workout, target.dataset.ex);
        if (ex)
        {
          ex.notes = target.value;
          save();
        }
      }
      return;
  }

  if (ui.overlay)
  {
    switch (ui.overlay.type)
    {
      case 'addex':
        draft = ui.overlay.draft;

        switch (field)
        {
          case 'ax-name':
            draft.name = target.value;
            ring_readout = document.getElementById('exList');
            if (ring_readout)
            {
              ring_readout.classList.add('open');
              updateExList(target.value);
            }
            return;

          case 'ax-targets':
            draft.targets = target.value;
            return;

          case 'ax-tops':
            draft.tops = target.value;
            return;

          case 'ax-rest':
            draft.rest = target.value;
            return;

          case 'ax-rrest':
            draft.rrest = target.value;
            return;

          case 'ax-setup':
            draft.setup = target.value;
            return;

          case 'ax-ring-rr':
          case 'ax-ring-h':
            if (field == 'ax-ring-rr')
            {
              draft.ringRr = target.value;
            }
            else
            {
              draft.ringH = target.value;
            }

            ring_readout = document.getElementById('ring_readout');
            if (ring_readout)
            {
              ring_readout.textContent = ringReadoutText(draft);
              ring_readout.classList.toggle('bad', ringReadoutBad(draft));
            }
            return;
        }
        break;

      case 'fix-times':
        draft = ui.overlay.draft;

        switch (field)
        {
          case 'ft-start-date':
            draft.startedDate = target.value;
            return;

          case 'ft-start-time':
            draft.startedTime = target.value;
            return;

          case 'ft-finish-date':
            draft.finishedDate = target.value;
            return;

          case 'ft-finish-time':
            draft.finishedTime = target.value;
            return;
        }
        break;

      case 'settings':
        switch (field)
        {
          case 'set-shoulder-push':
            state.profile.shoulderPushup = parseMaybeNumber(target.value);
            save();
            return;

          case 'set-shoulder-row':
            state.profile.shoulderRow = parseMaybeNumber(target.value);
            save();
            return;

          case 'set-arm':
            state.profile.arm = parseMaybeNumber(target.value);
            save();
            return;

          case 'set-anchor':
            state.rig.anchorHeight = parseMaybeNumber(target.value);
            save();
            return;

          case 'cal-x':
          case 'cal-y':
          case 'cal-rr':
            num = parseMaybeNumber(target.value);

            switch (field)
            {
              case 'cal-x':
                state.rig.calX = num;
                break;

              case 'cal-y':
                state.rig.calY = num;
                break;

              case 'cal-rr':
                state.rig.calRr = num;
                break;
            }

            cal_readout = document.getElementById('cal_readout');
            if (cal_readout)
            {
              cal_readout.textContent = calReadoutText();
            }
            save();
            return;
        }
        break;

      case 'exercise-editor':
        draft = ui.overlay.draft;

        switch (field)
        {
          case 'lib-name':
          case 'lib-setup':
          case 'lib-rest':
          case 'lib-rrest':
          case 'lib-targets':
          case 'lib-ladders':
          case 'lib-unit':
          case 'lib-ring-rr':
          case 'lib-ring-h':
            if (draft[parseInt(target.dataset.idx, 10)])
            {
              switch (field)
              {
                case 'lib-name':
                  draft[parseInt(target.dataset.idx, 10)].name = target.value;
                  break;

                case 'lib-setup':
                  draft[parseInt(target.dataset.idx, 10)].setup = target.value;
                  break;

                case 'lib-rest':
                  draft[parseInt(target.dataset.idx, 10)].rest = target.value;
                  break;

                case 'lib-rrest':
                  draft[parseInt(target.dataset.idx, 10)].rrest = target.value;
                  break;

                case 'lib-targets':
                  draft[parseInt(target.dataset.idx, 10)].targets = target.value;
                  break;

                case 'lib-ladders':
                  draft[parseInt(target.dataset.idx, 10)].ladders = target.value;
                  break;

                case 'lib-unit':
                  draft[parseInt(target.dataset.idx, 10)].unit = target.value;
                  break;

                case 'lib-ring-rr':
                  draft[parseInt(target.dataset.idx, 10)].ringRr = target.value;
                  break;

                case 'lib-ring-h':
                  draft[parseInt(target.dataset.idx, 10)].ringH = target.value;
                  break;
              }
            }
            return;
        }
        break;
    }
  }

  switch (field)
  {
    case 'ed-reps':
    case 'ed-load':
    case 'ed-note':
      hit = findSet(workout, target.dataset.set);
      if (!hit)
      {
        return;
      }

      switch (field)
      {
        case 'ed-note':
          hit.set.note = target.value;
          break;

        case 'ed-load':
          hit.set.load = parseMaybeNumber(target.value);
          if (hit.set.load != null && !hit.set.unit)
          {
            hit.set.unit = 'kg';
          }
          break;

        case 'ed-reps':
          num = parseInt(target.value, 10);
          if (hit.set.status == 'planned')
          {
            hit.set.target = isNaN(num) ? null : num;
          }
          else
          {
            hit.set.reps = isNaN(num) ? null : num;
          }
          break;
      }

      save();
      return;
  }
});

document.addEventListener('change', function(ev)
{
  let target = ev.target;
  let field = target.dataset && target.dataset.field;
  let workout = activeWorkout();
  let hit;

  if (target.id == 'importfile' || target.id == 'settings_importfile')
  {
    importBackupFile(target);
    return;
  }

  if (!field)
  {
    return;
  }

  switch (field)
  {
    case 'ed-unit':
      hit = findSet(workout, target.dataset.set);
      if (hit)
      {
        hit.set.unit = target.value;
        save();
        render();
      }
      return;

    case 'wdate':
      if (workout && target.value)
      {
        if (!setWorkoutDate(workout, target.value))
        {
          alert('Enter the workout date as YYYY-MM-DD.');
        }
      }
      return;

    case 'ft-start-date':
    case 'ft-start-time':
    case 'ft-finish-date':
    case 'ft-finish-time':
      if (ui.overlay && ui.overlay.type == 'fix-times')
      {
        switch (field)
        {
          case 'ft-start-date':
            ui.overlay.draft.startedDate = target.value;
            break;

          case 'ft-start-time':
            ui.overlay.draft.startedTime = target.value;
            break;

          case 'ft-finish-date':
            ui.overlay.draft.finishedDate = target.value;
            break;

          case 'ft-finish-time':
            ui.overlay.draft.finishedTime = target.value;
            break;
        }
      }
      return;

    case 'clone-src':
      if (ui.overlay)
      {
        ui.overlay.srcId = target.value;
        render();
      }
      return;

    case 'clone-prog':
      if (ui.overlay)
      {
        ui.overlay.prog = target.checked;
        render();
      }
      return;

    case 'ax-ring-type':
      if (ui.overlay && ui.overlay.type == 'addex')
      {
        ui.overlay.draft.ringType = target.value;
        render();
      }
      return;

    case 'lib-mode':
      if (ui.overlay && ui.overlay.type == 'exercise-editor' && ui.overlay.draft[parseInt(target.dataset.idx, 10)])
      {
        ui.overlay.draft[parseInt(target.dataset.idx, 10)].mode = target.value;
        render();
      }
      return;

    case 'lib-ring-type':
      if (ui.overlay && ui.overlay.type == 'exercise-editor' && ui.overlay.draft[parseInt(target.dataset.idx, 10)])
      {
        ui.overlay.draft[parseInt(target.dataset.idx, 10)].ringType = target.value;
        render();
      }
      return;

    case 'ed-reps':
    case 'ed-load':
    case 'ed-note':
      render();
      return;
  }
});

document.addEventListener('focusin', function(ev)
{
  let target = ev.target;
  let list;

  if (target && target.dataset && target.dataset.field == 'ax-name')
  {
    list = document.getElementById('exList');
    if (list)
    {
      list.classList.add('open');
      updateExList(target.value);
    }
  }
});

document.addEventListener('focusout', function(ev)
{
  let target = ev.target;

  if (target && target.dataset && target.dataset.field == 'ax-name')
  {
    setTimeout(function()
    {
      let list = document.getElementById('exList');
      if (list)
      {
        list.classList.remove('open');
      }
    }, 160);
  }
});

/* ======== boot ======== */
function boot()
{
  store.load().then(function(loaded)
  {
    let active_workout;

    if (loaded && loaded.workouts)
    {
      state = Object.assign(state, loaded); 
    }
    if (!state.settings) state.settings = { sound:true, countdown:false };
    if (state.settings.countdown == null) state.settings.countdown = false;
    if (!state.rig) state.rig = { anchorHeight:null, calX:null, calY:null, calRr:null };
    if (!state.profile) state.profile = { shoulderPushup:null, shoulderRow:null, arm:null };
    if (!state.exerciseLibrary)
    {
      state.exerciseLibrary = cloneLibraryExercises(rawExerciseLibrary().exercises);
    }
    /* migrate: the old single S was toe-to-shoulder, i.e. the pushup number */
    if (state.profile.shoulderPushup == null && state.profile.shoulder != null)
    {
      state.profile.shoulderPushup = state.profile.shoulder;
    }
    if (state.profile.shoulderRow == null) state.profile.shoulderRow = null;
    if (state.profile.arm == null) state.profile.arm = null;

    state.workouts.forEach(function(w)
    {
      let latest_done_at;

      if (w.startedAt == null)
      {
        w.startedAt = null;
      }
      if (w.finishedAt == null)
      {
        latest_done_at = latestDoneAtOfWorkout(w);
        w.finishedAt = w.finished ? (latest_done_at != null ? latest_done_at : w.startedAt) : null;
      }
      w.exercises.forEach(function(ex)
      {
        if (!ex.ring) ex.ring = { type:'none', Rr:null, H:null };
        if (ex.ring.type == null) ex.ring.type = ex.ring.enabled ? 'pushup' : 'none';
        /* heal ladders saved before positions were contiguous (1,2,3,5,6) —
           order is preserved, only the ordering keys are renumbered */
        normalizeLadders(ex);
        /* restActual conflated rest with the next set's work; doneAt replaces it */
        ex.sets.forEach(function(s)
        {
          if (s.restActual != null)
          {
            delete s.restActual;
          }
          if (s.doneAt == null)
          {
            s.doneAt = null;
          }
        });
      });
    });

    active_workout = activeWorkout();
    if (active_workout && !active_workout.finished) ui.view = 'workout';
    render();
  });
}

boot();
