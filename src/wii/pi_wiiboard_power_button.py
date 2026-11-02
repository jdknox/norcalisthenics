#!/usr/bin/env python3
import os
import struct
import subprocess
import time

address = '00:1F:C5:AB:39:A6'
board_name = 'Nintendo Wii Remote Balance Board'
event_format = 'llHHi'
event_size = struct.calcsize(event_format)

while True:
    device_path = None
    for entry in os.listdir('/sys/class/input'):
        if not entry.startswith('event'):
            continue

        name_path = f'/sys/class/input/{entry}/device/name'
        name_file = open(name_path)
        device_name = name_file.read().strip()
        name_file.close()
        if device_name == board_name:
            device_path = f'/dev/input/{entry}'
            break

    if device_path == None:
        time.sleep(0.5)
        continue

    if not os.access(device_path, os.R_OK):
        time.sleep(0.1)
        continue

    print(f'watching {device_path}', flush=True)
    device_fd = os.open(device_path, os.O_RDONLY)
    while True:
        event_data = os.read(device_fd, event_size)
        if not event_data:
            break

        seconds, microseconds, event_type, code, value = struct.unpack(event_format, event_data)
        if event_type == 1 and code == 304 and value == 1:
            print(f'front button pressed at {seconds}.{microseconds:06d}; disconnecting', flush=True)
            subprocess.run(['bluetoothctl', 'disconnect', address], check=True, timeout=10)
            break

    os.close(device_fd)
    time.sleep(0.5)
