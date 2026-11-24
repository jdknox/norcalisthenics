"""Run from the repo root with python3 tests/protein-pantry-handoff.py /path/to/chrome."""

import atexit
import json
import runpy
import subprocess
import sys
import tempfile


harness = runpy.run_path('tests/protein-offline-cache.py')
cdp = harness['cdp']
evaluate = harness['evaluate']
waitFor = harness['waitFor']


def openTab(browser, url):
    target = cdp(browser, 'Target.createTarget', {'url':'about:blank'})['result']['targetId']
    session = cdp(browser, 'Target.attachToTarget', {'targetId':target, 'flatten':True})['result']['sessionId']
    cdp(browser, 'Page.navigate', {'url':url}, session)
    return session


def main(chrome):
    fixture = tempfile.TemporaryDirectory(prefix='protein-pantry-link-test-')
    atexit.register(fixture.cleanup)
    server, port = harness['startServer'](0, fixture.name)
    url = f'http://127.0.0.1:{port}/protein-loadout.html'
    browser = subprocess.Popen([
        'sh', '-c', 'exec "$@" 3<&0 4>&1', 'chrome-pipe', chrome,
        '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-pipe',
        '--user-data-dir=' + fixture.name + '/chrome', 'about:blank'
    ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    atexit.register(harness['stopProcess'], browser)

    first = openTab(browser, url)
    waitFor(browser, first, 'navigator.serviceWorker.controller && document.querySelector(".site-version") && !g_sync_in_flight')
    harness['stopProcess'](server)
    package_link = '#pantry-add?v=1&name=Caf%C3%A9%20%22Lime%22%20%26%20Tea%2B&barcode=012345678905&serving_g=500&volume_ml=480&basis=serving&protein_g=0&water_pct=0'
    second = openTab(browser, url + package_link)
    waitFor(browser, second, 'isCachedProteinPage() && g_scoop_add_draft && g_scoop_add_draft.pantry_link')
    assert evaluate(browser, second, '''g_scoop_add_draft.name == 'Café "Lime" & Tea+' &&
      g_scoop_add_draft.barcode == '012345678905' && g_scoop_add_draft.volume == '480' &&
      g_scoop_add_draft.macro_protein == '0' && g_scoop_add_draft.macro_kcal == '' && g_scoop_add_draft.water_content == '0' ''')
    assert evaluate(browser, second, '!findPantryBarcode("012345678905")'), 'opening a link only opens a draft'

    evaluate(browser, first, '''document.querySelector('[data-a="scoop-add-item-open"]').click();
      g_scoop_add_draft.name = 'In progress';
      location.hash = '#pantry-add?v=1&name=Noodle%20bowl&brand=Example&basis=100g&kcal=180&estimate=1';''')
    waitFor(browser, first, 'g_pantry_link_pending && g_scoop_add_draft.name == "In progress"')
    evaluate(browser, first, 'document.querySelector(\'[data-a="scoop-add-item-cancel"]\').click()')
    evaluate(browser, first, 'document.querySelector(\'[data-a="pantry-link-open"]\').click()')
    assert evaluate(browser, first, 'g_scoop_add_draft.name == "Noodle bowl" && document.getElementById("pantry-add-editor").textContent.includes("Estimated values")')

    evaluate(browser, second, 'document.querySelector(\'[data-a="scoop-add-item-save"]\').click()')
    waitFor(browser, second, '!location.hash && findPantryBarcode("012345678905")')
    evaluate(browser, first, 'document.querySelector(\'[data-a="scoop-add-item-save"]\').click()')
    assert evaluate(browser, first, '!location.hash && g_scoop_items.some(item => item.name == "Noodle bowl")')
    # Simulate a tab persisting its older whole snapshot after a linked add.
    evaluate(browser, second, 'saveLocalJson(JSON.stringify(makeSavePayload()))')
    cdp(browser, 'Page.reload', {}, second)
    waitFor(browser, second, 'isCachedProteinPage() && findPantryBarcode("012345678905") && g_scoop_items.some(item => item.name == "Noodle bowl")')
    assert evaluate(browser, second, 'dayTotals(g_view_date).grams == 0'), 'pantry imports do not log food'

    evaluate(browser, second, 'location.hash = "#pantry-add?v=1&name=x&name=y&water_pct=101"')
    waitFor(browser, second, 'document.getElementById("pantry-link-notice").textContent.includes("invalid")')
    assert evaluate(browser, second, '''!g_scoop_add_draft &&
      parsePantryLink('#pantry-add?v=2&name=Tea') == null &&
      parsePantryLink('#pantry-add?v=1&name=Tea&basis=serving&kcal=10abc') == null &&
      parsePantryLink('#pantry-add?v=1&name=%ZZ') == null &&
      parsePantryLink('#pantry-add?v=1&name=' + 'a'.repeat(2048)) == null''')
    evaluate(browser, second, 'location.hash = ' + json.dumps(package_link))
    waitFor(browser, second, 'document.getElementById("pantry-link-duplicate") && document.getElementById("pantry-link-duplicate").textContent.includes("Barcode already in pantry")')
    evaluate(browser, second, 'document.querySelector(\'[data-a="scoop-add-item-save"]\').click()')
    assert evaluate(browser, second, 'g_scoop_add_draft && g_scoop_items.filter(item => item.barcode == "012345678905").length == 1')
    evaluate(browser, second, 'document.querySelector(\'[data-a="pantry-link-existing"]\').click()')
    waitFor(browser, second, 'g_edit_draft && g_edit_draft.barcode == "012345678905" && !location.hash')
    evaluate(browser, second, 'document.querySelector(\'[data-a="scoop-edit-cancel"]\').click()')
    evaluate(browser, second, 'location.hash = "#pantry-add?v=1&barcode=12345678"')
    waitFor(browser, second, 'g_scoop_add_draft && !g_scoop_add_draft.name && g_scoop_add_draft.barcode == "12345678"')
    evaluate(browser, second, 'document.querySelector(\'[data-a="scoop-add-item-cancel"]\').click()')
    assert evaluate(browser, second, '!location.hash && !g_scoop_add_draft')
    evaluate(browser, second, 'location.hash = "#pantry-add?v=1&name=Noodle%20bowl&brand=Example"')
    waitFor(browser, second, 'document.querySelector(\'[data-a="pantry-link-save-duplicate"]\')')
    evaluate(browser, second, 'document.querySelector(\'[data-a="scoop-add-item-cancel"]\').click()')

    harness['startServer'](port, fixture.name)
    evaluate(browser, second, 'window.dispatchEvent(new Event("online"))')
    waitFor(browser, second, 'isCachedProteinPage() && !readUnsyncedFlag() && !Object.keys(localStorage).some(key => key.startsWith(PANTRY_LINK_ITEM_PREFIX))')
    cdp(browser, 'Page.reload', {}, second)
    waitFor(browser, second, 'document.querySelector(".site-version") && !isCachedProteinPage() && !readUnsyncedFlag() && !Object.keys(localStorage).some(key => key.startsWith(PANTRY_LINK_ITEM_PREFIX))')
    handle = open(fixture.name + '/storage.json', encoding='utf-8')
    payload = json.load(handle)['protein-loadout:v1']
    handle.close()
    assert any(item['name'] == 'Noodle bowl' and item['kcal_100g'] == 180 for item in payload['scoop_items'])
    assert any(item.get('barcode') == '012345678905' and item['protein_g'] == 0 and item['kcal'] == None for item in payload['scoop_items'])
    print('PASS: offline link opening, encoded values, draft protection, two-tab recovery, duplicate review and Pi sync')


if __name__ == '__main__':
    main(sys.argv[1])
