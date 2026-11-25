# Usage:
#   python3 stereo_calibrated.py CAM_A.png CALIB_A.yml CAM_B.png CALIB_B.yml OUT_PREFIX [ipd_mm]
#
# Calibrated two-camera check on one simultaneous frame pair. CALIB_*.yml are
# pose_calib outputs (camera_matrix + distortion_coefficients, OpenCV YAML).
#
# Overlap: SIFT features matched A->B with Lowe's ratio test, undistorted to
# normalized camera coordinates with each camera's own intrinsics, then a RANSAC
# essential matrix. Reports surviving matches, their epipolar error in pixels,
# and how much of each image the inliers cover.
#
# Distance: E gives the relative pose up to scale. The eye centres from RTMPose
# (COCO keypoints 1 and 2) are triangulated and the scale is set so the 3D eye
# distance equals ipd_mm, so every distance is proportional to that guess.
# A bootstrap over the inlier matches gives error bars for the pose and scale.
import sys
import math
import numpy as np
import cv2
import rtmlib

DEFAULT_IPD_MM = 64.0
RATIO = 0.75            # Lowe ratio test
RANSAC_PX = 1.0         # essential-matrix inlier threshold, px (converted to normalized units)
GRID = 8                # coverage grid, cells per side
MAX_LINES = 120         # match lines drawn in the output image
BOOTSTRAP = 200         # resamples of the inliers for error bars
COCO_LEFT_EYE = 1
COCO_RIGHT_EYE = 2


def loadCalib(path, image_size):
    fs = cv2.FileStorage(path, cv2.FILE_STORAGE_READ)
    if not fs.isOpened():
        print(f'cannot read calibration {path}')
        sys.exit(1)
    K = fs.getNode('camera_matrix').mat()
    dist = fs.getNode('distortion_coefficients').mat().ravel()
    calib_size = (int(fs.getNode('image_width').real()), int(fs.getNode('image_height').real()))
    if calib_size != image_size:
        print(f'{path} is for {calib_size[0]}x{calib_size[1]}, image is {image_size[0]}x{image_size[1]}')
        sys.exit(1)
    fisheye_node = fs.getNode('fisheye_model')
    fisheye = False if fisheye_node.empty() else bool(int(fisheye_node.real()))
    return K, dist, fisheye


def matchFeatures(gray_a, gray_b):
    sift = cv2.SIFT_create(nfeatures=8000)
    kp_a, desc_a = sift.detectAndCompute(gray_a, None)
    kp_b, desc_b = sift.detectAndCompute(gray_b, None)
    matcher = cv2.BFMatcher(cv2.NORM_L2)
    knn = matcher.knnMatch(desc_a, desc_b, k=2)
    pts_a = []
    pts_b = []
    for pair in knn:
        if len(pair) < 2:
            continue
        best = pair[0]
        second = pair[1]
        if best.distance < RATIO*second.distance:
            pts_a.append(kp_a[best.queryIdx].pt)
            pts_b.append(kp_b[best.trainIdx].pt)
    return len(kp_a), len(kp_b), np.float64(pts_a), np.float64(pts_b)


def normalize(pts, K, dist, fisheye):
    if fisheye:
        return cv2.fisheye.undistortPoints(pts.reshape(-1, 1, 2).astype(np.float64), K, dist).reshape(-1, 2)
    return cv2.undistortPoints(pts.reshape(-1, 1, 2), K, dist).reshape(-1, 2)


def sampsonNormalized(E, norm_a, norm_b):
    ones = np.ones((len(norm_a), 1))
    xa = np.hstack([norm_a, ones])
    xb = np.hstack([norm_b, ones])
    Exa = xa @ E.T
    Etxb = xb @ E
    numerator = np.sum(xb*Exa, axis=1)**2
    denominator = Exa[:, 0]**2 + Exa[:, 1]**2 + Etxb[:, 0]**2 + Etxb[:, 1]**2
    return np.sqrt(numerator/denominator)


def gridCoverage(pts, width, height):
    occupied = np.zeros((GRID, GRID), bool)
    for x, y in pts:
        col = min(GRID - 1, int(x*GRID/width))
        row = min(GRID - 1, int(y*GRID/height))
        occupied[row, col] = True
    return occupied.sum()/(GRID*GRID)


def triangulate(R, t, norm_a, norm_b):
    P_a = np.hstack([np.eye(3), np.zeros((3, 1))])
    P_b = np.hstack([R, t.reshape(3, 1)])
    homog = cv2.triangulatePoints(P_a, P_b, norm_a.T, norm_b.T)
    return (homog[:3]/homog[3]).T


def reprojectionPx(X, K, dist, R, t, pts, fisheye):
    rvec = cv2.Rodrigues(R)[0]
    if fisheye:
        projected, unused = cv2.fisheye.projectPoints(X.reshape(1, -1, 3).astype(np.float64), rvec, t, K, dist)
    else:
        projected, unused = cv2.projectPoints(X, rvec, t, K, dist)
    return np.linalg.norm(projected.reshape(-1, 2) - pts, axis=1)


