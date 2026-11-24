# Usage: python3 session_summary.py 20261103-sls-merged.csv 'name=HH:MM:SS-HH:MM:SS' [more segments...]
# Prints, per named time segment, force_kg and arm_assist_kg stats and
# knee-angle range of motion. Reads a merge_force.py output (needs its
# force_kg/arm_assist_kg columns); the pose-only CSV works too, just without
# the force/assist lines.
# No rep counting: at this source's ~1 frame/second sampling, with real
# per-rep jitter and occasional missed detections, simple threshold-crossing
# rep counts swung from 8 to 14 against a known 12-rep set depending on the
# threshold -- not close enough to report. ROM (min/max over the whole window)
# doesn't have that problem; cycle counting does.
import sys
import csv
import time

def parseClock(date_prefix, clock):
    return time.mktime(time.strptime(date_prefix + clock.replace(':', ''), '%Y%m%d_%H%M%S'))

def frameTime(file_name):
    return time.mktime(time.strptime(file_name.rsplit('.', 1)[0], '%Y%m%d_%H%M%S'))

def statsOf(values):
    if not values:
        return None
    mean = sum(values)/len(values)
    variance = sum((v - mean)**2 for v in values)/len(values)
    return {'min': min(values), 'max': max(values), 'mean': mean, 'stdev': variance**0.5}

if __name__ == '__main__':
    csv_path = sys.argv[1]
    rows = list(csv.DictReader(open(csv_path)))
    date_prefix = rows[0]['file'].split('_')[0] + '_'
    has_force = 'force_kg' in rows[0]

    for spec in sys.argv[2:]:
        name, clock_range = spec.split('=', 1)
        start_clock, end_clock = clock_range.split('-', 1)
        start_time = parseClock(date_prefix, start_clock)
        end_time = parseClock(date_prefix, end_clock)

        segment = [r for r in rows if r['knee_l'] and start_time <= frameTime(r['file']) <= end_time]
        knee_l = [float(r['knee_l']) for r in segment]
        knee_r = [float(r['knee_r']) for r in segment]

        print(f'=== {name} ({len(segment)} frames with a detected pose) ===')
        if has_force:
            force = statsOf([float(r['force_kg']) for r in segment if r['force_kg']])
            assist = statsOf([float(r['arm_assist_kg']) for r in segment if r['arm_assist_kg']])
            if force:
                print(f'  force_kg:  min {force["min"]:.1f}  mean {force["mean"]:.1f}  max {force["max"]:.1f}  stdev {force["stdev"]:.1f}')
            if assist:
                print(f'  assist_kg: min {assist["min"]:.1f}  mean {assist["mean"]:.1f}  max {assist["max"]:.1f}')

        if knee_l and knee_r:
            print(f'  knee ROM: L {min(knee_l):.0f}-{max(knee_l):.0f}° (range {max(knee_l)-min(knee_l):.0f}°)  '
                  f'R {min(knee_r):.0f}-{max(knee_r):.0f}° (range {max(knee_r)-min(knee_r):.0f}°)')
        else:
            print('  no detected poses in this window')
