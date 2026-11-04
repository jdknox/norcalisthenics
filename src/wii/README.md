# Wii Balance Board on the Pi

The board is paired and trusted with the Raspberry Pi. BlueZ connects it as a
Bluetooth HID input device; the logger and front-button services read that
device, and a third service serves the live dashboard. The
Mac Bluetooth experiments and the raw L2CAP reader are **not** the normal
recording path.

## Daily use

- Press the board's **front button** to connect. Keep Bluetooth off on other
  devices that might grab the board (especially the Android phone).
- Live preview starts automatically on connection. Leave the board empty for
  the first **2 seconds** while the logger tares.
- Open **http://rpi:8011** (or use the Pi's IP address) on the same network.
  The dashboard shows total load, four corners, and a rolling 60-second chart.
  The total-load panel also shows the rolling three-second mean and population
  standard deviation of the live 100 ms readings, calculated by the logger
  independently of browser polling. It waits for three seconds of readings and
  resets on re-tare, disconnect, restart, or an actual measurement gap over
  0.5 seconds. Delayed browser updates retain the last statistics with a clear
  delay label until fresh readings arrive.
  Each corner also shows its own three-second mean and population standard
  deviation in kg, using the same window and shared calculation as the total.
  Corner statistics use signed, factory-calibrated values after subtracting a
  separate empty-board baseline for each corner, before the global correction
  factor. The physical panel order remains 3, 1, 4, 2 for calibration work.
  Each corner also shows its minimum minus average and maximum minus average
  over the last **3 seconds**, using the logger's complete window of 100 ms
  readings. The mini-graph has a fixed −0.3 to +0.3 kg scale centered on the
  average. Each min/max tick and readout is green within those inclusive bounds
  and red outside; out-of-range ticks stay at the edge with an outward pointer.
  The exact deviations remain visible in the numeric readouts. All corner
  statistics reset together and retain the same delayed-update label.
  A shared bar below the readings shows the window's sample count out of the
  **30 expected at 10 Hz**, its percentage (capped at 100%), and the latest
  sample's age. The count also fills during initial collection. Age is measured
  on the Pi, with browser elapsed time and request transit time added, so it
  continues increasing when updates pause and does not depend on matching
  browser/Pi clocks. After 0.5 seconds without a fresh sample, the bar turns
  amber and labels its count as the last received window. These are logger
  samples, not counts of fresh Bluetooth reports.
  The latest-sample age also has an average, minimum, and maximum over the
  last three seconds of browser observations, sampled every 100 ms. These
  include increasing age during a stall; extra polling or control renders do
  not add observations. Old observations expire by elapsed time. Age history
  resets on re-tare, disconnect, or logger restart and begins again as soon as
  sample age is available.
  The **Corner snapshot** readout provides exactly four CSV rows in that order:
  `corner,position,current_kg,mean_3s_kg,stdev_3s_kg` (column names are shown
  separately). Press **Copy 4 lines**, or select and copy the text manually.
  Focusing the readout holds its contents; click outside to resume live updates.
  Copy is enabled once live three-second corner statistics are available.
- Press **Record** to append readings to the CSV; press **Stop** to return to
  preview. Preview does not open, create, or modify the CSV.
- A quick front-button tap stops recording and re-tares; leave the board empty
  again. Disconnecting or restarting also stops recording; it never resumes
  automatically. Closing the browser tab does **not** stop recording.
- Hold the front button for **3 seconds** to disconnect and turn it off.

## Recording

`pi_wiiboard_weight_logger.service` reads the four raw ADC values from
`/dev/hidraw*`. It discovers this board by Bluetooth address and reads its
factory 0/17/34 kg calibration points from the driver's `bboard_calib` sysfs
attribute. Both factory calibration segments are retained, with the lower
segment extended below zero. This bypasses the Linux evdev conversion, which
clips negative values before application tare can recover them.

