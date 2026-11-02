#!/usr/bin/env python3
import os
import select
import struct
import time

device_path = '/dev/input/event3'
event_format = 'llHHi'
event_size = struct.calcsize(event_format)
deadline = time.monotonic() + 2
device_fd = os.open(device_path, os.O_RDONLY)

print(f'Watching {device_path} for 2 seconds', flush=True)
while time.monotonic() < deadline:
    remaining = deadline - time.monotonic()
    readable, unused_write, unused_error = select.select([device_fd], [], [], remaining)
    if not readable:
        break

    event_data = os.read(device_fd, event_size)
    seconds, microseconds, event_type, code, value = struct.unpack(event_format, event_data)
    if event_type == 1:
        print(f'key code={code} value={value} time={seconds}.{microseconds:06d}', flush=True)
    if event_type == 3:
        print(f'corner code={code} value={value} time={seconds}.{microseconds:06d}', flush=True)

os.close(device_fd)
