'use strict';

let protein_cache_name = 'protein-loadout-app-v2';
let protein_cached_urls = [
  '/protein-loadout.html',
  '/protein.css',
  '/protein-shared-storage.js'
];

function proteinFetchWithTimeout(request)
{
  let controller = new AbortController();
  let timeout_id = setTimeout(function()
  {
    controller.abort();
  }, 1500);

  return fetch(request, { signal:controller.signal }).then(function(response)
  {
    clearTimeout(timeout_id);
    return response;
  }, function(error)
  {
    clearTimeout(timeout_id);
    throw error;
  });
}

function cacheProteinUrl(cache, url)
{
  return fetch(url, { cache:'reload' }).then(function(response)
  {
    if (response && response.ok) return cache.put(url, response);
  }).catch(function(){});
}

self.addEventListener('install', function(event)
{
  event.waitUntil(caches.open(protein_cache_name).then(function(cache)
  {
    let jobs = [];

    for (let i = 0; i < protein_cached_urls.length; ++i)
    {
      jobs.push(cacheProteinUrl(cache, protein_cached_urls[i]));
    }

    return Promise.all(jobs);
  }).then(function()
  {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function(event)
{
  event.waitUntil(caches.keys().then(function(names)
  {
    let jobs = [];

    for (let i = 0; i < names.length; ++i)
    {
      if (names[i] != protein_cache_name) jobs.push(caches.delete(names[i]));
    }

    return Promise.all(jobs);
  }).then(function()
  {
    return self.clients.claim();
  }));
});

self.addEventListener('fetch', function(event)
{
  let request = event.request;
  let url = new URL(request.url);

  if (request.method != 'GET') return;
  if (url.pathname == '/api/storage') return;

  if (request.mode == 'navigate')
  {
    event.respondWith(proteinFetchWithTimeout(request).catch(function()
    {
      return caches.match('/protein-loadout.html').then(function(response)
      {
        if (response) return response;
        return Response.error();
      });
    }));
    return;
  }

  event.respondWith(proteinFetchWithTimeout(request).then(function(response)
  {
    let copy = response.clone();

    caches.open(protein_cache_name).then(function(cache)
    {
      cache.put(request, copy);
    });

    return response;
  }).catch(function()
  {
    return caches.match(request, { ignoreSearch:true });
  }));
});
