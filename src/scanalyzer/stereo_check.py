# Usage:
#   python3 stereo_check.py CAM_A.png CAM_B.png OUT_PREFIX [ipd_mm]
#
# Uncalibrated two-camera check on one simultaneous frame pair.
#
# Overlap: SIFT features matched A->B with Lowe's ratio test, then a RANSAC
# (MAGSAC) fundamental matrix. Reports how many matches survive, their epipolar
# (Sampson) error, and how much of each image the inliers cover.
#
# Focal length: neither camera is calibrated, so each focal length is searched
# over a horizontal-FOV grid, with the principal point assumed at the image
# centre and no lens distortion. For the right pair, E = Kb^T F Ka has two equal
# singular values. This is ill-conditioned when both cameras aim at the same
# point (a converging rig), so the spread of near-best FOVs is printed too.
#
# Distance: with those intrinsics, E gives the relative pose up to scale. The
# eye centres from RTMPose (COCO keypoints 1 and 2) are triangulated, and the
# scale is set so the 3D eye distance equals ipd_mm. Every distance is then
# proportional to both the IPD guess and the focal lengths.
import sys
import math
import numpy as np
import cv2
import rtmlib

DEFAULT_IPD_MM = 64.0
RATIO = 0.75            # Lowe ratio test
RANSAC_PX = 1.0         # fundamental-matrix inlier threshold, px
GRID = 8                # coverage grid, cells per side
FOV_MIN = 40
FOV_MAX = 120           # degrees, horizontal FOV search range
NEAR_BEST = 2.0         # FOVs within this factor of the best cost count as "near best"
MAX_LINES = 120         # match lines drawn in the output image
BOOTSTRAP = 200         # resamples of the F inliers for error bars
COCO_LEFT_EYE = 1
COCO_RIGHT_EYE = 2


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


def sampsonErrors(F, pts_a, pts_b):
    ones = np.ones((len(pts_a), 1))
    xa = np.hstack([pts_a, ones])
    xb = np.hstack([pts_b, ones])
    Fxa = xa @ F.T
    Ftxb = xb @ F
    numerator = np.sum(xb*Fxa, axis=1)**2
    denominator = Fxa[:, 0]**2 + Fxa[:, 1]**2 + Ftxb[:, 0]**2 + Ftxb[:, 1]**2
    return np.sqrt(numerator/denominator)


def gridCoverage(pts, width, height):
    occupied = np.zeros((GRID, GRID), bool)
    for x, y in pts:
        col = min(GRID - 1, int(x*GRID/width))
        row = min(GRID - 1, int(y*GRID/height))
        occupied[row, col] = True
    return occupied.sum()/(GRID*GRID)


def focalFromFov(fov_deg, width):
    return (width/2)/math.tan(math.radians(fov_deg)/2)


def intrinsics(focal, width, height):
    return np.array([[focal, 0, width/2], [0, focal, height/2], [0, 0, 1]], np.float64)


def searchFovs(F, size_a, size_b):
    fovs = np.arange(FOV_MIN, FOV_MAX + 1)
    Ka_all = np.zeros((len(fovs), 3, 3))
    Kb_all = np.zeros((len(fovs), 3, 3))
    for i in range(len(fovs)):
        Ka_all[i] = intrinsics(focalFromFov(fovs[i], size_a[0]), size_a[0], size_a[1])
        Kb_all[i] = intrinsics(focalFromFov(fovs[i], size_b[0]), size_b[0], size_b[1])
    # E[j, i] = Kb[j]^T F Ka[i], every pair at once
    E = np.einsum('jba,bc,icd->jiad', Kb_all, F, Ka_all)
    s = np.linalg.svd(E, compute_uv=False)
    costs = ((s[..., 0] - s[..., 1])/(s[..., 0] + s[..., 1])).T
    best_i, best_j = np.unravel_index(np.argmin(costs), costs.shape)
    near = np.argwhere(costs <= NEAR_BEST*costs[best_i, best_j])
    fov_a_range = (fovs[near[:, 0].min()], fovs[near[:, 0].max()])
    fov_b_range = (fovs[near[:, 1].min()], fovs[near[:, 1].max()])
    return int(fovs[best_i]), int(fovs[best_j]), costs[best_i, best_j], fov_a_range, fov_b_range


