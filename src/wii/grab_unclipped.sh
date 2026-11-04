#!/bin/sh
set -eu

ssh rpi sudo -n python3 - <<'PY'
import os
import select
import statistics
import sys
import time

device_path = None
for entry in os.listdir('/sys/class/hidraw'):
    handle = open(f'/sys/class/hidraw/{entry}/device/uevent')
    metadata = handle.read()
    handle.close()
    if 'HID_UNIQ=00:1f:c5:ab:39:a6' in metadata:
        device_path = f'/dev/{entry}'
        calibration_path = f'/sys/class/hidraw/{entry}/device/bboard_calib'
        break
if device_path == None:
    sys.exit('Wii Balance Board hidraw device not found. Connect the board first.')

handle = open(calibration_path)
calibration = [int(value, 16) for value in handle.read().strip().split(':')]
handle.close()


def signedKg(raw, corner):
    zero = calibration[corner]
    seventeen = calibration[4 + corner]
    thirty_four = calibration[8 + corner]
    # Extend the lower calibration segment below zero instead of clipping it.
    if raw < seventeen:
        return 17.0*(raw - zero)/(seventeen - zero)
    return 17.0 + 17.0*(raw - seventeen)/(thirty_four - seventeen)


print(f'Reading {device_path} for 3 seconds; no disconnect, tare, or CSV writes.', file=sys.stderr)
fd = os.open(device_path, os.O_RDONLY | os.O_NONBLOCK)
raw_samples = [[], [], [], []]
kg_samples = [[], [], [], []]
deadline = time.monotonic() + 3.0
while True:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        break
    readable, unused_write, unused_error = select.select([fd], [], [], remaining)
    if not readable:
        break
    data = os.read(fd, 64)
    if not data:
        break
    # Reports 0x32 and 0x34: report ID, two button bytes, then extension data.
    if len(data) < 11 or data[0] not in (0x32, 0x34):
        continue
    for corner in range(4):
        offset = 3 + 2*corner
        raw = int.from_bytes(data[offset:offset + 2], 'big')
        raw_samples[corner].append(raw)
        kg_samples[corner].append(signedKg(raw, corner))
os.close(fd)

if not raw_samples[0]:
    sys.exit('No board weight reports received within 3 seconds.')

print(f'{len(raw_samples[0])} reports captured. kg values use factory slopes, without clipping or tare.', file=sys.stderr)
print('corner,position,raw_adc_mean,zero_adc,mean_kg,stdev_kg')
corner_order = [2, 0, 3, 1]
positions = ['top_left', 'top_right', 'bottom_left', 'bottom_right']
for row in range(4):
    corner = corner_order[row]
    raw_mean = statistics.mean(raw_samples[corner])
    mean_kg = statistics.mean(kg_samples[corner])
    stdev_kg = statistics.pstdev(kg_samples[corner])
    print(f'{corner + 1},{positions[row]},{raw_mean:.2f},{calibration[corner]},{mean_kg:.3f},{stdev_kg:.3f}')
PY
