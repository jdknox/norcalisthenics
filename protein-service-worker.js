'use strict';

// This cache is how the protein site opens away from the Pi. Keep the last
// usable page across worker updates, including updates installed off-LAN.
const PROTEIN_PAGE_CACHE = 'protein-offline-page';
const PROTEIN_PAGE_PATH = '/protein-loadout.html';

self.addEventListener('install', function installProteinWorker(event)
{
  // The page that registers this worker may have loaded before it controls navigation.
  event.waitUntil(fetch(PROTEIN_PAGE_PATH, {cache:'no-store'}).then(
    cacheProteinPage, reportProteinCacheError
  ).then(function activateProteinWorker()
  {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function claimProteinPages(event)
{
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function openProteinPage(event)
{
  let request = event.request;
  if (request.method != 'GET' || request.mode != 'navigate') return;
  let url = new URL(request.url);
  if (url.origin != self.location.origin) return;
  if (url.pathname != PROTEIN_PAGE_PATH && (url.pathname != '/' || url.hostname != 'protein.proovd.com')) return;

  let network = fetch(request, {cache:'no-store'});
  event.waitUntil(network.then(function rememberProteinPage(response)
  {
    if (response.ok) return cacheProteinPage(response.clone());
  }, reportProteinCacheError));

  event.respondWith(network.then(function useLiveProteinPage(response)
  {
    if ([502, 503, 504].includes(response.status)) return useCachedProteinPage(response);
    return response;
  }, function useOfflineProteinPage()
  {
    return useCachedProteinPage(Response.error());
  }));
});

function cacheProteinPage(response)
{
  if (!response.ok || response.redirected) return;
  return response.text().then(function buildOfflineProteinPage(html)
  {
    // The Pi includes JS and CSS in the HTML so the copy works on its own.
    if (!html.includes('<style id="protein-styles">') || !html.includes('<script id="protein-storage">')) return;
    let offline_html = html.replace('<html lang="en">', '<html lang="en" data-protein-offline>');
    if (offline_html == html) return;
    let offline_page = new Response(offline_html, {headers:{'Content-Type':'text/html; charset=utf-8'}});
    return caches.open(PROTEIN_PAGE_CACHE).then(function storeOfflineProteinPage(cache)
    {
      return cache.put(PROTEIN_PAGE_PATH, offline_page);
    });
  }).catch(reportProteinCacheError);
}

function useCachedProteinPage(failure_response)
{
  return caches.match(PROTEIN_PAGE_PATH, {cacheName:PROTEIN_PAGE_CACHE}).then(function useProteinPage(cached)
  {
    return cached || failure_response;
  }, function failProteinCacheRead(error)
  {
    reportProteinCacheError(error);
    return failure_response;
  });
}

function reportProteinCacheError(error)
{
  console.warn('Protein offline page:', error);
}
