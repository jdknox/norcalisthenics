/*
> [!WARNING]
> ⚠️ **AI-gerenated Code:**
*/

/* ======== rendering ======== */
function render()
{
  let app = document.getElementById('app');
  app.innerHTML = ui.view=='workout' && activeWorkout() ? renderWorkout(activeWorkout()) : renderHome();
  renderOverlay();
  document.getElementById('soundbtn').textContent = state.settings.sound ? '♪ on' : '♪ off';
  syncWorkoutDurationHandle();
}

function renderHome()
{
  let h = '';
  h += '<div class="eyebrow">// local · no account · export anytime</div>';
  h += '<h1 class="page">Workouts</h1>';
  h += '<p class="sub">One tap per set. Timers start themselves. Ladders are first class.</p>';
  h += '<div class="btnrow">';
  h += '<button class="btn primary" data-a="new-workout">+ New workout</button>';
  if (state.workouts.length) h += '<button class="btn" data-a="clone-open">⟳ Clone last workout</button>';
  h += '</div>';

  if (!state.workouts.length)
  {
    h += '<div class="empty">No workouts yet.<br>Start a new one, or <a data-a="sample">load a sample session</a> to see how it works.</div>';
    return h;
  }

  h += '<div class="hometabs">'
     + '<button class="'+(ui.homeTab=='list'?'on':'')+'" data-a="home-tab" data-t="list">list</button>'
     + '<button class="'+(ui.homeTab=='calendar'?'on':'')+'" data-a="home-tab" data-t="calendar">calendar</button>'
     + '</div>';

  if (ui.homeTab == 'calendar') return h + renderCalendar();

  h += '<div class="wlist">';
  state.workouts.forEach(function(w)
  {
    h += '<button class="witem" data-a="open-workout" data-id="'+w.id+'">'
      + '<span class="wdate">'+esc(w.date)+'</span>'
      + '<span class="flex"><span class="wname">'+esc(w.name)+'</span><br><span class="wsum">'
      + esc(workoutSummary(w))+'</span></span>'
      + (!w.finished ? '<span class="tag-live">OPEN</span>' : '')
      + '</button>';
  });
  h += '</div>';
  return h;
}

function renderCalendar()
{
  let byDate = workoutsByDate(state.workouts);
  let cells = monthCells(ui.calY, ui.calM);
  let today = todayISO();
  let month_count = state.workouts.filter(function(w)
  {
    let d = w.date.split('-'); return parseInt(d[0],10)==ui.calY && parseInt(d[1],10)-1==ui.calM;
  }).length;

  let h = '<div class="cal">';
  h += '<div class="cal-h">'
     + '<button class="nav" data-a="cal-prev" aria-label="previous month">‹</button>'
     + '<div class="mo">'+esc(isoOf(ui.calY, ui.calM, 1).slice(0, 7))+'</div>'
     + '<button class="nav" data-a="cal-next" aria-label="next month">›</button>'
     + '<div class="stat">'+month_count+(month_count==1?' workout':' workouts')+'</div>'
     + '</div>';

  h += '<div class="cal-grid">';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(function(d)
  {
    h += '<div class="cal-dow">'+d+'</div>'; 
  });
  cells.forEach(function(d)
  {
    if (d == null)
    {
      h += '<div class="cal-cell blank"></div>'; return; 
    }
    let iso = isoOf(ui.calY, ui.calM, d);
    let list = byDate[iso] || [];
    let cls = 'cal-cell';
    if (list.length) cls += ' has';
    if (iso == today) cls += ' today';
    if (iso == ui.calSel) cls += ' sel';
    h += '<'+(list.length ? 'button' : 'div')+' class="'+cls+'"'
       + (list.length ? ' data-a="cal-day" data-d="'+iso+'"' : '')+'>'
       + (list.length>1 ? '<span class="cnt">'+list.length+'</span>' : '')
       + '<span>'+d+'</span>'
       + (list.length ? '<span class="dot"></span>' : '')
       + '</'+(list.length ? 'button' : 'div')+'>';
  });
  h += '</div>';

  if (ui.calSel && byDate[ui.calSel])
  {
    h += '<div class="cal-day-panel">';
    h += '<div class="pd">'+esc(ui.calSel)+'</div>';
    h += '<div class="wlist">';
    byDate[ui.calSel].forEach(function(w)
    {
      h += '<button class="witem" data-a="open-workout" data-id="'+w.id+'">'
        + '<span class="flex"><span class="wname">'+esc(w.name)+'</span><br><span class="wsum">'
        + esc(workoutSummary(w))+'</span></span>'
        + (!w.finished ? '<span class="tag-live">OPEN</span>' : '')
        + '</button>';
    });
    h += '</div></div>';
  }
  h += '</div>';
  return h;
}

