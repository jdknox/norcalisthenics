"""Run from the repo root with python3 tests/protein-bodyweight-kcal.py /path/to/chrome."""

import atexit
import http.client
import json
import runpy
import subprocess
import sys
import tempfile


PATH = '/api/protein-bodyweight-kcal.csv'
HEADER = 'date,body_mass_kg,daily_kcal,water_in_kg,mass_in_kg,steps,ebike_minutes,ebike_km\n'


def main(chrome):
    harness = runpy.run_path('tests/protein-offline-cache.py')
    cdp = harness['cdp']
    evaluate = harness['evaluate']
    waitFor = harness['waitFor']
    fixture = tempfile.TemporaryDirectory(prefix='protein-csv-test-')
    atexit.register(fixture.cleanup)
    server, port = harness['startServer'](0, fixture.name)
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    connection.request('GET', PATH)
    assert connection.getresponse().read().decode() == HEADER

    payload = {
        'foods': [],
        'scoop_items': [{'key': 'legacy', 'name': 'Legacy', 'scoop_g': 60, 'kcal': 23.25}],
        'bodyweight_by_date': {'2026-10-01': 82, '2026-10-03': 80.5},
        'log': {
            '2026-10-01': [
                {'id': 'recipe', 'item_key': 'recipe', 'kcal': 100.5,
                 'recipe_snapshot': {'ingredients': [{'grams': 200}, {'ingredients': [{'grams': 50}]}]},
                 'water_sources': [{'timestamp': '2026-10-01T09:00', 'name': 'Soup', 'water_ml': 75}]},
                {'id': 'deleted-log', 'item_key': 'legacy', 'kcal': 200, 'grams': 100, 'delete_count': 1,
                 'water_sources': [{'water_ml': 500}]}
            ],
            '2026-10-05': {'legacy': 2}
        },
        'mass_events': {
            '2026-10-01': [
                {'id': 'first', 'event_type': 'checkpoint_weight', 'body_mass_kg': 81},
                {'id': 'drink', 'event_type': 'water', 'water_volume_ml': 500},
                {'id': 'extra', 'event_type': 'food_mass', 'mass_in_kg': 0.125},
                {'id': 'last', 'event_type': 'post_meal_weight', 'body_mass_kg': 83},
                {'id': 'deleted-weight', 'event_type': 'post_restroom_weight', 'body_mass_kg': 70, 'deleted_at': '2026-10-01'},
                {'id': 'legacy-deleted', 'event_type': 'checkpoint_weight', 'body_mass_kg': 60}
            ],
            '2026-10-02': [
                {'id': 'pre', 'event_type': 'pre_meal_weight', 'body_mass_kg': 82},
                {'id': 'post', 'event_type': 'post_restroom_weight', 'body_mass_kg': 81.25}
            ],
            '2026-10-03': [{'id': 'higher', 'event_type': 'checkpoint_weight', 'body_mass_kg': 81}],
            '2026-10-06': [{'id': 'removed', 'event_type': 'checkpoint_weight', 'body_mass_kg': 79, 'delete_count': 1}]
        },
        'deleted_mass_event_ids': {'legacy-deleted': True},
        'daily_activity': {'2026-10-04': {'steps': 123.5, 'ebike_minutes': 8.5, 'ebike_km': 2.125}}
    }
    storage = runpy.run_path('shared-server.py')
    state = json.dumps({'protein-loadout:v1': json.dumps(payload), 'other-key': {'log': {}}})
    storage['writeTextFile'](fixture.name + '/storage.json', state)
    expected = HEADER + (
        '2026-10-01,81.00,101,0.575,0.175,,,\n'
        '2026-10-02,81.25,0,,,,,\n'
        '2026-10-03,80.50,0,,,,,\n'
        '2026-10-04,,0,,,124,9,2.13\n'
        '2026-10-05,,47,,0.120,,,\n'
    )
    connection.request('GET', PATH)
    response = connection.getresponse()
    assert response.status == 200 and response.getheader('Content-Type') == 'text/csv; charset=utf-8'
    assert 'no-store' in response.getheader('Cache-Control')
    assert response.read().decode() == expected
    connection.request('PUT', PATH, '{}')
    response = connection.getresponse()
    assert response.status == 404
    response.read()
    connection.close()
    assert storage['readTextFile'](fixture.name + '/storage.json') == state

    browser = subprocess.Popen([
        'sh', '-c', 'exec "$@" 3<&0 4>&1', 'chrome-pipe', chrome, '--headless=new', '--disable-gpu',
        '--no-sandbox', '--remote-debugging-pipe', '--user-data-dir=' + fixture.name + '/chrome', 'about:blank'
    ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    atexit.register(harness['stopProcess'], browser)
    target = cdp(browser, 'Target.createTarget', {'url': 'about:blank'})['result']['targetId']
    session = cdp(browser, 'Target.attachToTarget', {'targetId': target, 'flatten': True})['result']['sessionId']
    cdp(browser, 'Page.navigate', {'url': f'http://127.0.0.1:{port}/protein-loadout.html'}, session)
    waitFor(browser, session, 'navigator.serviceWorker.controller && !g_load_in_flight && !g_sync_in_flight')
    assert evaluate(browser, session, 'buildBodyweightKcalCSV()') == expected
    harness['stopProcess'](server)
    cdp(browser, 'Page.reload', {}, session)
    waitFor(browser, session, 'document.querySelector(".cached-version-status")')
    assert evaluate(browser, session, 'buildBodyweightKcalCSV()') == expected
    print('PASS: synced CSV GET, browser parity, and offline export')


if __name__ == '__main__':
    main(sys.argv[1])
