'use strict';

let assert = require('node:assert/strict');
let fs = require('node:fs');
let vm = require('node:vm');
let html = fs.readFileSync('protein-loadout.html', 'utf8');
let script = html.split('<script>')[1].split('</script>')[0];

async function loadActivity(local_activity, shared_activity, unsynced, offline = false)
{
  let local_values = {};
  let state = {rendered:[], status:'', shared_value:null};
  let context = vm.createContext(
  {
    console:console, setTimeout:function() {}, rendered:state.rendered,
    document:{body:null, addEventListener:function() {}, querySelectorAll:function() { return []; }},
    localStorage:
    {
      getItem:function(key) { return local_values[key] || null; },
      setItem:function(key, value) { local_values[key] = value; },
      removeItem:function(key) { delete local_values[key]; }
    },
    window:{storage:
    {
      get:function()
      {
        if (offline) return Promise.reject(new Error('offline'));
        return Promise.resolve({value:state.shared_value, revision:'test'});
      },
      set:function(key, value) { state.shared_value = value; return Promise.resolve({revision:'test'}); }
    }}
  });
  vm.runInContext(script.split("window.addEventListener('error'")[0], context);
  function evaluate(code) { return vm.runInContext(code, context); }
  let fixture = JSON.parse(evaluate('JSON.stringify(makeSavePayload())'));
  if (shared_activity != null) state.shared_value = JSON.stringify({...fixture, daily_activity:shared_activity});
  local_values[evaluate('g_storage_key')] = JSON.stringify({...fixture, daily_activity:local_activity});
  if (unsynced) local_values[evaluate('g_unsynced_key')] = '1';
  context.setSyncOk = function() { state.status = 'ok'; };
  context.setSyncFailed = function(message) { state.status = message; };
  evaluate(`render = function() { rendered.push(JSON.stringify(g_daily_activity)); }; load();`);
  await new Promise(function(resolve) { setImmediate(resolve); });
  state.activity = JSON.parse(evaluate('JSON.stringify(g_daily_activity)'));
  state.first_render = JSON.parse(state.rendered[0]);
  return state;
}

async function run()
{
  let current = {steps:10000, ebike_minutes:20, ebike_km:7};
  let old = {steps:0, ebike_minutes:15, ebike_km:0};
  let local_only = {steps:500, ebike_minutes:0, ebike_km:0};
  let local_activity = {'2026-11-05':old, '2026-11-04':local_only};
  let shared_activity = {'2026-11-05':current};
  let loaded = await loadActivity(local_activity, shared_activity, false);
  assert.deepEqual(loaded.first_render['2026-11-05'], current, 'the first render uses shared values instead of a stale local record');
  assert.deepEqual(loaded.first_render['2026-11-04'], local_only, 'local-only dates are retained');
  assert.deepEqual(loaded.activity, loaded.first_render, 'background startup sync does not silently change what was displayed');
  assert.equal(loaded.rendered.length, 1, 'no additional page rebuild is required');
  assert.equal(loaded.status, 'ok');

  loaded = await loadActivity(local_activity, shared_activity, true);
  assert.deepEqual(loaded.first_render['2026-11-05'], old, 'unsynced local activity wins over shared values');
  assert.deepEqual(loaded.activity, loaded.first_render);
  assert.deepEqual(JSON.parse(loaded.shared_value).daily_activity['2026-11-05'], old, 'unsynced edits are pushed without being overwritten');
  assert.equal(loaded.rendered.length, 1);

  loaded = await loadActivity(local_activity, {}, false);
  assert.deepEqual(loaded.first_render, local_activity, 'missing shared dates do not discard local activity');
  loaded = await loadActivity({}, shared_activity, false);
  assert.deepEqual(loaded.first_render, shared_activity, 'an empty local store uses shared activity');
  loaded = await loadActivity(local_activity, null, false);
  assert.deepEqual(loaded.first_render, local_activity, 'a new shared store retains local activity');
  loaded = await loadActivity(local_activity, shared_activity, false, true);
  assert.deepEqual(loaded.first_render, local_activity, 'offline startup still uses local activity');
  assert.equal(loaded.status, 'local only / sync failed');
  console.log('Startup activity: shared precedence, unsynced edits, first-render consistency, local-only dates, empty stores, and offline fallback passed.');
}

run().catch(function(error) { console.error(error); process.exitCode = 1; });
