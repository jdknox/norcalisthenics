# Usage:
#   python3 leg_analysis.py POSE.csv BOARD.csv BASELINE OUT.csv \
#       'label=HH:MM:SS-HH:MM:SS=LRLRLR' ...
#
# Per-leg eccentric-vs-concentric strength analysis for free-standing assisted
# single-leg squats. The athlete stands on the Wii board on one leg; when a leg
# can't carry the load, the arms push down on a chair to each side, offloading
# it. So board total_kg IS the working leg's load, and baseline - total_kg is
# how much the arms took (the assistance).
#
# The working leg per rep is NOT detected from the pose -- the pose L/R labeling
# is not reliable enough, and we know the sequence a priori. The segment spec
# carries the known leg order (e.g. LRLRLR = 6 reps, L then R ...). The data is
# used only to find each rep's TIMING: the deepest-flexion point, the single most
# robust feature. Reps are split at the midpoints between consecutive bottoms,
# legs are assigned in the given order, and each rep reads its KNOWN leg's knee
# directly -- the free leg is ignored.
#
# Within a rep, each board sample is eccentric (knee flexing, lowering) or
# concentric (knee extending, standing up) by the sign of that knee's angular
# velocity. The force a leg produces differs between the two phases at the same
# angle -- that gap is the signal -- so the two branches are kept separate.
# Near-stationary samples (|velocity| < MIN_VEL) are dropped.
#
# Knee angle is interpolated onto each board timestamp with a monotone cubic
# (PCHIP); its derivative gives the angular velocity. Samples inside a pose
# dropout longer than MAX_KNOT_GAP get no angle and are skipped.
#
# BASELINE: unassisted bodyweight in kg, or a step schedule for a mid-session
# load change, as in merge_force.py, e.g. '81.4,111.4@19:57:07'.
# OUT.csv: per leg/phase/angle-bin rows are appended for week-to-week tracking;
# pass '-' to skip.
import sys
import csv
import time
import merge_force

MAX_KNOT_GAP = 2.0      # s; board samples inside a longer pose dropout get no angle
MIN_VEL = 5.0           # deg/s; below this the knee is treated as stationary (rest/turnaround)
ANGLE_BIN = 15.0        # deg; width of strength-curve angle bins
ASSIST_UNLOADED = 3.0   # kg; assist below this counts as the leg carrying the load alone
DEEP_BOTTOM = 70.0      # deg; a rep bottom is the working knee flexed below this
MERGE_GAP = 5.0         # s; angle minima closer than this are one rep bottom

def endpointSlope(h0, h1, d0, d1):
    m = ((2*h0 + h1)*d0 - h0*d1)/(h0 + h1)
    if (m > 0) != (d0 > 0):
        return 0.0
    if (d0 > 0) != (d1 > 0) and abs(m) > 3*abs(d0):
        return 3*d0
    return m

def pchipSlopes(xs, ys):
    # Monotone cubic slope at each knot (Fritsch-Carlson 1980).
    n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    delta = [(ys[i + 1] - ys[i])/h[i] for i in range(n - 1)]
    m = [0.0]*n
    for i in range(1, n - 1):
        if delta[i - 1] == 0.0 or delta[i] == 0.0 or (delta[i - 1] > 0) != (delta[i] > 0):
            m[i] = 0.0
        else:
            w1 = 2*h[i] + h[i - 1]
            w2 = h[i] + 2*h[i - 1]
            m[i] = (w1 + w2)/(w1/delta[i - 1] + w2/delta[i])
    if n > 2:
        m[0] = endpointSlope(h[0], h[1], delta[0], delta[1])
        m[n - 1] = endpointSlope(h[n - 2], h[n - 3], delta[n - 2], delta[n - 3])
    else:
        m[0] = delta[0]
        m[n - 1] = delta[0]
    return m

def pchipEval(xs, ys, m, x):
    # (value, d/dx) at x, clamped to the end knots.
    n = len(xs)
    if x <= xs[0]:
        i = 0
    elif x >= xs[-1]:
        i = n - 2
    else:
        lo = 0
        hi = n - 1
        while hi - lo > 1:
            mid = (lo + hi)//2
            if xs[mid] <= x:
                lo = mid
            else:
                hi = mid
        i = lo
    h = xs[i + 1] - xs[i]
    t = (x - xs[i])/h
    t2 = t*t
    t3 = t2*t
    value = ((2*t3 - 3*t2 + 1)*ys[i] + (t3 - 2*t2 + t)*h*m[i] +
             (-2*t3 + 3*t2)*ys[i + 1] + (t3 - t2)*h*m[i + 1])
    deriv = ((6*t2 - 6*t)*ys[i] + (-6*t2 + 6*t)*ys[i + 1])/h + \
            (3*t2 - 4*t + 1)*m[i] + (3*t2 - 2*t)*m[i + 1]
    return value, deriv

def knotGap(xs, x):
    if x < xs[0] or x > xs[-1]:
        return float('inf')
    lo = 0
    hi = len(xs) - 1
    while hi - lo > 1:
        mid = (lo + hi)//2
        if xs[mid] <= x:
            lo = mid
        else:
            hi = mid
    return xs[lo + 1] - xs[lo]

