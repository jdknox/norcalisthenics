#!/bin/sh
set -eu

ssh rpi python3 - <<'PY'
import sys

sys.path.insert(0, '/home/knox/.local/share/norcalisthenics/wii')
import wii_runtime

state = wii_runtime.readState()
if not state['live'] or not state['connected']:
    sys.exit('Wii Balance Board logger is not connected.')
if state['taring'] or state['corners_kg'] == None:
    sys.exit('Wait for the empty-board tare to complete.')
if state['sample_age_ms'] == None or state['sample_age_ms'] > 500:
    sys.exit('Board readings are delayed; no fresh corner sample available.')
print(','.join(f'{value:.3f}' for value in state['corners_kg']))
PY
