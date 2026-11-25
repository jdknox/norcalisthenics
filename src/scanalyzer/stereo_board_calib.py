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
    fisheye_node = fs.getNode('fisheye_model')
    fisheye = False if fisheye_node.empty() else bool(int(fisheye_node.real()))
    return K, dist, size, fisheye


def solveBoardPose(obj, img, K, dist, fisheye):
    if fisheye:
        und = cv2.fisheye.undistortPoints(img.reshape(-1, 1, 2).astype(np.float64), K, dist)
        unused_ok, rvec, tvec = cv2.solvePnP(obj, und, np.eye(3), None, flags=cv2.SOLVEPNP_IPPE)
    else:
        unused_ok, rvec, tvec = cv2.solvePnP(obj, img, K, dist, flags=cv2.SOLVEPNP_IPPE)
    return rvec, tvec


def buildFisheyeRectify(K, dist, size):
    # ArUco's marker decode assumes near-straight quad edges and fails on raw
    # fisheye frames (confirmed: candidates get found but rejected at the bit
    # stage). Detect on a rectified virtual-pinhole view instead; everything
    # downstream then treats this camera as zero-distortion pinhole at Knew.
    Knew = cv2.fisheye.estimateNewCameraMatrixForUndistortRectify(K, dist, size, np.eye(3), balance=1.0)
    maps = cv2.fisheye.initUndistortRectifyMap(K, dist, np.eye(3), Knew, size, cv2.CV_16SC2)
    return Knew, maps


def detectCorners(detector, path, expected_size, rectify_maps=None):
    gray = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    size = (gray.shape[1], gray.shape[0])
    if size != expected_size:
        print(f'{path} is {size[0]}x{size[1]}, calibration expects {expected_size[0]}x{expected_size[1]}')
        sys.exit(1)
    if rectify_maps is not None:
        gray = cv2.remap(gray, rectify_maps[0], rectify_maps[1], cv2.INTER_LINEAR)
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


def meanRotation(rotations):
    # chordal L2 / Procrustes mean: the rotation matrix closest (in Frobenius
    # norm) to the average of the inputs, found by projecting that average
    # onto SO(3) via its SVD
    u, unused_s, vt = np.linalg.svd(sum(rotations))
    R = u @ vt
    if np.linalg.det(R) < 0:
        u[:, -1] *= -1
        R = u @ vt
    return R


if len(sys.argv) < 7 or (len(sys.argv) - 5)%2 != 0:
    print('usage: python3 stereo_board_calib.py CALIB_A.yml CALIB_B.yml SQUARE_MM OUT.yml A1.png B1.png [A2.png B2.png ...]')
    sys.exit(1)
Ka, dist_a, size_a, fisheye_a = loadCalib(sys.argv[1])
Kb, dist_b, size_b, fisheye_b = loadCalib(sys.argv[2])

# rectify any fisheye camera to a virtual pinhole view before detection (see
# buildFisheyeRectify); from here on it's zero-distortion pinhole at Knew, so
# a mixed pinhole/fisheye pair becomes an ordinary pinhole pair and gets the
# full joint stereoCalibrate refinement instead of a per-pair-average fallback
rectify_a = None
if fisheye_a:
    Ka, rectify_a = buildFisheyeRectify(Ka, dist_a, size_a)
    dist_a = np.zeros(5)
    fisheye_a = False
rectify_b = None
if fisheye_b:
    Kb, rectify_b = buildFisheyeRectify(Kb, dist_b, size_b)
    dist_b = np.zeros(5)
    fisheye_b = False