def solveMetric(F, in_a, in_b, eyes_a, eyes_b, size_a, size_b, ipd_mm):
    fov_a, fov_b, unused_cost, unused_range_a, unused_range_b = searchFovs(F, size_a, size_b)
    Ka = intrinsics(focalFromFov(fov_a, size_a[0]), size_a[0], size_a[1])
    Kb = intrinsics(focalFromFov(fov_b, size_b[0]), size_b[0], size_b[1])
    E = Kb.T @ F @ Ka
    n_front, R, t, unused_mask = cv2.recoverPose(E, normalize(in_a, Ka), normalize(in_b, Kb), np.eye(3))
    eye_X = triangulate(R, t, normalize(eyes_a, Ka), normalize(eyes_b, Kb))
    mm_per_unit = ipd_mm/np.linalg.norm(eye_X[0] - eye_X[1])
    mid = (eye_X[0] + eye_X[1])/2
    dist_a = np.linalg.norm(mid)*mm_per_unit
    dist_b = np.linalg.norm(R @ mid + t.ravel())*mm_per_unit
    return fov_a, fov_b, mm_per_unit, dist_a, dist_b


def detectEyes(body, gray):
    bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    keypoints, scores = body(bgr)
    if len(keypoints) == 0:
        return None, None
    person = int(np.argmax(scores.mean(axis=1)))
    eyes = keypoints[person][[COCO_LEFT_EYE, COCO_RIGHT_EYE]].astype(np.float64)
    eye_scores = scores[person][[COCO_LEFT_EYE, COCO_RIGHT_EYE]]
    return eyes, eye_scores


def normalize(pts, K):
    return cv2.undistortPoints(pts.reshape(-1, 1, 2), K, None).reshape(-1, 2)


def triangulate(R, t, norm_a, norm_b):
    P_a = np.hstack([np.eye(3), np.zeros((3, 1))])
    P_b = np.hstack([R, t])
    homog = cv2.triangulatePoints(P_a, P_b, norm_a.T, norm_b.T)
    return (homog[:3]/homog[3]).T


def reprojectionPx(X, K, R, t, pts):
    projected, unused = cv2.projectPoints(X, cv2.Rodrigues(R)[0], t, K, None)
    return np.linalg.norm(projected.reshape(-1, 2) - pts, axis=1)


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


if len(sys.argv) < 4:
    print('usage: python3 stereo_check.py CAM_A.png CAM_B.png OUT_PREFIX [ipd_mm]')
    sys.exit(1)
path_a = sys.argv[1]
path_b = sys.argv[2]
out_prefix = sys.argv[3]
ipd_mm = DEFAULT_IPD_MM
if len(sys.argv) > 4:
    ipd_mm = float(sys.argv[4])

gray_a = cv2.imread(path_a, cv2.IMREAD_GRAYSCALE)
gray_b = cv2.imread(path_b, cv2.IMREAD_GRAYSCALE)
size_a = (gray_a.shape[1], gray_a.shape[0])
size_b = (gray_b.shape[1], gray_b.shape[0])
print(f'A {path_a} {size_a[0]}x{size_a[1]}   B {path_b} {size_b[0]}x{size_b[1]}')

# --- overlap ---
n_kp_a, n_kp_b, pts_a, pts_b = matchFeatures(gray_a, gray_b)
print(f'keypoints        A {n_kp_a}  B {n_kp_b}')
print(f'ratio matches    {len(pts_a)}')
if len(pts_a) < 8:
    print('too few matches for a fundamental matrix')
    sys.exit(1)
F, mask = cv2.findFundamentalMat(pts_a, pts_b, cv2.USAC_MAGSAC, RANSAC_PX, 0.999, 10000)
inlier = mask.ravel() == 1
in_a = pts_a[inlier]
in_b = pts_b[inlier]
errors = sampsonErrors(F, in_a, in_b)
print(f'F inliers        {len(in_a)} ({100*len(in_a)/len(pts_a):.0f}% of matches)')
print(f'sampson error    median {np.median(errors):.2f} px  p90 {np.percentile(errors, 90):.2f} px')
print(f'grid coverage    A {100*gridCoverage(in_a, size_a[0], size_a[1]):.0f}%  B {100*gridCoverage(in_b, size_b[0], size_b[1]):.0f}%  ({GRID}x{GRID} cells with an inlier)')

