#!/usr/bin/env python3
# Integration test: real dashboard HTTP + logger, with only board hardware simulated.
import atexit
from collections import deque
import csv
import http.client
import json
import os
import socket
import subprocess
import sys
import tempfile
import time

source_dir = f'{os.getcwd()}/src/wii'
sys.path.insert(0, source_dir)
import pi_wiiboard_weight_logger as logger


def makeReport(raw_values, report_id=0x34):
    report = bytearray([report_id, 0, 0])
    for value in raw_values:
        report.extend(value.to_bytes(2, 'big'))
    if report_id == 0x34:
        report.extend(bytes(11))
    return bytes(report)


# Nonuniform slopes exercise both segments, continuity, and signed extrapolation.
calibration = [1000, 2000, 3000, 4000, 2700, 3700, 4700, 5700,
               6100, 7100, 8100, 9100]
for report_id in (0x32, 0x34):
    report = makeReport([950, 3700, 6400, 12500], report_id)
    assert logger.parseReport(report, calibration) == [-0.5, 17, 25.5, 51]
    assert logger.parseReport(makeReport(calibration[:4], report_id), calibration) == [0]*4
    assert logger.parseReport(makeReport(calibration[8:], report_id), calibration) == [34]*4
assert logger.parseReport(b'', calibration) == None
assert logger.parseReport(bytes([0x30])*22, calibration) == None
assert logger.parseReport(bytes([0x34])*10, calibration) == None
# Captured Pi report: ADC order must remain TR, BR, TL, BL.
factory = [int(value, 16) for value in '1793:1bf9:0fd9:0a7f:1e56:22b7:167f:115d:252a:2978:1d37:183f'.split(':')]
captured = bytes.fromhex('340000175d1be50f1d0ab518007a0000000000000000')
expected = [-54*17/1731, -20*17/1726, -188*17/1702, 54*17/1758]
assert logger.parseReport(captured, factory) == expected

stats = {}
samples = deque()
assert logger.calculateStats([]) == (None, None)
assert logger.calculateStats([703.5]) == (703.5, 0)
window_samples = round(logger.WINDOW_DURATION*10)
for index in range(window_samples + 1):
    fluctuation = index%2
    corners = [10 + fluctuation, 20 + 2*fluctuation, 30 + 3*fluctuation, 0]
    logger.updateLoadStats(stats, samples, 1000 + index/10, 79 + 2*fluctuation, corners)
    if index < window_samples:
        assert stats['load_samples'] == index + 1
        assert stats['load_average_kg'] == None
assert stats['load_samples'] == window_samples
assert abs(stats['load_average_kg'] - 80) < 0.000001
assert abs(stats['load_stdev_kg'] - 1) < 0.000001
for corner in range(4):
    expected_means = [10.5, 21, 31.5, 0]
    expected_stdevs = [0.5, 1, 1.5, 0]
    assert abs(stats['corner_average_kg'][corner] - expected_means[corner]) < 0.000001
    assert abs(stats['corner_stdev_kg'][corner] - expected_stdevs[corner]) < 0.000001
assert stats['corner_min_kg'] == [10, 20, 30, 0]
assert stats['corner_max_kg'] == [11, 22, 33, 0]
logger.updateLoadStats(stats, samples, 1000 + logger.WINDOW_DURATION + 1, 80, [10, 20, 30, 0])
assert stats['load_average_kg'] == None, 'An actual acquisition gap must reset statistics.'
assert stats['corner_average_kg'] == None and stats['corner_stdev_kg'] == None
assert stats['corner_min_kg'] == None and stats['corner_max_kg'] == None
assert stats['load_samples'] == 1, 'A gap starts counting a new window immediately.'
# Opposing corner fluctuations cancel in the total; total stdev is computed independently.
samples.clear()
for index in range(window_samples + 1):
    fluctuation = index%2
    corners = [10 + fluctuation, 20 - fluctuation, 0, 0]
    logger.updateLoadStats(stats, samples, 2000 + index/10, 30, corners)