def buildSamples(board, baseline_steps, knee_times, knee_l, knee_r):
    # One record per board sample with trustworthy interpolated angles for BOTH
    # knees: (t, force, assist, angle_l, vel_l, angle_r, vel_r). The known leg
    # sequence decides which knee to read per rep.
    slopes_l = pchipSlopes(knee_times, knee_l)
    slopes_r = pchipSlopes(knee_times, knee_r)
    samples = []
    for board_time, force in board:
        if knotGap(knee_times, board_time) > MAX_KNOT_GAP:
            continue
        angle_l, vel_l = pchipEval(knee_times, knee_l, slopes_l, board_time)
        angle_r, vel_r = pchipEval(knee_times, knee_r, slopes_r, board_time)
        assist = merge_force.baselineAt(baseline_steps, board_time) - force
        samples.append((board_time, force, assist, angle_l, vel_l, angle_r, vel_r))
    return samples

def findBottoms(samples):
    # Rep bottoms = local minima of the more-flexed knee below DEEP_BOTTOM, merged
    # within MERGE_GAP. Returns sample indices, in time order.
    depth = [min(s[3], s[5]) for s in samples]
    times = [s[0] for s in samples]
    n = len(samples)
    merged = []
    for i in range(1, n - 1):
        if depth[i] <= depth[i - 1] and depth[i] <= depth[i + 1] and depth[i] < DEEP_BOTTOM:
            if merged and times[i] - times[merged[-1]] < MERGE_GAP:
                if depth[i] < depth[merged[-1]]:
                    merged[-1] = i
            else:
                merged.append(i)
    return merged

