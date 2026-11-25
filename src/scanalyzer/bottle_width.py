# Usage:
#   python3 bottle_width.py IMG_A CALIB_A.yml SEED_A IMG_B CALIB_B.yml SEED_B STEREO.yml OUT_PREFIX
#     SEED_* = 'x,y0,y1': a column inside the cylinder and the image-row range of its
#              straight section (above any hand, below any shoulder), in that image.
#
# Cylinder diameter from silhouettes in two calibrated views, no distance assumption.
#
# 1. Per row, the left and right silhouette edges are found to sub-pixel precision:
#    walk out from the seed column until the profile crosses halfway between the
#    inside level and the local background level on that side.
# 2. Edge points are undistorted to normalized camera coordinates and a line is fit
#    to each side. A line a*x + b*y + c = 0 in normalized coordinates is the plane
#    through the camera centre with normal (a, b, c), tangent to the cylinder.
# 3. With inward unit normals, a point on the axis has equal signed distance r to both
#    tangent planes of a camera, so the axis lies in that camera's bisector plane
#    (n_left - n_right).X = 0. The two cameras' bisector planes meet in the axis.
# 4. r is the distance from the axis to the tangent planes. Because the axis lies in
#    each camera's bisector plane, a camera's left and right radii are equal by
#    construction: there are TWO independent estimates (camera A, camera B), and
#    their agreement is the consistency check.
# All 3D is in camera A's frame, in the stereo calibration's units (mm).
import sys
import numpy as np
import cv2

BG_NEAR = 25            # px beyond the expected edge where the background window starts
BG_FAR = 45             # px beyond the expected edge where it ends
INSIDE_HALF = 10        # px half-width of the inside-level window around the seed
SMOOTH_SIGMA = 1.0      # px, 1D Gaussian along each row before edge search


def loadCalib(path):
    fs = cv2.FileStorage(path, cv2.FILE_STORAGE_READ)
    if not fs.isOpened():
        print(f'cannot read calibration {path}')
        sys.exit(1)
    K = fs.getNode('camera_matrix').mat()
    dist = fs.getNode('distortion_coefficients').mat().ravel()
    fisheye_node = fs.getNode('fisheye_model')
    fisheye = False if fisheye_node.empty() else bool(int(fisheye_node.real()))
    return K, dist, fisheye


def undistortNormalized(pts, K, dist, fisheye):
    if fisheye:
        return cv2.fisheye.undistortPoints(pts.reshape(-1, 1, 2).astype(np.float64), K, dist).reshape(-1, 2)
    return cv2.undistortPoints(pts.reshape(-1, 1, 2), K, dist).reshape(-1, 2)


def parseSeed(text):
    parts = text.split(',')
    return int(parts[0]), int(parts[1]), int(parts[2])


def crossing(profile, start, step, threshold):
    # walk from start in direction step until the profile rises past threshold;
    # return the sub-pixel position of the crossing, or None if it never crosses
    k = start
    while 0 <= k + step < len(profile):
        if profile[k + step] >= threshold:
            a = profile[k]
            b = profile[k + step]
            frac = (threshold - a)/(b - a)
            return k + step*frac
        k += step
    return None


def findEdges(gray, seed_x, row_0, row_1):
    smooth = cv2.GaussianBlur(gray.astype(np.float64), (0, 0), SMOOTH_SIGMA)
    left_pts = []
    right_pts = []
    for v in range(row_0, row_1 + 1):
        profile = smooth[v]
        inside = np.median(profile[seed_x - INSIDE_HALF:seed_x + INSIDE_HALF + 1])
        # first pass: rough edges at a global threshold, to place the background windows
        rough_threshold = (inside + np.median(profile))/2
        rough_left = crossing(profile, seed_x, -1, rough_threshold)
        rough_right = crossing(profile, seed_x, 1, rough_threshold)
        if rough_left is None or rough_right is None:
            continue
        left_bg = np.median(profile[int(rough_left) - BG_FAR:int(rough_left) - BG_NEAR])
        right_bg = np.median(profile[int(rough_right) + BG_NEAR:int(rough_right) + BG_FAR])
        left = crossing(profile, seed_x, -1, (inside + left_bg)/2)
        right = crossing(profile, seed_x, 1, (inside + right_bg)/2)
        if left is None or right is None:
            continue
        left_pts.append((left, v))
        right_pts.append((right, v))
    return np.float64(left_pts), np.float64(right_pts)


def tangentPlane(pts, K, dist, inside_px, fisheye):
    # fit a line to undistorted edge points; return the unit plane normal pointing
    # toward the cylinder, plus the line-fit residual RMS in pixels
    norm = undistortNormalized(pts, K, dist, fisheye)
    centroid = norm.mean(axis=0)
    centered = norm - centroid
    unused_u, s, vt = np.linalg.svd(centered, full_matrices=False)
    line_normal = vt[1]
    residual_px = np.sqrt(np.mean((centered @ line_normal)**2))*K[0, 0]
    plane = np.array([line_normal[0], line_normal[1], -line_normal @ centroid])
    plane = plane/np.linalg.norm(plane)
    inside_norm = undistortNormalized(np.float64([[inside_px]]), K, dist, fisheye).reshape(2)
    if plane @ np.array([inside_norm[0], inside_norm[1], 1.0]) < 0:
        plane = -plane
    return plane, residual_px


