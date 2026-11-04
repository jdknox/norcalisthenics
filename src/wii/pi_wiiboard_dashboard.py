#!/usr/bin/env python3
import http.server
import json
import os
import time

import wii_runtime

source_dir = __file__.rsplit('/', 1)[0]


def sendResponse(handler, code, body, content_type):
    handler.send_response(code)
    handler.send_header('Content-Type', content_type)
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Cache-Control', 'no-store')
    handler.end_headers()
    handler.wfile.write(body)


def sendJson(handler, code, value):
    sendResponse(handler, code, json.dumps(value).encode(), 'application/json')


def getRequest(handler):
    path = handler.path.split('?', 1)[0]
    if path == '/api/status':
        return sendJson(handler, 200, wii_runtime.readState())
    assets = {
        '/': ('dashboard.html', 'text/html; charset=utf-8'),
        '/dashboard.css': ('dashboard.css', 'text/css; charset=utf-8'),
        '/dashboard.js': ('dashboard.js', 'text/javascript; charset=utf-8'),
    }
    if path not in assets:
        return sendJson(handler, 404, {'error': 'Not found.'})
    name, content_type = assets[path]
    handle = open(f'{source_dir}/{name}', 'rb')
    body = handle.read()
    handle.close()
    return sendResponse(handler, 200, body, content_type)


def postRequest(handler):
    # A custom header keeps cross-origin forms from changing recording state.
    if handler.headers.get('X-Wii-Control') != 'dashboard':
        return sendJson(handler, 403, {'error': 'Dashboard control header required.'})
    actions = {'/api/record/start': 'start', '/api/record/stop': 'stop'}
    if handler.path not in actions:
        return sendJson(handler, 404, {'error': 'Not found.'})
    state = wii_runtime.readState()
    if not state['live']:
        return sendJson(handler, 503, {'error': 'Logger is unavailable. Check the Pi service.'})
    action = actions[handler.path]
    if action == 'start' and (not state['connected'] or state['taring']):
        return sendJson(handler, 409, {'error': 'Connect the board and wait for tare before recording.'})
    command = {
        'run_id': state['run_id'],
        'command_id': str(time.time_ns()),
        'action': action,
    }
    wii_runtime.writeJson(wii_runtime.command_path, command)
    return sendJson(handler, 202, command)


def logRequest(handler, code='-', size='-'):
    if handler.path == '/api/status' and code == 200:
        return
    http.server.BaseHTTPRequestHandler.log_request(handler, code, size)


# The standard-library HTTP server requires a handler subclass; routing stays procedural.
class DashboardHandler(http.server.BaseHTTPRequestHandler):
    # Browsers can pre-open idle sockets; never let one block all other requests.
    timeout = 0.5
    do_GET = getRequest
    do_POST = postRequest
    log_request = logRequest


def main():
    host = os.environ.get('WII_DASHBOARD_HOST', '0.0.0.0')
    port = int(os.environ.get('WII_DASHBOARD_PORT', '8011'))
    server = http.server.HTTPServer((host, port), DashboardHandler)
    print(f'Wii dashboard: http://{host}:{port}', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
