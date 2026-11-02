# RPi Hosting Notes

This repo is meant to run behind freenginx on the RPi with one local Python
server:

```bash
cd /path/to/workout
python3 shared-server.py
```

The server listens on `0.0.0.0:8010`.

## Host routing

- `workout.proovd.com` -> `/` serves `workout-recorder.html`
- `protein.proovd.com` -> `/` serves `protein-loadout.html`
- `/protein-loadout.html` also serves the protein tool directly

Both hostnames can proxy to the same Python process because `shared-server.py`
uses the HTTP `Host` header to choose the root page.

## freenginx server block

Add a second server block for the protein hostname, using the same proxy target
as the workout recorder:

```nginx
server {
    listen 80;
    server_name protein.proovd.com;

    location / {
        proxy_pass http://127.0.0.1:8010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then reload freenginx:

```bash
sudo freenginx -t
sudo systemctl reload freenginx
```

If the installed binary/service is named `nginx`, use these instead:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## DNS and TLS

Point `protein.proovd.com` at the same public IP as `workout.proovd.com`.

If TLS is handled by Certbot, add the hostname to the existing certificate or
issue a new one for this server block:

```bash
sudo certbot --nginx -d protein.proovd.com
```

## Protein storage

`protein-loadout.html` loads `protein-shared-storage.js`, which reads/writes the
existing generic API:

```text
GET  /api/storage?key=protein-loadout:v1
POST /api/storage?key=protein-loadout:v1
```

The server stores that data in:

```text
data/shared-storage.json
```

That file is intentionally git-ignored because it is machine-local user data.

## WiFi stability — the `lxpanel` scanning trap (diagnosed 2026-11-01)

The RPi connects over WiFi (`wlan0`, Broadcom BCM4345/9, `brcmfmac`); `eth0`
is unused. It suffered frequent WiFi drops — the symptom in logs was:

```text
dhcpcd ... wlan0: carrier lost
iw event ... disconnected (local request) reason: 3: ... leaving ... ESS
```

recurring every few minutes (peaking at 200+/day), with crawling throughput
during the worst periods.

### Root cause

The **LXDE panel's network applets scan every few seconds**, and this Broadcom
chip cannot scan all channels without briefly dropping its association. The scans
caused both the `reason 3` disconnects and the slow throughput (the radio spent
more time off-channel scanning than passing data). Two panel plugins were
responsible: `dhcpcdui` (the WiFi-list applet; scanned furiously when its menu or
hover-tooltip was active) and `netman`.

Confirmed by: freezing `lxpanel` (`pkill -STOP lxpanel`) instantly dropped scans
to zero; killing it made web pages load immediately.

### Fix (persistent)

Both network plugins were removed from the panel config:

```text
~/.config/lxpanel/LXDE-pi/panels/panel     (backups: panel.bak-* alongside)
```

A kiosk does not need a panel WiFi applet — WiFi is managed by
`wpa_supplicant.conf` + `dhcpcd`. On boot `lxpanel` reads the clean config and
does not scan.

**Gotcha:** `lxpanelctl restart` does NOT truly reload the config — it keeps old
plugins in memory. Applying a panel config change requires an actual
`pkill lxpanel` (it respawns via `lxsession`) or a reboot.

### Related fixes kept in place (found while chasing this)

- **One `wpa_supplicant`, not two.** A hard power-cut on 2026-10-17 left a second
  `ifupdown`-launched `wpa_supplicant` running alongside the systemd one, both
  fighting over `wlan0` (and holding stale config in memory, defeating edits).
  `wpa_supplicant.service` was disabled so only dhcpcd's hook manages the
  interface: `sudo systemctl disable --now wpa_supplicant.service`.
- **`roamoff=1`** in `/etc/modprobe.d/brcmfmac.conf` disables firmware-side
  roaming (harmless/beneficial; was not the root cause).
- **One present network only** in `wpa_supplicant.conf`. An absent saved network
  (`NYC&SF_5G`) made `wpa_supplicant` scan periodically hunting for it; removed.
  The RPi uses the `SuperMarket2.4G` IoT SSID (BSSID `4a:64:cf:9b:53:7e`).

### How to verify

```bash
# live disconnect/scan reason codes (run detached so it survives drops):
sudo systemd-run --unit=iwcapture /usr/sbin/iw event -t
sudo journalctl -u iwcapture -f

# carrier-lost count over a window:
sudo journalctl -u dhcpcd --since "1 hour ago" | grep -c "carrier lost"

# confirm no panel network plugins:
grep -cE "type=(netman|dhcpcdui)" ~/.config/lxpanel/LXDE-pi/panels/panel   # want 0
```

After the fix: ~13 hours overnight with 0 disconnects / 0 scans (was 200+/day).
