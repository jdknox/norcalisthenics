# DIY body measurement — context handoff (2026-11-10)

## Goal
Replace the closed commercial body-scan apps (ZOZOFIT, me360) with our own camera-based measurement program. It should:
- produce tape-equivalent circumferences for the landmarks we track: neck, chest, waist, stomach (navel), seat, thighs, calves, and later biceps
- be repeatable to a few mm, with known accuracy against a tape
- capture with the subject slowly rotating in front of a fixed camera: no voice-cued poses, no accounts, raw data stays on our machines

Coding style: `/muratori-code-style`, meaning flat procedural code, explicit control flow and minimal abstraction. Prototype in Python (numpy and OpenCV); a C port is optional later.

User: 1.88 m male with a laptop, a Pixel 9 Pro XL (Android, adb available) and a base iPad (A16, no LiDAR).

## Why not the apps (what we measured over 10 weekly scans)
- **Closed and unverifiable.** No raw data export and no stated method, so every result means taking a screenshot and transcribing it by OCR. zozofit's logo covers some values on its own results screen.
- **me360's body fat % doesn't respond to fat loss.** It stayed between 18.7 and 19.2 for 10 weeks while scan weight dropped about 4 kg.
  - It estimates from a ratio, (biceps + thighs + calves) / stomach, so losing fat evenly cancels out.
  - It doesn't reproduce its own published Size Stream formula. On the same circumferences that formula gives 18.3 → 17.2%; the app showed 18.8 → 18.7.
  - Lean mass is just weight × (1 − bf), so about 80% of any weight loss gets booked as "lean". On 11-09 it also used an older weight (it displayed 66.1 kg lean at 79.65 kg body weight; 18.7% fat implies 64.8).
- **zozofit is noisy and biased.** Same-session repeatability is about ±1 cm on landmarks and ±0.7 body fat points. The noise has a typical pattern: torso up while shoulders and arms go down, or the reverse.
  - It runs the Navy formula on its own uncalibrated circumferences, so it reads about 3 points below tape-corrected Navy.
  - It is sensitive to phone height and angle. Height is now fixed to within a few mm.
- **Both are hard to capture with.**
  - zozofit needs a voice-cued 12-pose sequence with the phone on the floor.
  - Results depend on lighting (sunset changes them) and on whether you just ate or trained (pump).
  - Each scan gives one noisy snapshot, so trends take about 7 weekly scans to show.
- **Known biases (app − tape):** neck zozofit +2.0; stomach zozofit −2.3, me360 −3.0; biceps zozofit +2.9/+2.7, me360 +3.0/+2.6 (L/R).

## Core method
**Cauchy's formula:** the perimeter of a convex cross-section = π × its mean caliper width over all directions. A tape stretched around a cross-section bridges any hollows, so it also measures the convex outline. That makes this a like-for-like comparison, not an approximation.

**Continuous rotation instead of 12 poses:**
- The subject turns slowly in place (hands on head, 2–3 revolutions over about 60–90 s) in front of a fixed camera.
- Each frame gives the silhouette width at every landmark height, which is one caliper measurement per frame per slice.
- Hundreds of views per slice average out random edge and segmentation noise, roughly as 1/√N for independent errors.
- Several revolutions also average out breathing and sway.
- The widths over angle also give the cross-section's full outline, more than just its perimeter (useful later for shape and visual-hull work).

**What has to be right for this to work:**
1. **Even angle sampling.** The mean width has to be averaged over angle, not over time. If the subject turns unevenly, slow stretches are over-represented. Options, best first:
   - A **phone gyroscope** carried on the body, e.g. phyphox (free, no login, CSV export, and a live Wi-Fi remote interface). It gives yaw angle directly; sync it to the camera by the start and stop of the turn.
   - A **motorized turntable** rated for a person's weight, which turns at constant speed.
   - Assume constant speed over several revolutions and check that each revolution's mean width agrees with the others.
   - Estimate angle from the shape: width at a non-round slice (shoulders, chest) repeats every 180°. Use this as a fallback or a cross-check.
