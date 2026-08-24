'use strict';

/*
> [!WARNING]
> ⚠️ **AI-gerenated Code:**
*/

function notifyStorageStatus(kind, text, title)
{
  if (window.setStorageStatus)
  {
    window.setStorageStatus(kind, text, title);
    return;
  }

  window.pending_storage_status = {
    kind: kind,
    text: text,
    title: title
  };
}

function storageUrl(key)
{
  return '/api/storage?key=' + encodeURIComponent(key);
}

function readStorageJson(response)
{
  if (!response.ok)
  {
    throw new Error('storage request failed: ' + response.status);
  }

  return response.json();
}

function sharedStorageGet(key)
{
  notifyStorageStatus('checking', 'storage: checking', 'checking shared storage server');
  return fetch(storageUrl(key), {
    method: 'GET',
    cache: 'no-store'
  }).then(readStorageJson).then(function(result)
  {
    notifyStorageStatus('ok', 'storage: server', 'shared storage server responded; loading and saving go through the server');
    return result;
  }, function(error)
  {
    let message = error && error.message ? ' (' + error.message + ')' : '';
    notifyStorageStatus('warn', 'storage: browser fallback', 'shared storage load failed; using browser local storage' + message);
    throw error;
  });
}

function sharedStorageSet(key, value)
{
  notifyStorageStatus('checking', 'storage: checking', 'saving to shared storage server');
  return fetch(storageUrl(key), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value: value })
  }).then(readStorageJson).then(function(result)
  {
    notifyStorageStatus('ok', 'storage: server', 'shared storage server responded; loading and saving go through the server');
    return result;
  }, function(error)
  {
    let message = error && error.message ? ' (' + error.message + ')' : '';
    notifyStorageStatus('warn', 'storage: browser fallback', 'shared storage save failed; using browser local storage' + message);
    throw error;
  });
}

window.sharedStorageGet = sharedStorageGet;
window.sharedStorageSet = sharedStorageSet;