At connection, logger restart, and every front-button tare, the logger averages
**two seconds of fresh weight reports separately for each corner**. Keep the
board empty during that interval. These four signed averages replace the
previous baselines; they are not hardcoded or carried across connections.
No weight reports means tare stays pending, and a report gap over 0.5 seconds
restarts an incomplete tare. For each corner:

```text
tared_corner_kg = signed_factory_kg - current_empty_baseline_kg
total_kg = sum(tared_corner_kg) * calibration_factor
```

Neither corner values nor the total are clipped at zero. Small negative
empty-board residuals are expected; retaining them avoids upward bias from
noise. Factory gains remain unchanged (`calibration_factor = 1.0`).

Only fresh reports enter the approximately 100 ms averages; idle polling and
unrelated HID packets do not create samples. While Record is active, it writes
approximately **10 Hz** samples, including zero and sub-1 kg readings, to
`data/wii/wiiboard_weights.csv` on the Pi:

```text
timestamp,total_kg,corner_1_tared_kg,corner_2_tared_kg,corner_3_tared_kg,corner_4_tared_kg
1793242773.123,88.000,22.000,22.000,22.000,22.000
```

Timestamps are Unix epoch seconds. Each corner column is the average in kg
over the same approximately 100 ms window as the total, in sensor order
1 TR, 2 BR, 3 TL, 4 BL (the previous input axes 16, 17, 18, 19).
Corner values have their individual tares subtracted, before the global
calibration factor; `total_kg` includes that factor. Raw ADC readings are not
recorded. The CSV is local data, ignored by Git.

When Record first opens a CSV with a different header (including the old
two-column format and the previous untared corner columns), it preserves that
file with a nanosecond timestamp, such as
`wiiboard_weights.csv.1793647585873288350.bak`, and starts a new CSV with
the current header. Later recording intervals append to the same file.

The optional bodyweight reference draws a comparison line on the chart; it
does not change calibration or CSV data. A force deficit during movement is
not automatically hand assistance, because body acceleration also changes
the reading.

`calculateStats()` is the shared mean/stdev calculation for the total and four
corners. `GET /api/status` includes the four-element `corner_average_kg` and
`corner_stdev_kg` arrays in sensor order 1–4, alongside total statistics.
`corner_signed_kg` exposes the signed factory-relative readings before tare,
and `corner_tare_kg` exposes the current four empty-board baselines, also in
sensor order 1–4. The dashboard's **Before tare** total sums `corner_signed_kg`
over the same 100 ms window. All five statistics channels reset together on
re-tare, disconnect, restart, or an acquisition gap.
`corner_min_kg` and `corner_max_kg` provide the tared per-corner extrema over
the same window; the dashboard subtracts `corner_average_kg` for the graph.

## Dashboard service

`pi_wiiboard_dashboard.service` serves the standalone dashboard on port 8011;
the workout shared server on port 8010 is unchanged. Both dashboard and logger
run as `knox`. Live state and recording commands use atomically replaced JSON
files in `/dev/shm/norcalisthenics-wii-<uid>/` (RAM, not persistent storage).
The logger is the only process that opens and writes the CSV.

The dashboard polls `GET /api/status` about every 100 ms. Record/Stop send
`POST /api/record/start` and `/api/record/stop` with the header
`X-Wii-Control: dashboard`. The UI waits for the logger's acknowledgment;
commands from a previous logger process cannot restart recording. Stale
logger data is marked unavailable rather than displayed as live.

For local development, run `python3 src/wii/pi_wiiboard_dashboard.py` and open
`http://localhost:8011`. Without the Pi logger, it correctly shows offline.
`WII_RUNTIME_DIR` can override the RAM directory for tests; set it identically
for dashboard and logger. `WII_DASHBOARD_HOST` and `WII_DASHBOARD_PORT` override
the dashboard's default `0.0.0.0:8011` listener. This is a local-network
dashboard without authentication.

## Code and logs

