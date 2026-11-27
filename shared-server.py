#!/usr/bin/env python3

# > [!WARNING]
# > ⚠️ **AI-gerenated Code:**

import csv
import glob
import gzip
import hashlib
import http.server
import io
import json
import math
import os
import subprocess
import threading
import time
import urllib.parse
from decimal import Decimal, ROUND_HALF_UP


default_host = '0.0.0.0'
default_port = 8010


def fileExists(path):
    if not path:
        return False

    matches = glob.glob(path)
    return len(matches) > 0


def readTextFile(path):
    handle = open(path, 'r', encoding='utf-8')
    text = handle.read()
    handle.close()
    return text


def writeTextFile(path, text):
    handle = open(path, 'w', encoding='utf-8', newline='')
    handle.write(text)
    handle.close()


def readRequestText(handler):
    length_text = handler.headers.get('Content-Length', '0')
    length = int(length_text)
    raw_body = handler.rfile.read(length)
    return raw_body.decode('utf-8')


def noCacheHeaders(handler):
    handler.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
    handler.send_header('Pragma', 'no-cache')
    handler.send_header('Expires', '0')
    handler.send_header('Surrogate-Control', 'no-store')


def versionHtmlScripts(html_text):
    version_marker = "const PROTEIN_VERSION = 'unversioned';"
    if version_marker in html_text:
        commit_info = subprocess.check_output(['git', 'log', '-1', '--format=%cI%n%B'], text=True)
        commit_date, commit_message = commit_info.split('\n', 1)
        html_text = html_text.replace(version_marker, f"const PROTEIN_VERSION = '{commit_date}';")
        message_json = json.dumps(commit_message.strip()).replace('<', '\\u003c')
        html_text = html_text.replace("const PROTEIN_COMMIT_MESSAGE = '';", f'const PROTEIN_COMMIT_MESSAGE = {message_json};')

        # Deliver essential protein resources with the page, so partial asset
        # failures cannot leave a working UI without styles or sync support.
        css_start = html_text.index('<link rel="stylesheet" href="protein.css')
        css_end = html_text.index('>', css_start) + 1
        css_text = readTextFile('protein.css')
        html_text = html_text[:css_start] + '<style id="protein-styles">\n' + css_text + '\n</style>' + html_text[css_end:]
        storage_script = readTextFile('protein-shared-storage.js')
        html_text = html_text.replace('<script src="protein-shared-storage.js"></script>', '<script id="protein-storage">\n' + storage_script + '\n</script>')

    nonce = str(time.time_ns())
    css_start = 'href="protein.css'
    css_index = html_text.find(css_start)
    if css_index >= 0:
        css_end = html_text.index('"', css_index + len(css_start))
        css_hash = hashlib.sha256(readTextFile('protein.css').encode('utf-8')).hexdigest()[:16]
        html_text = html_text[:css_index] + f'href="protein.css?v={css_hash}' + html_text[css_end:]
    script_names = [
        'shared-storage.js',
        'data/workout-exercises.js',
        'workout-sample.js',
        'workout-sheets.js',
        'workout-render.js',
        'workout-recorder.js',
        'protein-shared-storage.js'
    ]
    i = 0

    for i in range(len(script_names)):
        name = script_names[i]
        html_text = html_text.replace(f'src="{name}"', f'src="{name}?v={nonce}"')

    return html_text


def writeHtml(handler, path):
    html_text = readTextFile(path)
    body = versionHtmlScripts(html_text).encode('utf-8')
    handler.send_response(200)
    handler.send_header('Content-Type', 'text/html; charset=utf-8')
    body = compressResponseBody(handler, body)
    handler.send_header('Content-Length', str(len(body)))
    # handler.send_header('Clear-Site-Data', '"cache"')
    noCacheHeaders(handler)
    handler.end_headers()
    handler.wfile.write(body)


