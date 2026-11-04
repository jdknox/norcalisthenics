import json
import os
import time

runtime_dir = os.environ.get('WII_RUNTIME_DIR', f'/dev/shm/norcalisthenics-wii-{os.getuid()}')
state_path = f'{runtime_dir}/state.json'
command_path = f'{runtime_dir}/command.json'


def writeJson(path, value):
    os.makedirs(runtime_dir, mode=0o700, exist_ok=True)
    handle = open(f'{path}.tmp', 'w')
    json.dump(value, handle)
    handle.close()
    os.replace(f'{path}.tmp', path)


def publishState(state):
    state['updated_at'] = time.time()
    writeJson(state_path, state)


def readState():
    if not os.access(state_path, os.F_OK):
        return {'live': False, 'connected': False, 'recording': False}
    handle = open(state_path)
    state = json.load(handle)
    handle.close()
    now = time.time()
    state['live'] = now - state['updated_at'] < 1.5
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
