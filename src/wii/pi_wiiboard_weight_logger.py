#!/usr/bin/env python3
import csv
import fcntl
import os
import struct
import time

board_name = 'Nintendo Wii Remote Balance Board'
csv_path = '/home/knox/prj/dev/norcalisthenics/data/wii/wiiboard_weights.csv'
retare_path = '/home/knox/prj/dev/norcalisthenics/data/wii/.retare-request'
calibration_factor = 1.028744517

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

    device_fd = os.open(device_path, os.O_RDONLY)
    csv_file = open(csv_path, 'a', newline='')
    csv_writer = csv.writer(csv_file)
    if csv_file.tell() == 0:
        csv_writer.writerow(['timestamp', 'total_kg'])
        csv_file.flush()

    print(f'reading calibrated corners from {device_path}', flush=True)
    tare_start = time.monotonic()
    tare_total = 0.0
    tare_count = 0
    tare_kg = None
    window_start = None
    window_total = 0.0
    window_count = 0

    while os.access(device_path, os.R_OK):
        if os.access(retare_path, os.F_OK):
            os.unlink(retare_path)
            tare_start = time.monotonic()
            tare_total = 0.0
            tare_count = 0
            tare_kg = None
            window_start = None
            window_total = 0.0
            window_count = 0
            print('re-tare requested', flush=True)

        corners_centi_kg = []
        for axis in range(16, 20):
            # EVIOCGABS(axis): input_absinfo is six 32-bit integers.
            abs_info = fcntl.ioctl(device_fd, 0x80184540 + axis, bytes(24))
            corners_centi_kg.append(struct.unpack_from('i', abs_info)[0])

        raw_kg = sum(corners_centi_kg)/100.0
        now = time.monotonic()
        if tare_kg == None:
            tare_total += raw_kg
            tare_count += 1
            if now - tare_start >= 2.0:
                tare_kg = tare_total/tare_count
                print(f'tare applied: {tare_kg:.3f} kg', flush=True)
        else:
            if window_start == None:
                window_start = now
            window_total += raw_kg
            window_count += 1
            if now - window_start >= 0.1:
                average_kg = window_total/window_count
                total_kg = max(0.0, average_kg - tare_kg)*calibration_factor
                if total_kg > 1.0:
                    csv_writer.writerow([f'{time.time():.3f}', f'{total_kg:.3f}'])
                    csv_file.flush()
                window_start = now
                window_total = 0.0
                window_count = 0

        time.sleep(0.01)

    os.close(device_fd)
    csv_file.close()
    print('board disconnected', flush=True)
