'use strict';

let assert = require('node:assert/strict');
let fs = require('node:fs');
let vm = require('node:vm');
let listeners = {};
let cached_responses = {};
let network_mode = 'online';
let network_text = 'Latest page';
let context = vm.createContext(
{
  URL:URL, Response:Response, AbortController:AbortController,
  setTimeout:setTimeout, clearTimeout:clearTimeout,
  self:{addEventListener:function(type, handler) { listeners[type] = handler; }},
  caches:
  {
    open:function()
    {
      return Promise.resolve(
      {
        put:function(key, response) { cached_responses[key] = response; return Promise.resolve(); }
      });
    },
    match:function(key)
    {
      let response = cached_responses[key];
      return Promise.resolve(response ? response.clone() : undefined);
    }
  },
  fetch:function(request, options)
  {
    switch (network_mode)
    {
      case 'offline': return Promise.reject(new Error('offline'));
      case 'slow':
        return new Promise(function(resolve, reject)
        {
          options.signal.addEventListener('abort', function() { reject(new Error('timeout')); });
        });
      case 'http_error': return Promise.resolve(new Response('Server error', {status:500}));
      default: return Promise.resolve(new Response(network_text));
    }
  }
});
vm.runInContext(fs.readFileSync('protein-service-worker.js', 'utf8'), context);

async function navigate(path)
{
  let response;
  let pending = [];
  listeners.fetch(
  {
    request:{method:'GET', mode:'navigate', url:'https://protein.proovd.com' + path},
    respondWith:function(promise) { response = promise; },
    waitUntil:function(promise) { pending.push(promise); }
  });
  response = await response;
  await Promise.all(pending);
  return response;
}

async function run()
{
  cached_responses['/protein-loadout.html'] = new Response('Old page');
  assert.equal(await (await navigate('/')).text(), 'Latest page');
  assert.equal(await cached_responses['/protein-loadout.html'].clone().text(), 'Latest page', 'a successful root navigation refreshes the canonical offline page');
  network_mode = 'slow';
  assert.equal(await (await navigate('/')).text(), 'Latest page', 'a timed-out navigation uses the refreshed page, not the old install-time page');
  network_mode = 'online';
  network_text = 'Next version';
  await navigate('/protein-loadout.html?v=next');
  assert.equal(await cached_responses['/protein-loadout.html'].clone().text(), 'Next version', 'direct page navigation updates the same canonical cache key');
  network_text = 'Workout page';
  await navigate('/workout-recorder.html');
  assert.equal(await cached_responses['/protein-loadout.html'].clone().text(), 'Next version', 'another page cannot replace the protein fallback');
  network_mode = 'http_error';
  assert.equal((await navigate('/')).status, 500);
  assert.equal(await cached_responses['/protein-loadout.html'].clone().text(), 'Next version', 'HTTP errors do not poison the offline cache');
  network_mode = 'offline';
  assert.equal(await (await navigate('/')).text(), 'Next version');
  delete cached_responses['/protein-loadout.html'];
  assert.equal((await navigate('/')).type, 'error', 'an empty offline cache returns a valid error Response');
  let intercepted = false;
  listeners.fetch(
  {
    request:{method:'GET', mode:'cors', url:'https://protein.proovd.com/api/storage?key=test'},
    respondWith:function() { intercepted = true; }
  });
  assert.equal(intercepted, false, 'shared data requests are never cached by the worker');
  console.log('Service worker: navigation refresh, timed-out/offline fallback, canonical URL, HTTP errors, unrelated pages, and storage bypass passed.');
}

run().catch(function(error) { console.error(error); process.exitCode = 1; });
