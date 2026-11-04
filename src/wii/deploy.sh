#!/bin/sh
set -eu

source_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
remote=rpi
runtime_dir=/home/knox/.local/share/norcalisthenics/wii

ui_only=false
case "$*" in
    '') ;;
    --ui) ui_only=true ;;
    *)
        printf '%s\n' 'Usage: deploy.sh [--ui]' >&2
        exit 2
        ;;
esac

ui_stage_dir=$(mktemp -d "${TMPDIR:-/tmp}/wii-dashboard-ui.XXXXXX")
trap 'rm -rf "$ui_stage_dir"' 0
python3 "$source_dir/prepare_dashboard_ui.py" "$source_dir" "$ui_stage_dir"

ssh "$remote" mkdir -p "$runtime_dir"
if [ "$ui_only" = false ]; then
    rsync -a --checksum --exclude=__pycache__ "$source_dir/" "$remote:$runtime_dir/"
fi
rsync -a --checksum "$ui_stage_dir/" "$remote:$runtime_dir/"
if [ "$ui_only" = true ]; then
    printf '%s\n' 'Dashboard files updated. Refresh the browser; services, tare, and recording are unchanged.'
    exit 0
fi

ssh "$remote" sudo install -m 644 "$runtime_dir/70-wii-board.rules" /etc/udev/rules.d/
ssh "$remote" sudo udevadm control --reload-rules
ssh "$remote" sudo udevadm trigger --action=change --subsystem-match=hidraw
ssh "$remote" sudo udevadm settle
ssh "$remote" sudo install -m 644 "$runtime_dir/pi_wiiboard_power_button.service" "$runtime_dir/pi_wiiboard_weight_logger.service" "$runtime_dir/pi_wiiboard_dashboard.service" /etc/systemd/system/
ssh "$remote" sudo systemctl daemon-reload
ssh "$remote" sudo systemctl enable pi_wiiboard_dashboard.service
ssh "$remote" sudo systemctl restart pi_wiiboard_power_button.service pi_wiiboard_weight_logger.service pi_wiiboard_dashboard.service
ssh "$remote" systemctl is-active pi_wiiboard_power_button.service pi_wiiboard_weight_logger.service pi_wiiboard_dashboard.service
printf '%s\n' 'Dashboard: http://rpi:8011 (or use the Pi IP address). Recording is stopped.'

printf '%s\n' 'Waiting for tare and corner readings (keep the board connected and empty)...'
ssh "$remote" sh -s <<'SH'
set -eu
invocation_id=$(systemctl show --property=InvocationID --value pi_wiiboard_weight_logger.service)
test -n "$invocation_id"
deadline=$(($(date +%s) + 30))
while [ "$(date +%s)" -lt "$deadline" ]; do
    corners=$(journalctl --quiet --no-pager -o cat "_SYSTEMD_INVOCATION_ID=$invocation_id" |
        sed -n '/^corners after tare:/p' | tail -n 1)
    if [ -n "$corners" ]; then
        printf '%s\n' "$corners"
        exit 0
    fi
    sleep 0.2
done
printf '%s\n' 'Timed out waiting for tare and corner readings; check the board connection and logger journal.' >&2
exit 1
SH
