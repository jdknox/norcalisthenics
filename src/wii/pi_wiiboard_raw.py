#!/usr/bin/env python3
import csv
import socket
import time

address = '00:1f:c5:ab:39:a6'
csv_path = '/home/knox/prj/dev/norcalisthenics/data/wii/wiiboard_weights.csv'
# calibration_factor = 1.028744517
calibration_factor = 1.0

def channel(psm):
    sock = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_SEQPACKET,
                         socket.BTPROTO_L2CAP)
    sock.settimeout(1.0)
    sock.connect((address, psm))
    return sock

control = channel(0x11)
receive = channel(0x13)

def send(*parts):
    control.send(b'\x52' + b''.join(parts))

send(b'\x17', b'\x04\xa4\x00\x24\x00\x18')
send(b'\x16', b'\x04\xa4\x00\x40\x00')
send(b'\x15', b'\x00')

calibration = []
reporting = False
timeout_count = 0
window_start = None
window_total = 0.0
window_count = 0
window_duration = 0.1
tare_start = None
tare_total = 0.0
tare_count = 0
tare_kg = None
csv_file = open(csv_path, 'a', newline='')
csv_writer = csv.writer(csv_file)
if csv_file.tell() == 0:
    csv_writer.writerow(['timestamp', 'total_kg'])
    csv_file.flush()

def mass(raw, corner):
    zero = calibration[corner]
    seventeen = calibration[4 + corner]
    thirty_four = calibration[8 + corner]
    if raw < zero:
        return 0.0
    if raw < seventeen:
        return 17.0 * (raw - zero) / float(seventeen - zero)
    return 17.0 + 17.0 * (raw - seventeen) / float(thirty_four - seventeen)

while True:
    try:
        data = receive.recv(64)
    except TimeoutError:
        timeout_count += 1
        if timeout_count >= 3:
            print('board disconnected (receive timeout)')
            break
        continue
    timeout_count = 0
    if not data:
        print('board disconnected')
        break

    if len(data) < 2:
        continue
    report_type = data[1]
    if report_type == 0x21:
        length = data[4] // 16 + 1
        payload = data[7:7 + length]
        if len(payload) >= 8:
            values = [int.from_bytes(payload[index:index + 2], 'big')
                      for index in range(0, len(payload) - 1, 2)]
            calibration.extend(values)
        if len(calibration) >= 12 and not reporting:
            send(b'\x12', b'\x04', b'\x32')
            send(b'\x11', b'\x10')
            reporting = True
            print('continuous reporting enabled', calibration)
    elif report_type == 0x32 and len(data) >= 12:
        raw = [int.from_bytes(data[index:index + 2], 'big')
               for index in (4, 6, 8, 10)]
        weights = [mass(value, index) for index, value in enumerate(raw)]
        raw_total_kg = sum(weights)

        now = time.time()
        if tare_start is None:
            tare_start = now
        if tare_kg is None:
            tare_total += raw_total_kg
            tare_count += 1
            if now - tare_start >= 2.0:
                tare_kg = tare_total/tare_count
                print('tare applied', f'{tare_kg:.3f}', 'kg')
            else:
                continue

        total_kg = max(0.0, raw_total_kg - tare_kg)*calibration_factor
        if window_start is None:
            window_start = now
        window_total += total_kg
        window_count += 1
        if now - window_start >= window_duration:
            average_kg = window_total/window_count
            if average_kg > 1.0:
                csv_writer.writerow([f'{now:.3f}', f'{average_kg:.3f}'])
                csv_file.flush()
            window_start = now
            window_total = 0.0
            window_count = 0

        print('weight kg corners', [round(value, 2) for value in weights],
              'total', f'{total_kg:.3f}', 'raw', raw)

control.close()
receive.close()
csv_file.close()
