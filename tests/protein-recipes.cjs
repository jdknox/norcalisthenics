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
let ingredient_total = {textContent:''};
let total_preview = {innerHTML:''};
let recipe_editor =
{
  querySelector:function() { return {getBoundingClientRect:function() { return {}; }}; }
};
let ingredient_input = {value:''};
let barcode_input = {
  inputMode:'none',
  blur:function() { barcode_input.blurred = true; },
  focus:function() { barcode_input.focused = true; }
};
let scroll_targets = [];
let context = vm.createContext({
  console:console,
  setTimeout:setTimeout,
  document:{
    body:null,
    addEventListener:function(type, handler) { listeners[type] = handler; },
    getElementById:function(id)
    {
      switch (id)
      {
        case 'recipe-ingredient-total': return ingredient_total;
        case 'recipe-total-preview': return total_preview;
        default: return preview;
      }
    },
    querySelector:function(selector)
    {
      if (selector == '.recipe-editor') return recipe_editor;
      if (selector == '[data-adddraft="barcode"]') return barcode_input;
      if (selector == '[data-recipeindex="1"][data-recipefield="grams"]') return ingredient_input;
      return {classList:{toggle:function() {}}};
    },
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

function toggleSaveModifications(checked)
{
  listeners.input({target:{dataset:{recipedraft:'save_modifications'}, checked:checked}});
}

function flushSync()
{
  return new Promise(function(resolve) { setImmediate(resolve); });
}

function testRecipeLogSnapshots()
{
  evaluate(`save = function() {};
    g_view_date = '2020-03-01';
    g_admin_mode = true;
    g_recipe_draft = null;
    g_log = {};
    g_scoop_items = [
      {
        key:'powder', name:'Powder', brand:'Original brand', barcode:'000123', scoop_g:20, protein_g:16, kcal:80
      },
      {
        key:'yogurt', name:'Yogurt', scoop_g:100, protein_g:10, kcal:60
      },
      {
        key:'premix', name:'Premix', scoop_g:100, protein_g:17, kcal:94, yield_g:200,
        ingredients:[
          {
            item_key:'powder', grams:20
          },
          {
            item_key:'yogurt', grams:180
          }
        ]
      },
      {
        key:'bowl', name:'Original bowl', scoop_g:125, protein_g:13.5, kcal:77, yield_g:250,
        ingredients:[
          {
            item_key:'premix', grams:100
          },
          {
            item_key:'yogurt', grams:100
          }
        ]
      }
    ];`);
  click('scoop-add',
  {
    key:'bowl'
  });
  click('scoop-scale-open',
  {
    key:'bowl'
  });
  input(
  {
    scaledraft:'grams'
  }, '62.5');
  click('scoop-scale-log');
  let entries = JSON.parse(evaluate('JSON.stringify(g_log[g_view_date])'));
  assert.equal(entries.length, 2, 'ingredients must not become additional diary entries');
  assert.equal(entries[0].recipe_snapshot.ingredients[0].grams, 50, 'saved portions use the finished batch weight');
  assert.equal(entries[0].recipe_snapshot.ingredients[0].ingredients[0].grams, 5, 'nested recipes scale down to the logged portion');
  assert.equal(entries[1].recipe_snapshot.ingredients[0].ingredients[0].grams, 2.5, 'scaled logging also captures the ingredient amounts');
  assert.equal(entries[0].recipe_snapshot.ingredients[0].ingredients[0].brand, 'Original brand');
  assert.equal(entries[0].recipe_snapshot.ingredients[0].ingredients[0].barcode, '000123');
  assert.equal(evaluate('dayTotals(g_view_date).protein'), 20.25, 'nested details cannot add protein a second time');
  assert.equal(evaluate('dayTotals(g_view_date).kcal'), 116, 'the rounded, recorded parent calories remain authoritative');
  assert.equal(evaluate('dayTotals(g_view_date).grams'), 187.5);

  click('scoop-edit-open',
  {
    key:'bowl'
  });
  click('recipe-log');
  entries = JSON.parse(evaluate('JSON.stringify(g_log[g_view_date])'));
  assert.equal(entries[2].item_key, 'custom');
  assert.equal(entries[2].recipe_snapshot.ingredients[0].grams, 100);
  assert.equal(entries[2].recipe_snapshot.ingredients[0].ingredients[0].grams, 10, 'unsaved drafts snapshot the full ingredient batch, not a portion based on finished yield');
  assert.equal(entries[2].grams, 200);
  assert.equal(entries[2].protein_g, 27);

  click('scoop-edit-open',
  {
    key:'bowl'
  });
  input(
  {
    recipedraft:'yield_g'
  }, '80');
  toggleSaveModifications(true);
  click('recipe-log');
  entries = JSON.parse(evaluate('JSON.stringify(g_log[g_view_date])'));
  assert.equal(entries[3].item_key, 'bowl');
  assert.equal(entries[3].recipe_snapshot.ingredients[0].ingredients[0].grams, 10, 'save-on-log keeps full-batch details even with a finished-weight override');
  let frozen_log = evaluate('JSON.stringify(g_log)');
  let frozen_totals = evaluate('JSON.stringify(dayTotals(g_view_date))');
  evaluate(`g_scoop_items[0].name = 'Changed powder';
    g_scoop_items[0].brand = 'Changed brand';
    g_scoop_items[0].barcode = '999';
    g_scoop_items[0].protein_g = 0;
    g_scoop_items[2].ingredients[0].grams = 99;
    g_scoop_items[3].name = 'Changed bowl';`);
  assert.equal(evaluate('JSON.stringify(g_log)'), frozen_log, 'later recipe and pantry edits cannot change any logged snapshot');
  assert.equal(evaluate('loggedEntryLabel(g_log[g_view_date][0])'), 'Original bowl');
  assert.equal(evaluate('JSON.stringify(dayTotals(g_view_date))'), frozen_totals);
  let diary = evaluate('buildDiaryText()');
  assert.match(diary, /Ingredients \(detail only; nutrition included in meal totals\)/);
  assert.match(diary, /Powder — Original brand \[000123\] · 5 g · 4 g protein · 20 kcal/);
  assert.doesNotMatch(diary.split('FOOD DIARY')[1], /Changed powder|Changed bowl/);

  let json_payload = JSON.parse(evaluate('buildExportJSON()'));
  assert.equal(JSON.stringify(json_payload.log), frozen_log, 'JSON exports retain every snapshot');
  evaluate('saveLocalJson(JSON.stringify(makeSavePayload()));');
  assert.equal(JSON.stringify(JSON.parse(local_values['protein-loadout:v1']).log), frozen_log, 'local storage retains every snapshot');
  let backup = evaluate('buildBackupTSV()');
  assert.equal(backup.ok, true, backup.error);
  let restored = evaluate('parseBackupTSV(' + JSON.stringify(backup.text) + ')');
  assert.equal(restored.ok, true, restored.error);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.payload.log['2020-03-01'][0].recipe_snapshot)), json_payload.log['2020-03-01'][0].recipe_snapshot, 'TSV round trips nested snapshots');
  context.snapshot_payload = restored.payload;
  evaluate('g_log = {}; g_import_pending = snapshot_payload; applyReplaceImport();');
  assert.equal(evaluate('JSON.stringify(dayTotals(g_view_date))'), frozen_totals, 'replacement imports still count only parent nutrition');
  assert.equal(evaluate('g_log[g_view_date][0].recipe_snapshot.ingredients[0].ingredients[0].grams'), 5);

  evaluate(`let snapshot_remote = JSON.parse(JSON.stringify(g_log));
    delete g_log[g_view_date][0].recipe_snapshot;
    mergeLogEntries(snapshot_remote);
    mergeLogEntries(snapshot_remote);`);
  assert.equal(evaluate('g_log[g_view_date].length'), 4, 'repeated sync cannot create ingredient entries or duplicate meals');
  assert.equal(evaluate('g_log[g_view_date][0].recipe_snapshot.ingredients[0].ingredients[0].grams'), 5, 'sync fills a missing snapshot on the same existing entry');
  evaluate('snapshot_remote[g_view_date][0].recipe_snapshot.ingredients[0].ingredients[0].grams = 999; mergeLogEntries(snapshot_remote);');
  assert.equal(evaluate('g_log[g_view_date][0].recipe_snapshot.ingredients[0].ingredients[0].grams'), 5, 'sync copies incoming detail and never overwrites an existing snapshot');
  evaluate('delete snapshot_remote[g_view_date][0].recipe_snapshot; mergeLogEntries(snapshot_remote);');
  assert.equal(evaluate('g_log[g_view_date][0].recipe_snapshot.ingredients[0].ingredients[0].grams'), 5, 'older clients cannot remove a snapshot');
  evaluate('markLogEntryDeleted(g_log[g_view_date][0]);');
  assert.equal(evaluate('dayTotals(g_view_date).protein'), 60.75);
  evaluate('markLogEntryRestored(g_log[g_view_date][0]);');
  assert.equal(evaluate('JSON.stringify(dayTotals(g_view_date))'), frozen_totals, 'restoring a meal does not add its ingredient nutrition again');

  let legacy_lines = backup.text.split('\n');
  let section = '';
  for (let index = 0; index < legacy_lines.length; ++index)
  {
    let line = legacy_lines[index];
    if (line.charAt(0) == '[') section = line;
    if (section != '[log_entries]' || !line || line.charAt(0) == '[') continue;
    legacy_lines[index] = line.slice(0, line.lastIndexOf('\t'));
  }
  let legacy = evaluate('parseBackupTSV(' + JSON.stringify(legacy_lines.join('\n')) + ')');
  assert.equal(legacy.ok, true, legacy.error);
  assert.equal(legacy.payload.log['2020-03-01'][0].recipe_snapshot, undefined, 'legacy backups remain readable without invented ingredient histories');
  context.snapshot_payload = legacy.payload;
  evaluate('g_log = {}; g_import_pending = snapshot_payload; applyReplaceImport();');
  assert.equal(evaluate('JSON.stringify(dayTotals(g_view_date))'), frozen_totals);

  evaluate(`g_view_date = '2020-03-02';
    addScoop('yogurt');
    pushLogEntry('bowl', null, 13.5, 77, null);`);
  assert.equal(evaluate('g_log[g_view_date][0].recipe_snapshot'), undefined, 'ordinary foods keep the existing log shape');
  assert.equal(evaluate('g_log[g_view_date][1].recipe_snapshot.ingredients[0].ingredients[0].grams'), null, 'unknown serving mass must not invent ingredient amounts');
  assert.equal(evaluate('dayTotals(g_view_date).protein'), 23.5, 'unknown ingredient amounts do not change the recorded meal nutrition');
  evaluate("g_scoop_items[2].ingredients[0].item_key = 'missing';");
  let log_before_invalid = evaluate('JSON.stringify(g_log)');
  assert.match(evaluate("addScoop('bowl')"), /Choose a pantry food/, 'missing nested ingredients produce a visible logging error');
  assert.equal(evaluate('JSON.stringify(g_log)'), log_before_invalid, 'snapshot failure cannot leave a partially logged meal');
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
  context.scrollBelowTabs = function(node) { scroll_targets.push(node); };
  click('recipe-new');
  assert.equal(scroll_targets.length, 0, 'starting a new recipe leaves scrolling unchanged');
  assert.equal(evaluate('g_recipe_draft.scoop_g'), '', 'new recipes default to the whole batch');
  assert.equal(evaluate('g_recipe_draft.yield_g'), '', 'new recipes have no finished-weight override');
  assert.equal(evaluate('g_recipe_draft.save_modifications'), false, 'logging defaults to leaving pantry recipes unchanged');
  assert.doesNotMatch(evaluate('renderRecipeDraft()'), /data-a="recipe-archive"/, 'unsaved recipes cannot be archived');
  let recipe_mode_html = evaluate('renderScoopSection()');
  assert.match(recipe_mode_html, /class="summary"/, 'recipe mode keeps the daily summary visible');
  assert.match(recipe_mode_html, /class="protein-kg-scale/, 'recipe mode keeps the protein and bodyweight panel visible');
  assert.match(recipe_mode_html, /class="logged-foods"/, 'recipe mode keeps logged foods visible');
  input({recipedraft:'name'}, 'Test recipe');
  click('scoop-add', {key:'a'});
  assert.equal(scroll_targets.length, 1, 'adding an ingredient scrolls once');
  assert.equal(scroll_targets.at(-1), recipe_editor, 'ingredient additions return to the recipe editor');
  click('scoop-add', {key:'a'});
  assert.equal(scroll_targets.length, 2, 'adding more of an ingredient also returns to the editor');
  assert.equal(evaluate('g_recipe_draft.ingredients.length'), 1, 'repeat servings must combine');
  assert.equal(evaluate('g_recipe_draft.ingredients[0].grams'), '200');
  click('scoop-scale-open', {key:'b'});
  input({scaledraft:'grams'}, '100');
  click('scoop-scale-log');
  assert.equal(scroll_targets.length, 3, 'scaled ingredient additions also scroll once');
  assert.equal(scroll_targets.at(-1), recipe_editor);
  assert.equal(evaluate('g_recipe_draft.ingredients[1].grams'), '100');
  assert.equal(shared, null, 'adding ingredients must not save or sync the draft');
  assert.equal(evaluate('dayTotals(g_view_date).kcal'), 0, 'draft must not log ingredients');
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).yield_g'), 300);
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).scoop_g'), 300);
  input({recipedraft:'yield_g'}, '250');
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).scoop_g'), 250, 'blank serving follows the finished batch mass');
  assert.equal(ingredient_total.textContent, '300.0 g', 'the ingredient total remains independent of the override');
  assert.match(total_preview.innerHTML, /300g/, 'the total nutrition line shows the full ingredient mass');
  assert.match(preview.innerHTML, /250g/, 'the serving nutrition line follows the finished override');
  input({recipedraft:'scoop_g'}, '50');
  assert.match(preview.innerHTML, /50g/);
  assert.match(preview.innerHTML, /class="logged-food-protein">\s*8</);
  assert.match(total_preview.innerHTML, /class="logged-food-protein">\s*40</, 'serving edits cannot change the full ingredient nutrition');
  input({recipedraft:'scoop_g'}, '');
  input({recipedraft:'yield_g'}, '');
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).yield_g'), 300, 'clearing the override uses the ingredient total');
  input({recipedraft:'yield_g'}, '250');
  click('recipe-save');
  await flushSync();
  let recipe = JSON.parse(shared).scoop_items[2];
  assert.equal(recipe.protein_100g, 16);
  assert.equal(recipe.kcal_100g, 200);
  assert.equal(recipe.brand, 'knox');
  assert.equal(recipe.ingredients.length, 2);
  assert.equal(recipe.scoop_g, 250);
  let recipe_row_html = evaluate('renderItemRow(g_scoop_items[2], true, false, "standalone")');
  assert.match(recipe_row_html, /class="scooprow recipeitem"/, 'saved recipes have a distinct row marker');
  assert.match(recipe_row_html, /class="recipe-label" title="Recipe">recipe</, 'saved recipes have a compact labeled marker');
  let key = recipe.key;
  evaluate('g_admin_mode = true;');
  let before_normal_log_scrolls = scroll_targets.length;
  click('scoop-scale-open', {key:key});
  input({scaledraft:'grams'}, '75');
  click('scoop-scale-log');
  assert.equal(scroll_targets.length, before_normal_log_scrolls, 'normal pantry logging does not jump');
  await flushSync();
  assert.equal(evaluate('dayTotals(g_view_date).protein'), 12);
  assert.equal(evaluate('dayTotals(g_view_date).kcal'), 150);

  click('scoop-edit-open', {key:key});
  assert.equal(scroll_targets.at(-1), recipe_editor, 'editing a recipe scrolls to the recipe editor');
  assert.equal(evaluate('g_recipe_draft.yield_g'), '250', 'editing preserves a distinct saved finished weight');
  input({recipedraft:'scoop_g'}, '');
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).scoop_g'), 250, 'clearing serving restores the whole batch');
  let before_blocked_add_scrolls = scroll_targets.length;
  click('scoop-add', {key:key});
  assert.equal(scroll_targets.length, before_blocked_add_scrolls, 'blocked ingredient additions do not jump');
  assert.equal(evaluate('g_recipe_draft.ingredients.length'), 2, 'a recipe cannot be its own ingredient');
  assert.equal(evaluate('g_recipe_draft.ingredients[1].grams'), '100');
  let render_count_before = evaluate('render_count');
  let before_typing_scrolls = scroll_targets.length;
  let pantry_before_zero = evaluate('JSON.stringify(g_scoop_items)');
  let log_before_zero = evaluate('JSON.stringify(g_log)');
  let shared_before_zero = shared;
  click('recipe-zero', {index:'1'});
  assert.equal(ingredient_input.value, '0', 'zero updates the existing input');
  assert.equal(evaluate('g_recipe_draft.ingredients[1].grams'), '0');
  assert.equal(evaluate('g_recipe_draft.ingredients.length'), 2, 'zero keeps the ingredient listed');
  assert.equal(evaluate('g_recipe_draft.ingredients[0].grams'), '200', 'zero leaves other ingredients alone');
  assert.equal(ingredient_total.textContent, '200.0 g');
  assert.equal(evaluate('recipeIngredientTotals(g_recipe_draft).protein_g'), 20);
  assert.equal(evaluate('recipeIngredientTotals(g_recipe_draft).kcal'), 400);
  click('recipe-zero', {index:'1'});
  assert.equal(evaluate('render_count'), render_count_before, 'zero must not rebuild the editor');
  assert.equal(evaluate('JSON.stringify(g_scoop_items)'), pantry_before_zero, 'zero only changes the draft');
  assert.equal(evaluate('JSON.stringify(g_log)'), log_before_zero);
  assert.equal(shared, shared_before_zero, 'zero must not save or sync');
  input({recipeindex:'1', recipefield:'grams'}, '200');
  assert.equal(scroll_targets.length, before_typing_scrolls, 'zeroing and typing ingredient grams do not jump');
  assert.equal(evaluate('render_count'), render_count_before, 'ingredient typing must not rebuild the page');
  assert.equal(ingredient_total.textContent, '400.0 g', 'the read-only total follows ingredient edits');
  assert.match(total_preview.innerHTML, /400g/, 'the total nutrition line follows ingredient edits');
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
  input({recipeindex:'0', recipefield:'grams'}, '-1');
  click('recipe-save');
  assert.match(preview.textContent, /non-negative ingredient grams/);
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
  let temporary_meals_before = evaluate('g_temporary_meals.length');
  click('recipe-new');
  click('recipe-log');
  assert.notEqual(evaluate('g_recipe_draft'), null, 'past dates require Admin mode to log');
  evaluate(`g_admin_mode = true;`);
  click('recipe-log');
  assert.match(preview.textContent, /Add an ingredient/);
  evaluate(`g_recipe_draft.ingredients = [{item_key:'a',grams:'125.5'},{item_key:'b',grams:'-1'}];`);
  click('recipe-log');
  assert.match(preview.textContent, /non-negative ingredient grams/);
  assert.equal(evaluate('dayTotals(g_view_date).grams'), 0, 'invalid meals must not log any ingredients');
  assert.equal(evaluate('meal_saves'), 0);
  assert.equal(evaluate('g_temporary_meals.length'), temporary_meals_before, 'invalid drafts cannot create temporary meals');
  input({recipeindex:'1', recipefield:'grams'}, '75');
  input({recipedraft:'yield_g'}, 'invalid');
  input({recipedraft:'scoop_g'}, '50');
  click('recipe-log');
  await flushSync();
  assert.equal(evaluate('g_recipe_draft'), null, 'meal logging must leave recipe mode');
  assert.equal(evaluate('g_scale_draft'), null);
  assert.equal(evaluate('meal_saves'), 1, 'save the complete meal once');
  assert.equal(evaluate('g_log[g_view_date].length'), 1);
  assert.equal(evaluate('dayTotals(g_view_date).grams'), 200.5);
  assert.equal(evaluate('dayTotals(g_view_date).kcal'), 326);
  assert.equal(evaluate('g_log[g_view_date][0].protein_g'), 27.55);
  assert.equal(evaluate('g_log[g_view_date][0].scale'), null);
  assert.equal(evaluate('g_log[g_view_date][0].item_key'), 'custom');
  assert.equal(evaluate('g_log[g_view_date][0].note'), 'Meal', 'unnamed drafts use a readable fallback');
  assert.equal(evaluate('JSON.stringify(g_scoop_items)'), pantry_before, 'meal logging must not save a recipe or change pantry items');
  assert.equal(JSON.parse(shared).log['2020-01-02'].length, 1);
  assert.equal(evaluate('g_temporary_meals.length'), temporary_meals_before, 'combined entries do not need a temporary meal');
  click('recipe-log');
  assert.equal(evaluate('g_log[g_view_date].length'), 1, 'a completed draft cannot log twice');
  evaluate('markLogEntryDeleted(g_log[g_view_date][0]);');
  assert.equal(evaluate('dayTotals(g_view_date).grams'), 0, 'deleting a combined entry removes its entire mass');
  evaluate('markLogEntryRestored(g_log[g_view_date][0]);');
  assert.equal(evaluate('dayTotals(g_view_date).grams'), 200.5);
  click('scoop-edit-open', {key:key});
  input({recipeindex:'0', recipefield:'grams'}, '300');
  click('recipe-log');
  assert.equal(evaluate('g_log[g_view_date][1].note'), 'Test recipe', 'logging an edited recipe uses its name');
  assert.equal(evaluate('JSON.stringify(g_scoop_items)'), pantry_before, 'logging an edited recipe draft must not modify the saved recipe');
  await flushSync();

  evaluate("save = original_save; g_view_date = '2020-02-01';");
  click('recipe-new');
  input({recipedraft:'name'}, 'Pita wrap');
  let ingredient_row = evaluate('renderItemRow(g_scoop_items[2], true, false, "standalone")');
  assert.doesNotMatch(ingredient_row.match(/<button[^>]*data-a="scoop-add"[^>]*>/)[0], / disabled/, 'recipe servings can be added to a draft');
  assert.doesNotMatch(ingredient_row.match(/<button[^>]*data-a="scoop-scale-open"[^>]*>/)[0], / disabled/, 'recipe ingredient grams can be chosen');
  assert.match(ingredient_row.match(/<button[^>]*data-a="scoop-edit-open"[^>]*>/)[0], / disabled/, 'editing another recipe must not replace the current draft');
  click('scoop-add', {key:key});
  assert.equal(evaluate('g_recipe_draft.ingredients[0].grams'), '250');
  click('scoop-scale-open', {key:key});
  input({scaledraft:'grams'}, '50');
  click('scoop-scale-log');
  assert.equal(evaluate('g_recipe_draft.ingredients[0].grams'), '300', 'scaled recipe servings combine with the existing ingredient');
  input({recipeindex:'0', recipefield:'grams'}, '150');
  click('scoop-add', {key:'b'});
  assert.equal(evaluate('dayTotals(g_view_date).grams'), 0, 'nested ingredients stay in the draft');
  click('recipe-save');
  await flushSync();
  let wrap = JSON.parse(shared).scoop_items[3];
  assert.deepEqual(wrap.ingredients, [{item_key:key, grams:150}, {item_key:'b', grams:50}]);
  assert.equal(wrap.protein_g, 46);
  assert.ok(Math.abs(wrap.kcal - 410) < 1e-9);
  click('scoop-edit-open', {key:wrap.key});
  assert.equal(evaluate('g_recipe_draft.yield_g'), '', 'a saved weight matching its ingredients is not an override');
  input({recipeindex:'0', recipefield:'grams'}, '160');
  assert.equal(evaluate('recipeBatchGrams(g_recipe_draft)'), 210, 'without an override the batch follows ingredient changes');
  click('recipe-cancel');
  click('scoop-add', {key:wrap.key});
  await flushSync();
  click('recipe-new');
  input({recipedraft:'name'}, '  Lunch wrap  ');
  click('scoop-add', {key:wrap.key});
  click('recipe-log');
  await flushSync();
  assert.equal(evaluate('g_log[g_view_date].length'), 2, 'logging a draft adds exactly one entry alongside existing foods');
  assert.equal(evaluate('g_log[g_view_date][1].note'), 'Lunch wrap');
  assert.equal(evaluate('g_log[g_view_date][1].item_key'), 'custom');
  assert.equal(evaluate('diaryEntryLabel(g_log[g_view_date][1])'), '* Lunch wrap');
  assert.equal(evaluate('g_temporary_meals.length'), temporary_meals_before);
  assert.equal(evaluate('dayTotals(g_view_date).protein'), 92);
  assert.ok(Math.abs(evaluate('dayTotals(g_view_date).kcal') - 820) < 1e-9);
  assert.equal(evaluate('dayTotals(g_view_date).grams'), 400);
  let frozen_log = evaluate('JSON.stringify(g_log)');

  click('recipe-new');
  input({recipedraft:'name'}, 'Wrap meal');
  click('scoop-add', {key:wrap.key});
  click('recipe-save');
  await flushSync();
  let meal = JSON.parse(shared).scoop_items[4];
  click('scoop-edit-open', {key:key});
  let blocked_row = evaluate('renderItemRow(g_scoop_items[3], true, false, "standalone")');
  assert.match(blocked_row.match(/<button[^>]*data-a="scoop-add"[^>]*>/)[0], / disabled/, 'a containing recipe cannot be added back into its ingredient');
  assert.match(blocked_row.match(/<button[^>]*data-a="scoop-scale-open"[^>]*>/)[0], / disabled/);
  click('scoop-add', {key:wrap.key});
  click('scoop-add', {key:meal.key});
  assert.equal(evaluate('g_recipe_draft.ingredients.length'), 2, 'direct and deeper circular references must be rejected');
  evaluate('g_recipe_draft.ingredients.push({item_key:' + JSON.stringify(meal.key) + ', grams:"50"});');
  click('recipe-save');
  assert.match(preview.textContent, /cannot contain itself/, 'save validation also rejects circular references');
  click('recipe-log');
  assert.match(preview.textContent, /cannot contain itself/, 'meal logging also rejects circular references');
  assert.equal(evaluate('JSON.stringify(g_log)'), frozen_log, 'invalid nested recipes cannot change the log');
  click('recipe-remove', {index:'2'});
  input({recipeindex:'1', recipefield:'grams'}, '100');
  click('recipe-save');
  await flushSync();
  assert.equal(JSON.parse(shared).scoop_items[2].protein_g, 40);
  assert.equal(JSON.parse(shared).scoop_items[3].protein_g, 46, 'editing the filling does not propagate into saved wraps');
  assert.equal(evaluate('JSON.stringify(g_log)'), frozen_log, 'editing the filling must preserve every logged value');

  click('scoop-edit-open', {key:wrap.key});
  assert.equal(evaluate('recipeNutrition(g_recipe_draft).protein_100g'), 17, 'reopening the wrap uses the updated saved filling nutrition');
  click('recipe-save');
  await flushSync();
  assert.equal(JSON.parse(shared).scoop_items[3].protein_g, 34, 'saving the wrap refreshes its own nutrition');
  assert.equal(evaluate('JSON.stringify(g_log)'), frozen_log, 'saving the wrap must preserve every logged value');
  assert.equal(JSON.stringify(JSON.parse(shared).log), frozen_log, 'shared sync preserves the frozen log');

  backup = evaluate('buildBackupTSV()');
  restored = evaluate('parseBackupTSV(' + JSON.stringify(backup.text) + ')');
  assert.equal(restored.ok, true, restored.error);
  assert.equal(JSON.stringify(restored.payload.scoop_items[3].ingredients), JSON.stringify(wrap.ingredients), 'TSV retains nested recipe keys and grams');
  let expected_restored_log = JSON.parse(frozen_log);
  for (let day of Object.values(expected_restored_log))
  {
    for (let entry of day)
    {
      if (entry.scale == null) delete entry.scale;
    }
  }
  assert.deepEqual(JSON.parse(JSON.stringify(restored.payload.log)), expected_restored_log, 'TSV retains the original logged nutrition; blank optional scales are omitted');
  evaluate('g_scoop_items = []; mergeScoopItems(JSON.parse(' + JSON.stringify(shared) + ').scoop_items);');
  assert.equal(evaluate('g_scoop_items[3].ingredients[0].item_key'), key, 'shared reload retains nested recipe references');
  assert.equal(evaluate('g_scoop_items[3].protein_g'), 34);

  evaluate(`g_view_date = '2020-02-02';
    let combined_saves = 0;
    let save_for_combined = save;
    save = function() { ++combined_saves; save_for_combined(); };`);
  let pantry_before_combined = evaluate('JSON.stringify(g_scoop_items)');
  let log_before_combined = evaluate('JSON.stringify(g_log)');
  click('recipe-new');
  click('scoop-add', {key:'b'});
  let before_toggle = evaluate('render_count');
  toggleSaveModifications(true);
  assert.equal(evaluate('g_recipe_draft.save_modifications'), true);
  assert.equal(evaluate('render_count'), before_toggle, 'toggling save must leave the form in place');
  click('recipe-log');
  assert.match(preview.textContent, /Enter a recipe name/);
  assert.equal(evaluate('JSON.stringify(g_scoop_items)'), pantry_before_combined);
  assert.equal(evaluate('JSON.stringify(g_log)'), log_before_combined);
  input({recipedraft:'name'}, 'Saved lunch');
  input({recipedraft:'yield_g'}, '-1');
  click('recipe-log');
  assert.match(preview.textContent, /positive finished weight/);
  assert.equal(evaluate('JSON.stringify(g_scoop_items)'), pantry_before_combined, 'a failed combined action cannot save partial edits');
  assert.equal(evaluate('JSON.stringify(g_log)'), log_before_combined, 'a failed combined action cannot log food');
  input({recipedraft:'yield_g'}, '');
  click('recipe-log');
  await flushSync();
  assert.equal(evaluate('combined_saves'), 1, 'saving and logging persists the whole action once');
  let saved_lunch = JSON.parse(shared).scoop_items.at(-1);
  assert.equal(saved_lunch.name, 'Saved lunch');
  assert.equal(saved_lunch.ingredients[0].grams, 50);
  assert.equal(saved_lunch.save_modifications, undefined, 'the toggle is transient draft state');
  assert.equal(evaluate('g_log[g_view_date].length'), 1);
  assert.equal(evaluate('g_log[g_view_date][0].item_key'), saved_lunch.key, 'save-on-log records the saved pantry recipe');
  assert.equal(evaluate('loggedEntryLabel(g_log[g_view_date][0])'), 'Saved lunch');
  assert.equal(evaluate('g_log[g_view_date][0].grams'), 50);
  let first_lunch = evaluate('JSON.stringify(g_log[g_view_date][0])');

  click('scoop-edit-open', {key:saved_lunch.key});
  assert.equal(evaluate('g_recipe_draft.save_modifications'), false, 'each edit session starts with save-on-log off');
  input({recipeindex:'0', recipefield:'grams'}, '100');
  input({recipedraft:'yield_g'}, '80');
  input({recipedraft:'scoop_g'}, '20');
  toggleSaveModifications(true);
  click('recipe-log');
  await flushSync();
  assert.equal(evaluate('combined_saves'), 2);
  assert.equal(evaluate('findScoopItem(' + JSON.stringify(saved_lunch.key) + ').ingredients[0].grams'), 100);
  assert.equal(evaluate('findScoopItem(' + JSON.stringify(saved_lunch.key) + ').yield_g'), 80);
  assert.equal(evaluate('findScoopItem(' + JSON.stringify(saved_lunch.key) + ').scoop_g'), 20);
  assert.equal(evaluate('g_log[g_view_date][1].grams'), 100, 'combined actions still log the full ingredient mass');
  assert.equal(evaluate('g_log[g_view_date][1].item_key'), saved_lunch.key);
  assert.equal(evaluate('g_log[g_view_date][1].protein_g'), 20);
  assert.equal(evaluate('g_log[g_view_date][1].kcal'), 100);
  assert.equal(evaluate('JSON.stringify(g_log[g_view_date][0])'), first_lunch, 'saving modifications cannot change previous logged values');

  click('scoop-edit-open', {key:saved_lunch.key});
  toggleSaveModifications(true);
  input({recipeindex:'0', recipefield:'grams'}, '75');
  click('recipe-save');
  await flushSync();
  assert.equal(evaluate('g_log[g_view_date].length'), 2, 'the bottom Save button never logs food');
  assert.equal(evaluate('findScoopItem(' + JSON.stringify(saved_lunch.key) + ').ingredients[0].grams'), 75);
  let recipe_before_archive = evaluate('JSON.stringify(findScoopItem(' + JSON.stringify(key) + '))');
  let parent_before_archive = evaluate('JSON.stringify(findScoopItem(' + JSON.stringify(wrap.key) + '))');
  let log_before_archive = evaluate('JSON.stringify(g_log)');
  let parent_totals_before_archive = evaluate('JSON.stringify(recipeIngredientTotals(findScoopItem(' + JSON.stringify(wrap.key) + ')))');
  click('scoop-edit-open', {key:key});
  assert.match(evaluate('renderRecipeDraft()'), /data-a="recipe-archive"[^>]*>archive</);
  input({recipedraft:'name'}, '');
  input({recipeindex:'0', recipefield:'grams'}, '-1');
  click('recipe-archive');
  await flushSync();
  assert.equal(evaluate('g_recipe_draft'), null, 'archiving closes recipe mode');
  let archived_recipe = JSON.parse(shared).scoop_items.find(function(item) { return item.key == key; });
  assert.equal(archived_recipe.archived, true, 'the existing archive flag is synced');
  let archived_backup = evaluate('buildBackupTSV()');
  assert.equal(archived_backup.ok, true, archived_backup.error);
  let archived_restore = evaluate('parseBackupTSV(' + JSON.stringify(archived_backup.text) + ')');
  assert.equal(archived_restore.ok, true, archived_restore.error);
  assert.equal(archived_restore.payload.scoop_items.find(function(item) { return item.key == key; }).archived, true, 'recipe archive state survives a TSV backup round trip');
  delete archived_recipe.archived;
  assert.deepEqual(archived_recipe, JSON.parse(recipe_before_archive), 'archiving does not save draft edits or change recipe values');
  assert.equal(evaluate('sortedActiveScoopItems().some(item => item.key == ' + JSON.stringify(key) + ')'), false);
  assert.equal(evaluate('sortedArchivedScoopItems().some(item => item.key == ' + JSON.stringify(key) + ')'), true);
  assert.equal(evaluate('g_collapsed_groups.__archived'), undefined, 'archiving opens the archived group');
  assert.match(evaluate('renderArchivedItems()'), /recipeitem/, 'archived recipes use the existing archived list');
  assert.equal(evaluate('JSON.stringify(g_log)'), log_before_archive, 'archiving leaves logged foods frozen');
  assert.equal(evaluate('JSON.stringify(findScoopItem(' + JSON.stringify(wrap.key) + '))'), parent_before_archive);
  assert.equal(evaluate('JSON.stringify(recipeIngredientTotals(findScoopItem(' + JSON.stringify(wrap.key) + ')))'), parent_totals_before_archive, 'archived ingredients remain available to existing recipes');
  click('scoop-edit-open', {key:key, context:'archived'});
  assert.match(evaluate('renderRecipeDraft()'), /data-a="recipe-archive"[^>]*>unarchive</);
  click('recipe-archive');
  await flushSync();
  assert.equal(evaluate('g_recipe_draft'), null, 'unarchiving closes recipe mode');
  let unarchived_recipe = JSON.parse(shared).scoop_items.find(function(item) { return item.key == key; });
  assert.equal(unarchived_recipe.archived, false, 'unarchiving syncs the same archive flag');
  delete unarchived_recipe.archived;
  assert.deepEqual(unarchived_recipe, JSON.parse(recipe_before_archive));
  assert.equal(evaluate('sortedActiveScoopItems().some(item => item.key == ' + JSON.stringify(key) + ')'), true);
  assert.equal(evaluate('JSON.stringify(g_log)'), log_before_archive, 'unarchiving leaves logged foods frozen');
  click('scoop-edit-open', {key:key});
  click('recipe-zero', {index:'1'});
  let zeroed_totals = JSON.parse(evaluate('JSON.stringify(recipeIngredientTotals(g_recipe_draft))'));
  let log_count_before_zeroed_meal = evaluate('g_log[g_view_date].length');
  let pantry_before_zeroed_meal = evaluate('JSON.stringify(g_scoop_items)');
  click('recipe-log');
  await flushSync();
  let zeroed_entry = JSON.parse(shared).log[evaluate('g_view_date')].at(-1);
  assert.equal(zeroed_entry.item_key, 'custom');
  assert.equal(zeroed_entry.grams, zeroed_totals.grams);
  assert.equal(zeroed_entry.protein_g, zeroed_totals.protein_g);
  assert.equal(zeroed_entry.kcal, zeroed_totals.kcal);
  assert.equal(evaluate('g_log[g_view_date].length'), log_count_before_zeroed_meal + 1);
  assert.equal(evaluate('JSON.stringify(g_scoop_items)'), pantry_before_zeroed_meal, 'logging with a zeroed ingredient leaves the saved recipe unchanged');
  click('scoop-add-item-open');
  assert.equal(evaluate('g_scoop_add_draft.barcode_keyboard'), false);
  assert.match(evaluate('renderScoopSection()'), /inputmode="none" data-adddraft="barcode"/);
  let before_keyboard = evaluate('render_count');
  click('addex-barcode-keyboard');
  assert.equal(barcode_input.inputMode, 'numeric');
  assert.equal(barcode_input.blurred, true, 'keyboard entry refocuses even an already focused barcode field');
  assert.equal(barcode_input.focused, true);
  assert.equal(evaluate('render_count'), before_keyboard, 'keyboard entry does not rebuild the form');
  assert.match(evaluate('renderScoopSection()'), /inputmode="numeric" data-adddraft="barcode"/, 'manual entry mode survives a render');
  input({adddraft:'barcode'}, '0012345678905');
  input({adddraft:'name'}, 'Barcode test');
  click('scoop-add-item-save');
  await flushSync();
  let barcode_item = JSON.parse(shared).scoop_items.at(-1);
  assert.equal(barcode_item.barcode, '0012345678905', 'barcode entry keeps leading zeros');
  assert.equal(barcode_item.barcode_keyboard, undefined, 'keyboard mode is never saved with an item');
  click('scoop-add-item-open');
  assert.match(evaluate('renderScoopSection()'), /inputmode="none" data-adddraft="barcode"/, 'each new form starts paste-first');
  click('scoop-add-item-cancel');
  testRecipeLogSnapshots();
  console.log('Recipe and pantry workflows, nested ingredient snapshots, counted-once nutrition, sync, legacy imports, frozen history, shared reload, and TSV round trip passed.');
}

run().catch(function(error) { console.error(error); process.exitCode = 1; });