def detectEyes(body, gray):
    bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    keypoints, scores = body(bgr)
    if len(keypoints) == 0:
        return None, None
    person = int(np.argmax(scores.mean(axis=1)))
    eyes = keypoints[person][[COCO_LEFT_EYE, COCO_RIGHT_EYE]].astype(np.float64)
    eye_scores = scores[person][[COCO_LEFT_EYE, COCO_RIGHT_EYE]]
    return eyes, eye_scores


def metricFromPose(R, t, eye_norm_a, eye_norm_b, ipd_mm):
    eye_X = triangulate(R, t, eye_norm_a, eye_norm_b)
    mm_per_unit = ipd_mm/np.linalg.norm(eye_X[0] - eye_X[1])
    mid = (eye_X[0] + eye_X[1])/2
    dist_a = np.linalg.norm(mid)*mm_per_unit
    dist_b = np.linalg.norm(R @ mid + t.ravel())*mm_per_unit
    return mm_per_unit, dist_a, dist_b


def drawPair(gray_a, gray_b, pts_a, pts_b, eyes_a, eyes_b, path):
    height = max(gray_a.shape[0], gray_b.shape[0])
    canvas = np.zeros((height, gray_a.shape[1] + gray_b.shape[1], 3), np.uint8)
    canvas[:gray_a.shape[0], :gray_a.shape[1]] = cv2.cvtColor(gray_a, cv2.COLOR_GRAY2BGR)
    canvas[:gray_b.shape[0], gray_a.shape[1]:] = cv2.cvtColor(gray_b, cv2.COLOR_GRAY2BGR)
    offset = gray_a.shape[1]
    rng = np.random.default_rng(0)
    picks = rng.permutation(len(pts_a))[:MAX_LINES]
    for k in picks:
        color = tuple(int(c) for c in rng.integers(64, 256, 3))
        a = (int(pts_a[k][0]), int(pts_a[k][1]))
        b = (int(pts_b[k][0]) + offset, int(pts_b[k][1]))
        cv2.line(canvas, a, b, color, 1, cv2.LINE_AA)
        cv2.circle(canvas, a, 3, color, -1, cv2.LINE_AA)
        cv2.circle(canvas, b, 3, color, -1, cv2.LINE_AA)
    if eyes_a is not None and eyes_b is not None:
        for k in range(2):
            a = (int(eyes_a[k][0]), int(eyes_a[k][1]))
            b = (int(eyes_b[k][0]) + offset, int(eyes_b[k][1]))
            cv2.circle(canvas, a, 8, (0, 0, 255), 2, cv2.LINE_AA)
            cv2.circle(canvas, b, 8, (0, 0, 255), 2, cv2.LINE_AA)
    cv2.imwrite(path, canvas)


if len(sys.argv) < 6:
    print('usage: python3 stereo_calibrated.py CAM_A.png CALIB_A.yml CAM_B.png CALIB_B.yml OUT_PREFIX [ipd_mm]')
    sys.exit(1)
path_a = sys.argv[1]
calib_path_a = sys.argv[2]
path_b = sys.argv[3]
calib_path_b = sys.argv[4]
out_prefix = sys.argv[5]
ipd_mm = DEFAULT_IPD_MM
if len(sys.argv) > 6:
    ipd_mm = float(sys.argv[6])

gray_a = cv2.imread(path_a, cv2.IMREAD_GRAYSCALE)
gray_b = cv2.imread(path_b, cv2.IMREAD_GRAYSCALE)
size_a = (gray_a.shape[1], gray_a.shape[0])
size_b = (gray_b.shape[1], gray_b.shape[0])
Ka, dist_a, fisheye_a = loadCalib(calib_path_a, size_a)
Kb, dist_b, fisheye_b = loadCalib(calib_path_b, size_b)
mean_focal = (Ka[0, 0] + Ka[1, 1] + Kb[0, 0] + Kb[1, 1])/4
print(f'A {path_a} {size_a[0]}x{size_a[1]} f={Ka[0, 0]:.0f} fisheye={fisheye_a}   '
      f'B {path_b} {size_b[0]}x{size_b[1]} f={Kb[0, 0]:.0f} fisheye={fisheye_b}')

# --- overlap ---
n_kp_a, n_kp_b, pts_a, pts_b = matchFeatures(gray_a, gray_b)
print(f'keypoints        A {n_kp_a}  B {n_kp_b}')
print(f'ratio matches    {len(pts_a)}')
if len(pts_a) < 8:
    print('too few matches for an essential matrix')
    sys.exit(1)
norm_a = normalize(pts_a, Ka, dist_a, fisheye_a)
norm_b = normalize(pts_b, Kb, dist_b, fisheye_b)
E, mask = cv2.findEssentialMat(norm_a, norm_b, np.eye(3), cv2.RANSAC, 0.999, RANSAC_PX/mean_focal)
inlier = mask.ravel() == 1
in_a = pts_a[inlier]
in_b = pts_b[inlier]
in_norm_a = norm_a[inlier]
in_norm_b = norm_b[inlier]
errors_px = sampsonNormalized(E, in_norm_a, in_norm_b)*mean_focal
print(f'E inliers        {len(in_a)} ({100*len(in_a)/len(pts_a):.0f}% of matches)')
print(f'epipolar error   median {np.median(errors_px):.2f} px  p90 {np.percentile(errors_px, 90):.2f} px')
print(f'grid coverage    A {100*gridCoverage(in_a, size_a[0], size_a[1]):.0f}%  B {100*gridCoverage(in_b, size_b[0], size_b[1]):.0f}%  ({GRID}x{GRID} cells with an inlier)')