assert stats['load_stdev_kg'] == 0
assert abs(stats['corner_stdev_kg'][0] - 0.5) < 0.000001
assert abs(stats['corner_stdev_kg'][1] - 0.5) < 0.000001

# An old extreme at the cutoff must not leak into the current range.
samples.clear()
for index in range(window_samples + 1):
    corners = [-100, 200, -300, 400] if index == 0 else [10, 20, 30, 40]
    logger.updateLoadStats(stats, samples, 3000 + index/10, sum(corners), corners)
assert stats['corner_min_kg'] == [10, 20, 30, 40]
assert stats['corner_max_kg'] == [10, 20, 30, 40]

# A slower acquisition rate must count only the samples in three elapsed seconds.
samples.clear()
slow_samples = round(logger.WINDOW_DURATION*5)
for index in range(slow_samples + 1):
    logger.updateLoadStats(stats, samples, 4000 + index/5, 10, [10, 0, 0, 0])
assert stats['load_samples'] == slow_samples
assert stats['load_average_kg'] == 10

task_dir = tempfile.mkdtemp(prefix='wii-dashboard-test-', dir='/tmp')
battery_path = f'{task_dir}/battery-capacity'
logger.wii_runtime.battery_capacity_path = battery_path
assert logger.wii_runtime.readBatteryPercent(True) == None
for text, expected in [('80', 80), ('20', 20), ('0', 0), ('100', 100), ('101', None), ('-1', None), ('unknown', None)]:
    handle = open(battery_path, 'w')
    handle.write(text + '\n')
    handle.close()
    logger.wii_runtime.battery_checked_at = time.monotonic() - 31
    assert logger.wii_runtime.readBatteryPercent(True) == expected
handle = open(battery_path, 'w')
handle.write('80\n')
handle.close()
assert logger.wii_runtime.readBatteryPercent(True) == None, 'Battery reads must use the 30 s cache.'
assert logger.wii_runtime.readBatteryPercent(False) == None
assert logger.wii_runtime.readBatteryPercent(True) == 80, 'Reconnect must refresh battery immediately.'
runtime_dir = f'{task_dir}/runtime'
csv_path = f'{task_dir}/weights.csv'
processes = []


def cleanup():
    for process in processes:
        if process.poll() == None:
            process.terminate()
    for process in processes:
        process.wait(timeout=5)


atexit.register(cleanup)


def writeJson(path, value):
    handle = open(f'{path}.tmp', 'w')
    json.dump(value, handle)
    handle.close()
    os.replace(f'{path}.tmp', path)


