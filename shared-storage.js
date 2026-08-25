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

let workout_data_url = '/api/workout-data';

function readStorageText(response)
{
  if (!response.ok)
  {
    throw new Error('storage request failed: ' + response.status);
  }

  return response.text();
}

function sharedStorageLoadText()
{
  notifyStorageStatus('checking', 'storage: checking', 'checking shared storage server');
  return fetch(workout_data_url, {
    method: 'GET',
    cache: 'no-store'
  }).then(readStorageText).then(function(text)
  {
    notifyStorageStatus('ok', 'storage: server', 'shared storage server responded; loading and saving go through the server');
    return text;
  }, function(error)
  {
    let message = error && error.message ? ' (' + error.message + ')' : '';
    notifyStorageStatus('warn', 'storage: browser fallback', 'shared storage load failed; using browser local storage' + message);
    throw error;
  });
}

function sharedStorageSaveText(text)
{
  notifyStorageStatus('checking', 'storage: checking', 'saving to shared storage server');
  return fetch(workout_data_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/tab-separated-values; charset=utf-8'
    },
    body: text
  }).then(readStorageText).then(function(result)
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

window.sharedStorageLoadText = sharedStorageLoadText;
window.sharedStorageSaveText = sharedStorageSaveText;
