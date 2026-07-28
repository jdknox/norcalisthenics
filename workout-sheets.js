
/*
> [!WARNING]
> ⚠️ **AI-gerenated Code:**
*/

function sheetAddEx(o)
{
  let d = o.draft;
  let pivot_word;
  let logged_rungs = 0;
  let edit_ex = o.editExId ? findEx(activeWorkout(), o.editExId) : null;
  let presetNames = Object.keys(state.presets).map(function(k)
  {
    return state.presets[k].name; 
  });
  let library_names = libraryExerciseNames();
  let i;

  for (i = 0; i < library_names.length; ++i)
  {
    if (presetNames.indexOf(library_names[i]) < 0)
    {
      presetNames.push(library_names[i]);
    }
  }

  if (edit_ex && edit_ex.mode == 'ladder')
  {
    logged_rungs = performedSetsOf(edit_ex).length;
  }
  let h = '<h2>'+(o.editExId ? '// edit exercise' : '// add exercise')+'</h2>';
  h += '<div class="frow exname-wrap"><label class="lab">exercise</label>'
     + '<input type="text" data-field="ax-name" value="'+esc(d.name)+'" placeholder="ring row" autocomplete="off">'
     + (presetNames.length ? '<div class="exlist" id="exList">'+presetNames.map(function(n)
     {
       return '<button type="button" class="exitem" data-a="ex-pick" data-name="'+esc(n)+'">'+esc(n)+'</button>';
     }).join('')+'</div>' : '')
     + '</div>';
  h += '<div class="frow"><label class="lab">mode</label><div class="seg">'
     + ['straight','ladder','weighted','timed'].map(function(m)
     {
       return '<button data-a="ax-mode" data-m="'+m+'" class="'+(d.mode==m?'on':'')+'">'+m+'</button>';
     }).join('') + '</div></div>';
  if (d.mode=='ladder')
  {
    h += '<div class="frow"><label class="lab">rungs per ladder</label>'
       + '<input type="text" inputmode="text" data-field="ax-tops" value="'+esc(d.tops)+'" placeholder="3 3 2">'
       + '<div class="hint">tops shorthand: "3 3 2" → ladders 1·2·3 / 1·2·3 / 1·2.<br>'
       + 'custom rungs: "/" splits ladders, "," splits rungs — "1,2,4,5 / 1,2,4,5 / 1,2,3,4" is kept exactly as written, nothing is filled in.</div>'
       + (logged_rungs
          ? '<div class="notice"><span class="ico">▲</span><span><b>'
            + logged_rungs + ' rung' + (logged_rungs == 1 ? '' : 's') + ' already logged.</b> '
            + 'Logged rungs keep the reps you actually did — editing the list only changes what is still planned. '
            + 'To remove a logged rung, use its <b>delete</b> button instead.</span></div>'
          : '')
       + '</div>';
  }
  else 
  {
    h += '<div class="frow"><label class="lab">target sets</label>'
       + '<input type="text" data-field="ax-targets" value="'+esc(d.targets)+'" placeholder="'+(d.mode=='weighted'?'15x8, 10x12, 10x10':d.mode=='timed'?'30 / 30 / 30':'8 / 8 / 8')+'">'
       + '<div class="hint">'+(d.mode=='weighted'?'loadxreps, comma separated — or plain reps':'reps, separated by /')+(d.mode=='timed'?' · numbers are seconds':'')+'</div></div>';
  }
  h += '<div class="inline2">'
     + '<div class="frow"><label class="lab">'+(d.mode=='ladder'?'ladder rest':'set rest')+'</label><input type="text" data-field="ax-rest" value="'+esc(d.rest)+'" placeholder="2:30"></div>'
     + (d.mode=='ladder' ? '<div class="frow"><label class="lab">rung rest</label><input type="text" data-field="ax-rrest" value="'+esc(d.rrest)+'" placeholder="0:20"></div>' : '')
     + '</div>';
  h += '<div class="frow"><label class="lab">setup (optional)</label>'
     + '<textarea data-field="ax-setup" placeholder="ring height 25 cm · heel-anchor 80 cm · body ~45° · feet floor">'+esc(d.setup)+'</textarea>'
     + '<div class="hint">free form — angle, ring height + anchor distance, band load/position… saved as a preset for this exercise</div></div>';
  h += '<div class="frow ringsec"><label class="lab">geometry (optional)</label>'
     + '<select data-field="ax-ring-type">'
     + '<option value="none"'+(d.ringType=='none'?' selected':'')+'>none — no angle calculation</option>'
     + '<option value="pushup"'+(d.ringType=='pushup'?' selected':'')+'>ring pushup — body angle (shoulder ≈ ring)</option>'
     + '<option value="row"'+(d.ringType=='row'?' selected':'')+'>ring row — body angle, arms extended</option>'
     + '</select>'
     + '<div class="hint">only pick a formula for exercises it applies to. Rows are measured at <b>full arm extension</b> — the bottom of the row, not the chest-to-rings top.</div>';

  switch (d.ringType)
  {
    case 'pushup':
    case 'row':
      pivot_word = ringPivotWord(d.ringType);
      h += '<div class="inline2">'
         + '<div class="frow"><label class="lab">ring rest height R<sub>r</sub> (cm)</label><input type="text" inputmode="decimal" data-field="ax-ring-rr" value="'+esc(d.ringRr)+'" placeholder="110"></div>'
         + '<div class="frow"><label class="lab">'+pivot_word+' distance H (cm, signed)</label><input type="text" inputmode="text" data-field="ax-ring-h" value="'+esc(d.ringH)+'" placeholder="+80"></div>'
         + '</div>'
         + '<div class="hint">Both are measured from the <b>plumb line</b> — the spot on the floor directly under the anchor, where the resting ring hangs. R<sub>r</sub> is the height of the freely hanging ring\'s <b>hand-contact point</b> (its bottom inner surface). H is how far your '+pivot_word+'s sit from the plumb line: <b>positive</b> while your '+pivot_word+'s and shoulders are on the same side of it, <b>negative</b> once the plumb line reaches or passes your '+pivot_word+'s. The angle is <b>not</b> a straight line in H — it bottoms out and climbs again on both sides — so read the live angle below rather than assuming a direction.</div>';
      h += '<div class="ring-readout'+(ringReadoutBad(d)?' bad':'')+'" id="ring_readout">'+esc(ringReadoutText(d))+'</div>';
      break;
  }
  h += '</div>';
  h += '<div class="foot"><button class="btn ghost" data-a="overlay-close">cancel</button>'
     + '<button class="btn primary" data-a="ax-save">'+(o.editExId?'save':'add & go')+'</button></div>';
  return h;
}

