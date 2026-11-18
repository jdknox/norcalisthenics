import json
import os
import time

runtime_dir = os.environ.get('WII_RUNTIME_DIR', f'/dev/shm/norcalisthenics-wii-{os.getuid()}')
state_path = f'{runtime_dir}/state.json'
command_path = f'{runtime_dir}/command.json'
battery_capacity_path = '/sys/class/power_supply/wiimote_battery_00:1f:c5:ab:39:a6/capacity'
# These outlive disconnects and reboots, so they can't live in /dev/shm.
state_dir = os.path.expanduser('~/.local/state/norcalisthenics-wii')
battery_last_path = f'{state_dir}/last-battery.json'
# Dashboard inputs (bodyweight, targets, axis limits), shared by every browser.
settings_path = f'{state_dir}/dashboard-settings.json'
SETTING_NAMES = ['baseline', 'eccentric', 'concentric', 'axis_minimum', 'axis_maximum']
battery_percent = None
battery_checked_at = None


def readJsonFile(path):
    # Missing or corrupt reads as None; callers treat that as "nothing saved".
    if not os.access(path, os.R_OK):
        return None
    handle = open(path)
    try:
        value = json.load(handle)
    except ValueError:
        value = None
    handle.close()
    return value


def saveLastBattery(percent):
    writeJson(battery_last_path, {'percent': percent, 'at': time.time()})


def readLastBattery():
    return readJsonFile(battery_last_path)


def readSettings():
    settings = readJsonFile(settings_path)
    if not isinstance(settings, dict):
        return {}
    return settings


def validSettings(settings):
    # Input box values exactly as typed: short strings, known names only.
    if not isinstance(settings, dict):
        return False
    for name, value in settings.items():
        if name not in SETTING_NAMES or not isinstance(value, str) or len(value) > 16:
            return False
    return True


def writeSettings(settings):
    writeJson(settings_path, settings)


def readBatteryPercent(connected):
    global battery_percent, battery_checked_at
    if not connected:
        battery_percent = None
        battery_checked_at = None
        return None

    now = time.monotonic()
    if battery_checked_at == None or now - battery_checked_at >= 30:
        battery_checked_at = now
        battery_percent = None
        if os.access(battery_capacity_path, os.R_OK):
            handle = open(battery_capacity_path)
            text = handle.read().strip()
            handle.close()
            if text.isdecimal():
                value = int(text)
                if 0 <= value <= 100:
                    battery_percent = value
                    saveLastBattery(value)
    return battery_percent


def addLastBattery(state):
    last = readLastBattery()
    state['battery_last_percent'] = None
    state['battery_last_at'] = None
    if last != None:
        state['battery_last_percent'] = last['percent']
        state['battery_last_at'] = last['at']
    return state


def writeJson(path, value):
    os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
    handle = open(f'{path}.tmp', 'w')
    json.dump(value, handle)
    handle.close()
    os.replace(f'{path}.tmp', path)


def publishState(state):
    state['updated_at'] = time.time()
    writeJson(state_path, state)


def readState():
    if not os.access(state_path, os.F_OK):
        readBatteryPercent(False)
        return addLastBattery({'live': False, 'connected': False, 'recording': False, 'battery_percent': None})
    handle = open(state_path)
    state = json.load(handle)
    handle.close()
    now = time.time()
    state['live'] = now - state['updated_at'] < 1.5
    state['battery_percent'] = readBatteryPercent(state['live'] and state['connected'])
    addLastBattery(state)
    state['sample_age_ms'] = None
    if state['sample_time'] != None:
        state['sample_age_ms'] = max(0.0, (now - state['sample_time'])*1000)
    return state


def applyCommand(state):
    if not os.access(command_path, os.F_OK):
        return None
    handle = open(command_path)
    command = json.load(handle)
    handle.close()
    if command['run_id'] != state['run_id'] or command['command_id'] == state['applied_command']:
        return None

    state['applied_command'] = command['command_id']
    state['command_error'] = ''
    action = command['action']
    if action == 'stop':
        state['recording'] = False
        return action
    if not state['connected'] or state['taring']:
        state['command_error'] = 'Connect the board and wait for tare before recording.'
        return None
    if not state['recording']:
        state['recording'] = True
        state['recording_started_at'] = time.time()
        state['rows_written'] = 0
        return action
    return None