empty_corners = [-50, -18, -191, 55]
writeJson(f'{task_dir}/sensors.json', empty_corners)
open(f'{task_dir}/connected', 'w').close()
environment = dict(os.environ)
environment['PYTHONPATH'] = source_dir
environment['WII_RUNTIME_DIR'] = runtime_dir
environment['WII_TEST_DIR'] = task_dir
logger_fixture = '''
import builtins
import io
import json
import os
import time
import pi_wiiboard_weight_logger as logger

task_dir = os.environ['WII_TEST_DIR']
real_open = builtins.open
real_listdir = os.listdir
real_access = os.access
real_device_open = os.open
real_device_read = os.read
sensor_fd = None

def fakeOpen(path, *args, **kwargs):
    if path == '/sys/class/hidraw/hidraw99/device/uevent':
        return io.StringIO('HID_UNIQ=00:1f:c5:ab:39:a6')
    if path == '/sys/class/hidraw/hidraw99/device/bboard_calib':
        calibration = [10000]*4 + [11700]*4 + [13400]*4
        return io.StringIO(':'.join(f'{value:04x}' for value in calibration))
    return real_open(path, *args, **kwargs)

def fakeListdir(path):
    if path == '/sys/class/hidraw':
        if real_access(f'{task_dir}/connected', os.F_OK):
            return ['hidraw99']
        return []
    return real_listdir(path)

def fakeAccess(path, mode):
    if path == '/sys/class/hidraw':
        return True
    if path == '/dev/hidraw99':
        return real_access(f'{task_dir}/connected', os.F_OK)
    return real_access(path, mode)

def fakeDeviceOpen(path, flags):
    global sensor_fd
    if path == '/dev/hidraw99':
        sensor_fd = real_device_open('/dev/null', flags)
        return sensor_fd
    return real_device_open(path, flags)

def fakeSelect(read_fds, write_fds, error_fds, timeout):
    time.sleep(0.01)
    if real_access(f'{task_dir}/stall', os.F_OK):
        return [], [], []
    return read_fds, [], []

def fakeRead(fd, size):
    if fd != sensor_fd:
        return real_device_read(fd, size)
    if real_access(f'{task_dir}/unrelated', os.F_OK):
        return bytes([0x30, 0, 0])
    handle = real_open(f'{task_dir}/sensors.json')
    corners = json.load(handle)
    handle.close()
    report = bytearray([0x34, 0, 0])
    for value in corners:
        report.extend((10000 + value).to_bytes(2, 'big'))
    report.extend(bytes(11))
    return bytes(report)

builtins.open = fakeOpen
os.listdir = fakeListdir
os.access = fakeAccess
os.open = fakeDeviceOpen
os.read = fakeRead
logger.select.select = fakeSelect
logger.csv_path = f'{task_dir}/weights.csv'
logger.retare_path = f'{task_dir}/retare'
logger.main()
'''
log_handle = open(f'{task_dir}/logger.log', 'w')


def launchLogger():
    process = subprocess.Popen([sys.executable, '-u', '-c', logger_fixture], env=environment,
                               stdout=log_handle, stderr=log_handle)
    processes.append(process)
    return process


logger_process = launchLogger()
# Bind to an OS-selected port, then announce it after the HTTP server is ready.
server_fixture = '''
import http.server
import os
import pi_wiiboard_dashboard as dashboard
dashboard.wii_runtime.battery_capacity_path = os.environ['WII_TEST_DIR'] + '/battery-capacity'
server = http.server.HTTPServer(('127.0.0.1', 0), dashboard.DashboardHandler)
print(server.server_address[1], flush=True)
server.serve_forever()
'''
server_process = subprocess.Popen([sys.executable, '-u', '-c', server_fixture], env=environment,
                                 stdout=subprocess.PIPE, stderr=log_handle, text=True)
processes.append(server_process)
port_text = server_process.stdout.readline().strip()
assert port_text.isdigit(), f'Dashboard did not start; inspect {task_dir}/logger.log'
port = int(port_text)


def request(method, path, control=True):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=2)
    headers = {}
    if control:
        headers['X-Wii-Control'] = 'dashboard'
    connection.request(method, path, headers=headers)
    response = connection.getresponse()
    body = response.read()
    code = response.status
    connection.close()
    if path.startswith('/api/'):
        return code, json.loads(body)
    return code, body


def waitState(predicate):
    deadline = time.monotonic() + 6
    while time.monotonic() < deadline:
        assert logger_process.poll() == None, f'Logger exited; inspect {task_dir}/logger.log'
        code, state = request('GET', '/api/status')
        assert code == 200
        if predicate(state):
            return state
        time.sleep(0.03)
    assert False, f'Timed out: {state}; inspect {task_dir}/logger.log'


def command(action):
    code, result = request('POST', f'/api/record/{action}')
    assert code == 202, result
    return waitState(lambda state: state.get('applied_command') == result['command_id'])


def cornersMatch(state, key, expected):
    if state.get(key) == None:
        return False
    for value, target in zip(state[key], expected):
        if abs(value - target) > 0.000001:
            return False
    return True


# An unused browser connection must not stall the single-process server forever.
idle_connection = socket.create_connection(('127.0.0.1', port), timeout=2)
time.sleep(0.05)
request_started = time.monotonic()
assert request('GET', '/api/status')[0] == 200
assert time.monotonic() - request_started < 1.5
idle_connection.close()