# --- focal lengths ---
fov_a, fov_b, best_cost, fov_a_range, fov_b_range = searchFovs(F, size_a, size_b)
print(f'self-calib HFOV  A {fov_a} deg (near-best {fov_a_range[0]}-{fov_a_range[1]})  B {fov_b} deg (near-best {fov_b_range[0]}-{fov_b_range[1]})  cost {best_cost:.4f}')
Ka = intrinsics(focalFromFov(fov_a, size_a[0]), size_a[0], size_a[1])
Kb = intrinsics(focalFromFov(fov_b, size_b[0]), size_b[0], size_b[1])

# --- pose up to scale ---
E = Kb.T @ F @ Ka
norm_a = normalize(in_a, Ka)
norm_b = normalize(in_b, Kb)
n_front, R, t, pose_mask = cv2.recoverPose(E, norm_a, norm_b, np.eye(3))
angle = math.degrees(math.acos(max(-1.0, min(1.0, (np.trace(R) - 1)/2))))
print(f'relative pose    rotation {angle:.1f} deg, {n_front}/{len(in_a)} points in front of both cameras')
X = triangulate(R, t, norm_a, norm_b)
reproj_a = reprojectionPx(X, Ka, np.eye(3), np.zeros((3, 1)), in_a)
reproj_b = reprojectionPx(X, Kb, R, t, in_b)
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
print(f'eye scores       A {eye_scores_a[0]:.2f} {eye_scores_a[1]:.2f}  B {eye_scores_b[0]:.2f} {eye_scores_b[1]:.2f}')
eye_epipolar = sampsonErrors(F, eyes_a, eyes_b)
print(f'eye epipolar err L {eye_epipolar[0]:.1f} px  R {eye_epipolar[1]:.1f} px')
eye_X = triangulate(R, t, normalize(eyes_a, Ka), normalize(eyes_b, Kb))
ipd_units = np.linalg.norm(eye_X[0] - eye_X[1])
mm_per_unit = ipd_mm/ipd_units
mid = (eye_X[0] + eye_X[1])/2
dist_a = np.linalg.norm(mid)*mm_per_unit
dist_b = np.linalg.norm(R @ mid + t.ravel())*mm_per_unit
print(f'scale            IPD {ipd_mm:.1f} mm -> baseline {mm_per_unit:.0f} mm')
print(f'eye-midpoint distance  A {dist_a:.0f} mm  B {dist_b:.0f} mm')
mono_a = Ka[0, 0]*ipd_mm/np.linalg.norm(eyes_a[0] - eyes_a[1])
mono_b = Kb[0, 0]*ipd_mm/np.linalg.norm(eyes_b[0] - eyes_b[1])
print(f'monocular check  A {mono_a:.0f} mm  B {mono_b:.0f} mm  (f*IPD/eye_px; assumes the face is square-on to that camera)')
depth = np.linalg.norm(X, axis=1)*mm_per_unit
print(f'matched-point distance from A  p10 {np.percentile(depth, 10):.0f}  median {np.median(depth):.0f}  p90 {np.percentile(depth, 90):.0f} mm')

# --- bootstrap: resample the inlier matches, refit F, redo everything ---
rng = np.random.default_rng(1)
rows = []
for k in range(BOOTSTRAP):
    pick = rng.integers(0, len(in_a), len(in_a))
    F_k, unused_mask = cv2.findFundamentalMat(in_a[pick], in_b[pick], cv2.FM_8POINT)
    if F_k is None or F_k.shape != (3, 3):
        continue
    rows.append(solveMetric(F_k, in_a[pick], in_b[pick], eyes_a, eyes_b, size_a, size_b, ipd_mm))
rows = np.array(rows)
print(f'bootstrap ({len(rows)} refits)          p10    median   p90')
labels = ['HFOV A deg', 'HFOV B deg', 'baseline mm', 'distance A mm', 'distance B mm']
for c in range(len(labels)):
    p10, p50, p90 = np.percentile(rows[:, c], [10, 50, 90])
    print(f'  {labels[c]:<16} {p10:8.0f} {p50:8.0f} {p90:8.0f}')