def writePlainText(handler, code, text, content_type):
    body = text.encode('utf-8')
    handler.send_response(code)
    handler.send_header('Content-Type', content_type)
    body = compressResponseBody(handler, body)
    handler.send_header('Content-Length', str(len(body)))
    noCacheHeaders(handler)
    handler.end_headers()
    handler.wfile.write(body)


def compressResponseBody(handler, body):
    handler.send_header('Vary', 'Accept-Encoding')
    if len(body) < 1024:
        return body
    for encoding in handler.headers.get('Accept-Encoding', '').split(','):
        parts = encoding.strip().split(';')
        if parts[0] == 'gzip' and 'q=0' not in [part.strip() for part in parts[1:]]:
            handler.send_header('Content-Encoding', 'gzip')
            return gzip.compress(body, compresslevel=5)
    return body


def writeJsonText(handler, code, value):
    text = json.dumps(value)
    return writePlainText(handler, code, text, 'application/json; charset=utf-8')


def readStorageFile(path):
    if not fileExists(path):
        return ''

    return readTextFile(path)


def writeStorageFile(path, text):
    temp_path, backup_path = f'{path}.tmp', f'{path}.0.bak'
    writeTextFile(temp_path, text)

    if fileExists(backup_path):
        backup_1 = f'{path}.1.bak'
        os.replace(backup_path, backup_1)

    if fileExists(path):
        os.replace(path, backup_path)

    os.replace(temp_path, path)


def readSharedStorageFile():
    if not fileExists(shared_storage_file):
        return {}

    text = readTextFile(shared_storage_file)
    if not text.strip():
        return {}

    return json.loads(text)


def readSharedStorageValue(key):
    storage_lock.acquire()
    try:
        return readSharedStorageFile().get(key)
    finally:
        storage_lock.release()


def writeSharedStorageFile(data):
    text = json.dumps(data, indent=2, sort_keys=True) + '\n'
    writeStorageFile(shared_storage_file, text)


def storageResponseValue(value):
    if value == None:
        return None

    if isinstance(value, str):
        return value

    return json.dumps(value)


