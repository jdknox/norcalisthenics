'use strict';

/*
> [!WARNING]
> AI-generated Code:
*/

let protein_storage_url = '/api/storage';

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

function getProteinStorage(key)
{
  return fetch(proteinStorageUrl(key), {
    method: 'GET',
    cache: 'no-store'
  }).then(readProteinStorageJson);
}

function setProteinStorage(key, value)
{
  return fetch(proteinStorageUrl(key), {
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