for path in ['/', '/dashboard.js', '/dashboard.css']:
    code, body = request('GET', path)
    assert code == 200 and body
assert request('GET', '/missing')[0] == 404
assert request('POST', '/api/record/start', control=False)[0] == 403
state = waitState(lambda state: state.get('taring'))
assert state['sample_age_ms'] == None and state['load_samples'] == 0
assert state['battery_percent'] == 80
assert request('POST', '/api/record/start')[0] == 409
state = waitState(lambda state: state.get('total_kg') != None)
assert 0 < state['load_samples'] < window_samples
assert 0 <= state['sample_age_ms'] < 500
state = waitState(lambda state: state.get('load_average_kg') != None)
assert abs(state['load_average_kg']) < 0.000001 and state['load_stdev_kg'] < 0.000001
assert all(abs(value - expected/100) < 0.000001
           for value, expected in zip(state['corner_tare_kg'], empty_corners))
assert state['corner_signed_kg'][2] < -1.9
for corner, expected in enumerate([0, 0, 0, 0]):
    assert abs(state['corner_average_kg'][corner] - expected) < 0.000001
    assert state['corner_stdev_kg'][corner] < 0.000001
    assert abs(state['corner_min_kg'][corner] - expected) < 0.000001
    assert abs(state['corner_max_kg'][corner] - expected) < 0.000001
# The logger keeps its full statistics window while the viewer pauses polling.
time.sleep(0.8)
state = request('GET', '/api/status')[1]
assert abs(state['load_average_kg']) < 0.000001 and state['load_samples'] >= 10
assert not os.access(csv_path, os.F_OK), 'Preview must not create a CSV.'

# Preserve existing logs only when recording actually begins.
old_csv = 'timestamp,total_kg,corner_1_kg,corner_2_kg,corner_3_kg,corner_4_kg\n1.000,80.000,20,20,20,20\n'
handle = open(csv_path, 'w')
handle.write(old_csv)
handle.close()
state = command('start')
assert state['recording']
waitState(lambda state: state['rows_written'] >= 2)
rows = list(csv.reader(open(csv_path)))
assert rows[0] == logger.csv_header
assert all(abs(float(value)) < 0.000001 for value in rows[1][1:]), rows
archives = [name for name in os.listdir(task_dir) if name.endswith('.bak')]
assert len(archives) == 1
assert open(f'{task_dir}/{archives[0]}').read() == old_csv

# A small force at TL must register even while its factory-relative value is negative.
small_load = empty_corners.copy()
small_load[2] += 50
writeJson(f'{task_dir}/sensors.json', small_load)
state = waitState(lambda state: cornersMatch(state, 'corners_kg', [0, 0, 0.5, 0]))
assert abs(state['total_kg'] - 0.5) < 0.000001
assert state['corner_signed_kg'][2] < 0

# Preserve negative residuals in both the total and recorded corners.
negative_load = empty_corners.copy()
negative_load[0] -= 10
writeJson(f'{task_dir}/sensors.json', negative_load)
state = waitState(lambda state: cornersMatch(state, 'corners_kg', [-0.1, 0, 0, 0]))
assert abs(state['total_kg'] + 0.1) < 0.000001
time.sleep(0.15)
rows = list(csv.reader(open(csv_path)))
assert any(row[1:3] == ['-0.100', '-0.100'] for row in rows[1:])

