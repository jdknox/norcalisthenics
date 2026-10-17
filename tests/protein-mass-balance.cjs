'use strict';

let assert = require('node:assert/strict');
let fs = require('node:fs');
let vm = require('node:vm');
let html = fs.readFileSync('protein-loadout.html', 'utf8');
let script = html.split('<script>')[1].split('</script>')[0];
let listeners = {};
let context = vm.createContext({
  setTimeout:function() {},
  document:{addEventListener:function(type, handler) { listeners[type] = handler; }},
  window:{}
});
vm.runInContext(script.split("window.addEventListener('error'")[0], context);

function evaluate(code)
{
  return vm.runInContext(code, context);
}

evaluate(`render = function() {};
  save = function() {};
  g_admin_mode = true;
  g_view_date = '2026-10-16';
  g_log = {};
  g_scoop_items = [{key:'a', name:'Food A', scoop_g:100, protein_g:10, kcal:200, tags:[]}];
  g_mass_events = {};
  g_daily_activity = {};`);
assert.equal(evaluate('dayTotals(g_view_date).grams'), 0);
assert.equal(evaluate('computeMassLedger(g_view_date).totals.total_mass_in_kg'), 0);

evaluate(`g_log[g_view_date] = [
  {id:'food', item_key:'a', grams:100, protein_g:10, kcal:200},
  {id:'recipe', item_key:'recipe', grams:'250', protein_g:20, kcal:400},
  {id:'custom', item_key:'custom', grams:null, protein_g:5, kcal:50},
  {id:'deleted', item_key:'a', grams:1000, deleted_at:'2026-10-16T12:00:00Z'}
];
g_mass_events[g_view_date] = [
  {id:'first', timestamp:'2026-10-16T08:00', event_type:'checkpoint_weight', body_mass_kg:80},
  {id:'water', timestamp:'2026-10-16T09:00', event_type:'water', water_volume_ml:500},
  {id:'delta', timestamp:'2026-10-16T10:00', event_type:'food_mass', mass_in_kg:0.05},
  {id:'last', timestamp:'2026-10-16T20:00', event_type:'checkpoint_weight', body_mass_kg:80.2}
];`);
assert.equal(evaluate('dayTotals(g_view_date).grams'), 350);
let summary = evaluate('massSummaryForDate(g_view_date)');
assert.equal(summary.food_mass_in_g, 400);
assert.equal(summary.total_mass_in_g, 900);
assert.equal(summary.inferred_mass_out_g, 700);
assert.ok(Math.abs(summary.mass_change_kg - 0.2) < 1e-10);
let bodymass_csv = evaluate('buildBodyweightKcalCSV()').trim().split('\n');
assert.equal(bodymass_csv[0], 'date,body_mass_kg,daily_kcal,water_in_kg,mass_in_kg,steps,ebike_minutes,ebike_km');
let bodymass_cells = bodymass_csv.find(function(line) { return line.indexOf('2026-10-16,') == 0; }).split(',');
assert.equal(bodymass_cells[3], '0.500');
assert.equal(bodymass_cells[4], '0.350', 'mass_in_kg must contain pantry mass, excluding manual deltas');
let row = evaluate('renderMassEventLog()').match(/<div class="mass-event">[\s\S]*?<\/div>\s*<\/div>/)[0];
assert.match(row, /Pantry mass/);
assert.match(row, /350 g/);
assert.doesNotMatch(row, /<button|<input/);
assert.equal(evaluate('rawMassEventsForDate(g_view_date).length'), 4, 'derived row must not create a stored event');

evaluate('markLogEntryDeleted(g_log[g_view_date][0]);');
assert.equal(evaluate('dayTotals(g_view_date).grams'), 250);
evaluate('markLogEntryRestored(g_log[g_view_date][0]);');
assert.equal(evaluate('dayTotals(g_view_date).grams'), 350);
evaluate('g_log[g_view_date][0].grams = 120;');
assert.equal(evaluate('massSummaryForDate(g_view_date).food_mass_in_g'), 420);
evaluate('openRecipeDraft(null); addRecipeIngredient("a", 48);');
assert.equal(evaluate('dayTotals(g_view_date).grams'), 370, 'recipe drafts must not contribute mass');
evaluate('g_recipe_draft = null;');

let actions = evaluate('renderMassQuickActions()');
assert.doesNotMatch(actions, /Pre Meal|Post Latrine|data-type="post_meal_weight"/);
assert.match(actions, /data-type="food_mass"/);
assert.match(actions, /Checkpoint/);
evaluate('openMassEntryDraft("food_mass");');
let draft = evaluate('renderMassEntryDraft()');
assert.match(draft, /data-massdraft="mass_in"/);
assert.doesNotMatch(draft, /data-massdraft="body_mass"|known_mass_in/);
listeners.input({target:{dataset:{massdraft:'mass_in'}, value:'123'}});
evaluate('saveMassEntryDraft();');
assert.equal(evaluate('g_mass_events[g_view_date][4].event_type'), 'food_mass');
assert.equal(evaluate('g_mass_events[g_view_date][4].mass_in_kg'), 0.123);
assert.equal(evaluate('g_mass_events[g_view_date][4].body_mass_kg'), undefined);
assert.equal(evaluate('massSummaryForDate(g_view_date).total_mass_in_g'), 1043);
evaluate('openMassEntryDraft("food_mass"); g_mass_entry_draft.mass_in_raw = ""; saveMassEntryDraft();');
assert.equal(evaluate('rawMassEventsForDate(g_view_date).length'), 5, 'blank deltas must not save');
evaluate('g_mass_entry_draft.mass_in_raw = "-2"; saveMassEntryDraft();');
assert.equal(evaluate('rawMassEventsForDate(g_view_date).length'), 5, 'nonpositive deltas must not save');
evaluate('g_mass_entry_draft = null;');

evaluate(`g_log['2026-10-15'] = [{id:'past-food', item_key:'a', grams:75, protein_g:1, kcal:10}];`);
assert.match(evaluate('renderMassDailySummaries()'), /2026-10-15/);
let backup = evaluate('buildBackupTSV()');
assert.equal(backup.ok, true, backup.error);
let restored = evaluate('parseBackupTSV(' + JSON.stringify(backup.text) + ')');
assert.equal(restored.ok, true, restored.error);
context.restored_payload = restored.payload;
evaluate('g_log = restored_payload.log; g_mass_events = restored_payload.mass_events;');
assert.equal(evaluate('massSummaryForDate(g_view_date).total_mass_in_g'), 1043);
assert.equal(evaluate('massSummaryForDate("2026-10-15").total_mass_in_g'), 75);
evaluate('g_mass_events[g_view_date].pop();');
assert.equal(evaluate('computeMassLedger(g_view_date).totals.checkpoint_count'), 2);
evaluate('g_mass_events = {};');
assert.equal(evaluate('massSummaryForDate(g_view_date).inferred_mass_out_g'), 0, 'intake alone cannot establish mass out');

console.log('Daily pantry mass, food deltas, deletion/restoration, summaries, and backup round trip passed.');
