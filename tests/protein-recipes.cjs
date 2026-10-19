'use strict';

let assert = require('node:assert/strict');
let fs = require('node:fs');
let vm = require('node:vm');
let html = fs.readFileSync('protein-loadout.html', 'utf8');
let script = html.split('<script>')[1].split('</script>')[0];
new vm.Script(script);
let listeners = {};
let local_values = {};
let shared = null;
let preview = {textContent:''};
let context = vm.createContext({
  console:console,
  setTimeout:setTimeout,
  document:{
    body:null,
    addEventListener:function(type, handler) { listeners[type] = handler; },
    getElementById:function() { return preview; },
    querySelector:function() { return {classList:{toggle:function() {}}}; },
    querySelectorAll:function() { return []; }
  },
  localStorage:{
    setItem:function(key, value) { local_values[key] = value; },
    getItem:function(key) { return local_values[key] || null; },
    removeItem:function(key) { delete local_values[key]; }
  },
  window:{storage:{
    get:function() { return Promise.resolve({value:shared, revision:'test'}); },
    set:function(key, value) { shared = value; return Promise.resolve({revision:'test'}); }
  }}
});
vm.runInContext(script.split("window.addEventListener('error'")[0], context);

function evaluate(code)
{
  return vm.runInContext(code, context);
}

function click(action, extra = {})
{
  let target = {dataset:{a:action, ...extra}, getBoundingClientRect:function() { return {}; }};
  listeners.click({target:{closest:function() { return target; }}});
}

function input(dataset, value)
{
  listeners.input({target:{dataset:dataset, value:value, classList:{toggle:function() {}}}});
}

function flushSync()
{
  return new Promise(function(resolve) { setImmediate(resolve); });
}

