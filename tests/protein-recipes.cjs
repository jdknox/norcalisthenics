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
  let target = {dataset:{a:action, ...extra}};
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
  evaluate(`let render_count = 0;
    render = function() { ++render_count; };
    g_scoop_items = [
      {key:'a', name:'Food A', scoop_g:100, protein_g:10, kcal:200, tags:[]},
      {key:'b', name:'Food B', scoop_g:50, protein_g:10, kcal:50, tags:[]}
    ];
    g_log = {};
    g_admin_mode = false;
    g_view_date = '2020-01-01';`);
  click('recipe-new');
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
  input({recipedraft:'yield_g'}, '250');
  click('recipe-save');
  await flushSync();
  let recipe = JSON.parse(shared).scoop_items[2];
  assert.equal(recipe.protein_100g, 16);
  assert.equal(recipe.kcal_100g, 200);
  assert.equal(recipe.ingredients.length, 2);
  let key = recipe.key;
  evaluate('g_admin_mode = true;');
  click('scoop-scale-open', {key:key});
  input({scaledraft:'grams'}, '75');
  click('scoop-scale-log');
  await flushSync();
  assert.equal(evaluate('dayTotals(g_view_date).protein'), 12);
  assert.equal(evaluate('dayTotals(g_view_date).kcal'), 150);

  click('scoop-edit-open', {key:key});
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
  console.log('Recipe workflow, shared save/reload, history, validation, and TSV round trip passed.');
}

run().catch(function(error) { console.error(error); process.exitCode = 1; });
