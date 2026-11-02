#!/usr/bin/env python3
import os
import select
import struct
import subprocess
import time

address = '00:1F:C5:AB:39:A6'
board_name = 'Nintendo Wii Remote Balance Board'
retare_path = '/home/knox/prj/dev/norcalisthenics/data/wii/.retare-request'
event_format = 'llHHi'
event_size = struct.calcsize(event_format)
hold_seconds = 3.0

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
    button_down_at = None
    while True:
        timeout = None
        if button_down_at != None:
            timeout = max(0.0, hold_seconds - (time.monotonic() - button_down_at))

        readable, unused_write, unused_error = select.select([device_fd], [], [], timeout)
        if not readable:
            print('front button held for 3 seconds; disconnecting', flush=True)
            subprocess.run(['bluetoothctl', 'disconnect', address], check=True, timeout=10)
            break

        event_data = os.read(device_fd, event_size)
        if not event_data:
            break

        seconds, microseconds, event_type, code, value = struct.unpack(event_format, event_data)
        if event_type == 1 and code == 304:
            if value == 1:
                button_down_at = time.monotonic()
            if value == 0 and button_down_at != None:
                held_seconds = time.monotonic() - button_down_at
                if held_seconds >= hold_seconds:
                    print(f'front button held {held_seconds:.2f} seconds; disconnecting', flush=True)
                    subprocess.run(['bluetoothctl', 'disconnect', address], check=True, timeout=10)
                    break

                request_file = open(retare_path, 'w')
                request_file.close()
                print(f'front button tap at {seconds}.{microseconds:06d}; requesting re-tare', flush=True)
                button_down_at = None

    os.close(device_fd)
    time.sleep(0.5)
