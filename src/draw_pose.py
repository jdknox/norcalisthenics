# Usage: python3 draw_pose.py output/20261030-oac.csv /q/video/workout/sequences
# Reads <date>-<movement>.csv, takes each row's frame from
# <sequence_root>/<date>/<movement>/<file>, draws skeleton and joint angles, and
# writes the result to <csv dir>/<date>/<movement>/<file>.
# Frames with no detected pose are still written, marked 'no pose', so the output
# sequence has no gaps. Landmarks with visibility under LOW_VISIBILITY are drawn
# hollow and dashed. One process per CPU core.
import sys
import os
import csv
import multiprocessing
from PIL import Image, ImageDraw, ImageFont

LOW_VISIBILITY = 0.5
FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

# Near/far sides get different colors so the two legs and arms can be told apart.
LEFT_COLOR = (255, 200, 0)
RIGHT_COLOR = (0, 220, 255)
CENTER_COLOR = (255, 255, 255)

BONES = [
    ('l_shoulder', 'r_shoulder', CENTER_COLOR), ('l_hip', 'r_hip', CENTER_COLOR),
    ('l_shoulder', 'l_hip', LEFT_COLOR), ('r_shoulder', 'r_hip', RIGHT_COLOR),
    ('l_shoulder', 'l_elbow', LEFT_COLOR), ('l_elbow', 'l_wrist', LEFT_COLOR),
    ('r_shoulder', 'r_elbow', RIGHT_COLOR), ('r_elbow', 'r_wrist', RIGHT_COLOR),
    ('l_hip', 'l_knee', LEFT_COLOR), ('l_knee', 'l_ankle', LEFT_COLOR),
    ('r_hip', 'r_knee', RIGHT_COLOR), ('r_knee', 'r_ankle', RIGHT_COLOR),
    ('l_ankle', 'l_heel', LEFT_COLOR), ('l_heel', 'l_foot', LEFT_COLOR), ('l_ankle', 'l_foot', LEFT_COLOR),
    ('r_ankle', 'r_heel', RIGHT_COLOR), ('r_heel', 'r_foot', RIGHT_COLOR), ('r_ankle', 'r_foot', RIGHT_COLOR),
    ('l_shoulder', 'nose', LEFT_COLOR), ('r_shoulder', 'nose', RIGHT_COLOR),
]

# Angle column -> joint landmark it is measured at.
ANGLE_JOINTS = [
    ('knee_l', 'l_knee', LEFT_COLOR), ('knee_r', 'r_knee', RIGHT_COLOR),
    ('hip_l', 'l_hip', LEFT_COLOR), ('hip_r', 'r_hip', RIGHT_COLOR),
    ('elbow_l', 'l_elbow', LEFT_COLOR), ('elbow_r', 'r_elbow', RIGHT_COLOR),
    ('shoulder_l', 'l_shoulder', LEFT_COLOR), ('shoulder_r', 'r_shoulder', RIGHT_COLOR),
]

def drawFrame(job):
    row, frame_path, out_path = job
    image = Image.open(frame_path).convert('RGB')
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT_PATH, 28)

    found = row['knee_r'] != ''
    if found:
        points = {}
        for name in set([b[0] for b in BONES] + [b[1] for b in BONES]):
            points[name] = (float(row[name + '_x']), float(row[name + '_y']), float(row[name + '_v']))

        for a_name, b_name, color in BONES:
            # if color == LEFT_COLOR: continue

            ax, ay, av = points[a_name]
            bx, by, bv = points[b_name]
            if av == 0.0 or bv == 0.0:
                continue  # landmark doesn't exist for this backend, not just low-confidence
            if av < LOW_VISIBILITY or bv < LOW_VISIBILITY:
                steps = 12
                for i in range(0, steps, 2):
                    t0 = i/steps
                    t1 = (i + 1)/steps
                    draw.line([(ax + (bx - ax)*t0, ay + (by - ay)*t0),
                               (ax + (bx - ax)*t1, ay + (by - ay)*t1)], fill=color, width=4)
            else:
                draw.line([(ax, ay), (bx, by)], fill=color, width=5)

        for a_name, b_name, color in BONES:
            for name in [a_name, b_name]:
                x, y, v = points[name]
                if v == 0.0:
                    continue
                r = 9
                if v < LOW_VISIBILITY:
                    draw.ellipse([x - r, y - r, x + r, y + r], outline=color, width=3)
                else:
                    draw.ellipse([x - r, y - r, x + r, y + r], fill=color, outline=(0, 0, 0), width=2)

        for angle_name, joint_name, color in ANGLE_JOINTS:
            # if angle_name.endswith('_l'): continue

            x, y, v = points[joint_name]
            label = f'{float(row[angle_name]):.0f}°'
            if v < LOW_VISIBILITY:
                label += '?'
            bbox = draw.textbbox((0, 0), label, font=font)
            draw.rectangle([x + 14, y - 16, x + 14 + bbox[2] + 8, y + 18], fill=(0, 0, 0))
            draw.text((x + 18, y - 16), label, fill=color, font=font)

    panel = [f'frame {row["frame"]}  {row["file"]}']
    if found:
        panel += ['yellow = L side, cyan = R side', 'hollow / dashed = visibility < 0.5']
    else:
        panel += ['NO POSE DETECTED']
    draw.rectangle([20, 20, 640, 20 + 40*len(panel) + 10], fill=(0, 0, 0))
    for i in range(len(panel)):
        draw.text((32, 28 + 40*i), panel[i], fill=(255, 255, 255), font=font)

    image.save(out_path, quality=90)
    return found

if __name__ == '__main__':
    csv_path = sys.argv[1]
    sequence_root = sys.argv[2]

    # <date>-<movement>.csv -> frames in <sequence_root>/<date>/<movement>/
    csv_name = os.path.basename(csv_path)
    assert csv_name.endswith('.csv'), f'{csv_name} is not a .csv'
    date, movement = csv_name[:-len('.csv')].split('-', 1)
    assert len(date) == 8 and date.isdigit(), f'expected <YYYYMMDD>-<movement>.csv, got {csv_name}'

    frames_dir = os.path.join(sequence_root, date, movement)
    assert os.path.isdir(frames_dir), f'frame dir {frames_dir} does not exist'
    out_dir = os.path.join(os.path.dirname(os.path.abspath(csv_path)), date, movement)
    os.makedirs(out_dir, exist_ok=True)

    jobs = []
    for row in csv.DictReader(open(csv_path)):
        frame_path = os.path.join(frames_dir, row['file'])
        assert os.path.isfile(frame_path), f'{frame_path} listed in CSV but missing'
        jobs.append((row, frame_path, os.path.join(out_dir, row['file'])))
    assert jobs, f'{csv_path} has no rows'

    print(f'{len(jobs)} frames: {frames_dir} -> {out_dir}')
    pool = multiprocessing.Pool(os.cpu_count())
    results = pool.map(drawFrame, jobs)
    pool.close()
    pool.join()
    print(f'{len(results)} written, {results.count(False)} marked no pose')