# No weight reports means no manufactured samples, even if other HID reports arrive.
open(f'{task_dir}/unrelated', 'w').close()
time.sleep(0.15)
state = request('GET', '/api/status')[1]
sample_time = state['sample_time']
saved = open(csv_path).read()
time.sleep(0.65)
state = request('GET', '/api/status')[1]
assert state['sample_time'] == sample_time and state['sample_age_ms'] >= 650
assert open(csv_path).read() == saved
os.unlink(f'{task_dir}/unrelated')
writeJson(f'{task_dir}/sensors.json', [950, 1982, 2809, 4055])
state = waitState(lambda state: cornersMatch(state, 'corners_kg', [10, 20, 30, 40]))
assert abs(state['total_kg'] - 100) < 0.000001
assert state['load_average_kg'] == None, 'A raw-report outage must reset the statistics window.'
state = waitState(lambda state: cornersMatch(state, 'corner_average_kg', [10, 20, 30, 40]))
assert max(state['corner_stdev_kg']) < 0.000001
assert cornersMatch(state, 'corner_min_kg', [10, 20, 30, 40])
assert cornersMatch(state, 'corner_max_kg', [10, 20, 30, 40])
assert not command('stop')['recording']
saved = open(csv_path).read()
time.sleep(0.3)
assert open(csv_path).read() == saved, 'Stop must prevent further CSV rows.'

# Retare ends recording; reconnect and restart must never resume it.
assert command('start')['recording']
# Simulate a new empty-board zero after drift; each tare must replace every baseline.
new_empty = [-80, 25, -220, 60]
writeJson(f'{task_dir}/sensors.json', new_empty)
open(f'{task_dir}/stall', 'w').close()
open(f'{task_dir}/retare', 'w').close()
state = waitState(lambda state: state.get('taring'))
assert not state['recording']
assert state['load_average_kg'] == None and state['load_stdev_kg'] == None
assert state['corner_average_kg'] == None and state['corner_stdev_kg'] == None
assert state['corner_min_kg'] == None and state['corner_max_kg'] == None
assert state['corners_kg'] == None and state['corner_tare_kg'] == None
time.sleep(2.1)
state = request('GET', '/api/status')[1]
assert state['taring'], 'A tare must not finish without fresh weight reports.'
os.unlink(f'{task_dir}/stall')
state = waitState(lambda state: state.get('total_kg') != None)
assert cornersMatch(state, 'corner_tare_kg', [value/100 for value in new_empty])
assert cornersMatch(state, 'corners_kg', [0]*4)
new_load = new_empty.copy()
new_load[2] += 50
writeJson(f'{task_dir}/sensors.json', new_load)
state = waitState(lambda state: cornersMatch(state, 'corners_kg', [0, 0, 0.5, 0]))
assert abs(state['total_kg'] - 0.5) < 0.000001
assert command('start')['recording']
os.unlink(f'{task_dir}/connected')
state = waitState(lambda state: not state['connected'])
assert not state['recording'] and state['corner_tare_kg'] == None
assert state['battery_percent'] == None
handle = open(battery_path, 'w')
handle.write('20\n')
handle.close()
writeJson(f'{task_dir}/sensors.json', empty_corners)
open(f'{task_dir}/connected', 'w').close()
state = waitState(lambda state: state.get('total_kg') != None)
assert cornersMatch(state, 'corner_tare_kg', [value/100 for value in empty_corners])
assert state['battery_percent'] == 20
assert command('start')['recording']
previous_run = request('GET', '/api/status')[1]['run_id']
logger_process.terminate()
logger_process.wait(timeout=3)
logger_process = launchLogger()
state = waitState(lambda state: state.get('run_id') != previous_run and state.get('total_kg') != None)
assert not state['recording'], 'A stale start command must not survive a restart.'
assert cornersMatch(state, 'corner_tare_kg', [value/100 for value in empty_corners])
saved = open(csv_path).read()
time.sleep(0.3)
assert open(csv_path).read() == saved
logger_process.terminate()
logger_process.wait(timeout=3)
time.sleep(1.6)
state = request('GET', '/api/status')[1]
assert not state['live']
assert state['sample_age_ms'] >= 1600, 'A stopped logger must expose an aging sample.'
assert request('POST', '/api/record/start')[0] == 503
print('PASS: signed raw decoding and factory slopes; small loads below factory zero; per-corner tare and refreshed baselines; negative CSV samples; report outages and unrelated packets; shared statistics/min/max; idle HTTP timeout; preview/record gating; old CSV preservation; disconnect/restart reset and stale logger rejection.')