2. **Pixel-to-cm scale at the body's centre line.** Standing 5 cm off the mark at 2.5 m changes the scale by 2%, which is about 1.8 cm on a 90 cm waist. Options:
   - Tape a mark on the floor, fix the camera, and calibrate once per session with a ChArUco/ArUco board held on the rotation axis.
   - Cross-check against known height (1.88 m) and floor contact.
3. **Silhouette segmentation.** Shoot a background frame with the subject out of view, then use background subtraction, a local person-segmentation model, or both.
   - Plain wall, artificial light rather than daylight, tight clothing, hair kept off the neck.
4. **Camera geometry.** Level camera (no pitch), lens at about mid-torso height, distance at least about 2.5 m.
   - Perspective error is about r²/(2D²): 0.2% at r = 15 cm, D = 2.5 m, so negligible.
   - Correct for lens distortion with a one-time intrinsic calibration.
5. **Landmark heights.** Use fixed heights above the floor, measured once with a tape (navel height for stomach, etc.), for repeatability. Optionally refine with features: waist = narrowest point between ribs and hips, seat = widest point at hips, calf = widest point of the lower leg.

**Resolution budget:** a 1080-px-tall portrait frame with a 1.9 m subject is about 1.1 mm per pixel. ±1 px per edge is ±2 mm of width before averaging. The real error sources are segmentation, scale, posture and breathing, not pixel count.

**Hard parts, phase 2:**
- **Thighs:** feet apart separates the legs from the front but they overlap from the side. Per-leg slices need multi-view carving (visual hull) of two separate blobs.
- **Biceps:** need an arms-out pose, which gives a vertical slice orientation.
- Start with the torso: neck, chest, waist, stomach, seat. Calves next, with feet apart.

## Validation plan
- **Repeatability:** 5 back-to-back sessions. Target SD under 0.3 cm on stomach and waist.
- **Accuracy:** same-day tape, 3 repeats per landmark. Bias = DIY − tape, stored per landmark.
- **Synthetic tests** before real data (reuse the elliptical-cross-section generator approach from the LiDAR work).
- **Scan conditions:** pre-workout, not just after eating, same time of day, artificial light.

## Prior work to reuse
`body_scan.py` (iPad LiDAR + Stray Scanner, delivered earlier; re-attach it if needed). It can't run here because the iPad has no LiDAR, but these parts carry over:
- **Frame trimming:** compare each frame to the first and last frames, flag change above 3× the minimum frame-to-frame noise, and drop the stationary frames before and after the turn.
- **Measurement:** the width-per-slice → π·mean-width pipeline, half-split repeatability (first half of frames vs second), and appending a row to a TSV.
- **Synthetic tests** showed ±0.5 cm consistency under pauses, ±50% speed pulses and overshoot. Raw readings came out 8–15% low as a constant per-landmark offset, which tape calibration removes.
- **Rejected ideas:** ICP to track rotation angle (ill-conditioned on smooth bodies) and front/back arc length.

## Capture options
- **Pixel 9 Pro XL:** record a video and pull it over `adb` (USB, or Wi-Fi with `adb pair` / `adb connect` on Android 11+). Or stream frames live with scrcpy or a camera-to-webcam app.
- **Laptop webcam:** easiest to stream live, but lower quality and usually wide-angle, so it needs distortion calibration.
- **iPad (A16):** plain RGB video only.

## Output
- One TSV row per session with the same column names as the sheet's `raw_*` tabs, so it can become a third source (e.g. a `raw_diy` tab) with its own weight on the dashboard.
- The sheet is `body-scan-tracker`, ID `1--B_tt2K6LshZRVcQVtHv-QhzjmvlbEizOLVMIFjUyg`, writable through the Google Sheets connector. Full sheet context is in `claude/body-scan-handoff.md` in this project.

## Suggested first steps
1. Choose the camera (Pixel over adb or webcam) and the angle source (gyroscope vs constant-speed assumption).
2. Prototype: background frame → silhouette mask → per-row widths at fixed heights → uniform resampling over angle → π·mean width.
3. Validate on synthetic renders, then do one real session against tape.