function updateExList(q)
{
  let l = document.getElementById('exList'); if (!l) return;
  q = (q||'').trim().toLowerCase();
  let items = Array.prototype.slice.call(l.querySelectorAll('.exitem'));
  items.forEach(function(el,i)
  {
    if (el.dataset.orig==null) el.dataset.orig = String(i); 
  });
  function score(el)
  {
    let n = el.dataset.name.toLowerCase();
    if (!q) return 0;
    if (n.indexOf(q)==0) return 0;   // prefix match first
    if (n.indexOf(q)>=0) return 1;    // substring match next
    return 2;                          // everything else still shown, below
  }
  items.sort(function(a,b)
  {
    let sa=score(a), sb=score(b);
    if (sa!=sb) return sa-sb;
    return (+a.dataset.orig)-(+b.dataset.orig);
  });
  items.forEach(function(el)
  {
    let name = el.dataset.name, idx = q ? name.toLowerCase().indexOf(q) : -1;
    if (idx>=0) el.innerHTML = esc(name.slice(0,idx))+'<span class="mt">'+esc(name.slice(idx,idx+q.length))+'</span>'+esc(name.slice(idx+q.length));
    else el.textContent = name;
    l.appendChild(el);
  });
}
/* the draft's ring fields resolved against the saved rig + profile */
function draftAngle(d)
{
  let anchor_height = state.rig.anchorHeight;
  let body_len = ringBodyLen(d.ringType, state.profile);
  let arm_len = ringArmLen(d.ringType, state.profile);
  let ring_height = parseFloat(d.ringRr);
  let pivot_dist = parseFloat(d.ringH);

  if (isNaN(ring_height) || isNaN(pivot_dist))
  {
    return { status: 'incomplete', deg: 0 };
  }

  return bodyAngle(anchor_height, body_len, pivot_dist, ring_height, arm_len);
}