async function run()
{
  let imported_detail = evaluate("loggedEntryDetail({grams:'48', protein_g:'5.4', kcal:'125'})");
  assert.match(imported_detail, /48g/);
  assert.match(imported_detail, />\s+5</);
  assert.match(imported_detail, />\s+130</);
  assert.match(imported_detail, /23\.1\/g/);
  let custom_detail = evaluate("loggedEntryDetail({grams:null, protein_g:'5', kcal:'50'})");
  assert.match(custom_detail, /—/);
  assert.match(custom_detail, /10\.0\/g/);

  evaluate(`let render_count = 0;
    showAddFeedback = function() {};
    render = function() { ++render_count; };
    g_scoop_items = [
      {key:'a', name:'Food A', scoop_g:100, protein_g:10, kcal:200, tags:[]},
      {key:'b', name:'Food B', scoop_g:50, protein_g:10, kcal:50, tags:[]}
    ];
    g_log = {};
    g_admin_mode = false;
    g_view_date = '2020-01-01';`);
  click('recipe-new');
  assert.equal(evaluate('g_recipe_draft.scoop_g'), '', 'new recipes default to the whole batch');
  input({recipedraft:'name'}, 'Test recipe');
  click('scoop-add', {key:'a'});
  click('scoop-add', {key:'a'});
  assert.equal(evaluate('g_recipe_draft.ingredients.length'), 1, 'repeat servings must combine');
  assert.equal(evaluate('g_recipe_draft.ingredients[0].grams'), '200');
  click('scoop-scale-open', {key:'b'});
  input({scaledraft:'grams'}, '100');
  click('scoop-scale-log');
  assert.equal(evaluate('g_recipe_draft.ingredients[1].grams'), '100');
  assert.equal(shared, null, 'adding ingredients must not save or sync the draft');
  assert.equal(evaluate('dayTotals(g_view_date).kcal'), 0, 'draft must not log ingredients');
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).yield_g'), 300);
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).scoop_g'), 300);
  input({recipedraft:'yield_g'}, '250');
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).scoop_g'), 250, 'blank serving follows the finished batch mass');
  click('recipe-save');
  await flushSync();
  let recipe = JSON.parse(shared).scoop_items[2];
  assert.equal(recipe.protein_100g, 16);
  assert.equal(recipe.kcal_100g, 200);
  assert.equal(recipe.ingredients.length, 2);
  assert.equal(recipe.scoop_g, 250);
  let key = recipe.key;
  evaluate('g_admin_mode = true;');
  click('scoop-scale-open', {key:key});
  input({scaledraft:'grams'}, '75');
  click('scoop-scale-log');
  await flushSync();
  assert.equal(evaluate('dayTotals(g_view_date).protein'), 12);
  assert.equal(evaluate('dayTotals(g_view_date).kcal'), 150);

  click('scoop-edit-open', {key:key});
  input({recipedraft:'scoop_g'}, '');
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).scoop_g'), 250, 'clearing serving restores the whole batch');
  click('scoop-add', {key:key});
  assert.equal(evaluate('g_recipe_draft.ingredients.length'), 2, 'nested recipes must be rejected');
  assert.equal(evaluate('g_recipe_draft.ingredients[1].grams'), '100');
  let render_count_before = evaluate('render_count');
  input({recipeindex:'1', recipefield:'grams'}, '200');
  assert.equal(evaluate('render_count'), render_count_before, 'ingredient typing must not rebuild the page');
  click('recipe-save');
  await flushSync();
  assert.equal(JSON.parse(shared).scoop_items[2].protein_100g, 24);
  assert.equal(evaluate('dayTotals(g_view_date).protein'), 12, 'editing must preserve past nutrition');
  evaluate('g_scoop_items = []; mergeScoopItems(JSON.parse(' + JSON.stringify(shared) + ').scoop_items);');
  assert.equal(evaluate('g_scoop_items[2].ingredients[1].grams'), 200, 'shared reload must retain amounts');
  let backup = evaluate('buildBackupTSV()');
  assert.equal(backup.ok, true, backup.error);
  let restored = evaluate('parseBackupTSV(' + JSON.stringify(backup.text) + ')');
  assert.equal(restored.ok, true, restored.error);
  let restored_recipe = restored.payload.scoop_items[2];
  assert.equal(restored_recipe.yield_g, 250);
  assert.equal(restored_recipe.ingredients[1].grams, 200);
  assert.equal(restored_recipe.protein_100g, 24);

  click('scoop-edit-open', {key:key});
  input({recipeindex:'0', recipefield:'grams'}, '0');
  click('recipe-save');
  assert.match(preview.textContent, /positive ingredient grams/);
  assert.equal(evaluate('g_scoop_items[2].ingredients[0].grams'), 200);
  input({recipeindex:'0', recipefield:'grams'}, '200');
  evaluate("g_scoop_items[0].archived = true;");
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).error'), '');
  evaluate("g_recipe_draft.ingredients[0].item_key = 'missing';");
  assert.match(evaluate('recipeNutrition(g_recipe_draft).error'), /Choose a pantry food/);
  click('recipe-cancel');
  assert.equal(evaluate('g_recipe_draft'), null);
  assert.equal(evaluate('g_scale_draft'), null);
  click('scoop-add', {key:'a'});
  await flushSync();
  assert.equal(evaluate('dayTotals(g_view_date).kcal'), 350, 'normal logging must resume after cancel');

  evaluate(`g_view_date = '2020-01-02';
    g_admin_mode = false;
    let meal_saves = 0;
    let original_save = save;
    save = function() { ++meal_saves; original_save(); };`);
  let pantry_before = evaluate('JSON.stringify(g_scoop_items)');
  click('recipe-new');
  click('recipe-log');
  assert.notEqual(evaluate('g_recipe_draft'), null, 'past dates require Admin mode to log');
  evaluate(`g_admin_mode = true;`);
  click('recipe-log');
  assert.match(preview.textContent, /Add an ingredient/);
  evaluate(`g_recipe_draft.ingredients = [{item_key:'a',grams:'125.5'},{item_key:'b',grams:'0'}];`);
  click('recipe-log');
  assert.match(preview.textContent, /positive ingredient grams/);
  assert.equal(evaluate('dayTotals(g_view_date).grams'), 0, 'invalid meals must not log any ingredients');
  assert.equal(evaluate('meal_saves'), 0);
  input({recipeindex:'1', recipefield:'grams'}, '75');
  input({recipedraft:'yield_g'}, 'invalid');
  input({recipedraft:'scoop_g'}, '');
  click('recipe-log');
  await flushSync();
  assert.equal(evaluate('g_recipe_draft'), null, 'meal logging must leave recipe mode');
  assert.equal(evaluate('g_scale_draft'), null);
  assert.equal(evaluate('meal_saves'), 1, 'save the complete meal once');
  assert.equal(evaluate('g_log[g_view_date].length'), 2);
  assert.equal(evaluate('dayTotals(g_view_date).grams'), 200.5);
  assert.equal(evaluate('dayTotals(g_view_date).kcal'), 326);
  assert.equal(evaluate('g_log[g_view_date][0].protein_g'), 12.55);
  assert.equal(evaluate('g_log[g_view_date][1].scale'), 1.5);
  assert.equal(evaluate('JSON.stringify(g_scoop_items)'), pantry_before, 'meal logging must not save a recipe or change pantry items');
  assert.equal(JSON.parse(shared).log['2020-01-02'].length, 2);
  click('recipe-log');
  assert.equal(evaluate('g_log[g_view_date].length'), 2, 'a completed draft cannot log twice');
  click('scoop-edit-open', {key:key});
  input({recipeindex:'0', recipefield:'grams'}, '300');
  click('recipe-log');
  assert.equal(evaluate('JSON.stringify(g_scoop_items)'), pantry_before, 'logging an edited recipe draft must not modify the saved recipe');
  console.log('Recipe workflow, meal logging, shared save/reload, history, validation, and TSV round trip passed.');
}

run().catch(function(error) { console.error(error); process.exitCode = 1; });