function renderWorkout(w)
{
  let h = '';
  h += '<div class="whead">'
    + '<button class="btn small ghost" data-a="nav-home">← back</button>'
    + '<input class="wname" data-field="wname" value="'+esc(w.name)+'" aria-label="workout name">'
    + '<input class="wdate-input" type="text" data-field="wdate" value="'+esc(w.date)+'" placeholder="YYYY-MM-DD" spellcheck="false" aria-label="workout date">'
    + '</div>';
  h += '<div class="btnrow" style="margin-bottom:14px">'
    + '<button class="btn small" data-a="export-open">⇪ Export</button>'
    + '<button class="btn small" data-a="addex-open">+ Add exercise</button>'
    + (!w.startedAt ? '<button class="btn small primary" data-a="begin-workout">▶ Begin Workout</button>' : '<span class="chip">began '+esc(fmtClockTs(w.startedAt))+'</span>')
    + (!w.finished ? '<button class="btn small" data-a="finish-workout">✓ Finish</button>' : '<button class="btn small ghost" data-a="reopen-workout">reopen</button>')
    + '<button class="btn small ghost" data-a="workout-menu-open">⋯</button>'
    + '</div>';
  h += '<div class="sub mono" style="margin:0 0 14px">Duration: <span id="workout_duration_label">'+esc(workoutDurationLabel(w))+'</span></div>';
  if (!w.exercises.length)
  {
    h += '<div class="empty">Add your first exercise.<br><span class="mono" style="font-size:12px;color:var(--faint)">Tap Done as each set happens — the rest timer starts itself.</span></div>';
  }
  w.exercises.forEach(function(ex)
  {
    h += renderCard(w, ex); 
  });
  return h;
}

function renderCard(w, ex)
{
  let h = '<section class="card'+(ex.stopped?' stopped':'')+'">';
  h += '<div class="card-h"><div class="exname">'+esc(ex.name)
     + '<span class="modechip">'+esc(ex.mode)+'</span></div>'
     + '<button class="iconbtn" data-a="ex-menu" data-ex="'+ex.id+'" aria-label="exercise menu">⋯</button></div>';
  if (ex.setup) h += '<div class="setupline">setup: '+esc(ex.setup)+'</div>';
  let ri = ringInfo(ex, state.rig, state.profile);
  if (ri) h += '<div class="ringline'+ringLineClass(ri)+'">'+esc(ri.text)+'</div>';
  h += '<div class="restline">rest '+fmtRest(ex.restSet)+(ex.mode=='ladder' ? ' · rung '+fmtRest(ex.restRung) : '')+'</div>';

  let perf = ex.sets.filter(isPerformed);
  if (perf.length)
  {
    let sug = suggestForExercise(ex);
    h += '<div class="nextline"><span class="k">next time → </span><span class="'+(sug.warn?'warn':'v')+'">'
       + esc(targetsLabel(sug)) + '</span> <span class="k">· '+esc(sug.reason)+'</span></div>';
  }
  if (ex.stopped) h += '<div class="stoppedline">■ stopped'+(ex.stopReason ? ' — '+esc(ex.stopReason) : '')+'</div>';

  if (ui.menuExId == ex.id) h += renderMenu(w, ex);
  if (ui.painExId == ex.id && !ex.stopped)
  {
    h += '<div class="painbar">Pain marked on this exercise.'
      + '<div class="btnrow"><button class="btn small danger" data-a="stop-ex" data-ex="'+ex.id+'">Stop exercise</button>'
      + '<button class="btn small" data-a="backoff" data-ex="'+ex.id+'">Add backoff exercise</button>'
      + '<button class="btn small ghost" data-a="pain-dismiss">Continue</button></div></div>';
  }

  h += '<div class="card-body">';
  if (ex.mode == 'ladder')
  {
    laddersOf(ex).forEach(function(L)
    {
      h += '<div class="ladder"><div class="ladder-h">Ladder '+L.idx+'<span class="fill"></span></div>';
      L.sets.forEach(function(s)
      {
        h += renderSetRow(ex, s); if (ui.editSetId==s.id) h += renderSetEdit(ex, s); 
      });
      if (!ex.stopped) h += '<button class="btn small ghost addrung" data-a="add-rung" data-ex="'+ex.id+'" data-l="'+L.idx+'">+ rung</button>';
      h += '</div>';
    });
  }
  else 
  {
    ex.sets.forEach(function(s)
    {
      h += renderSetRow(ex, s); if (ui.editSetId==s.id) h += renderSetEdit(ex, s); 
    });
  }
  h += '</div>';

  if (ui.notesExId == ex.id)
  {
    h += '<div class="exnotes"><textarea data-field="exnotes" data-ex="'+ex.id+'" placeholder="exercise notes…">'+esc(ex.notes)+'</textarea></div>';
  }

  h += '<div class="card-f">';
  if (!ex.stopped)
  {
    if (ex.mode == 'ladder')
    {
      h += '<button class="btn small" data-a="add-ladder" data-ex="'+ex.id+'">+ ladder</button>';
    }
    else 
    {
      h += '<button class="btn small" data-a="add-set" data-ex="'+ex.id+'">+ set</button>';
      let last_done = ex.sets.filter(isDone).slice(-1)[0];
      if (last_done) h += '<button class="btn small" data-a="repeat" data-ex="'+ex.id+'">↻ repeat '+ (ex.mode=='timed' ? last_done.reps+'s' : (last_done.load!=null? last_done.load+'×':'')+last_done.reps) +'</button>';
    }
  }
  h += '<button class="btn small ghost" data-a="notes-toggle" data-ex="'+ex.id+'">notes'+(ex.notes?' •':'')+'</button>';
  h += '</div></section>';
  return h;
}