def storageRevision(value):
    text = json.dumps(value, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def parseStorageValue(text):
    return json.loads(text)


def roundProteinExportNumber(value):
    whole = math.floor(value)
    return whole + int(value - whole >= 0.5)


def formatProteinExportNumber(value, places):
    # Match JavaScript toFixed, including ties on the stored binary value.
    return str(Decimal.from_float(float(value or 0)).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


def knownIngredientGrams(snapshot):
    grams = snapshot.get('grams')
    if grams != None:
        return float(grams or 0)

    grams = 0.0
    for ingredient in snapshot.get('ingredients') or []:
        grams += knownIngredientGrams(ingredient)
    return grams


def proteinLogEntries(day, pantry_items):
    if isinstance(day, list):
        return day

    entries = []
    for key, count in day.items():
        item = pantry_items.get(key, {})
        for _ in range(math.ceil(float(count or 0))):
            entries.append({'grams': item.get('scoop_g'), 'kcal': item.get('kcal')})
    return entries


def proteinMassEventSortKey(event, date):
    timestamp = event.get('timestamp') or '00:00'
    if 'T' in timestamp:
        return timestamp[:16]
    return date + 'T' + timestamp[:5]


def buildProteinBodyweightKcalCSV(payload):
    bodyweights = payload.get('bodyweight_by_date') or {}
    log = payload.get('log') or {}
    mass_events = payload.get('mass_events') or {}
    daily_activity = payload.get('daily_activity') or {}
    pantry_items = {}
    for item in payload.get('scoop_items') or []:
        pantry_items.setdefault(item['key'], item)

    deleted_log_ids = set()
    for key, deleted in (payload.get('deleted_log_entry_ids') or {}).items():
        if deleted:
            deleted_log_ids.add(key)
    for key, record in (payload.get('deleted_log_entries') or {}).items():
        if record and record.get('date') and (record.get('entry') or {}).get('id'):
            deleted_log_ids.add(key)
    deleted_mass_ids = payload.get('deleted_mass_event_ids') or {}

    output = io.StringIO()
    writer = csv.writer(output, lineterminator='\n')
    writer.writerow(['date', 'body_mass_kg', 'daily_kcal', 'water_in_kg', 'mass_in_kg', 'steps', 'ebike_minutes', 'ebike_km'])

    for date in sorted(bodyweights.keys() | log.keys() | mass_events.keys() | daily_activity.keys()):
        bodyweight_kg = bodyweights.get(date)
        if bodyweight_kg != None:
            bodyweight_kg = float(bodyweight_kg or 0)

        events = []
        for event in mass_events.get(date) or []:
            if event.get('deleted_at') or float(event.get('delete_count') or 0) > 0 or deleted_mass_ids.get(event.get('id')):
                continue
            events.append(event)

        kcal = 0.0
        pantry_grams = 0.0
        for entry in proteinLogEntries(log.get(date) or [], pantry_items):
            if entry.get('deleted_at') or float(entry.get('delete_count') or 0) > 0 or entry.get('id') in deleted_log_ids:
                continue
            kcal += float(entry.get('kcal') or 0)
            grams = entry.get('grams')
            if grams != None:
                pantry_grams += float(grams or 0)
            elif entry.get('recipe_snapshot'):
                pantry_grams += knownIngredientGrams(entry['recipe_snapshot'])

            for source in entry.get('water_sources') or []:
                volume_ml = float(source.get('water_ml') or 0)
                if volume_ml > 0:
                    events.append({
                        'event_type': 'water', 'timestamp': source.get('timestamp'),
                        'water_volume_ml': volume_ml, 'mass_in_kg': 0, 'food_water': True
                    })

        pantry_kg = pantry_grams/1000
        water_in_ml = 0.0
        water_kg = 0.0
        food_water_kg = 0.0
        manual_food_kg = 0.0
        events.sort(key=lambda event: proteinMassEventSortKey(event, date))
        for event in events:
            event_type = event.get('event_type')
            if event_type == 'water':
                volume_ml = float(event.get('water_volume_ml') or 0)
                if event.get('food_water'):
                    food_water_kg += volume_ml/1000
                else:
                    volume_ml = roundProteinExportNumber(volume_ml)
                mass_kg = event.get('mass_in_kg')
                mass_kg = volume_ml/1000 if mass_kg == None else float(mass_kg or 0)
                water_kg += mass_kg
                water_in_ml += volume_ml or roundProteinExportNumber(mass_kg*1000)
            elif event_type == 'food_mass':
                manual_food_kg += roundProteinExportNumber(float(event.get('mass_in_kg') or 0)*1000)/1000
            elif event_type in ('checkpoint_weight', 'pre_meal_weight', 'post_meal_weight', 'post_restroom_weight'):
                weight_kg = event.get('body_mass_kg')
                if weight_kg != None:
                    weight_kg = roundProteinExportNumber(float(weight_kg or 0)*100)/100
                    if bodyweight_kg == None or weight_kg < bodyweight_kg:
                        bodyweight_kg = weight_kg

        activity = daily_activity.get(date) or {}
        steps = roundProteinExportNumber(float(activity.get('steps') or 0))
        ebike_minutes = roundProteinExportNumber(float(activity.get('ebike_minutes') or 0))
        ebike_km = roundProteinExportNumber(float(activity.get('ebike_km') or 0)*100)/100
        # Paired meal deltas only affect row inclusion, and those days already have a weigh-in.
        total_mass_g = roundProteinExportNumber((water_kg + manual_food_kg + pantry_kg)*1000)
        if bodyweight_kg == None and kcal <= 0 and not (water_in_ml or total_mass_g or steps or ebike_minutes or ebike_km):
            continue

        water_kg += food_water_kg
        pantry_kg -= food_water_kg
        writer.writerow([
            date,
            formatProteinExportNumber(bodyweight_kg, 2) if bodyweight_kg != None else '',
            formatProteinExportNumber(kcal, 0),
            formatProteinExportNumber(water_kg, 3) if water_kg else '',
            formatProteinExportNumber(pantry_kg, 3) if pantry_kg else '',
            steps or '',
            ebike_minutes or '',
            formatProteinExportNumber(ebike_km, 2) if ebike_km else ''
        ])

    return output.getvalue()


def validStorageKey(key):
    if not key:
        return False

    for ch in key:
        if ch.isalnum() or ch in '-_:./':
            continue
        return False

    return True


def requestHost(handler):
    host = handler.headers.get('Host', '')
    return host.split(':')[0].lower()


class WorkoutHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        noCacheHeaders(self)
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        host = requestHost(self)

        if path == '/' and host == 'protein.proovd.com':
            return writeHtml(self, './protein-loadout.html')

        if path == '/' or path == '/workout-recorder.html':
            return writeHtml(self, './workout-recorder.html')

        if path == '/protein-loadout.html':
            return writeHtml(self, './protein-loadout.html')

        if path == '/api/workout-data':
            text = readStorageFile(data_file)
            return writePlainText(self, 200, text, 'text/tab-separated-values; charset=utf-8')

        if path == '/api/workout-library':
            text = readStorageFile(library_file)
            return writePlainText(self, 200, text, 'text/tab-separated-values; charset=utf-8')

        if path == '/api/protein-bodyweight-kcal.csv':
            payload = readSharedStorageValue('protein-loadout:v1')
            if isinstance(payload, str):
                payload = parseStorageValue(payload)
            text = buildProteinBodyweightKcalCSV(payload or {})
            return writePlainText(self, 200, text, 'text/csv; charset=utf-8')

        if path == '/api/storage':
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            key = query.get('key', [''])[0]
            if not validStorageKey(key):
                return writeJsonText(self, 400, {'error': 'invalid key'})

            stored_value = readSharedStorageValue(key)
            value = storageResponseValue(stored_value)
            revision = storageRevision(stored_value)
            return writeJsonText(self, 200, {'value': value, 'revision': revision})

        return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def do_PUT(self):
        path = urllib.parse.urlparse(self.path).path

        text = readRequestText(self)

        if path == '/api/workout-data':
            writeStorageFile(data_file, text)
            return writePlainText(self, 200, 'ok\n', 'text/plain; charset=utf-8')

        if path == '/api/workout-library':
            writeStorageFile(library_file, text)
            return writePlainText(self, 200, 'ok\n', 'text/plain; charset=utf-8')

        if path == '/api/storage':
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            key = query.get('key', [''])[0]
            if not validStorageKey(key):
                return writeJsonText(self, 400, {'error': 'invalid key'})

            expected_revision = self.headers.get('If-Match', '')
            if key == 'protein-loadout:v1' and not expected_revision:
                return writeJsonText(self, 428, {'error': 'storage revision required'})

            new_value = parseStorageValue(text)
            storage_lock.acquire()
            try:
                data = readSharedStorageFile()
                stored_value = data.get(key, None)
                current_revision = storageRevision(stored_value)

                if expected_revision and expected_revision != current_revision:
                    value = storageResponseValue(stored_value)
                    return writeJsonText(self, 409, {
                        'error': 'storage conflict',
                        'value': value,
                        'revision': current_revision
                    })

                data[key] = new_value
                writeSharedStorageFile(data)
                new_revision = storageRevision(new_value)
            finally:
                storage_lock.release()
            return writeJsonText(self, 200, {'ok': True, 'revision': new_revision})

        return writePlainText(self, 404, 'not found\n', 'text/plain; charset=utf-8')

    def do_POST(self):
        return self.do_PUT()


data_file       = './data/workout-data.tsv'
library_file    = './data/workout-library.tsv'
shared_storage_file = './data/shared-storage.json'
storage_lock = threading.Lock()

def main():
    host = default_host
    port = default_port
    server = http.server.ThreadingHTTPServer((host, port), WorkoutHandler)
    print(f'serving http://{host}:{port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
