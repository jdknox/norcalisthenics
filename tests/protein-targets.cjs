'use strict';

let assert = require('node:assert/strict');
let fs = require('node:fs');
let vm = require('node:vm');
let html = fs.readFileSync('protein-loadout.html', 'utf8');
let script = html.split('<script>')[1].split('</script>')[0];
let listeners = {};
let local_values = {};
let summary = {outerHTML:''};
let context = vm.createContext({
  setTimeout:function() {},
  document:{
    body:null,
    addEventListener:function(type, handler) { listeners[type] = handler; },
    getElementById:function(id) { return id == 'pantry-nutrition-summary' ? summary : null; }
  },
  localStorage:{
    setItem:function(key, value) { local_values[key] = value; },
    getItem:function(key) { return local_values[key] || null; },
    removeItem:function(key) { delete local_values[key]; }
  },
  window:{}
});
vm.runInContext(script.split("window.addEventListener('error'")[0], context);

function evaluate(code)
{
  return vm.runInContext(code, context);
}

function inputCut(value)
{
  listeners.input({target:{id:'target-cut-input', dataset:{}, value:value}});
}

function predictions(text)
{
  return text.match(/[+-]?\d+\.\d+ kg\/(?:wk|m)/g);
}

evaluate(`let render_count = 0;
  render = function() { ++render_count; };
  g_view_date = '2026-10-25';
  g_log = {[g_view_date]:[{id:'meal', item_key:'a', grams:500, protein_g:80, kcal:1400}]};`);
let frozen_log = evaluate('JSON.stringify(g_log)');
let baseline = evaluate('renderPantryNutritionSummary(dayTotals(g_view_date))');
assert.equal(evaluate('remainingKcalProteinRatio(dayTotals(g_view_date))'), 23);
assert.match(baseline, /1150 rem/);

inputCut('400');
assert.equal(evaluate('targetKcalDay()'), 2550, 'maintenance stays unchanged');
assert.equal(evaluate('dailyKcalBudget()'), 2150);
assert.equal(evaluate('remainingKcalProteinRatio(dayTotals(g_view_date))'), 15);
assert.match(summary.outerHTML, /750 rem/);
assert.deepEqual(predictions(summary.outerHTML), predictions(baseline), 'changing cut does not change mass predictions');
assert.equal(evaluate('render_count'), 0, 'cut typing updates dependent displays without rebuilding the input');
assert.equal(evaluate('JSON.stringify(g_log)'), frozen_log, 'cut settings cannot change logged entries');
assert.equal(evaluate('makeSavePayload().cut_kcal'), 400);
evaluate('g_cut_kcal = 0; load();');
assert.equal(evaluate('g_cut_kcal'), 400, 'local save/reload retains the cut');
assert.equal(evaluate('g_cut_kcal_raw'), '400');

evaluate('g_log[g_view_date][0].kcal = 2150;');
let at_budget = evaluate('renderPantryNutritionSummary(dayTotals(g_view_date))');
assert.match(at_budget, /0 rem/);
assert.match(at_budget, /-0\.4 kg\/wk/);
assert.match(at_budget, /-1\.6 kg\/m/);
assert.equal(evaluate('remainingKcalProteinRatio(dayTotals(g_view_date))'), 0);
evaluate('g_log[g_view_date][0].kcal = 2200;');
assert.match(evaluate('renderPantryNutritionSummary(dayTotals(g_view_date))'), /50 over/);
assert.equal(evaluate('remainingKcalProteinRatio(dayTotals(g_view_date))'), null);
evaluate('g_log[g_view_date][0].kcal = 2550;');
let at_maintenance = evaluate('renderPantryNutritionSummary(dayTotals(g_view_date))');
assert.match(at_maintenance, /400 over/);
assert.match(at_maintenance, /\+0\.00 kg\/wk/);

