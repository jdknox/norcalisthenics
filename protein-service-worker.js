'use strict';

// Retire the old offline code cache. Requests go directly to the network;
// refresh must never silently substitute an older application or stylesheet.
self.addEventListener('install', function(event)
{
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event)
{
  event.waitUntil(caches.keys().then(function(names)
  {
    let jobs = [];
    for (let name of names)
    {
      if (name.indexOf('protein-loadout-app-') == 0) jobs.push(caches.delete(name));
    }
    return Promise.all(jobs);
  }).then(function()
  {
    return self.clients.claim();
  }));
});