function ringReadoutText(d)
{
  let missing = [];
  let result;

  if (state.rig.anchorHeight == null)
  {
    missing.push('anchor height');
  }
  if (ringBodyLen(d.ringType, state.profile) == null)
  {
    missing.push(ringPivotWord(d.ringType) + '-to-shoulder');
  }
  if (ringArmLen(d.ringType, state.profile) == null)
  {
    missing.push('arm length');
  }
  if (missing.length)
  {
    return 'set ' + missing.join(' & ') + ' in ⚙ setup first';
  }

  result = draftAngle(d);

  switch (result.status)
  {
    case 'incomplete':
      return 'enter R' + '\u1d63' + ' and H to see the angle';

    case 'unreachable':
      return 'impossible configuration — ring can\'t reach';

    case 'slack':
      return 'rings too low — shoulder would hang below the floor (slack straps)';
  }

  return 'body angle ≈ ' + result.deg.toFixed(1) + '°';
}

function ringReadoutBad(d)
{
  let result;

  if (state.rig.anchorHeight == null)
  {
    return true;
  }
  if (ringBodyLen(d.ringType, state.profile) == null)
  {
    return true;
  }
  if (ringArmLen(d.ringType, state.profile) == null)
  {
    return true;
  }

  result = draftAngle(d);

  switch (result.status)
  {
    case 'unreachable':
    case 'slack':
      return true;
  }

  return false;
}
function calReadoutText()
{
  let rg = state.rig;
  let A = calibrateAnchor(rg.calX, rg.calY, rg.calRr);
  if (A==null || isNaN(A)) return 'enter x₁, y₁, Rr';
  if (A<=0) return 'check inputs — non-physical result';
  return 'computed A ≈ ' + A.toFixed(1) + ' cm';
}
function sheetSettings()
{
  let rg = state.rig, pr = state.profile;
  let rig_open = sectionIsOpen('settings-rig-profile', true);
  let h = '<h2>// settings</h2>';
  h += '<div class="card" style="margin-bottom:12px">';
  h += '<div class="card-h"><div class="exname">// rigging &amp; profile</div><span class="fill"></span>'
     + '<button class="btn small" data-a="section-toggle" data-key="settings-rig-profile" data-default="open">'+(rig_open ? 'hide' : 'show')+'</button></div>';
  if (rig_open)
  {
    h += '<div class="frow"><label class="lab">toe-to-shoulder S<sub>push</sub> (cm)</label>'
       + '<input type="text" inputmode="decimal" data-field="set-shoulder-push" value="'+esc(pr.shoulderPushup==null?'':pr.shoulderPushup)+'" placeholder="165">'
       + '<div class="hint">pushup body length — the <b>toe</b> is the pivot. ≈ your standing shoulder height; cleanest measured lying in a plank.</div></div>';
    h += '<div class="frow"><label class="lab">heel-to-shoulder S<sub>row</sub> (cm)</label>'
       + '<input type="text" inputmode="decimal" data-field="set-shoulder-row" value="'+esc(pr.shoulderRow==null?'':pr.shoulderRow)+'" placeholder="156">'
       + '<div class="hint">row body length — the <b>heel</b> is the pivot, so this is its own measurement, shorter than S<sub>push</sub> by about a foot length. Not a reuse.</div></div>';
    h += '<div class="frow"><label class="lab">arm length (cm)</label>'
       + '<input type="text" inputmode="decimal" data-field="set-arm" value="'+esc(pr.arm==null?'':pr.arm)+'" placeholder="62">'
       + '<div class="hint">shoulder joint to hand-contact point, arm straight (shoulder to the centre of a closed fist). Rows only — a pushup uses 0. Typically 60–65.</div></div>';
    h += '<div class="frow"><label class="lab">anchor height A (cm)</label>'
       + '<input type="text" inputmode="decimal" data-field="set-anchor" value="'+esc(rg.anchorHeight==null?'':rg.anchorHeight)+'" placeholder="400">'
       + '<div class="hint">height of the anchor above the floor. Usually too high to tape-measure — use the helper below, or enter directly. Fixed per rig, shared by both modes.</div></div>';
    h += '<div class="calib"><div class="calib-h">calibration helper — derive A from floor measurements</div>'
       + '<div class="hint">Pull the resting ring out to a measured floor offset x₁, then measure its height y₁ (both reachable at ground level). All three heights are of the <b>hand-contact point</b> — the bottom inner surface of the ring, where your palm sits.</div>'
       + '<div class="inline2">'
       + '<div class="frow"><label class="lab">x₁ (cm)</label><input type="text" inputmode="decimal" data-field="cal-x" value="'+esc(rg.calX==null?'':rg.calX)+'" placeholder="200"></div>'
       + '<div class="frow"><label class="lab">y₁ (cm)</label><input type="text" inputmode="decimal" data-field="cal-y" value="'+esc(rg.calY==null?'':rg.calY)+'" placeholder="77"></div>'
       + '<div class="frow"><label class="lab">Rr (cm)</label><input type="text" inputmode="decimal" data-field="cal-rr" value="'+esc(rg.calRr==null?'':rg.calRr)+'" placeholder="20"></div>'
       + '</div>'
       + '<div class="ring-readout" id="cal_readout">'+esc(calReadoutText())+'</div>'
       + '<button class="btn small primary" data-a="cal-apply">use as anchor height</button></div>';
  }
  h += '</div>';
  h += '<div class="frow"><label class="lab">rest timer display</label><div class="seg">'
     + '<button data-a="timer-dir" data-d="up" class="'+(state.settings.countdown?'':'on')+'">count up</button>'
     + '<button data-a="timer-dir" data-d="down" class="'+(state.settings.countdown?'on':'')+'">count down</button>'
     + '</div><div class="hint">counting down shows time remaining and drains the bar; either way it keeps running past the target so you can see how long you actually took.</div></div>';
  h += '<div class="import-sec">'
     + '<div class="calib-h">backup &amp; restore</div>'
     + '<div class="hint">Complete, lossless snapshot of <b>everything</b> — every workout, all planned and logged sets, rest config, ring geometry, and your rig + profile. Restore merges into what you already have: matching workout ids are replaced, new ones are added, and rig/profile fill only where you have not set them.</div>'
     + '<textarea class="exp-out" id="settings_backup_out" readonly spellcheck="false"></textarea>'
     + '<div class="foot"><span class="hint" id="settings_copymsg"></span>'
     + '<button class="btn" data-a="settings-backup-download">download</button>'
     + '<button class="btn primary" data-a="settings-backup-copy">copy</button></div>'
     + '<input type="file" id="settings_importfile" accept=".txt,.tsv,text/plain" class="hidden">'
     + '<div class="btnrow" style="margin-top:8px"><button class="btn small" data-a="settings-import-pick">load backup file…</button></div>'
     + (ui.importMsg ? '<div class="import-msg '+(ui.importMsg.kind=='bad'?'bad':'ok')+'">'+esc(ui.importMsg.text)+'</div>' : '')
     + '</div>';
  h += '<div class="btnrow" style="margin-top:10px"><button class="btn small" data-a="exercise-editor-open">Edit Exercise List</button></div>';
  h += '<div class="hint">Saving the exercise list prunes learned presets that no longer exist in workout history or in the saved main list.</div>';
  h += '<div class="foot"><button class="btn primary" data-a="overlay-close">done</button></div>';
  return h;
}