def binByAngle(rows):
    # rows: list of (angle, force, assist). Returns {bin_index: (mean_force, mean_assist, n)}.
    buckets = {}
    for angle, force, assist in rows:
        buckets.setdefault(int(angle//ANGLE_BIN), []).append((force, assist))
    out = {}
    for key, values in buckets.items():
        n = len(values)
        out[key] = (sum(f for f, a in values)/n, sum(a for f, a in values)/n, n)
    return out

def analyzeSegment(label, samples, sequence, bottom_times, start_time, end_time, writer, date):
    print(f'=== {label} ===')
    if bottom_times:
        # Rep timing supplied a priori; no detection.
        times = list(bottom_times)
        print(f'  known sequence {sequence} ({len(sequence)} reps); rep bottoms given')
    else:
        bottoms = findBottoms(samples)
        times = [samples[b][0] for b in bottoms]
        print(f'  known sequence {sequence} ({len(sequence)} reps); detected {len(bottoms)} rep bottoms')
        for i, b in enumerate(bottoms):
            leg = sequence[i] if i < len(sequence) else '?'
            print(f'    bottom {i + 1}: {time.strftime("%M:%S", time.localtime(samples[b][0]))}  '
                  f'knee {min(samples[b][3], samples[b][5]):.0f}deg  -> leg {leg}')
    if len(times) != len(sequence):
        print(f'  MISMATCH: {len(times)} bottoms but sequence has {len(sequence)}; '
              f'supply rep bottom times to resolve (spec: ...={sequence}@MM:SS,MM:SS,...).')
        print()
        return
    boundaries = [start_time]
    for i in range(len(times) - 1):
        boundaries.append((times[i] + times[i + 1])/2)
    boundaries.append(end_time)

    phase_rows = {}
    per_rep = []
    for i, leg in enumerate(sequence):
        lo_time = boundaries[i]
        hi_time = boundaries[i + 1]
        # The working leg's identity (L/R) is a priori from the sequence, but RTMPose
        # labels left/right inconsistently across reps, so which knee to READ is the
        # one actually flexed at the bottom -- the physical working leg -- not the
        # pose's L/R tag. Pick the deeper knee at this rep's bottom and read it throughout.
        bottom_sample = min(samples, key=lambda s: abs(s[0] - times[i]))
        read_left = bottom_sample[3] < bottom_sample[5]
        rep_rows = {'ecc': [], 'con': []}
        for s in samples:
            if not (lo_time <= s[0] < hi_time):
                continue
            angle, vel = (s[3], s[4]) if read_left else (s[5], s[6])
            if abs(vel) < MIN_VEL:
                continue
            phase = 'ecc' if vel < 0 else 'con'
            row = (angle, s[1], s[2])
            rep_rows[phase].append(row)
            phase_rows.setdefault((leg, phase), []).append(row)
        per_rep.append((i + 1, leg, rep_rows))

    print('  per rep:')
    for number, leg, rep_rows in per_rep:
        allrows = rep_rows['ecc'] + rep_rows['con']
        if not allrows:
            print(f'    rep {number} [{leg}]: no moving samples')
            continue
        peak = max(allrows, key=lambda r: r[1])
        con_assist = max((r[2] for r in rep_rows['con']), default=0.0)
        print(f'    rep {number} [{leg}]: {len(rep_rows["ecc"])} ecc + {len(rep_rows["con"])} con, '
              f'peak force {peak[1]:.1f} kg @ {peak[0]:.0f}deg, max concentric assist {con_assist:.1f} kg')

    for leg in sorted({l for l, p in phase_rows}):
        ecc_rows = phase_rows.get((leg, 'ecc'), [])
        con_rows = phase_rows.get((leg, 'con'), [])
        ecc = binByAngle(ecc_rows)
        con = binByAngle(con_rows)
        print(f'  --- leg {leg}: {len(ecc_rows)} eccentric + {len(con_rows)} concentric samples ---')
        print('    knee angle | ecc force (n) | con force (n) | ecc-con gap | con assist')
        for key in sorted(set(ecc) | set(con)):
            lo = key*ANGLE_BIN
            ecc_cell = f'{ecc[key][0]:5.1f} ({ecc[key][2]:2d})' if key in ecc else '    -     '
            con_cell = f'{con[key][0]:5.1f} ({con[key][2]:2d})' if key in con else '    -     '
            gap = f'{ecc[key][0] - con[key][0]:+5.1f}' if key in ecc and key in con else '   - '
            con_assist = f'{con[key][1]:5.1f}' if key in con else '   - '
            print(f'    {lo:3.0f}-{lo + ANGLE_BIN:3.0f}deg | {ecc_cell} | {con_cell} | {gap} kg | {con_assist} kg')
        unassisted = [(angle, force) for angle, force, assist in ecc_rows + con_rows if assist < ASSIST_UNLOADED]
        if unassisted:
            peak = max(unassisted, key=lambda r: r[1])
            print(f'    peak unassisted force {peak[1]:.1f} kg @ {peak[0]:.0f}deg')
        if con:
            stick = max(con.items(), key=lambda kv: kv[1][1])
            print(f'    concentric sticking point: most assist {stick[1][1]:.1f} kg @ '
                  f'{stick[0]*ANGLE_BIN:.0f}-{stick[0]*ANGLE_BIN + ANGLE_BIN:.0f}deg')
        if writer:
            for phase, binned in (('ecc', ecc), ('con', con)):
                for key in sorted(binned):
                    mean_force, mean_assist, n = binned[key]
                    writer.writerow([date, label, leg, phase, int(key*ANGLE_BIN),
                                     f'{mean_force:.1f}', f'{mean_assist:.1f}', n])

if __name__ == '__main__':
    pose_csv = sys.argv[1]
    board_csv = sys.argv[2]
    baseline_text = sys.argv[3]
    out_csv = sys.argv[4]
    segment_specs = sys.argv[5:]

    board_times, board_totals = merge_force.loadBoardLog(board_csv)
    board = list(zip(board_times, board_totals))
    pose_rows = [r for r in csv.DictReader(open(pose_csv)) if r['knee_l'] and r['knee_r']]
    date_prefix = pose_rows[0]['file'].split('_')[0] + '_'
    date = pose_rows[0]['file'].split('_')[0]
    baseline_steps = merge_force.parseBaselineSchedule(baseline_text, date_prefix)

    writer = None
    out_file = None
    if out_csv != '-':
        import os
        new_file = not os.path.exists(out_csv)
        out_file = open(out_csv, 'a', newline='')
        writer = csv.writer(out_file)
        if new_file:
            writer.writerow(['date', 'label', 'leg', 'phase', 'angle_bin_deg',
                             'mean_force_kg', 'mean_assist_kg', 'n'])

    for spec in segment_specs:
        parts = spec.split('=')
        label = parts[0]
        start_clock, end_clock = parts[1].split('-', 1)
        sequence = ''
        bottom_times = []
        if len(parts) > 2:
            seq_spec = parts[2].upper()
            if '@' in seq_spec:
                sequence, times_text = seq_spec.split('@', 1)
                for clock in times_text.split(','):
                    bottom_times.append(time.mktime(time.strptime(date_prefix + clock.replace(':', ''), '%Y%m%d_%H%M%S')))
            else:
                sequence = seq_spec
        start_time = time.mktime(time.strptime(date_prefix + start_clock.replace(':', ''), '%Y%m%d_%H%M%S'))
        end_time = time.mktime(time.strptime(date_prefix + end_clock.replace(':', ''), '%Y%m%d_%H%M%S'))

        segment_board = [(t, f) for t, f in board if start_time <= t <= end_time]
        knots = [(merge_force.parseFrameTime(r['file']), float(r['knee_l']), float(r['knee_r']))
                 for r in pose_rows if start_time - 2 <= merge_force.parseFrameTime(r['file']) <= end_time + 2]
        if len(knots) < 3 or not segment_board or not sequence:
            print(f'=== {label} ===\n  needs pose knots, board samples, and a known leg sequence\n')
            continue
        samples = buildSamples(segment_board, baseline_steps, [k[0] for k in knots], [k[1] for k in knots], [k[2] for k in knots])
        analyzeSegment(label, samples, sequence, bottom_times, start_time, end_time, writer, date)
        print()

    if out_file:
        out_file.close()