# kept for the (now unreachable unless rectification is skipped) fisheye
# stereoCalibrate/averaging branches further down
mixed_model = fisheye_a != fisheye_b
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
pair_R = []
pair_t = []
for p in range(0, len(image_paths), 2):
    path_a = image_paths[p]
    path_b = image_paths[p + 1]
    found_a = detectCorners(detector, path_a, size_a, rectify_a)
    found_b = detectCorners(detector, path_b, size_b, rectify_b)
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
    rvec_a, tvec_a = solveBoardPose(obj, img_a, Ka, dist_a, fisheye_a)
    rvec_b, tvec_b = solveBoardPose(obj, img_b, Kb, dist_b, fisheye_b)
    R_a = cv2.Rodrigues(rvec_a)[0]
    R_b = cv2.Rodrigues(rvec_b)[0]
    R_ab = R_b @ R_a.T
    t_ab = tvec_b.ravel() - R_ab @ tvec_a.ravel()
    board_dist_a = np.linalg.norm(tvec_a)
    board_dist_b = np.linalg.norm(tvec_b)
    pair_rows.append((rotationAngle(R_ab), np.linalg.norm(t_ab)))
    pair_R.append(R_ab)
    pair_t.append(t_ab)
    print(f'{name}: {len(common):2d} common corners, board at {board_dist_a:.0f} / {board_dist_b:.0f} mm, rotation {rotationAngle(R_ab):5.2f} deg, baseline {np.linalg.norm(t_ab):6.1f} mm')

if len(object_sets) == 0:
    print('no usable pairs')
    sys.exit(1)

criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 200, 1e-9)
pair_rows = np.array(pair_rows)
E = None
F = None

if mixed_model:
    # no joint bundle refinement available for a mixed pair (see note above);
    # fall back to averaging the independent per-pair cross-check poses
    R = meanRotation(pair_R)
    T = np.mean(pair_t, axis=0).reshape(3, 1)
    rms = float('nan')
    angle_dev = [rotationAngle(R.T @ Ri) for Ri in pair_R]
    t_dev = [np.linalg.norm(ti - T.ravel()) for ti in pair_t]
    print(f'averaged {len(pair_R)} per-pair poses (mixed pinhole/fisheye, no joint refinement): '
          f'rotation dev from mean {max(angle_dev):.2f} deg max, baseline dev {max(t_dev):.1f} mm max')
elif fisheye_a:
    # fisheye.stereoCalibrate wants (1,N,3)/(1,N,2) float64 per-view arrays and
    # has no E/F output (those are undefined for a non-pinhole model anyway)
    object_sets_f = [o.reshape(1, -1, 3).astype(np.float64) for o in object_sets]
    image_sets_a_f = [p.reshape(1, -1, 2).astype(np.float64) for p in image_sets_a]
    image_sets_b_f = [p.reshape(1, -1, 2).astype(np.float64) for p in image_sets_b]
    rms, unused_ka, unused_da, unused_kb, unused_db, R, T = cv2.fisheye.stereoCalibrate(
        object_sets_f, image_sets_a_f, image_sets_b_f, Ka, dist_a, Kb, dist_b, size_a,
        flags=cv2.fisheye.CALIB_FIX_INTRINSIC, criteria=criteria)
else:
    rms, unused_ka, unused_da, unused_kb, unused_db, R, T, E, F = cv2.stereoCalibrate(
        object_sets, image_sets_a, image_sets_b, Ka, dist_a, Kb, dist_b, size_a,
        flags=cv2.CALIB_FIX_INTRINSIC, criteria=criteria)

baseline = np.linalg.norm(T)
print(f'calibration over {len(object_sets)} pairs: RMS {rms:.3f} px')
print(f'rotation A->B    {rotationAngle(R):.2f} deg   (per-pair {pair_rows[:, 0].min():.2f}..{pair_rows[:, 0].max():.2f})')
print(f'baseline         {baseline:.1f} mm   (per-pair {pair_rows[:, 1].min():.1f}..{pair_rows[:, 1].max():.1f})')
print(f'T (mm, in A)     {T[0, 0]:+.1f} {T[1, 0]:+.1f} {T[2, 0]:+.1f}   B centre in A frame: {(-R.T @ T).ravel().round(1)}')

fs = cv2.FileStorage(out_path, cv2.FILE_STORAGE_WRITE)
fs.write('calib_a', sys.argv[1])
fs.write('calib_b', sys.argv[2])
fs.write('square_mm', square_mm)
fs.write('square_y_mm', square_y_mm)
fs.write('pairs', len(object_sets))
fs.write('fisheye_a', 1 if fisheye_a else 0)
fs.write('fisheye_b', 1 if fisheye_b else 0)
fs.write('method', 'averaged_pairs' if mixed_model else 'joint_bundle')
fs.write('rms', rms)
fs.write('R', R)
fs.write('T', T)
if E is not None:
    fs.write('E', E)
    fs.write('F', F)
fs.release()
print(f'wrote            {out_path}')