function renderSetRow(ex, s)
{
  let label = ex.mode=='ladder' ? 'r'+(s.rungIndex||'') : '#'+(ex.sets.indexOf(s)+1);
  let planned = s.status == 'planned';
  let h = '<div class="set '+(planned?'planned':'')+'">';
  h += '<span class="idx">'+esc(label)+'</span>';
  if (planned && !ex.stopped) h += '<button class="stp" data-a="tgt-dec" data-set="'+s.id+'" aria-label="decrease target">−</button>';
  let valTxt;
  if (planned) valTxt = (s.load!=null ? '<span class="u">'+esc(s.load)+(s.unit||'kg')+'×</span>' : '') + (s.target!=null?s.target:'?') + (ex.mode=='timed'?'<span class="u">s</span>':'');
  else valTxt = (s.load!=null ? '<span class="u">'+esc(s.load)+(s.unit||'kg')+'×</span>' : '') + (s.reps!=null?s.reps:'—') + (ex.mode=='timed'?'<span class="u">s</span>':'');
  h += '<button class="val" data-a="set-edit" data-set="'+s.id+'" title="edit">'+valTxt+'</button>';
  if (planned && !ex.stopped) h += '<button class="stp" data-a="tgt-inc" data-set="'+s.id+'" aria-label="increase target">+</button>';
  if (s.note) h += '<span class="note-ind" title="'+esc(s.note)+'">✎</span>';
  h += '<div class="actions">';
  if (planned)
  {
    if (!ex.stopped)
    {
      h += '<button class="minor" data-a="set-fail" data-set="'+s.id+'">fail</button>';
      h += '<button class="minor" data-a="set-skip" data-set="'+s.id+'">skip</button>';
      h += '<button class="done-btn" data-a="set-done" data-set="'+s.id+'">DONE</button>';
    }
    else 
    {
      h += '<span class="status-word skipped">—</span>';
    }
  }
  else if (isDone(s))
  {
    h += '<div class="chips">'
      + '<button class="chip '+(s.status=='done_clean'?'on-clean':'')+'" data-a="set-status" data-set="'+s.id+'" data-st="done_clean">clean</button>'
      + '<button class="chip '+(s.status=='done_ugly'?'on-ugly':'')+'" data-a="set-status" data-set="'+s.id+'" data-st="done_ugly">ugly</button>'
      + '<button class="chip '+(s.status=='pain'?'on-pain':'')+'" data-a="set-status" data-set="'+s.id+'" data-st="pain">pain</button>'
      + '</div>';
  }
  else 
  {
    h += '<span class="status-word '+esc(s.status)+'">'+esc(s.status)+'</span>'
      + '<button class="minor" data-a="set-unmark" data-set="'+s.id+'">undo</button>';
  }
  h += '</div></div>';
  return h;
}

