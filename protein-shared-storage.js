'use strict';

/*
> [!WARNING]
> AI-generated Code:
*/

let protein_storage_url = '/api/storage';
let protein_storage_timeout_ms = 2500;

function proteinStorageUrl(key)
{
  return protein_storage_url + '?key=' + encodeURIComponent(key);
}

function readProteinStorageJson(response)
{
  if (!response.ok)
  {
    throw new Error('storage request failed: ' + response.status);
  }

  return response.json();
}

function proteinStorageFetch(url, options)
{
  let controller = new AbortController();
  let timeout_id = setTimeout(function()
  {
    controller.abort();
  }, protein_storage_timeout_ms);

  options.signal = controller.signal;

  return fetch(url, options).then(function(response)
  {
    clearTimeout(timeout_id);
    return response;
  }, function(error)
  {
    clearTimeout(timeout_id);
    throw error;
  });
}

function getProteinStorage(key)
{
  return proteinStorageFetch(proteinStorageUrl(key), {
    method: 'GET',
    cache: 'no-store'
  }).then(readProteinStorageJson);
}

function setProteinStorage(key, value)
{
  return proteinStorageFetch(proteinStorageUrl(key), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: value
  }).then(readProteinStorageJson);
}

window.storage = {
  get: getProteinStorage,
  set: setProteinStorage
};