function sheetExerciseEditor(o)
{
  let list = o.draft;
  let h = '<h2>// edit exercise list</h2>';
  let expanded_idx = o.openIdx;
  let expanded;
  let item;
  let summary;
  let i;

  h += '<div class="hint">This edits the saved main exercise list. Blank names are ignored on save. Duplicate names collapse to the first one.</div>';
  h += '<div class="frow">';

  for (i = 0; i < list.length; ++i)
  {
    item = list[i];
    expanded = expanded_idx == i;
    summary = item.mode || 'straight';
    if (item.mode == 'ladder' && item.ladders)
    {
      summary += ' · ' + item.ladders;
    }
    else if (item.targets)
    {
      summary += ' · ' + item.targets;
    }
    h += '<div class="card" style="margin-bottom:12px">';
    h += '<div class="card-h"><div class="flex"><div class="exname">'+esc(item.name || ('exercise ' + (i + 1)))+'</div><div class="sub" style="margin:2px 0 0">'+esc(summary)+'</div></div>'
       + '<button class="btn small" data-a="exercise-editor-toggle" data-idx="'+i+'">'+(expanded ? 'hide' : 'edit')+'</button>'
       + '<button class="btn small danger" data-a="exercise-editor-delete" data-idx="'+i+'">delete</button></div>';
    if (expanded)
    {
      h += '<div class="frow"><label class="lab">name</label>'
         + '<input type="text" data-field="lib-name" data-idx="'+i+'" value="'+esc(item.name || '')+'" placeholder="exercise name"></div>';
      h += '<div class="frow"><label class="lab">mode</label>'
         + '<select data-field="lib-mode" data-idx="'+i+'">'
         + '<option value="straight"'+(item.mode == 'straight' ? ' selected' : '')+'>straight</option>'
         + '<option value="ladder"'+(item.mode == 'ladder' ? ' selected' : '')+'>ladder</option>'
         + '<option value="weighted"'+(item.mode == 'weighted' ? ' selected' : '')+'>weighted</option>'
         + '<option value="timed"'+(item.mode == 'timed' ? ' selected' : '')+'>timed</option>'
         + '</select></div>';
      h += '<div class="frow"><label class="lab">setup</label>'
         + '<textarea data-field="lib-setup" data-idx="'+i+'" placeholder="optional setup text">'+esc(item.setup || '')+'</textarea></div>';
      h += '<div class="inline2">'
         + '<div class="frow"><label class="lab">set rest</label><input type="text" data-field="lib-rest" data-idx="'+i+'" value="'+esc(item.rest || '')+'" placeholder="2:30"></div>'
         + (item.mode == 'ladder' ? '<div class="frow"><label class="lab">rung rest</label><input type="text" data-field="lib-rrest" data-idx="'+i+'" value="'+esc(item.rrest || '')+'" placeholder="0:20"></div>' : '')
         + '</div>';
      if (item.mode == 'ladder')
      {
        h += '<div class="frow"><label class="lab">default ladders</label>'
           + '<input type="text" data-field="lib-ladders" data-idx="'+i+'" value="'+esc(item.ladders || '')+'" placeholder="3 3 2">'
           + '<div class="hint">same ladder syntax as the add-exercise form</div></div>';
      }
      else
      {
        h += '<div class="frow"><label class="lab">default targets</label>'
           + '<input type="text" data-field="lib-targets" data-idx="'+i+'" value="'+esc(item.targets || '')+'" placeholder="'+(item.mode == 'weighted' ? '15x8 / 10x12 / 10x10' : item.mode == 'timed' ? '30 / 30 / 30' : '8 / 8 / 8')+'">'
           + '<div class="hint">'+(item.mode == 'weighted' ? 'loadxreps, separated by /' : item.mode == 'timed' ? 'seconds, separated by /' : 'reps, separated by /')+'</div></div>';
        h += '<div class="frow"><label class="lab">unit</label>'
           + '<input type="text" data-field="lib-unit" data-idx="'+i+'" value="'+esc(item.unit || '')+'" placeholder="kg"></div>';
      }
      h += '<div class="frow"><label class="lab">geometry</label>'
         + '<select data-field="lib-ring-type" data-idx="'+i+'">'
         + '<option value="none"'+(item.ringType == 'none' ? ' selected' : '')+'>none</option>'
         + '<option value="pushup"'+(item.ringType == 'pushup' ? ' selected' : '')+'>pushup</option>'
         + '<option value="row"'+(item.ringType == 'row' ? ' selected' : '')+'>row</option>'
         + '</select></div>';
      if (item.ringType != 'none')
      {
        h += '<div class="inline2">'
           + '<div class="frow"><label class="lab">Rr</label><input type="text" data-field="lib-ring-rr" data-idx="'+i+'" value="'+esc(item.ringRr || '')+'" placeholder="110"></div>'
           + '<div class="frow"><label class="lab">H</label><input type="text" data-field="lib-ring-h" data-idx="'+i+'" value="'+esc(item.ringH || '')+'" placeholder="+80"></div>'
           + '</div>';
      }
    }
    h += '</div>';
  }

  h += '</div>';
  h += '<div class="btnrow"><button class="btn small" data-a="exercise-editor-add">+ add exercise</button></div>';
  h += '<div class="import-sec">'
     + '<div class="calib-h">export to js</div>'
     + '<div class="hint">Exports the current saved exercise list as a `workout-exercises.js` file. The sample workout stays as it is in the checked-in source file.</div>'
     + '<textarea class="exp-out" id="exercise_js_out" readonly spellcheck="false"></textarea>'
     + '<div class="foot"><span class="hint" id="exercise_js_copymsg"></span>'
     + '<button class="btn" data-a="exercise-js-download">download</button>'
     + '<button class="btn primary" data-a="exercise-js-copy">copy</button></div>'
     + '</div>';
  h += '<div class="foot"><button class="btn ghost" data-a="exercise-editor-cancel">back</button>'
     + '<button class="btn primary" data-a="exercise-editor-save">save</button></div>';
  return h;
}

