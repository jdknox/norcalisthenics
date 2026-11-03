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
  The total-load panel also shows the rolling two-second mean and population
  standard deviation of the live 100 ms readings. It waits for two seconds of
  readings and resets on re-tare, disconnect, restart, or a gap over 0.5 seconds.
- Press **Record** to append readings to the CSV; press **Stop** to return to
  preview. Preview does not open, create, or modify the CSV.
- A quick front-button tap stops recording and re-tares; leave the board empty
  again. Disconnecting or restarting also stops recording; it never resumes
  automatically. Closing the browser tab does **not** stop recording.
- Hold the front button for **3 seconds** to disconnect and turn it off.

## Recording

`pi_wiiboard_weight_logger.service` reads the four calibrated corner values
from `/dev/input/event*`, sums them, subtracts the tare, and applies the
current (provisional) calibration factor. While Record is active, it writes
approximately **10 Hz** samples, including zero and sub-1 kg readings, to
`data/wii/wiiboard_weights.csv` on the Pi:

```text
timestamp,total_kg,corner_1_kg,corner_2_kg,corner_3_kg,corner_4_kg
1793242773.123,89.391,22.000,22.000,22.000,22.000
```

Timestamps are Unix epoch seconds. Each corner column is the average in kg
over the same approximately 100 ms window as the total, in input-axis order
16, 17, 18, 19. Corner values are the HID-calibrated readings before tare
subtraction and the provisional calibration factor; `total_kg` retains both
adjustments. Raw sensor readings are not recorded. The CSV is local data,
ignored by Git.

When Record first opens a CSV with a different header (including the old
two-column format), it preserves that file with a nanosecond timestamp, such
as `wiiboard_weights.csv.1793647585873288350.bak`, and starts a new CSV with
the current header. Later recording intervals append to the same file.

The optional bodyweight reference draws a comparison line on the chart; it
does not change calibration or CSV data. A force deficit during movement is
not automatically hand assistance, because body acceleration also changes
the reading.

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

Run `./src/wii/grab_corners.sh` to print the four current corner readings
from the Pi as one comma-separated line in kg, in the same order as the CSV.
These are instantaneous HID values before tare and correction, without
averaging. The board must be connected; no deployment or restart is needed.

Edit the files here on the Mac, then run `./src/wii/deploy.sh` from the repo
root. It copies `src/wii` to `~/.local/share/norcalisthenics/wii` on the Pi
and installs, enables, and restarts the dashboard along with restarting the
two board services. **Deploy with the board empty:** the logger
re-tares on restart.
Deployment waits up to 30 seconds for tare to finish and prints the first
100 ms average of all four corners to the calling terminal, even when not
recording. These use the same corner order and units
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

From the repo root, run `python3 tests/wii-dashboard.py`. It exercises the
real dashboard HTTP server and logger with simulated HID input, including
preview/record gating, zero-load recording, CSV preservation, and stopping
on re-tare, disconnect, and restart. It does not contact the Pi.
