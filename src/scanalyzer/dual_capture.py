# Usage:
#   python3 dual_capture.py OUT_DIR [CALIB_A.yml CALIB_B.yml [CAM_A_INDEX CAM_A_W CAM_A_H CAM_B_INDEX CAM_B_W CAM_B_H]]
#     defaults: camera A = mac FaceTime (index 1, 1280x720, matching calib_mac_facetime.yml),
#               camera B = OV9281 fisheye (index 0, 1280x800, matching calib_ov9281.yml)
#
# Live side-by-side preview of two simultaneously-opened cameras, for gathering
# the image pairs stereo_board_calib.py needs. Hold the ChArUco board where both
# cameras can see it; each capture reads A and B back-to-back (not hardware
# synced), so keep the board still while capturing, same as any single pair
# stereo_board_calib.py expects.
#
# Keys: c or space = force-save a pair right now regardless of match status,
#       q or Esc = quit.
#
# Every frame shows live ChArUco corner counts for both cameras and the number
# of ids common to both (the number stereo_board_calib.py actually needs, see
# its MIN_COMMON) so a bad pose is obvious before you bother capturing it.
# Frame-to-frame detection is noisy even on a good pose (flickers true/false),
# so this doesn't wait on a keypress for the normal case: once matched holds
# for STEADY_FRAMES_REQUIRED straight frames it auto-saves, same idea as
# pose_calib's steady-frame gate. It then waits for a non-match frame (you
# moved to a new pose) before it can auto-save again.
#
# A fisheye camera's frame is rectified to a virtual-pinhole view before this
# detection check, exactly like stereo_board_calib.py does before its own
# detection pass (see buildFisheyeRectify there) -- otherwise "matched" here
# can disagree with what the actual calibration run sees.
import sys
import os

import cv2
import numpy as np

WARMUP_FRAMES = 20
BOARD_X = 9
BOARD_Y = 6
MARKER_RATIO = 182/280
DICTIONARY = 0
MIN_COMMON = 15   # must match stereo_board_calib.py's MIN_COMMON
STEADY_FRAMES_REQUIRED = 5   # consecutive matched frames before auto-capture
# at 1280x800 uncompressed YUY2 needs ~61 MB/s at 30fps, past USB 2.0's
# practical ceiling, so UVC cameras commonly fall back to an internal MJPG
# (DCT-block) encode at that rate; 10fps drops it to ~20 MB/s and stays
# uncompressed. OpenCV's AVFoundation backend can't report or select the
# pixel format directly (cv2.CAP_PROP_FOURCC set()/get() are both no-ops
# here), so FPS is the only lever available to avoid the compressed mode.
CAPTURE_FPS = 10
DEFAULT_CALIB_A = '/Users/knox/prj/tools/pose_calib/calib_mac_facetime.yml'
DEFAULT_CALIB_B = '/Users/knox/prj/tools/pose_calib/calib_ov9281.yml'


def loadCalib(path):
    fs = cv2.FileStorage(path, cv2.FILE_STORAGE_READ)
    if not fs.isOpened():
        print(f'cannot read calibration {path}')
        sys.exit(1)
    K = fs.getNode('camera_matrix').mat()
    dist = fs.getNode('distortion_coefficients').mat()
    fisheye_node = fs.getNode('fisheye_model')
    fisheye = False if fisheye_node.empty() else bool(int(fisheye_node.real()))
    size = (int(fs.getNode('image_width').real()), int(fs.getNode('image_height').real()))
    return K, dist, fisheye, size


def buildFisheyeRectify(K, dist, size):
    Knew = cv2.fisheye.estimateNewCameraMatrixForUndistortRectify(K, dist, size, np.eye(3), balance=1.0)
    maps = cv2.fisheye.initUndistortRectifyMap(K, dist, np.eye(3), Knew, size, cv2.CV_16SC2)
    return maps


def openCamera(index, width, height):
    cap = cv2.VideoCapture(index, cv2.CAP_AVFOUNDATION)
    if not cap.isOpened():
        print(f'cannot open camera {index}')
        sys.exit(1)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, CAPTURE_FPS)
    for _ in range(WARMUP_FRAMES):
        ok, unused_frame = cap.read()
        if not ok:
            print(f'camera {index} warmup read failed')
            sys.exit(1)
    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    actual_fps = cap.get(cv2.CAP_PROP_FPS)
    if (actual_w, actual_h) != (width, height):
        print(f'camera {index} negotiated {actual_w}x{actual_h}, wanted {width}x{height}')
    if abs(actual_fps - CAPTURE_FPS) > 0.5:
        print(f'camera {index} negotiated {actual_fps:.1f} fps, wanted {CAPTURE_FPS}')
    return cap


def detectIds(detector, frame, rectify_maps=None):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame
    if rectify_maps is not None:
        gray = cv2.remap(gray, rectify_maps[0], rectify_maps[1], cv2.INTER_LINEAR)
    unused_corners, ids, unused_marker_corners, unused_marker_ids = detector.detectBoard(gray)
    return set() if ids is None else set(ids.ravel().tolist())


if len(sys.argv) not in (2, 4, 10):
    print('usage: python3 dual_capture.py OUT_DIR [CALIB_A.yml CALIB_B.yml [CAM_A_INDEX CAM_A_W CAM_A_H CAM_B_INDEX CAM_B_W CAM_B_H]]')
    sys.exit(1)

