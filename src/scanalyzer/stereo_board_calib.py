# Usage:
#   python3 stereo_board_calib.py CALIB_A.yml CALIB_B.yml SQUARE_MM OUT.yml A1.png B1.png [A2.png B2.png ...]
#     SQUARE_MM is one size, or 'x,y' when the board's squares are not square (e.g. a
#     tablet display scaled slightly differently along its two axes); x runs along the
#     board's 9-square side, y along its 6-square side.
#
# Extrinsic stereo calibration from simultaneous image pairs of the pose_calib
# ChArUco board (9x6 squares, legacy pattern, DICT_4X4_50, marker/square = 182/280).
# Each camera's intrinsics come from its own pose_calib yml and are held fixed;
# only the rotation R and translation T from camera A to camera B are solved
# (cv2.stereoCalibrate with CALIB_FIX_INTRINSIC), in millimetres via SQUARE_MM.
#
# Cross-check: each pair is also solved on its own (solvePnP in each camera,
# then the relative pose), so the per-pair spread shows how consistent it is.
import sys
import math
import numpy as np
import cv2

BOARD_X = 9
BOARD_Y = 6
MARKER_RATIO = 182/280
DICTIONARY = 0
MIN_COMMON = 15         # corners seen by both cameras for a pair to count; near-frontal boards
                        #   with fewer can flip to the wrong IPPE pose and drag the solve


def loadCalib(path):
    fs = cv2.FileStorage(path, cv2.FILE_STORAGE_READ)
    if not fs.isOpened():
        print(f'cannot read calibration {path}')
        sys.exit(1)
    K = fs.getNode('camera_matrix').mat()
    dist = fs.getNode('distortion_coefficients').mat().ravel()
    size = (int(fs.getNode('image_width').real()), int(fs.getNode('image_height').real()))
    return K, dist, size


def detectCorners(detector, path, expected_size):
    gray = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    size = (gray.shape[1], gray.shape[0])
    if size != expected_size:
        print(f'{path} is {size[0]}x{size[1]}, calibration expects {expected_size[0]}x{expected_size[1]}')
        sys.exit(1)
    corners, ids, unused_marker_corners, unused_marker_ids = detector.detectBoard(gray)
    if ids is None:
        return {}
    found = {}
    flat_ids = ids.ravel()
    flat_corners = corners.reshape(-1, 2)
    for k in range(len(flat_ids)):
        found[int(flat_ids[k])] = flat_corners[k]
    return found


def rotationAngle(R):
    return math.degrees(math.acos(max(-1.0, min(1.0, (np.trace(R) - 1)/2))))


if len(sys.argv) < 7 or (len(sys.argv) - 5)%2 != 0:
    print('usage: python3 stereo_board_calib.py CALIB_A.yml CALIB_B.yml SQUARE_MM OUT.yml A1.png B1.png [A2.png B2.png ...]')
    sys.exit(1)
Ka, dist_a, size_a = loadCalib(sys.argv[1])
Kb, dist_b, size_b = loadCalib(sys.argv[2])
square_parts = sys.argv[3].split(',')
square_mm = float(square_parts[0])
square_y_mm = square_mm
if len(square_parts) > 1:
    square_y_mm = float(square_parts[1])
out_path = sys.argv[4]
image_paths = sys.argv[5:]

dictionary = cv2.aruco.getPredefinedDictionary(DICTIONARY)
board = cv2.aruco.CharucoBoard((BOARD_X, BOARD_Y), square_mm, square_mm*MARKER_RATIO, dictionary)
board.setLegacyPattern(True)
detector = cv2.aruco.CharucoDetector(board)
board_points = board.getChessboardCorners().copy()
board_points[:, 1] *= square_y_mm/square_mm

object_sets = []
image_sets_a = []
image_sets_b = []
pair_rows = []
for p in range(0, len(image_paths), 2):
    path_a = image_paths[p]
    path_b = image_paths[p + 1]
    found_a = detectCorners(detector, path_a, size_a)
    found_b = detectCorners(detector, path_b, size_b)
    common = []
    for corner_id in sorted(found_a.keys()):
        if corner_id in found_b:
            common.append(corner_id)
    name = f'{path_a.split("/")[-1]} + {path_b.split("/")[-1]}'
    if len(common) < MIN_COMMON:
        print(f'skip {name}: only {len(common)} corners in both')
        continue
    obj = np.float32([board_points[c] for c in common]).reshape(-1, 1, 3)
    img_a = np.float32([found_a[c] for c in common]).reshape(-1, 1, 2)
    img_b = np.float32([found_b[c] for c in common]).reshape(-1, 1, 2)
    object_sets.append(obj)
    image_sets_a.append(img_a)
    image_sets_b.append(img_b)

    # this pair on its own: board pose in each camera, then B relative to A
    unused_ok_a, rvec_a, tvec_a = cv2.solvePnP(obj, img_a, Ka, dist_a, flags=cv2.SOLVEPNP_IPPE)
    unused_ok_b, rvec_b, tvec_b = cv2.solvePnP(obj, img_b, Kb, dist_b, flags=cv2.SOLVEPNP_IPPE)
    R_a = cv2.Rodrigues(rvec_a)[0]
    R_b = cv2.Rodrigues(rvec_b)[0]
    R_ab = R_b @ R_a.T
    t_ab = tvec_b.ravel() - R_ab @ tvec_a.ravel()
    board_dist_a = np.linalg.norm(tvec_a)
    board_dist_b = np.linalg.norm(tvec_b)
    pair_rows.append((rotationAngle(R_ab), np.linalg.norm(t_ab)))
    print(f'{name}: {len(common):2d} common corners, board at {board_dist_a:.0f} / {board_dist_b:.0f} mm, rotation {rotationAngle(R_ab):5.2f} deg, baseline {np.linalg.norm(t_ab):6.1f} mm')

if len(object_sets) == 0:
    print('no usable pairs')
    sys.exit(1)

criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 200, 1e-9)
rms, unused_ka, unused_da, unused_kb, unused_db, R, T, E, F = cv2.stereoCalibrate(
    object_sets, image_sets_a, image_sets_b, Ka, dist_a, Kb, dist_b, size_a,
    flags=cv2.CALIB_FIX_INTRINSIC, criteria=criteria)
pair_rows = np.array(pair_rows)
baseline = np.linalg.norm(T)
print(f'stereoCalibrate over {len(object_sets)} pairs: RMS {rms:.3f} px')
print(f'rotation A->B    {rotationAngle(R):.2f} deg   (per-pair {pair_rows[:, 0].min():.2f}..{pair_rows[:, 0].max():.2f})')
print(f'baseline         {baseline:.1f} mm   (per-pair {pair_rows[:, 1].min():.1f}..{pair_rows[:, 1].max():.1f})')
print(f'T (mm, in A)     {T[0, 0]:+.1f} {T[1, 0]:+.1f} {T[2, 0]:+.1f}   B centre in A frame: {(-R.T @ T).ravel().round(1)}')

fs = cv2.FileStorage(out_path, cv2.FILE_STORAGE_WRITE)
fs.write('calib_a', sys.argv[1])
fs.write('calib_b', sys.argv[2])
fs.write('square_mm', square_mm)
fs.write('square_y_mm', square_y_mm)
fs.write('pairs', len(object_sets))
fs.write('rms', rms)
fs.write('R', R)
fs.write('T', T)
fs.write('E', E)
fs.write('F', F)
fs.release()
print(f'wrote            {out_path}')
