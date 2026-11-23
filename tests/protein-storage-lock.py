import io
import json
import runpy
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock


server = runpy.run_path('shared-server.py')
handler_type = server['WorkoutHandler']
server_globals = handler_type.do_PUT.__globals__
storage_lock = server_globals['storage_lock']
stored_data = {}
responses = []


def captureResponse(handler, code, value):
    responses.append((code, value))


def captureWrite(data):
    stored_data.update(data)


def makeRequest(text):
    body = text.encode('utf-8')
    return SimpleNamespace(
        path='/api/storage?key=lock-test',
        headers={'Content-Length': str(len(body))},
        rfile=io.BytesIO(body))


server_globals['readSharedStorageFile'] = lambda: dict(stored_data)
server_globals['writeSharedStorageFile'] = captureWrite
server_globals['writeJsonText'] = captureResponse
checks = TestCase()
checks.assertRaises(json.JSONDecodeError, handler_type.do_PUT, makeRequest('{"broken":'))
assert not storage_lock.locked(), 'malformed request must not leave storage locked'
handler_type.do_PUT(makeRequest('{"valid":1}'))
assert responses[-1][0] == 200
assert stored_data['lock-test'] == {'valid': 1}
handler_type.do_GET(makeRequest(''))
assert responses[-1][0] == 200, 'GET still works after malformed write'

server_globals['readSharedStorageFile'] = Mock(side_effect=OSError('read failed'))
checks.assertRaises(OSError, handler_type.do_GET, makeRequest(''))
assert not storage_lock.locked(), 'failed read must release storage lock'
checks.assertRaises(OSError, handler_type.do_PUT, makeRequest('{}'))
assert not storage_lock.locked(), 'failed write setup must release storage lock'

server_globals['readSharedStorageFile'] = lambda: dict(stored_data)
server_globals['writeSharedStorageFile'] = Mock(side_effect=OSError('write failed'))
checks.assertRaises(OSError, handler_type.do_PUT, makeRequest('{}'))
assert not storage_lock.locked(), 'failed disk write must release storage lock'
print('PASS: malformed JSON, subsequent GET/PUT, and lock release after storage failures')
