"""Run from the repo root with python3 tests/protein-offline-cache.py /path/to/chrome."""

import atexit
import http.server
import json
import os
import runpy
import subprocess
import sys
import tempfile
import time


def serve(port, directory):
    server_code = runpy.run_path('shared-server.py')
    handler = server_code['WorkoutHandler']
    handler.do_GET.__globals__['shared_storage_file'] = directory + '/storage.json'
    original_get = handler.do_GET

    def getFixture(request):
        if request.path == '/protein-loadout.html?slow':
            time.sleep(2)
        if os.access(directory + '/worker-update', os.F_OK):
            if request.path == '/protein-loadout.html':
                return request.send_error(503)
            if request.path == '/protein-service-worker.js':
                script = server_code['readTextFile']('protein-service-worker.js')
                return server_code['writePlainText'](request, 200, script + '\n// Test worker update\n', 'application/javascript')
        original_get(request)

    handler.do_GET = getFixture
    server = http.server.HTTPServer(('127.0.0.1', port), handler)
    print(server.server_port, flush=True)
    server.serve_forever()


def startServer(port, directory):
    process = subprocess.Popen(
        [sys.executable, __file__, '--serve', str(port), directory],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    atexit.register(stopProcess, process)
    return process, int(process.stdout.readline())


def stopProcess(process):
    if process.poll() != None:
        return
    process.terminate()
    process.wait(timeout=5)


def readMessage(browser):
    message = bytearray()
    while True:
        byte = browser.stdout.read(1)
        if byte == b'\0':
            return json.loads(message)
        if not byte:
            raise RuntimeError('Chromium closed the debugging pipe')
        message.extend(byte)


def cdp(browser, method, params=None, session=None):
    command = {'id':1, 'method':method, 'params':params or {}}
    if session:
        command['sessionId'] = session
    browser.stdin.write(json.dumps(command).encode() + b'\0')
    browser.stdin.flush()
    while True:
        reply = readMessage(browser)
        if reply.get('id') == 1:
            return reply


def evaluate(browser, session, expression):
    reply = cdp(browser, 'Runtime.evaluate', {'expression':expression, 'returnByValue':True}, session)
    return reply.get('result', {}).get('result', {}).get('value')


def waitFor(browser, session, expression):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if evaluate(browser, session, f'Boolean({expression})'):
            return
        time.sleep(0.1)
    raise AssertionError(expression)


def main(chrome):
    fixture = tempfile.TemporaryDirectory(prefix='protein-offline-test-')
    atexit.register(fixture.cleanup)
    server, port = startServer(0, fixture.name)
    url = f'http://127.0.0.1:{port}/protein-loadout.html'
    browser = subprocess.Popen([
        'sh', '-c', 'exec "$@" 3<&0 4>&1', 'chrome-pipe', chrome,
        '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-pipe',
        '--user-data-dir=' + fixture.name + '/chrome', 'about:blank'
    ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    atexit.register(stopProcess, browser)
    target = cdp(browser, 'Target.createTarget', {'url':'about:blank'})['result']['targetId']
    session = cdp(browser, 'Target.attachToTarget', {'targetId':target, 'flatten':True})['result']['sessionId']
    cdp(browser, 'Page.navigate', {'url':url}, session)
    waitFor(browser, session, 'navigator.serviceWorker.controller && document.querySelector(".site-version")')
    version = evaluate(browser, session, 'PROTEIN_VERSION')
    assert evaluate(browser, session, 'localStorage.getItem(PROTEIN_HIGHEST_VERSION_KEY)') == version

    cdp(browser, 'Page.navigate', {'url':url + '?slow'}, session)
    waitFor(browser, session, 'location.search == "?slow" && document.querySelector(".site-version")')
    assert evaluate(browser, session, '!document.querySelector(".cached-version-status")'), 'slow live refresh uses the Pi response'

    open(fixture.name + '/worker-update', 'w', encoding='utf-8').close()
    evaluate(browser, session, '''window.oldWorker = navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', function recordWorkerUpdate()
      {
        window.workerUpdated = navigator.serviceWorker.controller != window.oldWorker;
      });''')
    cdp(browser, 'ServiceWorker.enable', {}, session)
    reply = cdp(browser, 'ServiceWorker.updateRegistration', {'scopeURL':f'http://127.0.0.1:{port}/'}, session)
    assert 'error' not in reply, reply
    waitFor(browser, session, 'window.workerUpdated')
    os.remove(fixture.name + '/worker-update')
    stopProcess(server)
    cdp(browser, 'Page.reload', {}, session)
    waitFor(browser, session, 'document.querySelector(".cached-version-status")')
    assert evaluate(browser, session, 'document.querySelector(".cached-version-status").textContent.includes("Matches the newest version")')
    assert evaluate(browser, session, 'getComputedStyle(document.body,"::before").borderTopStyle') == 'dashed'
    assert evaluate(browser, session, 'getComputedStyle(document.body,"::before").borderTopColor') == 'rgb(203, 187, 127)'
    new_version = '2099-01-01T00:00:00-06:00'
    evaluate(browser, session, f'localStorage.setItem(PROTEIN_HIGHEST_VERSION_KEY, {json.dumps(new_version)})')
    evaluate(browser, session, '''g_scoop_add_draft = {
        name:'Offline test tea', barcode:'', brand:'', scoop_g:'100', volume:'',
        tags:'', macro_mode:'serving', macro_protein:'0', macro_kcal:'0', water_content:'100'
    }; saveAddItemDraft();''')
    assert evaluate(browser, session, 'readUnsyncedFlag() && g_scoop_items.some(item => item.name == "Offline test tea")')
    cdp(browser, 'Page.reload', {}, session)
    waitFor(browser, session, 'document.querySelector(".cached-version-status") && g_scoop_items.some(item => item.name == "Offline test tea")')
    banner = evaluate(browser, session, 'document.querySelector(".cached-version-status").textContent')
    assert version in banner and new_version in banner and 'newer version was seen' in banner

    startServer(port, fixture.name)
    cdp(browser, 'Page.reload', {}, session)
    waitFor(browser, session, 'document.querySelector(".site-version") && !isCachedProteinPage() && !readUnsyncedFlag()')
    handle = open(fixture.name + '/storage.json', encoding='utf-8')
    data = json.load(handle)
    handle.close()
    assert any(item['name'] == 'Offline test tea' for item in data['protein-loadout:v1']['scoop_items'])
    print('PASS: slow live navigation, cache retention across worker updates, offline refresh, version warning, local save and Pi sync on reconnect')


if __name__ == '__main__':
    if sys.argv[1] == '--serve':
        serve(int(sys.argv[2]), sys.argv[3])
    else:
        main(sys.argv[1])
