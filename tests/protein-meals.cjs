'use strict';

let assert = require('node:assert/strict');
let fs = require('node:fs');
let vm = require('node:vm');
let html = fs.readFileSync('protein-loadout.html', 'utf8');
let script = html.split('<script>')[1].split('</script>')[0];
let listeners = {};
let subtotals = {innerHTML:''};
let context = vm.createContext({
  setTimeout:function() {},
  document:{
    body:null,
    addEventListener:function(type, handler) { listeners[type] = handler; },
    getElementById:function(id) { return id == 'temporary-meals' ? subtotals : null; }
  },
  window:{}
});
vm.runInContext(script.split("window.addEventListener('error'")[0], context);

function evaluate(code)
{
  return vm.runInContext(code, context);
}

function click(action, extra = {})
{
  let target = {dataset:{a:action, ...extra}};
  listeners.click({target:{closest:function() { return target; }}});
}

function select(entry_id, checked = true)
{
  listeners.change({target:{dataset:{mealentry:entry_id}, checked:checked}});
}

function totals(index)
{
  return JSON.parse(evaluate('JSON.stringify(temporaryMealTotals(g_temporary_meals[' + index + ']))'));
}

evaluate(`let render_count = 0;
  render = function() { ++render_count; };
  save = function() { throw new Error('Temporary meal actions must not save'); };
  g_view_date = '2026-10-24';
  g_log = {[g_view_date]:[
    {id:'a', item_key:'food-a', grams:80, protein_g:10, kcal:100},
    {id:'b', item_key:'food-b', grams:120, protein_g:20, kcal:400},
    {id:'c', item_key:'food-c', grams:50, protein_g:5, kcal:200},
    {id:'custom', item_key:'custom', grams:null, protein_g:5, kcal:50},
    {id:'deleted', item_key:'food-a', grams:999, protein_g:999, kcal:999, deleted_at:'2026-10-24T12:00:00Z'}
  ]};`);
let frozen_log = evaluate('JSON.stringify(g_log)');
let saved_payload = evaluate('JSON.stringify(makeSavePayload())');
let backup = evaluate('buildBackupTSV().text');
click('meal-new');
assert.equal(evaluate('g_temporary_meals.length'), 1);
let render_count = evaluate('render_count');
select('a');
select('a');
select('b');
assert.deepEqual(totals(0), {grams:200, protein_g:30, kcal:500});
assert.equal(evaluate('g_temporary_meals[0].entry_ids.length'), 2, 'checkbox updates cannot duplicate membership');
assert.match(subtotals.innerHTML, /16\.7 kcal\/g protein/);
assert.equal(evaluate('render_count'), render_count, 'checkbox selection must keep the food list intact');
let selection_html = evaluate('renderLoggedFoodList()');
assert.match(selection_html, /data-mealentry="a"[^>]* checked/);
assert.match(selection_html, /data-mealentry="deleted"[^>]* disabled/);
click('meal-done');
assert.doesNotMatch(evaluate('renderLoggedFoodList()'), /data-mealentry=/);
click('meal-new');
select('b');
select('c');
click('meal-done');
assert.deepEqual(totals(1), {grams:170, protein_g:25, kcal:600});
assert.match(evaluate('renderTemporaryMeals()'), /24\.0 kcal\/g protein/);
click('logged-foods-toggle');
let collapsed = evaluate('renderLoggedFoodList()');
assert.match(collapsed, /Meal 1/);
assert.match(collapsed, /Meal 2/);
assert.doesNotMatch(collapsed, /class="logged-foods-list"/);
click('meal-edit', {meal:'0'});
assert.equal(evaluate('g_logged_foods_open'), true);
select('a', false);
assert.deepEqual(totals(0), {grams:120, protein_g:20, kcal:400});
select('a');
click('meal-done');
assert.equal(evaluate('JSON.stringify(g_log)'), frozen_log, 'selection and editing cannot change logged entries');
assert.equal(evaluate('JSON.stringify(makeSavePayload())'), saved_payload, 'temporary meals cannot enter the saved payload');
assert.equal(evaluate('buildBackupTSV().text'), backup, 'temporary meals cannot enter exports');

evaluate('removeLogEntry("b");');
assert.deepEqual(totals(0), {grams:80, protein_g:10, kcal:100});
assert.deepEqual(totals(1), {grams:50, protein_g:5, kcal:200});
evaluate('restoreLogEntry("b");');
assert.deepEqual(totals(0), {grams:200, protein_g:30, kcal:500});
evaluate('g_log[g_view_date][1].grams = "140";');
assert.equal(totals(0).grams, 220, 'subtotals read the current recorded values and accept numeric strings');

evaluate("g_view_date = '2026-10-23';");
assert.equal(evaluate('renderTemporaryMeals()'), '');
click('meal-new');
assert.equal(evaluate('g_temporary_meals[2].number'), 1, 'numbering starts at one for each day');
click('meal-done');
evaluate("g_view_date = '2026-10-24';");
assert.match(evaluate('renderTemporaryMeals()'), /Meal 2/);
click('meal-edit', {meal:'0'});
select('custom');
assert.equal(totals(0).grams, null, 'unknown mass must not be reported as a complete total');
select('a', false);
select('b', false);
select('custom', false);
assert.deepEqual(totals(0), {grams:0, protein_g:0, kcal:0});
assert.match(evaluate('renderTemporaryMeals()'), /— kcal\/g protein/, 'empty and zero-protein selections have no ratio');
click('meal-remove', {meal:'0'});
assert.equal(evaluate('g_temporary_meal_edit'), null);
assert.deepEqual(totals(0), {grams:190, protein_g:25, kcal:600}, 'removing a subtotal preserves overlapping meals and their foods');
assert.equal(evaluate('dayTotals(g_view_date).kcal'), 750, 'overlapping meals never add to the daily total');
console.log('Temporary meals: overlapping selections, live subtotals, date isolation, deletion/restoration, collapsed summaries, and unchanged saves/exports passed.');