For HTML, CSS, or JavaScript edits only, run `./src/wii/deploy.sh --ui` from
the desktop repo root, then refresh the dashboard in the browser. This copies
only `dashboard.html`, `dashboard.css`, and `dashboard.js`; it does not restart
services, re-tare, or interrupt recording. The dashboard server reads these
files on each request and disables browser caching.

The move to logger-calculated three-second statistics requires one full deploy
with the board connected and empty; `--ui` alone cannot update the logger.
The corner min/max fields also require a full deploy; an older logger keeps
showing averages and stdevs with an update notice for the missing min/max data.
Sample coverage during initial collection and Pi-calculated sample age also
require a full deploy to update the logger and dashboard service.

Run `./src/wii/grab_corners.sh` to print the four current tared corner readings
from the Pi as one comma-separated line in kg, in the same order as the CSV.
These are the logger's latest 100 ms averages, with per-corner baselines
subtracted, before the global correction factor. The logger must be connected
and finished taring, with a sample no older than 0.5 seconds. It reads the RAM
state directly, so the dashboard HTTP service is not required. No deployment
or restart is needed once the updated logger is installed.

Run `./src/wii/grab_unclipped.sh` from the desktop to capture three seconds of
raw board reports through the Pi's `hidraw` device. It uses `sudo -n` on the Pi
for access, discovers the board by its Bluetooth address, and prints ADC means,
factory zero references, signed kg means, and population stdevs in physical
order 3, 1, 4, 2. Signed kg values extrapolate the lower factory calibration
segment below zero; they are not yet zeroed for the current empty board.
This diagnostic runs alongside the raw-report logger without disconnecting
Bluetooth, re-taring, or writing to the recording CSV. No deploy is needed to
run it.

Edit the files here on the desktop, then run `./src/wii/deploy.sh` from the repo
root. It copies `src/wii` to `~/.local/share/norcalisthenics/wii` on the Pi
and installs, enables, and restarts the dashboard along with restarting the
two board services. **Deploy with the board empty:** the logger
re-tares on restart.

The first full deploy also installs `70-wii-board.rules`, granting the `input`
group access to Nintendo Bluetooth HID devices, reloads udev rules, and applies
them to already connected devices. The logger explicitly has that supplementary
group; it and the dashboard continue to run as `knox`. The power-button service
continues using evdev. This acquisition change requires a **full deploy**;
`--ui` alone cannot install it. No Bluetooth disconnect is required.

Deployment waits up to 30 seconds for tare to finish and prints the first
100 ms average of all four corners to the calling terminal, even when not
recording. The journal also prints all four signed empty-board baselines on
each tare. The reported corners use the same corner order and units
as the CSV. Keep the board connected as well as empty during deployment.
No commit or Git pull is needed for quick iteration.

On the Pi, check the services and their messages with:

```sh
systemctl status pi_wiiboard_weight_logger pi_wiiboard_power_button pi_wiiboard_dashboard
journalctl -u pi_wiiboard_weight_logger -u pi_wiiboard_power_button -u pi_wiiboard_dashboard -f
```

`pi_wiiboard_pair_connect.sh` is for the one-time pairing setup using the red
SYNC button; it is not needed for ordinary front-button use.

## Checks

The page installs error reporting before loading `dashboard.js`. JavaScript
syntax errors, uncaught runtime errors, unhandled promise rejections, and
script loading failures show a prominent red banner with the available
file/line or stack details. Errors also remain visible in the browser console.
The banner does not stop recording on the Pi.

From the repo root, run `python3 tests/wii-dashboard.py`. It exercises the
real dashboard HTTP server and logger with simulated raw HID reports, including
signed conversion, both factory calibration segments, small loads below factory
zero, updated per-corner baselines, report outages, preview/record gating,
negative/zero-load recording, CSV preservation, and stopping on re-tare,
disconnect, and restart. It does not contact the Pi.
Run `node tests/wii-sample-coverage.cjs` for coverage percentage, sample age,
transport delay, delayed-update labeling, and collection/reset checks.
