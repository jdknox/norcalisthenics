#!/usr/bin/env python3

# > [!WARNING]
# > ⚠️ **AI-gerenated Code:**

import http.server
import glob
import json
import os
import time
import urllib.parse


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
    handler.send_header('Vary', '*')


def versionHtmlScripts(html_text):
    nonce = str(time.time_ns())
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
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Clear-Site-Data', '"cache"')
    noCacheHeaders(handler)
    handler.end_headers()
    handler.wfile.write(body)


def writePlainText(handler, code, text, content_type):
    body = text.encode('utf-8')
    handler.send_response(code)
    handler.send_header('Content-Type', content_type)
    handler.send_header('Content-Length', str(len(body)))
    noCacheHeaders(handler)
    handler.end_headers()
    handler.wfile.write(body)


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


def writeSharedStorageFile(data):
    text = json.dumps(data, indent=2, sort_keys=True) + '\n'
    writeStorageFile(shared_storage_file, text)


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

        if path == '/api/storage':
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            key = query.get('key', [''])[0]
            if not validStorageKey(key):
                return writeJsonText(self, 400, {'error': 'invalid key'})

            data = readSharedStorageFile()
            value = data.get(key, None)
            return writeJsonText(self, 200, {'value': value})

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

            data = readSharedStorageFile()
            data[key] = text
            writeSharedStorageFile(data)
            return writeJsonText(self, 200, {'ok': True})

        return writePlainText(self, 404, 'not found\n', 'text/plain; charset=utf-8')

    def do_POST(self):
        return self.do_PUT()


data_file       = './data/workout-data.tsv'
library_file    = './data/workout-library.tsv'
shared_storage_file = './data/shared-storage.json'

def main():
    host = default_host
    port = default_port
    server = http.server.ThreadingHTTPServer((host, port), WorkoutHandler)
    print(f'serving http://{host}:{port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
