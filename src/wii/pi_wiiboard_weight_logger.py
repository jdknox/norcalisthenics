#!/usr/bin/env python3
import csv
from collections import deque
import math
import os
import select
import time

import wii_runtime

board_address = '00:1f:c5:ab:39:a6'
csv_path = '/home/knox/prj/dev/norcalisthenics/data/wii/wiiboard_weights.csv'
retare_path = '/home/knox/prj/dev/norcalisthenics/data/wii/.retare-request'
# calibration_factor = 1.028744517
calibration_factor = 1.0
WINDOW_DURATION = 3.0
csv_header = ['timestamp', 'total_kg', 'corner_1_tared_kg', 'corner_2_tared_kg',
              'corner_3_tared_kg', 'corner_4_tared_kg']


def findBoard():
    if not os.access('/sys/class/hidraw', os.F_OK):
        return None
    for entry in os.listdir('/sys/class/hidraw'):
        handle = open(f'/sys/class/hidraw/{entry}/device/uevent')
        metadata = handle.read().splitlines()
        handle.close()
        if f'HID_UNIQ={board_address}' in metadata:
            return f'/dev/{entry}', f'/sys/class/hidraw/{entry}/device/bboard_calib'
    return None


def readCalibration(path):
    handle = open(path)
    calibration = [int(value, 16) for value in handle.read().strip().split(':')]
    handle.close()
    if len(calibration) != 12:
        raise ValueError('Expected 12 factory calibration values.')
    for corner in range(4):
        if not calibration[corner] < calibration[4 + corner] < calibration[8 + corner]:
            # The driver can still be fetching calibration just after connecting.
            return None
    return calibration


def parseReport(data, calibration):
    # Report ID, two button bytes, then four big-endian ADC values: TR, BR, TL, BL.
    if len(data) < 11 or data[0] not in (0x32, 0x34):
        return None
    corners = []
    for corner in range(4):
        offset = 3 + 2*corner
        raw = int.from_bytes(data[offset:offset + 2], 'big')
        zero = calibration[corner]
        seventeen = calibration[4 + corner]
        thirty_four = calibration[8 + corner]
        # Preserve values below the factory zero, unlike the evdev conversion.
        if raw < seventeen:
            value = 17.0*(raw - zero)/(seventeen - zero)
        else:
            value = 17.0 + 17.0*(raw - seventeen)/(thirty_four - seventeen)
        corners.append(value)
    return corners


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
        'corner_signed_kg': None, 'corner_tare_kg': None,
        'load_average_kg': None, 'load_stdev_kg': None, 'load_samples': 0,
        'corner_average_kg': None, 'corner_stdev_kg': None,
        'corner_min_kg': None, 'corner_max_kg': None,
        'applied_command': None, 'command_error': '',
    }
    wii_runtime.publishState(state)

    while True:
        board = findBoard()
        calibration = None
        if board != None and os.access(board[0], os.R_OK):
            calibration = readCalibration(board[1])
        if calibration == None:
            wii_runtime.applyCommand(state)
            wii_runtime.publishState(state)
            time.sleep(0.5)
            continue

        device_path = board[0]
        device_fd = os.open(device_path, os.O_RDONLY | os.O_NONBLOCK)
        csv_file = None
        state['connected'] = True
        state['taring'] = True
        wii_runtime.publishState(state)
        print(f'reading signed raw corners from {device_path}', flush=True)
        tare_start = None
        tare_totals = [0.0, 0.0, 0.0, 0.0]
        tare_count = 0
        tare_corners = None
        window_start = None
        window_corners = [0.0, 0.0, 0.0, 0.0]
        window_count = 0
        report_corners = True
        last_publish = time.monotonic()
        last_report = None
        stats_samples = deque()

        while os.access(device_path, os.R_OK):
            if os.access(retare_path, os.F_OK):
                os.unlink(retare_path)
                state['recording'] = False
                state['taring'] = True
                state['total_kg'] = None
                state['sample_time'] = None
                state['corners_kg'] = None
                state['corner_signed_kg'] = None
                state['corner_tare_kg'] = None
                clearLoadStats(state)
                stats_samples.clear()
                tare_start = None
                tare_totals = [0.0, 0.0, 0.0, 0.0]
                tare_count = 0
                tare_corners = None
                window_start = None
                window_corners = [0.0, 0.0, 0.0, 0.0]
                window_count = 0
                report_corners = True
                print('re-tare requested; recording stopped', flush=True)

            action = wii_runtime.applyCommand(state)
            if action == 'start':
                csv_file, csv_writer = openCsv()
                # Start a fresh window so preview samples never enter the CSV.
                window_start = None
                window_corners = [0.0, 0.0, 0.0, 0.0]
                window_count = 0
                print('recording started', flush=True)
            if not state['recording'] and csv_file != None:
                csv_file.close()
                csv_file = None
                print('recording stopped', flush=True)

            readable, unused_write, unused_error = select.select([device_fd], [], [], 0.01)
            now = time.monotonic()
            signed_corners = None
            if readable:
                data = os.read(device_fd, 64)
                if not data:
                    break
                signed_corners = parseReport(data, calibration)

            if signed_corners != None:
                if last_report != None and now - last_report > 0.5:
                    # Never carry an old partial window across a report outage.
                    window_start = None
                    window_corners = [0.0, 0.0, 0.0, 0.0]
                    window_count = 0
                    stats_samples.clear()
                    clearLoadStats(state)
                    if tare_corners == None:
                        tare_start = None
                        tare_totals = [0.0, 0.0, 0.0, 0.0]
                        tare_count = 0
                last_report = now
                if tare_corners == None:
                    if tare_start == None:
                        tare_start = now
                    state['corner_signed_kg'] = signed_corners
                    for corner in range(4):
                        tare_totals[corner] += signed_corners[corner]
                    tare_count += 1
                    if now - tare_start >= 2.0:
                        tare_corners = [value/tare_count for value in tare_totals]
                        state['corner_tare_kg'] = tare_corners
                        state['taring'] = False
                        window_start = now
                        baseline_values = [f'{value:.3f}' for value in tare_corners]
                        print('corner baselines applied: ' + ', '.join(baseline_values) + ' kg', flush=True)
                else:
                    if window_start == None:
                        window_start = now
                    for corner in range(4):
                        window_corners[corner] += signed_corners[corner]
                    window_count += 1
                    if now - window_start >= 0.1:
                        signed_kg = [value/window_count for value in window_corners]
                        corners_kg = []
                        for corner in range(4):
                            corners_kg.append(signed_kg[corner] - tare_corners[corner])
                        # Keep signed residuals; clipping biases an empty-board average.
                        total_kg = sum(corners_kg)*calibration_factor
                        sample_time = time.time()
                        state['total_kg'] = total_kg
                        state['corners_kg'] = corners_kg
                        state['corner_signed_kg'] = signed_kg
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
                        window_corners = [0.0, 0.0, 0.0, 0.0]
                        window_count = 0

            if now - last_publish >= 0.1:
                wii_runtime.publishState(state)
                last_publish = now

        os.close(device_fd)
        if csv_file != None:
            csv_file.close()
        state['connected'] = False
        state['taring'] = False
        state['recording'] = False
        state['total_kg'] = None
        state['corners_kg'] = None
        state['corner_signed_kg'] = None
        state['corner_tare_kg'] = None
        state['sample_time'] = None
        clearLoadStats(state)
        wii_runtime.publishState(state)
        print('board disconnected; recording stopped', flush=True)


if __name__ == '__main__':
    main()