function renderSetEdit(ex, s)
{
  let planned = s.status=='planned';
  let timings = setTimings(ex);
  let t = timings[s.id];
  let h = '<div class="setedit">';

  if (t)
  {
    switch (t.status)
    {
      case 'exact':
        h += '<div class="timing"><b>'+esc(fmtDur(t.work))+'</b> held'
           + ' <span class="k">· '+esc(fmtDur(t.rest))+' actual rest before it, from a '+esc(fmtDur(t.cycle))+' gap</span></div>';
        break;

      case 'estimate':
        h += '<div class="timing">≈ <b>'+esc(fmtDur(t.work))+'</b> under tension'
           + ' <span class="k">· '+esc(fmtDur(t.cycle))+' gap less the '+esc(fmtRest(t.rest_target))+' rest target</span></div>';
        break;

      case 'early':
        h += '<div class="timing off">'+esc(fmtDur(t.cycle))+' gap'
           + ' <span class="k">· shorter than the '+esc(fmtRest(t.rest_target))+' rest target, so you went before the beep and the set length cannot be split out</span></div>';
        break;

      case 'lingered':
        h += '<div class="timing off">'+esc(fmtDur(t.cycle))+' gap'
           + ' <span class="k">· far past the '+esc(fmtRest(t.rest_target))+' rest target, so the extra is waiting, not effort</span></div>';
        break;
    }
  }
  h += '<div class="row"><label>'+(planned?'target':'reps')+(ex.mode=='timed'?' (sec)':'')+'</label>'
     + '<button class="stp" data-a="ed-dec" data-set="'+s.id+'">−</button>'
     + '<input type="text" inputmode="numeric" data-field="ed-reps" data-set="'+s.id+'" value="'+esc(planned ? (s.target!=null?s.target:'') : (s.reps!=null?s.reps:''))+'">'
     + '<button class="stp" data-a="ed-inc" data-set="'+s.id+'">+</button></div>';
  if (ex.mode=='weighted' || s.load!=null)
  {
    h += '<div class="row"><label>load</label>'
       + '<input type="text" inputmode="decimal" data-field="ed-load" data-set="'+s.id+'" value="'+esc(s.load!=null?s.load:'')+'">'
       + '<select data-field="ed-unit" data-set="'+s.id+'">'
       + '<option value="kg"'+((s.unit||'kg')=='kg'?' selected':'')+'>kg</option>'
       + '<option value="lb"'+(s.unit=='lb'?' selected':'')+'>lb</option></select></div>';
  }
  h += '<div class="row" style="flex-wrap:nowrap"><label>note</label>'
     + '<input class="notein" type="text" data-field="ed-note" data-set="'+s.id+'" value="'+esc(s.note||'')+'" placeholder="short note…"></div>';
  h += '<div class="btnrow">';
  if (!planned) h += '<button class="btn small" data-a="set-unmark" data-set="'+s.id+'">mark not done</button>';
  h += '<button class="btn small danger" data-a="set-delete" data-set="'+s.id+'">delete set</button>';
  h += '<button class="btn small primary" data-a="set-edit-close">done</button>';
  h += '</div></div>';
  return h;
}

function renderMenu(w, ex)
{
  let i = w.exercises.indexOf(ex);
  let h = '<div class="menu">';
  h += '<button class="btn small" data-a="ex-edit" data-ex="'+ex.id+'">edit setup / rest</button>';
  if (ex.mode!='ladder') h += '<button class="btn small" data-a="convert-ladder" data-ex="'+ex.id+'">→ convert to ladder</button>';
  else h += '<button class="btn small" data-a="convert-straight" data-ex="'+ex.id+'">→ convert to straight</button>';
  h += '<button class="btn small" data-a="backoff" data-ex="'+ex.id+'">add backoff</button>';
  if (!ex.stopped) h += '<button class="btn small danger" data-a="stop-ex" data-ex="'+ex.id+'">stop (pain)</button>';
  else h += '<button class="btn small" data-a="unstop-ex" data-ex="'+ex.id+'">resume exercise</button>';
  if (i>0) h += '<button class="btn small ghost" data-a="ex-up" data-ex="'+ex.id+'">▲ up</button>';
  if (i<w.exercises.length-1) h += '<button class="btn small ghost" data-a="ex-down" data-ex="'+ex.id+'">▼ down</button>';
  h += '<button class="btn small danger" data-a="ex-delete" data-ex="'+ex.id+'">delete</button>';
  h += '<button class="btn small ghost" data-a="ex-menu-close">close</button>';
  h += '</div>';
  return h;
}

/* ---------- overlays ---------- */
function renderOverlay()
{
  let el = document.getElementById('overlay');
  if (!ui.overlay)
  {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }

  el.classList.remove('hidden');
  let o = ui.overlay;
  let h = '<div class="sheet">';

  switch (o.type)
  {
    case 'addex':
      h += sheetAddEx(o);
      break;

    case 'settings':
      h += sheetSettings();
      break;

    case 'export':
      h += sheetExport(o);
      break;

    case 'clone':
      h += sheetClone(o);
      break;

    case 'workout-menu':
      h += sheetWorkoutMenu(o);
      break;

    case 'fix-times':
      h += sheetFixTimes(o);
      break;
  }

  h += '</div>';
  el.innerHTML = h;
  if (o.type == 'settings')
  {
    let out = document.getElementById('settings_backup_out');

    if (out)
    {
      out.value = buildBackup(state);
    }
  }
  else if (o.type == 'export')
  {
    let w = activeWorkout() || findWorkout(o.wid);
    let out = document.getElementById('expout');

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
  }
}