inputCut('');
assert.equal(evaluate('g_cut_kcal'), 0);
assert.equal(evaluate('dailyKcalBudget()'), 2550, 'clearing the cut returns to maintenance');
inputCut('-100');
assert.equal(evaluate('g_cut_kcal'), 0, 'a negative cut cannot raise the budget');
inputCut('9999');
assert.equal(evaluate('dailyKcalBudget()'), 0, 'the daily budget cannot become negative');
inputCut('400');
let backup = evaluate('buildBackupTSV()');
assert.equal(backup.ok, true, backup.error);
let restored = evaluate('parseBackupTSV(' + JSON.stringify(backup.text) + ')');
assert.equal(restored.ok, true, restored.error);
assert.equal(restored.payload.cut_kcal, 400);
context.restored_payload = restored.payload;
evaluate('g_cut_kcal = 0; g_import_pending = restored_payload; applyReplaceImport();');
assert.equal(evaluate('g_cut_kcal'), 400, 'replacement imports restore the saved cut');
evaluate('g_import_pending = {cut_kcal:100}; applyMergeImport();');
assert.equal(evaluate('g_cut_kcal'), 400, 'data merges preserve the current target settings');

evaluate(`todayISO = function() { return '2026-10-31'; };
  g_view_date = '2026-10-30';
  g_admin_mode = false;
  g_bodyweight_by_date = {'2026-10-30':80};
  g_bodyweight_raw_by_date = {};
  g_bodyweight_dirty_dates = {};
  let bodyweight_saves = 0;
  save = function() { ++bodyweight_saves; };
  renderPreservingFocus = function() { ++render_count; };`);
let locked_weight_html = evaluate('renderProteinKgScale(100)');
assert.match(locked_weight_html, /id="bodyweight-input"[^>]* disabled/);
assert.match(locked_weight_html, /data-a="bodyweight-push"[^>]* disabled/);
assert.doesNotMatch(locked_weight_html.match(/<button[^>]*data-a="bodyweight-pull"[^>]*>/)[0], / disabled/, 'pulling shared data remains available');
let before_locked_weight = evaluate('JSON.stringify(makeSavePayload())');
let before_locked_render = evaluate('render_count');
listeners.input({target:{id:'bodyweight-input', dataset:{}, value:'81.5'}});
evaluate('pushBodyweightToShared();');
assert.equal(evaluate('JSON.stringify(makeSavePayload())'), before_locked_weight, 'locked input events cannot change past bodyweight');
assert.equal(evaluate('render_count'), before_locked_render, 'blocked weight edits and pushes do no work');
assert.equal(evaluate('bodyweight_saves'), 0);
assert.equal(evaluate('g_bodyweight_dirty_dates[g_view_date]'), undefined);

evaluate('g_admin_mode = true;');
let admin_weight_html = evaluate('renderProteinKgScale(100)');
assert.doesNotMatch(admin_weight_html.match(/<input[^>]*id="bodyweight-input"[^>]*>/)[0], / disabled/);
assert.doesNotMatch(admin_weight_html.match(/<button[^>]*data-a="bodyweight-push"[^>]*>/)[0], / disabled/);
listeners.input({target:{id:'bodyweight-input', dataset:{}, value:'81.5'}});
assert.equal(evaluate('bodyweightForDate(g_view_date)'), 81.5, 'Admin mode allows past-day bodyweight edits');
assert.equal(evaluate('bodyweight_saves'), 1);

evaluate('g_admin_mode = false; g_view_date = todayISO();');
assert.doesNotMatch(evaluate('renderProteinKgScale(100)').match(/<input[^>]*id="bodyweight-input"[^>]*>/)[0], / disabled/);
listeners.input({target:{id:'bodyweight-input', dataset:{}, value:'82.5'}});
assert.equal(evaluate('bodyweightForDate(g_view_date)'), 82.5, 'today remains editable without Admin mode');
assert.equal(evaluate('g_bodyweight_kg'), 82.5);
assert.equal(evaluate('bodyweight_saves'), 2);

console.log('Calorie cut, remaining values, maintenance predictions, frozen logs, bodyweight Admin guard, save/reload, and TSV round trip passed.');