function sheetWorkoutMenu(o)
{
  let workout = activeWorkout() || findWorkout(o.wid);
  let h = '<h2>// workout</h2>';

  if (!workout)
  {
    h += '<div class="foot"><button class="btn ghost" data-a="overlay-close">close</button></div>';
    return h;
  }

  h += '<div class="btnrow">'
     + '<button class="btn" data-a="fix-times-open">Fix Times</button>'
     + '<button class="btn danger" data-a="workout-delete">Delete Workout</button>'
     + '</div>';
  h += '<div class="hint">Fix Times repairs began and ended date-time later. Delete Workout removes the whole workout and all of its sets.</div>';
  h += '<div class="foot"><button class="btn ghost" data-a="overlay-close">close</button></div>';
  return h;
}

function sheetFixTimes(o)
{
  let d = o.draft;
  let h = '<h2>// fix times</h2>';

  h += '<div class="inline2">'
     + '<div class="frow"><label class="lab">began date</label><input type="text" data-field="ft-start-date" value="'+esc(d.startedDate)+'" placeholder="YYYY-MM-DD" spellcheck="false"></div>'
     + '<div class="frow"><label class="lab">began time</label><input type="text" data-field="ft-start-time" value="'+esc(d.startedTime)+'" placeholder="HH:MM" spellcheck="false"></div>'
     + '</div>';
  h += '<div class="inline2">'
     + '<div class="frow"><label class="lab">ended date</label><input type="text" data-field="ft-finish-date" value="'+esc(d.finishedDate)+'" placeholder="YYYY-MM-DD" spellcheck="false"></div>'
     + '<div class="frow"><label class="lab">ended time</label><input type="text" data-field="ft-finish-time" value="'+esc(d.finishedTime)+'" placeholder="HH:MM" spellcheck="false"></div>'
     + '</div>';
  h += '<div class="hint">Leave ended blank to keep the workout open. Saving began also sets the workout date to that began date.</div>';
  h += '<div class="foot"><button class="btn ghost" data-a="fix-times-back">back</button>'
     + '<button class="btn primary" data-a="fix-times-save">save times</button></div>';
  return h;
}

