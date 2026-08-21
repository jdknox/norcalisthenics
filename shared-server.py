#!/usr/bin/env python3

import http.server
import json
import time
import urllib.parse


storage_file = './shared-storage.json'
default_host = '0.0.0.0'
default_port = 8010


def readStorage():
    if not fileExists(storage_file):
        return {}

    handle = open(storage_file, 'r', encoding='utf-8')
    text = handle.read()
    handle.close()

    if text.strip() == '':
        return {}

    return json.loads(text)


def writeStorage(data):
    handle = open(storage_file, 'w', encoding='utf-8')
    handle.write(json.dumps(data, indent=2, sort_keys=True))
    handle.write('\n')
    handle.close()


def parseStoredValue(value):
    if type(value) != str:
        return value

    if value == '':
        return value

    first = value[0]
    if first != '{' and first != '[':
        return value

    return json.loads(value)


def encodeApiValue(value):
    if type(value) == str or value == None:
        return value

    return json.dumps(value, separators=(',', ':'))


def fileExists(path):
    handle = None

    if not path:
        return False

    try_open = open(path, 'a+', encoding='utf-8')
    try_open.close()

    handle = open(path, 'r', encoding='utf-8')
    handle.close()
    return True


def parseKey(path):
    parts = urllib.parse.urlparse(path)
    query = urllib.parse.parse_qs(parts.query)
    key_list = query.get('key', [])

    if len(key_list) < 1:
        return ''

    return key_list[0]


def readRequestJson(handler):
    length_text = handler.headers.get('Content-Length', '0')
    length = int(length_text)
    raw_body = handler.rfile.read(length)

    if raw_body == b'':
        return {}

    return json.loads(raw_body.decode('utf-8'))


def writeJson(handler, code, payload):
    body = json.dumps(payload).encode('utf-8')
    handler.send_response(code)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    noCacheHeaders(handler)
    handler.end_headers()
    handler.wfile.write(body)


def readTextFile(path):
    handle = open(path, 'r', encoding='utf-8')
    text = handle.read()
    handle.close()
    return text


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
        'workout-exercises.js',
        'workout-sheets.js',
        'workout-render.js',
        'workout-recorder.js'
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


class WorkoutHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        noCacheHeaders(self)
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        if path == '/' or path == '/workout-recorder.html':
            return writeHtml(self, './workout-recorder.html')

        if path != '/api/storage':
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

        key = parseKey(self.path)
        data = readStorage()
        value = encodeApiValue(data.get(key))
        return writeJson(self, 200, { 'key': key, 'value': value })

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path

        if path != '/api/storage':
            return writeJson(self, 404, { 'error': 'not found' })

        key = parseKey(self.path)
        payload = readRequestJson(self)
        value = payload.get('value')
        data = readStorage()
        data[key] = parseStoredValue(value)
        writeStorage(data)
        return writeJson(self, 200, { 'ok': True, 'key': key })


def main():
    host = default_host
    port = default_port
    server = http.server.ThreadingHTTPServer((host, port), WorkoutHandler)
    print(f'serving http://{host}:{port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
