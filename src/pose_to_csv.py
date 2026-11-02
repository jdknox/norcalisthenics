# Usage:
#   python3 pose_to_csv.py /q/video/.../20261030/squat/clip.mp4 pose_landmarker_heavy.task out_dir
#   python3 pose_to_csv.py '/q/video/.../20261030/hspu/*.jpg' pose_landmarker_heavy.task out_dir 30 [workers] [cpu|gpu] [0|180]
# Writes out_dir/<date>-<movement>.csv, e.g. 20261030-hspu.csv. Input must sit in
# .../<date>/<movement>/, where <date> is 8 digits.
# Input is a video file, or a quoted glob of image frames plus their frame rate.
# Frames are read in sorted filename order, so gaps in the numbering don't matter.
# Image frames are split into contiguous chunks, one process per chunk. Video
# files run in one process.
# Device: 'cpu' (default) or 'gpu'. The GPU is only used when asked for, and a
# failure then is an error, not a fallback. MediaPipe's Python GPU support is
# Linux (OpenGL ES/EGL) only, and under WSL it is slower than the CPU.
# Default workers: 1 on the GPU (processes would share one GPU), CPU count on the CPU.
# Rotation: 180 turns each frame upside down before detection and maps the
# landmarks back. The detector is trained mostly on upright people, so this helps
# inverted movements (HSPU). Rotation is not a mirror, so L/R stay correct.
# MediaPipe tracks one person from frame to frame; pickPerson then rejects any
# frame where that person's torso jumped too far (the model switched people).
# One CSV row per frame: time, joint angles, all 33 landmarks in pixels.
import sys
import os
# Quiet MediaPipe/TFLite startup chatter (INFO + WARNING). Set before the import;
# spawned workers re-run this file, so they inherit it too. Errors still print.
os.environ.setdefault('GLOG_minloglevel', '2')
os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '2')
import glob
import math
import multiprocessing
import cv2
import mediapipe as mp

# MediaPipe pose indices
L_SHOULDER, R_SHOULDER = 11, 12
L_ELBOW, R_ELBOW = 13, 14
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24
L_KNEE, R_KNEE = 25, 26
L_ANKLE, R_ANKLE = 27, 28

# All 33 landmarks in MediaPipe index order. Each gets _x and _y (pixels,
# y pointing down) and _v (visibility, 0-1).
LANDMARK_NAMES = [
    'nose', 'l_eye_inner', 'l_eye', 'l_eye_outer', 'r_eye_inner', 'r_eye', 'r_eye_outer',
    'l_ear', 'r_ear', 'mouth_l', 'mouth_r',
    'l_shoulder', 'r_shoulder', 'l_elbow', 'r_elbow', 'l_wrist', 'r_wrist',
    'l_pinky', 'r_pinky', 'l_index', 'r_index', 'l_thumb', 'r_thumb',
    'l_hip', 'r_hip', 'l_knee', 'r_knee', 'l_ankle', 'r_ankle',
    'l_heel', 'r_heel', 'l_foot', 'r_foot']
assert len(LANDMARK_NAMES) == 33

# Angle at the middle joint, 180 = straight.
# shoulder = hip-shoulder-elbow: ~0 arm along the torso, 180 arm in line overhead.
ANGLE_NAMES = ['knee_l', 'knee_r', 'hip_l', 'hip_r', 'elbow_l', 'elbow_r', 'shoulder_l', 'shoulder_r']

# Person selection. Distances are fractions of image width; torso center is the
# mean of both shoulders and both hips.
# num_poses stays 1: MediaPipe skips its person detector on the next frame only
# while it tracks num_poses people, so asking for more makes it re-detect every
# frame, and the detector favors upright bystanders over an inverted athlete.
LOCK_RADIUS = 0.25       # to lock on (start, or re-lock), torso must be this close to image center
MAX_JUMP = 0.15          # once locked, reject any pose whose torso moved more than this since last kept
RELOCK_AFTER = 3         # this many rejected frames in a row -> drop the lock, re-lock via image center

# poses   = 1 if MediaPipe returned a person, 0 if not
# jump_px = distance of the nearest candidate from the tracked position (or from
#           image center when not locked). Landmarks are empty when it was rejected.
CSV_HEADER = ('frame,file,time_s,poses,jump_px,' + ','.join(ANGLE_NAMES) + ',' +
              ','.join(f'{n}_x,{n}_y,{n}_v' for n in LANDMARK_NAMES) + '\n')
EMPTY_COLUMNS = ','*(len(ANGLE_NAMES) + 3*len(LANDMARK_NAMES))