# --- pose up to scale ---
n_front, R, t, pose_mask = cv2.recoverPose(E, in_norm_a, in_norm_b, np.eye(3))
angle = math.degrees(math.acos(max(-1.0, min(1.0, (np.trace(R) - 1)/2))))
print(f'relative pose    rotation {angle:.1f} deg, {n_front}/{len(in_a)} points in front of both cameras')
X = triangulate(R, t, in_norm_a, in_norm_b)
reproj_a = reprojectionPx(X, Ka, dist_a, np.eye(3), np.zeros((3, 1)), in_a, fisheye_a)
reproj_b = reprojectionPx(X, Kb, dist_b, R, t, in_b, fisheye_b)
print(f'reprojection     A median {np.median(reproj_a):.2f} px  B median {np.median(reproj_b):.2f} px')

# --- scale from the eyes ---
body = rtmlib.Body(mode='balanced', backend='onnxruntime', device='cpu')
eyes_a, eye_scores_a = detectEyes(body, gray_a)
eyes_b, eye_scores_b = detectEyes(body, gray_b)
drawPair(gray_a, gray_b, in_a, in_b, eyes_a, eyes_b, f'{out_prefix}_matches.png')
print(f'wrote            {out_prefix}_matches.png')
if eyes_a is None or eyes_b is None:
    print('no person found in one of the images; no metric scale')
    sys.exit(0)
eye_norm_a = normalize(eyes_a, Ka, dist_a, fisheye_a)
eye_norm_b = normalize(eyes_b, Kb, dist_b, fisheye_b)
print(f'eye scores       A {eye_scores_a[0]:.2f} {eye_scores_a[1]:.2f}  B {eye_scores_b[0]:.2f} {eye_scores_b[1]:.2f}')
eye_epipolar = sampsonNormalized(E, eye_norm_a, eye_norm_b)*mean_focal
print(f'eye epipolar err L {eye_epipolar[0]:.1f} px  R {eye_epipolar[1]:.1f} px')
mm_per_unit, dist_eye_a, dist_eye_b = metricFromPose(R, t, eye_norm_a, eye_norm_b, ipd_mm)
print(f'scale            IPD {ipd_mm:.1f} mm -> baseline {mm_per_unit:.0f} mm')
print(f'eye-midpoint distance  A {dist_eye_a:.0f} mm  B {dist_eye_b:.0f} mm')
mono_a = Ka[0, 0]*ipd_mm/np.linalg.norm(eye_norm_a[0]*Ka[0, 0] - eye_norm_a[1]*Ka[0, 0])
mono_b = Kb[0, 0]*ipd_mm/np.linalg.norm(eye_norm_b[0]*Kb[0, 0] - eye_norm_b[1]*Kb[0, 0])
print(f'monocular check  A {mono_a:.0f} mm  B {mono_b:.0f} mm  (f*IPD/eye_px after undistortion; assumes the face is square-on)')
depth = np.linalg.norm(X, axis=1)*mm_per_unit
print(f'matched-point distance from A  p10 {np.percentile(depth, 10):.0f}  median {np.median(depth):.0f}  p90 {np.percentile(depth, 90):.0f} mm')

# --- bootstrap: resample the inliers, refit E, redo pose and scale ---
rng = np.random.default_rng(1)
rows = []
for k in range(BOOTSTRAP):
    pick = rng.integers(0, len(in_a), len(in_a))
    E_k, unused_mask = cv2.findEssentialMat(in_norm_a[pick], in_norm_b[pick], np.eye(3), cv2.LMEDS)
    if E_k is None or E_k.shape != (3, 3):
        continue
    unused_front, R_k, t_k, unused_pose_mask = cv2.recoverPose(E_k, in_norm_a[pick], in_norm_b[pick], np.eye(3))
    angle_k = math.degrees(math.acos(max(-1.0, min(1.0, (np.trace(R_k) - 1)/2))))
    mm_k, dist_a_k, dist_b_k = metricFromPose(R_k, t_k, eye_norm_a, eye_norm_b, ipd_mm)
    rows.append((angle_k, mm_k, dist_a_k, dist_b_k))
rows = np.array(rows)
print(f'bootstrap ({len(rows)} refits)          p10    median   p90')
labels = ['rotation deg', 'baseline mm', 'distance A mm', 'distance B mm']
for c in range(len(labels)):
    p10, p50, p90 = np.percentile(rows[:, c], [10, 50, 90])
    print(f'  {labels[c]:<16} {p10:8.1f} {p50:8.1f} {p90:8.1f}')
