#!/usr/bin/env python3
import csv
from collections import deque
import fcntl
import math
import os
import struct
import time

import wii_runtime

board_name = 'Nintendo Wii Remote Balance Board'
csv_path = '/home/knox/prj/dev/norcalisthenics/data/wii/wiiboard_weights.csv'
retare_path = '/home/knox/prj/dev/norcalisthenics/data/wii/.retare-request'
# calibration_factor = 1.028744517
calibration_factor = 1.0
WINDOW_DURATION = 3.0
csv_header = ['timestamp', 'total_kg', 'corner_1_kg', 'corner_2_kg',
              'corner_3_kg', 'corner_4_kg']


def openCsv():
    csv_file = open(csv_path, 'a+', newline='')
    csv_file.seek(0)
    existing_header = next(csv.reader(csv_file), None)
    if existing_header != None and existing_header != csv_header:
        csv_file.close()
        archive_path = f'{csv_path}.{time.time_ns()}.bak'
        os.rename(csv_path, archive_path)
        print(f'previous CSV preserved at {archive_path}', flush=True)
        csv_file = open(csv_path, 'a', newline='')
    csv_file.seek(0, os.SEEK_END)
    csv_writer = csv.writer(csv_file)
    if csv_file.tell() == 0:
        csv_writer.writerow(csv_header)
        csv_file.flush()
    return csv_file, csv_writer


def calculateStats(values):
    if not values:
        return None, None

    mean = 0.0
    squared_deviations = 0.0
    count = 0
    for value in values:
        count += 1
        delta = value - mean
        mean += delta/count
        squared_deviations += delta*(value - mean)
    variance = max(0.0, squared_deviations/count)
    return mean, math.sqrt(variance)


def clearLoadStats(state):
    state['load_average_kg'] = None
    state['load_stdev_kg'] = None
    state['load_samples'] = 0
    state['corner_average_kg'] = None
    state['corner_stdev_kg'] = None
    state['corner_min_kg'] = None
    state['corner_max_kg'] = None


def updateLoadStats(state, samples, now, total_kg, corners_kg):
    if samples and now - samples[-1][0] > 0.5:
        samples.clear()
    samples.append((now, total_kg, corners_kg))
    cutoff = now - WINDOW_DURATION
    # Keep one sample at or before the cutoff to establish a full window.
    while len(samples) > 1 and samples[1][0] <= cutoff:
        samples.popleft()

    clearLoadStats(state)
    total_values = []
    corner_values = [[], [], [], []]
    for sample_time, sample_total, sample_corners in samples:
        if sample_time <= cutoff:
            continue
        total_values.append(sample_total)
        for corner in range(4):
            corner_values[corner].append(sample_corners[corner])

    state['load_samples'] = len(total_values)
    if now - samples[0][0] < WINDOW_DURATION:
        return

    state['load_average_kg'], state['load_stdev_kg'] = calculateStats(total_values)
    corner_averages = []
    corner_stdevs = []
    corner_minima = []
    corner_maxima = []
    for corner in range(4):
        mean, stdev = calculateStats(corner_values[corner])
        corner_averages.append(mean)
        corner_stdevs.append(stdev)
        corner_minima.append(min(corner_values[corner]))
        corner_maxima.append(max(corner_values[corner]))
    state['corner_average_kg'] = corner_averages
    state['corner_stdev_kg'] = corner_stdevs
    state['corner_min_kg'] = corner_minima
    state['corner_max_kg'] = corner_maxima