def angleDeg(a, b, c):
    # Angle at b. Points are (x_px, y_px, visibility).
    ax = a[0] - b[0]
    ay = a[1] - b[1]
    cx = c[0] - b[0]
    cy = c[1] - b[1]
    dot = ax*cx + ay*cy
    norm = math.hypot(ax, ay)*math.hypot(cx, cy)
    return math.degrees(math.acos(max(-1.0, min(1.0, dot/norm))))

def makeLandmarker(model_path, use_gpu):
    delegate = mp.tasks.BaseOptions.Delegate.CPU
    if use_gpu:
        delegate = mp.tasks.BaseOptions.Delegate.GPU
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=model_path, delegate=delegate),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1)
    return mp.tasks.vision.PoseLandmarker.create_from_options(options)

def detectFrame(landmarker, frame_bgr, frame_index, fps, width, height, rotate_180):
    # Returns every detected pose as a list of 33 (x_px, y_px, visibility), in the
    # original (unrotated) frame's pixels.
    # Frame-count time keeps timestamps strictly increasing, which VIDEO mode requires.
    time_ms = int(round(frame_index*1000.0/fps))
    if rotate_180:
        frame_bgr = cv2.rotate(frame_bgr, cv2.ROTATE_180)
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
    result = landmarker.detect_for_video(image, time_ms)
    poses = []
    for pose in result.pose_landmarks:
        if rotate_180:
            poses.append([(width - l.x*width, height - l.y*height, l.visibility) for l in pose])
        else:
            poses.append([(l.x*width, l.y*height, l.visibility) for l in pose])
    return time_ms, poses

def processImageChunk(job):
    # One landmarker per process. VIDEO mode tracks from frame to frame, so each
    # chunk is contiguous; only its first frame runs a full detection.
    paths, first_frame_index, model_path, use_gpu, rotate_180, fps, width, height = job
    landmarker = makeLandmarker(model_path, use_gpu)
    frames = []
    for i in range(len(paths)):
        frame_bgr = cv2.imread(paths[i])
        assert frame_bgr is not None, f'cannot read {paths[i]}'
        # basename, not split on '/': on Windows glob joins the matched name with
        # '\', giving 'C:/q/.../hspu\20261030_211638.jpg'.
        frame_name = os.path.basename(paths[i])
        time_ms, poses = detectFrame(landmarker, frame_bgr, first_frame_index + i, fps, width, height, rotate_180)
        frames.append((first_frame_index + i, frame_name, time_ms, poses))
    landmarker.close()
    return frames

def pickPerson(tracker, poses, width, height):
    # Returns (pose or None, distance of nearest candidate). Updates tracker.
    if not poses:
        # Keep the lock: the same person is picked up again after a dropout.
        return None, None

    locked = tracker['center'] is not None
    target_x = width/2
    target_y = height/2
    limit = LOCK_RADIUS*width
    if locked:
        target_x, target_y = tracker['center']
        limit = MAX_JUMP*width

    best = None
    best_center = None
    best_distance = 0.0
    for pose in poses:
        center_x = (pose[L_SHOULDER][0] + pose[R_SHOULDER][0] + pose[L_HIP][0] + pose[R_HIP][0])/4
        center_y = (pose[L_SHOULDER][1] + pose[R_SHOULDER][1] + pose[L_HIP][1] + pose[R_HIP][1])/4
        distance = math.hypot(center_x - target_x, center_y - target_y)
        if best is None or distance < best_distance:
            best = pose
            best_center = (center_x, center_y)
            best_distance = distance

    if best_distance <= limit:
        tracker['center'] = best_center
        tracker['rejected_run'] = 0
        return best, best_distance

    tracker['rejected_run'] += 1
    if tracker['rejected_run'] >= RELOCK_AFTER:
        tracker['center'] = None
        tracker['rejected_run'] = 0
    return None, best_distance