out_dir = sys.argv[1]
calib_path_a = sys.argv[2] if len(sys.argv) >= 4 else DEFAULT_CALIB_A
calib_path_b = sys.argv[3] if len(sys.argv) >= 4 else DEFAULT_CALIB_B
if len(sys.argv) == 10:
    idx_a, w_a, h_a, idx_b, w_b, h_b = (int(v) for v in sys.argv[4:10])
else:
    idx_a, w_a, h_a = 1, 1280, 720   # mac FaceTime
    idx_b, w_b, h_b = 0, 1280, 800   # OV9281 fisheye

os.makedirs(out_dir, exist_ok=True)

print(f'opening camera A (index {idx_a}, {w_a}x{h_a})...')
cap_a = openCamera(idx_a, w_a, h_a)
print(f'opening camera B (index {idx_b}, {w_b}x{h_b})...')
cap_b = openCamera(idx_b, w_b, h_b)

K_a, dist_a, fisheye_a, size_a = loadCalib(calib_path_a)
K_b, dist_b, fisheye_b, size_b = loadCalib(calib_path_b)
rectify_a = buildFisheyeRectify(K_a, dist_a, size_a) if fisheye_a else None
rectify_b = buildFisheyeRectify(K_b, dist_b, size_b) if fisheye_b else None
print(f'A ({calib_path_a}): fisheye={fisheye_a}   B ({calib_path_b}): fisheye={fisheye_b}')

dictionary = cv2.aruco.getPredefinedDictionary(DICTIONARY)
board = cv2.aruco.CharucoBoard((BOARD_X, BOARD_Y), 280.0, 280.0*MARKER_RATIO, dictionary)
board.setLegacyPattern(True)
detector = cv2.aruco.CharucoDetector(board)

window_name = 'dual_capture  [auto-saves when green holds; c/space: force-save, q/Esc: quit]'
cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

n_saved = 0
n_good = 0
# existing A_*.png files in out_dir, so re-running doesn't overwrite a prior session
existing = [f for f in os.listdir(out_dir) if f.startswith('A_') and f.endswith('.png')]
if existing:
    n_saved = max(int(f[2:-4]) for f in existing) + 1
    print(f'{len(existing)} pair(s) already in {out_dir}, continuing from A_{n_saved:02d}')


def savePair(frame_a, frame_b, matched, n_common, len_a, len_b, note):
    global n_saved, n_good
    path_a = f'{out_dir}/A_{n_saved:02d}.png'
    path_b = f'{out_dir}/B_{n_saved:02d}.png'
    cv2.imwrite(path_a, frame_a)
    cv2.imwrite(path_b, frame_b)
    verdict = 'OK' if matched else f'TOO FEW (need {MIN_COMMON})'
    print(f'saved {path_a}  {path_b}   A={len_a} B={len_b} common={n_common}  -> {verdict} ({note})')
    n_saved += 1
    if matched:
        n_good += 1


steady_count = 0
armed = True   # must see a non-match frame before the next auto-capture
while True:
    ok_a, frame_a = cap_a.read()
    ok_b, frame_b = cap_b.read()
    if not ok_a or not ok_b:
        print('camera read failed')
        break

    ids_a = detectIds(detector, frame_a, rectify_a)
    ids_b = detectIds(detector, frame_b, rectify_b)
    n_common = len(ids_a & ids_b)
    matched = n_common >= MIN_COMMON

    if matched:
        steady_count += 1
    else:
        steady_count = 0
        armed = True

    auto_capture = armed and steady_count >= STEADY_FRAMES_REQUIRED

    preview_h = max(frame_a.shape[0], frame_b.shape[0])
    scale_a = preview_h / frame_a.shape[0]
    scale_b = preview_h / frame_b.shape[0]
    disp_a = cv2.resize(frame_a, None, fx=scale_a, fy=scale_a)
    disp_b = cv2.resize(frame_b, None, fx=scale_b, fy=scale_b)
    preview = cv2.hconcat([disp_a, disp_b])
    cv2.putText(preview, f'pairs saved: {n_saved} ({n_good} matched)', (14, 36),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 2, cv2.LINE_AA)
    status_color = (0, 255, 0) if matched else (0, 0, 255)
    status_text = f'holding {min(steady_count, STEADY_FRAMES_REQUIRED)}/{STEADY_FRAMES_REQUIRED}' if matched else f'need {MIN_COMMON}'
    cv2.putText(preview, f'A corners: {len(ids_a)}   B corners: {len(ids_b)}   common: {n_common} [{status_text}]',
                (14, 76), cv2.FONT_HERSHEY_SIMPLEX, 1.0, status_color, 2, cv2.LINE_AA)
    cv2.imshow(window_name, preview)

    key = cv2.waitKeyEx(1) & 0xff
    if key == ord('q') or key == 27:
        break
    if auto_capture:
        savePair(frame_a, frame_b, matched, n_common, len(ids_a), len(ids_b), 'auto')
        armed = False
        steady_count = 0
    elif key == ord('c') or key == ord(' '):
        savePair(frame_a, frame_b, matched, n_common, len(ids_a), len(ids_b), 'forced')

cap_a.release()
cap_b.release()
cv2.destroyAllWindows()
print(f'{n_saved} pair(s) in {out_dir}, {n_good} matched (common >= {MIN_COMMON})')
# stereo_board_calib.py re-checks and skips any pair under MIN_COMMON itself, so
# it's fine to just hand it every pair saved here
print(f'next: python3 stereo_board_calib.py {calib_path_a} {calib_path_b} SQUARE_MM OUT.yml '
      + ' '.join(f'{out_dir}/A_{i:02d}.png {out_dir}/B_{i:02d}.png' for i in range(n_saved)))
