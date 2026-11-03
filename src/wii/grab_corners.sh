#!/bin/sh
set -eu

ssh rpi python3 - <<'PY'
import fcntl
import os
import struct
import sys

board_name = 'Nintendo Wii Remote Balance Board'
device_path = None
for entry in os.listdir('/sys/class/input'):
    if not entry.startswith('event'):
        continue

    name_file = open(f'/sys/class/input/{entry}/device/name')
    device_name = name_file.read().strip()
    name_file.close()
    if device_name == board_name:
        device_path = f'/dev/input/{entry}'
        break

if device_path == None:
    sys.exit('Wii Balance Board is not connected.')

device_fd = os.open(device_path, os.O_RDONLY)
corners = []
for axis in range(16, 20):
    # EVIOCGABS(axis): input_absinfo is six 32-bit integers.
    abs_info = fcntl.ioctl(device_fd, 0x80184540 + axis, bytes(24))
    corner_kg = struct.unpack_from('i', abs_info)[0]/100.0
    corners.append(f'{corner_kg:.3f}')
os.close(device_fd)
print(','.join(corners))
PY