function sheetExport(o)
{
  let is_backup = ui.expFmt == 'backup';
  let h = '<h2>// export &amp; backup</h2>';
  h += '<div class="exp-tabs">'
     + '<button class="btn small'+(ui.expFmt=='plain'?' primary':'')+'" data-a="exp-fmt" data-f="plain">FitNotes text</button>'
     + '<button class="btn small'+(ui.expFmt=='compact'?' primary':'')+'" data-a="exp-fmt" data-f="compact">compact</button>'
     + '<button class="btn small'+(ui.expFmt=='csv'?' primary':'')+'" data-a="exp-fmt" data-f="csv">CSV</button>'
     + '<button class="btn small'+(is_backup?' primary':'')+'" data-a="exp-fmt" data-f="backup">full backup</button></div>';

  if (is_backup)
  {
    h += '<div class="hint" style="margin-bottom:8px">Complete, lossless snapshot of <b>everything</b> — every workout, all planned and logged sets, rest config, ring geometry, and your rig + profile. This is the file to keep for moving devices or restoring after a reset.</div>';
  }

  h += '<textarea class="exp-out" id="expout" readonly spellcheck="false"></textarea>';
  h += '<div class="foot"><span class="hint" id="copymsg"></span>'
     + '<button class="btn" data-a="exp-download">download</button>'
     + '<button class="btn primary" data-a="exp-copy">copy</button>'
     + '<button class="btn ghost" data-a="overlay-close">close</button></div>';

  if (is_backup)
  {
    h += '<div class="import-sec">'
       + '<div class="calib-h">restore from a backup</div>'
       + '<div class="hint">Merges into what you already have: a workout with a matching id is overwritten by the file, new ones are added, and rig/profile fill only where you have not set them. Nothing is deleted.</div>'
       + '<input type="file" id="importfile" accept=".txt,.tsv,text/plain" class="hidden">'
       + '<div class="btnrow" style="margin-top:8px"><button class="btn small" data-a="import-pick">load backup file…</button></div>'
       + (ui.importMsg ? '<div class="import-msg '+(ui.importMsg.kind=='bad'?'bad':'ok')+'">'+esc(ui.importMsg.text)+'</div>' : '')
       + '</div>';
  }

  return h;
}