if __name__ == '__main__':
    input_path = sys.argv[1]
    model_path = sys.argv[2]
    out_dir = sys.argv[3]

    # .../<date>/<movement>/<file or glob> -> <date>-<movement>.csv
    input_dir = os.path.dirname(os.path.abspath(input_path))
    movement = os.path.basename(input_dir)
    date = os.path.basename(os.path.dirname(input_dir))
    assert len(date) == 8 and date.isdigit(), f'expected .../<YYYYMMDD>/<movement>/, got date dir {date!r} in {input_dir}'
    assert os.path.isdir(out_dir), f'output dir {out_dir} does not exist'
    out_path = os.path.join(out_dir, f'{date}-{movement}.csv')

    rotation = '0'
    if len(sys.argv) > 7:
        rotation = sys.argv[7]
    assert rotation in ('0', '180'), f'rotation must be 0 or 180, got {rotation}'
    rotate_180 = rotation == '180'

    # frames: list of (frame_index, frame_name, time_ms, poses), in order.
    frames = []
    if '*' in input_path or '?' in input_path:
        frame_paths = sorted(glob.glob(input_path))
        assert frame_paths, f'no files match {input_path}'
        assert len(sys.argv) > 4, 'image frames need a frame rate as the 4th argument'
        fps = float(sys.argv[4])
        device = 'cpu'
        if len(sys.argv) > 6:
            device = sys.argv[6]
        assert device in ('cpu', 'gpu'), f'device must be cpu or gpu, got {device}'
        use_gpu = device == 'gpu'
        first = cv2.imread(frame_paths[0])
        height, width = first.shape[:2]

        worker_count = os.cpu_count()
        if use_gpu:
            worker_count = 1
        if len(sys.argv) > 5 and sys.argv[5] != 'auto':
            worker_count = int(sys.argv[5])
        worker_count = max(1, min(worker_count, len(frame_paths)))
        print(f'{len(frame_paths)} frames: {frame_paths[0]} .. {frame_paths[-1]}')
        print(f'{width}x{height} @ {fps:.2f} fps, {"GPU" if use_gpu else "CPU"}, {worker_count} workers, rotate {rotation}')

        jobs = []
        chunk_size = (len(frame_paths) + worker_count - 1)//worker_count
        for start in range(0, len(frame_paths), chunk_size):
            jobs.append((frame_paths[start:start + chunk_size], start, model_path, use_gpu, rotate_180, fps, width, height))

        # spawn: each worker builds its own MediaPipe graph instead of inheriting
        # a forked copy of the parent's threads.
        context = multiprocessing.get_context('spawn')
        pool = context.Pool(worker_count)
        results = pool.map(processImageChunk, jobs)
        pool.close()
        pool.join()
        for chunk_frames in results:
            frames += chunk_frames
    else:
        capture = cv2.VideoCapture(input_path)
        assert capture.isOpened(), f'cannot open {input_path}'
        fps = capture.get(cv2.CAP_PROP_FPS)
        if len(sys.argv) > 4:
            fps = float(sys.argv[4])
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        device = 'cpu'
        if len(sys.argv) > 6:
            device = sys.argv[6]
        assert device in ('cpu', 'gpu'), f'device must be cpu or gpu, got {device}'
        use_gpu = device == 'gpu'
        print(f'{input_path}: {width}x{height} @ {fps:.2f} fps, {"GPU" if use_gpu else "CPU"}, 1 worker, rotate {rotation}')

        landmarker = makeLandmarker(model_path, use_gpu)
        frame_index = 0
        while True:
            ok, frame_bgr = capture.read()
            if not ok:
                break
            time_ms, poses = detectFrame(landmarker, frame_bgr, frame_index, fps, width, height, rotate_180)
            frames.append((frame_index, '', time_ms, poses))
            frame_index += 1
        landmarker.close()

    # One sequential pass over the whole sequence, so tracking never restarts at
    # a chunk boundary.
    out = open(out_path, 'w')
    out.write(CSV_HEADER)
    tracker = {'center': None, 'rejected_run': 0}
    missed = 0
    rejected = 0
    for frame_index, frame_name, time_ms, poses in frames:
        p, distance = pickPerson(tracker, poses, width, height)
        row = f'{frame_index},{frame_name},{time_ms/1000.0:.3f},{len(poses)},'
        if distance is not None:
            row += f'{distance:.0f}'
        if p is None:
            if poses:
                rejected += 1
            else:
                missed += 1
            out.write(row + EMPTY_COLUMNS + '\n')
            continue

        angles = [
            angleDeg(p[L_HIP], p[L_KNEE], p[L_ANKLE]),
            angleDeg(p[R_HIP], p[R_KNEE], p[R_ANKLE]),
            angleDeg(p[L_SHOULDER], p[L_HIP], p[L_KNEE]),
            angleDeg(p[R_SHOULDER], p[R_HIP], p[R_KNEE]),
            angleDeg(p[L_SHOULDER], p[L_ELBOW], p[L_WRIST]),
            angleDeg(p[R_SHOULDER], p[R_ELBOW], p[R_WRIST]),
            angleDeg(p[L_HIP], p[L_SHOULDER], p[L_ELBOW]),
            angleDeg(p[R_HIP], p[R_SHOULDER], p[R_ELBOW]),
        ]
        row += ',' + ','.join(f'{a:.1f}' for a in angles)
        for i in range(33):
            row += f',{p[i][0]:.1f},{p[i][1]:.1f},{p[i][2]:.2f}'
        out.write(row + '\n')
    out.close()
    print(f'{len(frames)} frames, {missed} with no pose, {rejected} rejected as a different person -> {out_path}')
