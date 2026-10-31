# Usage:
#   python3 pose_to_csv.py squat.mp4 pose_landmarker_heavy.task out.csv
#   python3 pose_to_csv.py '/path/to/frames/*.jpg' pose_landmarker_heavy.task out.csv 30 [workers]
# Input is a video file, or a quoted glob of image frames plus their frame rate.
# Frames are read in sorted filename order, so gaps in the numbering don't matter.
# Image frames are split into contiguous chunks, one process per chunk; workers
# defaults to the CPU count. Video files run in one process.
# Side-on video in, one CSV row per frame out: time, knee/hip angles, key landmarks.
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
L_HIP, R_HIP = 23, 24
L_KNEE, R_KNEE = 25, 26
L_ANKLE, R_ANKLE = 27, 28
L_HEEL, R_HEEL = 29, 30

CSV_HEADER = ('frame,file,time_s,knee_l,knee_r,hip_l,hip_r,'
              'hip_l_y,hip_r_y,heel_l_y,heel_r_y,vis_knee_l,vis_knee_r\n')

def angleDeg(a, b, c, width, height):
    # Angle at b, in pixels so the image aspect ratio doesn't skew it.
    # 180 = straight joint, smaller = more flexed.
    ax = (a.x - b.x)*width
    ay = (a.y - b.y)*height
    cx = (c.x - b.x)*width
    cy = (c.y - b.y)*height
    dot = ax*cx + ay*cy
    norm = math.hypot(ax, ay)*math.hypot(cx, cy)
    return math.degrees(math.acos(max(-1.0, min(1.0, dot/norm))))

def poseRow(landmarker, frame_bgr, frame_index, frame_name, fps, width, height):
    # Frame-count time keeps timestamps strictly increasing, which VIDEO mode requires.
    time_ms = int(round(frame_index*1000.0/fps))
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
    result = landmarker.detect_for_video(image, time_ms)

    if not result.pose_landmarks:
        return f'{frame_index},{frame_name},{time_ms/1000.0:.3f},,,,,,,,,,\n', False

    p = result.pose_landmarks[0]
    knee_l = angleDeg(p[L_HIP], p[L_KNEE], p[L_ANKLE], width, height)
    knee_r = angleDeg(p[R_HIP], p[R_KNEE], p[R_ANKLE], width, height)
    hip_l = angleDeg(p[L_SHOULDER], p[L_HIP], p[L_KNEE], width, height)
    hip_r = angleDeg(p[R_SHOULDER], p[R_HIP], p[R_KNEE], width, height)
    # y is image-down in pixels; hip_y rising means going deeper.
    row = (f'{frame_index},{frame_name},{time_ms/1000.0:.3f},'
           f'{knee_l:.1f},{knee_r:.1f},{hip_l:.1f},{hip_r:.1f},'
           f'{p[L_HIP].y*height:.1f},{p[R_HIP].y*height:.1f},'
           f'{p[L_HEEL].y*height:.1f},{p[R_HEEL].y*height:.1f},'
           f'{p[L_KNEE].visibility:.2f},{p[R_KNEE].visibility:.2f}\n')
    return row, True

def makeLandmarker(model_path):
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=model_path),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1)
    return mp.tasks.vision.PoseLandmarker.create_from_options(options)

def processImageChunk(job):
    # One landmarker per process. VIDEO mode tracks from frame to frame, so each
    # chunk is contiguous; only its first frame runs a full detection.
    paths, first_frame_index, model_path, fps, width, height = job
    landmarker = makeLandmarker(model_path)
    rows = []
    missed = 0
    for i in range(len(paths)):
        frame_bgr = cv2.imread(paths[i])
        assert frame_bgr is not None, f'cannot read {paths[i]}'
        frame_name = paths[i].rsplit('/', 1)[-1]
        row, found = poseRow(landmarker, frame_bgr, first_frame_index + i, frame_name, fps, width, height)
        rows.append(row)
        if not found:
            missed += 1
    landmarker.close()
    return rows, missed

if __name__ == '__main__':
    input_path = sys.argv[1]
    model_path = sys.argv[2]
    out_path = sys.argv[3]

    out = open(out_path, 'w')
    out.write(CSV_HEADER)

    if '*' in input_path or '?' in input_path:
        frame_paths = sorted(glob.glob(input_path))
        assert frame_paths, f'no files match {input_path}'
        assert len(sys.argv) > 4, 'image frames need a frame rate as the 4th argument'
        fps = float(sys.argv[4])
        worker_count = os.cpu_count()
        if len(sys.argv) > 5:
            worker_count = int(sys.argv[5])
        worker_count = max(1, min(worker_count, len(frame_paths)))
        first = cv2.imread(frame_paths[0])
        height, width = first.shape[:2]
        print(f'{len(frame_paths)} frames: {frame_paths[0]} .. {frame_paths[-1]}')
        print(f'{width}x{height} @ {fps:.2f} fps, {worker_count} workers')

        jobs = []
        chunk_size = (len(frame_paths) + worker_count - 1)//worker_count
        for start in range(0, len(frame_paths), chunk_size):
            jobs.append((frame_paths[start:start + chunk_size], start, model_path, fps, width, height))

        # spawn: each worker builds its own MediaPipe graph instead of inheriting
        # a forked copy of the parent's threads.
        context = multiprocessing.get_context('spawn')
        pool = context.Pool(worker_count)
        results = pool.map(processImageChunk, jobs)
        pool.close()
        pool.join()

        frame_count = 0
        missed = 0
        for rows, chunk_missed in results:
            out.writelines(rows)
            frame_count += len(rows)
            missed += chunk_missed
    else:
        capture = cv2.VideoCapture(input_path)
        assert capture.isOpened(), f'cannot open {input_path}'
        fps = capture.get(cv2.CAP_PROP_FPS)
        if len(sys.argv) > 4:
            fps = float(sys.argv[4])
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f'{input_path}: {width}x{height} @ {fps:.2f} fps, 1 worker')

        landmarker = makeLandmarker(model_path)
        frame_count = 0
        missed = 0
        while True:
            ok, frame_bgr = capture.read()
            if not ok:
                break
            row, found = poseRow(landmarker, frame_bgr, frame_count, '', fps, width, height)
            out.write(row)
            if not found:
                missed += 1
            frame_count += 1
        landmarker.close()

    out.close()
    print(f'{frame_count} frames, {missed} with no pose -> {out_path}')