function sheetClone(o)
{
  let src = findWorkout(o.srcId) || state.workouts[0];
  let h = '<h2>// clone workout</h2>';
  if (!src) return h + '<p class="sub">Nothing to clone yet.</p><div class="foot"><button class="btn ghost" data-a="overlay-close">close</button></div>';
  if (state.workouts.length > 1)
  {
    h += '<div class="frow"><label class="lab">source</label><select data-field="clone-src">'
       + state.workouts.map(function(w)
       {
         return '<option value="'+w.id+'"'+(w.id==src.id?' selected':'')+'>'+esc(w.date+' — '+w.name)+'</option>'; 
       }).join('')
       + '</select></div>';
  }
  h += '<div class="togglerow"><input type="checkbox" id="progchk" data-field="clone-prog"'+(o.prog?' checked':'')+'>'
     + '<label for="progchk">Apply suggested progressions</label></div>';
  h += '<div class="clone-prev">';
  src.exercises.forEach(function(ex)
  {
    let sug = suggestForExercise(ex);
    let shown = o.prog ? targetsLabel(sug)
      : (ex.mode=='ladder' ? 'ladders '+laddersDisplay(rungsOf(ex))
        : ex.sets.map(function(s)
        {
          return (s.load!=null?s.load+'x':'')+(s.target!=null?s.target:s.reps); 
        }).join(' / '));
    h += '<div class="pl"><span class="pn">'+esc(ex.name)+'</span><span class="pt">'+esc(shown)+'</span>'
       + (o.prog ? '<span class="'+(sug.warn?'pw':'pr')+'">'+esc(sug.reason)+'</span>' : '')+'</div>';
  });
  h += '</div>';
  h += '<div class="foot"><button class="btn ghost" data-a="overlay-close">cancel</button>'
     + '<button class="btn primary" data-a="clone-start" data-src="'+src.id+'">Start workout</button></div>';
  return h;
}