def main():
    state = {
        'run_id': str(time.time_ns()), 'connected': False, 'taring': False,
        'recording': False, 'recording_started_at': None, 'rows_written': 0,
        'total_kg': None, 'corners_kg': None, 'sample_time': None,
        'load_average_kg': None, 'load_stdev_kg': None, 'load_samples': 0,
        'corner_average_kg': None, 'corner_stdev_kg': None,
        'corner_min_kg': None, 'corner_max_kg': None,
        'applied_command': None, 'command_error': '',
    }
    wii_runtime.publishState(state)

    while True:
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

        if device_path == None or not os.access(device_path, os.R_OK):
            wii_runtime.applyCommand(state)
            wii_runtime.publishState(state)
            time.sleep(0.5)
            continue

        device_fd = os.open(device_path, os.O_RDONLY)
        csv_file = None
        state['connected'] = True
        state['taring'] = True
        wii_runtime.publishState(state)
        print(f'reading calibrated corners from {device_path}', flush=True)
        tare_start = time.monotonic()
        tare_total = 0.0
        tare_count = 0
        tare_kg = None
        window_start = None
        window_total = 0.0
        window_corners = [0.0, 0.0, 0.0, 0.0]
        window_count = 0
        report_corners = True
        last_publish = tare_start
        stats_samples = deque()

        while os.access(device_path, os.R_OK):
            if os.access(retare_path, os.F_OK):
                os.unlink(retare_path)
                state['recording'] = False
                state['taring'] = True
                state['total_kg'] = None
                state['sample_time'] = None
                clearLoadStats(state)
                stats_samples.clear()
                tare_start = time.monotonic()
                tare_total = 0.0
                tare_count = 0
                tare_kg = None
                window_start = None
                window_total = 0.0
                window_corners = [0.0, 0.0, 0.0, 0.0]
                window_count = 0
                report_corners = True
                print('re-tare requested; recording stopped', flush=True)

            action = wii_runtime.applyCommand(state)
            if action == 'start':
                csv_file, csv_writer = openCsv()
                # Start a fresh window so preview samples never enter the CSV.
                window_start = None
                window_total = 0.0
                window_corners = [0.0, 0.0, 0.0, 0.0]
                window_count = 0
                print('recording started', flush=True)
            if not state['recording'] and csv_file != None:
                csv_file.close()
                csv_file = None
                print('recording stopped', flush=True)

            corners_centi_kg = []
            for axis in range(16, 20):
                # EVIOCGABS(axis): input_absinfo is six 32-bit integers.
                abs_info = fcntl.ioctl(device_fd, 0x80184540 + axis, bytes(24))
                corners_centi_kg.append(struct.unpack_from('i', abs_info)[0])

            raw_kg = sum(corners_centi_kg)/100.0
            now = time.monotonic()
            if tare_kg == None:
                state['corners_kg'] = [value/100.0 for value in corners_centi_kg]
                tare_total += raw_kg
                tare_count += 1
                if now - tare_start >= 2.0:
                    tare_kg = tare_total/tare_count
                    state['taring'] = False
                    print(f'tare applied: {tare_kg:.3f} kg', flush=True)
            else:
                if window_start == None:
                    window_start = now
                window_total += raw_kg
                for corner in range(4):
                    window_corners[corner] += corners_centi_kg[corner]/100.0
                window_count += 1
                if now - window_start >= 0.1:
                    average_kg = window_total/window_count
                    total_kg = max(0.0, average_kg - tare_kg)*calibration_factor
                    corners_kg = [value/window_count for value in window_corners]
                    sample_time = time.time()
                    state['total_kg'] = total_kg
                    state['corners_kg'] = corners_kg
                    state['sample_time'] = sample_time
                    updateLoadStats(state, stats_samples, now, total_kg, corners_kg)
                    if report_corners:
                        corner_values = [f'{value:.3f}' for value in corners_kg]
                        print('corners after tare: ' + ', '.join(corner_values) + ' kg', flush=True)
                        report_corners = False
                    if state['recording']:
                        row = [f'{sample_time:.3f}', f'{total_kg:.3f}']
                        for value in corners_kg:
                            row.append(f'{value:.3f}')
                        csv_writer.writerow(row)
                        csv_file.flush()
                        state['rows_written'] += 1
                    window_start = now
                    window_total = 0.0
                    window_corners = [0.0, 0.0, 0.0, 0.0]
                    window_count = 0

            if now - last_publish >= 0.1:
                wii_runtime.publishState(state)
                last_publish = now
            time.sleep(0.01)

        os.close(device_fd)
        if csv_file != None:
            csv_file.close()
        state['connected'] = False
        state['taring'] = False
        state['recording'] = False
        state['total_kg'] = None
        state['corners_kg'] = None
        state['sample_time'] = None
        clearLoadStats(state)
        wii_runtime.publishState(state)
        print('board disconnected; recording stopped', flush=True)


if __name__ == '__main__':
    main()
