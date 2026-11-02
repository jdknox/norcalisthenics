# Wii Balance Board on the Pi

The board is paired and trusted with the Raspberry Pi. BlueZ connects it as a
Bluetooth HID input device; the two systemd services read that device. The
Mac Bluetooth experiments and the raw L2CAP reader are **not** the normal
recording path.

## Daily use

- Press the board's **front button** to connect. Keep Bluetooth off on other
  devices that might grab the board (especially the Android phone).
- Recording starts automatically on connection. Leave the board empty for the
  first **2 seconds** while the logger tares.
- A quick front-button tap re-tares; leave the board empty again.
- Hold the front button for **3 seconds** to disconnect and turn it off.

## Recording

`pi_wiiboard_weight_logger.service` reads the four calibrated corner values
from `/dev/input/event*`, sums them, subtracts the tare, and applies the
current (provisional) calibration factor. It writes approximately **10 Hz**
samples above **1 kg** to `data/wii/wiiboard_weights.csv` on the Pi:

```text
timestamp,total_kg
1793242773.123,89.391
```

Timestamps are Unix epoch seconds. The CSV contains only the summed weight,
not the four individual corners or raw sensor readings. The CSV is local data,
ignored by Git.

## Code and logs

Edit the files here on the Mac, then run `./src/wii/deploy.sh` from the repo
root. It copies `src/wii` to `~/.local/share/norcalisthenics/wii` on the Pi
and restarts both services. **Deploy with the board empty:** the logger
re-tares on restart.
No commit or Git pull is needed for quick iteration.

On the Pi, check the services and their messages with:

```sh
systemctl status pi_wiiboard_weight_logger pi_wiiboard_power_button
journalctl -u pi_wiiboard_weight_logger -u pi_wiiboard_power_button -f
```

`pi_wiiboard_pair_connect.sh` is for the one-time pairing setup using the red
SYNC button; it is not needed for ordinary front-button use.
