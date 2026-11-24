# Usage: python3 redetect_fixedbox.py '<glob>' out.csv x1 y1 x2 y2
# Re-detect poses with RTMPose driven by a FIXED person bounding box, bypassing
# the YOLOX detector. For a single-person, fixed-camera session the athlete is
# always in a known region, so a fixed box avoids the detector latching onto
# background clutter (chairs, AC unit, mirror). Every frame gets a pose; there is
# no cross-frame tracking or rejection. Output matches pose_to_csv's columns so
# merge_force.py / leg_analysis.py / draw_pose.py consume it unchanged.
import sys
import glob
import cv2
import rtmlib
import pose_to_csv as pc

input_glob = sys.argv[1]
out_path = sys.argv[2]
box = [float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])]

paths = sorted(glob.glob(input_glob))
assert paths, f'no files match {input_glob}'
body = rtmlib.Body(mode='balanced', backend='onnxruntime', device='cpu')
pose_model = body.pose_model
bboxes = [box]

out = open(out_path, 'w')
out.write(pc.CSV_HEADER)
for frame_index in range(len(paths)):
    path = paths[frame_index]
    frame_bgr = cv2.imread(path)
    assert frame_bgr is not None, f'cannot read {path}'
    frame_name = path.rsplit('/', 1)[-1]
    keypoints, scores = pose_model(frame_bgr, bboxes=bboxes)
    # map 17 COCO joints onto the 33 MediaPipe-shaped slots
    pose = [(0.0, 0.0, 0.0)]*33
    for coco_index, slot in enumerate(pc.COCO_TO_LANDMARK_SLOT):
        x, y = keypoints[0][coco_index]
        pose[slot] = (float(x), float(y), float(scores[0][coco_index]))

    def safeAngle(a, b, c):
        # Degenerate (coincident joints) -> 0.0; only the knee angles are used
        # downstream, and hip/knee/ankle never coincide in a real pose.
        try:
            return pc.angleDeg(a, b, c)
        except (ZeroDivisionError, ValueError):
            return 0.0
    angles = [
        safeAngle(pose[pc.L_HIP], pose[pc.L_KNEE], pose[pc.L_ANKLE]),
        safeAngle(pose[pc.R_HIP], pose[pc.R_KNEE], pose[pc.R_ANKLE]),
        safeAngle(pose[pc.L_SHOULDER], pose[pc.L_HIP], pose[pc.L_KNEE]),
        safeAngle(pose[pc.R_SHOULDER], pose[pc.R_HIP], pose[pc.R_KNEE]),
        safeAngle(pose[pc.L_SHOULDER], pose[pc.L_ELBOW], pose[pc.L_WRIST]),
        safeAngle(pose[pc.R_SHOULDER], pose[pc.R_ELBOW], pose[pc.R_WRIST]),
        safeAngle(pose[pc.L_HIP], pose[pc.L_SHOULDER], pose[pc.L_ELBOW]),
        safeAngle(pose[pc.R_HIP], pose[pc.R_SHOULDER], pose[pc.R_ELBOW]),
    ]
    row = f'{frame_index},{frame_name},0.000,1,0'
    row += ',' + ','.join(f'{a:.1f}' for a in angles)
    for i in range(33):
        row += f',{pose[i][0]:.1f},{pose[i][1]:.1f},{pose[i][2]:.2f}'
    out.write(row + '\n')
out.close()
print(f'{len(paths)} frames re-detected with fixed box {box} -> {out_path}')