def drawEdges(gray, left_pts, right_pts, path):
    canvas = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    for x, y in left_pts:
        cv2.circle(canvas, (int(round(x)), int(y)), 1, (0, 0, 255), -1)
    for x, y in right_pts:
        cv2.circle(canvas, (int(round(x)), int(y)), 1, (0, 255, 0), -1)
    cv2.imwrite(path, canvas)


if len(sys.argv) < 9:
    print('usage: python3 bottle_width.py IMG_A CALIB_A.yml SEED_A IMG_B CALIB_B.yml SEED_B STEREO.yml OUT_PREFIX')
    sys.exit(1)
gray_a = cv2.imread(sys.argv[1], cv2.IMREAD_GRAYSCALE)
Ka, dist_a, fisheye_a = loadCalib(sys.argv[2])
seed_a = parseSeed(sys.argv[3])
gray_b = cv2.imread(sys.argv[4], cv2.IMREAD_GRAYSCALE)
Kb, dist_b, fisheye_b = loadCalib(sys.argv[5])
seed_b = parseSeed(sys.argv[6])
stereo = cv2.FileStorage(sys.argv[7], cv2.FILE_STORAGE_READ)
R = stereo.getNode('R').mat()
T = stereo.getNode('T').mat().ravel()
out_prefix = sys.argv[8]

left_a, right_a = findEdges(gray_a, seed_a[0], seed_a[1], seed_a[2])
left_b, right_b = findEdges(gray_b, seed_b[0], seed_b[1], seed_b[2])
drawEdges(gray_a, left_a, right_a, f'{out_prefix}_edges_a.png')
drawEdges(gray_b, left_b, right_b, f'{out_prefix}_edges_b.png')
print(f'edge rows        A {len(left_a)}  B {len(left_b)}')
print(f'pixel width      A {np.median(right_a[:, 0] - left_a[:, 0]):.1f} px  B {np.median(right_b[:, 0] - left_b[:, 0]):.1f} px  (median over rows)')

mid_a = (seed_a[0], (seed_a[1] + seed_a[2])/2)
mid_b = (seed_b[0], (seed_b[1] + seed_b[2])/2)
plane_al, res_al = tangentPlane(left_a, Ka, dist_a, mid_a, fisheye_a)
plane_ar, res_ar = tangentPlane(right_a, Ka, dist_a, mid_a, fisheye_a)
plane_bl, res_bl = tangentPlane(left_b, Kb, dist_b, mid_b, fisheye_b)
plane_br, res_br = tangentPlane(right_b, Kb, dist_b, mid_b, fisheye_b)
print(f'edge line fit    A left {res_al:.2f} right {res_ar:.2f} px   B left {res_bl:.2f} right {res_br:.2f} px  (RMS off a straight line)')

# camera B planes in camera A's frame: n_B.(R X + T) = 0  ->  (R^T n_B).X + n_B.T = 0
normals = [plane_al[:3], plane_ar[:3], R.T @ plane_bl, R.T @ plane_br]
offsets = [0.0, 0.0, plane_bl @ T, plane_br @ T]
names = ['A left', 'A right', 'B left', 'B right']

# bisector planes; their intersection is the axis
bis_a_normal = normals[0] - normals[1]
bis_a_offset = offsets[0] - offsets[1]
bis_b_normal = normals[2] - normals[3]
bis_b_offset = offsets[2] - offsets[3]
axis_dir = np.cross(bis_a_normal, bis_b_normal)
axis_dir = axis_dir/np.linalg.norm(axis_dir)
# point on the axis: solve the two plane equations plus "closest to the A ray through the seed"
seed_ray = cv2.undistortPoints(np.float64([[mid_a]]), Ka, dist_a).reshape(2)
seed_ray = np.array([seed_ray[0], seed_ray[1], 1.0])
seed_ray = seed_ray/np.linalg.norm(seed_ray)
A_mat = np.array([bis_a_normal, bis_b_normal, axis_dir])
b_vec = np.array([-bis_a_offset, -bis_b_offset, 0.0])
axis_origin = np.linalg.solve(A_mat, b_vec)
# slide along the axis to the point nearest the seed ray (middle of the measured section)
w0 = axis_origin
uu = axis_dir @ axis_dir
uv = axis_dir @ seed_ray
vv = seed_ray @ seed_ray
uw = axis_dir @ w0
vw = seed_ray @ w0
s_axis = (uv*vw - vv*uw)/(uu*vv - uv*uv)
axis_point = axis_origin + s_axis*axis_dir

print(f'axis point (A)   {axis_point.round(1)} mm   distance from A {np.linalg.norm(axis_point):.0f} mm, from B {np.linalg.norm(R @ axis_point + T):.0f} mm')
print(f'axis direction   {axis_dir.round(3)}  ({np.degrees(np.arccos(abs(axis_dir[1]))):.1f} deg from camera-A vertical)')
radii = []
for k in range(4):
    r = normals[k] @ axis_point + offsets[k]
    tilt = np.degrees(np.arcsin(min(1.0, abs(normals[k] @ axis_dir))))
    radii.append(r)
    print(f'radius {names[k]:<8} {r:6.2f} mm   (plane vs axis {tilt:.2f} deg off parallel)')
radii = np.array(radii)
print(f'diameter         {2*radii.mean():.1f} mm   (camera A {2*radii[0]:.1f}, camera B {2*radii[2]:.1f})')
print(f'wrote            {out_prefix}_edges_a.png  {out_prefix}_edges_b.png')
