# Usage: python3 merge_force.py 20261103-sls.csv ../data/wii/wiiboard_weights.csv out.csv [baseline]
# Joins a pose_to_csv.py CSV with a Wii board weight log by wall-clock time, and
# adds two columns: force_kg (board total, interpolated to the frame's instant)
# and arm_assist_kg (baseline_kg - force_kg; positive means the arms/a rail are
# carrying some of the bodyweight, negative means bearing more than bodyweight).
# Both logs must be on clocks that agree (NTP-synced machines, same timezone);
# frame filenames only carry whole-second resolution, so matches are only as
# tight as that.
# baseline: standing bodyweight with no rail assistance, in kg. If omitted,
# uses the 90th percentile of the board log's total_kg, which is steadier than
# the max (a single noisy spike can't skew it) but still close to full
# weight-bearing. If bodyweight changes mid-session (a weighted vest put on
# partway through), pass a schedule instead of one number:
#   '81.4,111.4@19:57:07'
# meaning 81.4 kg from the start of the log, stepping to 111.4 kg at 19:57:07
# (same date as the frames). Without a step, arm_assist_kg would read as a
# large, misleading negative number for the whole post-vest stretch: correct
# arithmetic, but it would be showing added vest load, not reduced assistance.
import sys
import csv
import time

def parseFrameTime(file_name):
    # '20261103_195332.jpg' -> Unix seconds, local time.
    date_time = file_name.rsplit('.', 1)[0]
    return time.mktime(time.strptime(date_time, '%Y%m%d_%H%M%S'))

def loadBoardLog(path):
    # Returns (timestamps, totals) both sorted ascending, as the log is written.
    rows = list(csv.DictReader(open(path)))
    timestamps = [float(r['timestamp']) for r in rows]
    totals = [float(r['total_kg']) for r in rows]
    return timestamps, totals

def percentile(values, fraction):
    ordered = sorted(values)
    index = int(round(fraction*(len(ordered) - 1)))
    return ordered[index]

def parseBaselineSchedule(text, date_prefix):
    # 'kg' or 'kg,kg@HH:MM:SS,...': steps, applied on date_prefix (the frames'
    # own date). Returns (switch_time, value) pairs sorted ascending; the first
    # step's switch_time is -inf so it always applies before any step time.
    steps = []
    for part in text.split(','):
        if '@' in part:
            value_text, clock = part.split('@', 1)
            switch_time = time.mktime(time.strptime(date_prefix + clock.replace(':', ''), '%Y%m%d_%H%M%S'))
        else:
            value_text = part
            switch_time = float('-inf')
        steps.append((switch_time, float(value_text)))
    steps.sort()
    return steps

def baselineAt(steps, frame_time):
    value = steps[0][1]
    for switch_time, step_value in steps:
        if frame_time >= switch_time:
            value = step_value
    return value

def forceAt(timestamps, totals, frame_time):
    # Linear interpolation between the two board samples bracketing frame_time.
    # None outside the board log's time range: nothing to interpolate from.
    if frame_time < timestamps[0] or frame_time > timestamps[-1]:
        return None
    hi = 0
    while timestamps[hi] < frame_time:
        hi += 1
    if timestamps[hi] == frame_time or hi == 0:
        return totals[hi]
    lo = hi - 1
    span = timestamps[hi] - timestamps[lo]
    t = (frame_time - timestamps[lo])/span
    return totals[lo] + (totals[hi] - totals[lo])*t

if __name__ == '__main__':
    pose_csv = sys.argv[1]
    board_csv = sys.argv[2]
    out_path = sys.argv[3]

    timestamps, totals = loadBoardLog(board_csv)
    rows = list(csv.DictReader(open(pose_csv)))
    date_prefix = rows[0]['file'].split('_')[0] + '_'

    if len(sys.argv) > 4:
        baseline_steps = parseBaselineSchedule(sys.argv[4], date_prefix)
    else:
        baseline_steps = [(float('-inf'), percentile(totals, 0.9))]
    schedule_text = ', then '.join(
        f'{value:.1f} kg' if switch_time == float('-inf') else
        f'{value:.1f} kg from {time.strftime("%H:%M:%S", time.localtime(switch_time))}'
        for switch_time, value in baseline_steps)
    print(f'baseline {schedule_text}, board log {timestamps[0]:.1f}..{timestamps[-1]:.1f}')

    out = open(out_path, 'w')
    writer = csv.writer(out)
    writer.writerow(list(rows[0].keys()) + ['force_kg', 'arm_assist_kg'])

    matched = 0
    for row in rows:
        frame_time = parseFrameTime(row['file'])
        force_kg = forceAt(timestamps, totals, frame_time)
        assist_kg = ''
        if force_kg is not None:
            assist_kg = f'{baselineAt(baseline_steps, frame_time) - force_kg:.2f}'
            matched += 1
        writer.writerow(list(row.values()) + [
            '' if force_kg is None else f'{force_kg:.2f}', assist_kg])
    out.close()
    print(f'{len(rows)} frames, {matched} matched to the board log -> {out_path}')
