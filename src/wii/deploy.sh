#!/bin/sh
set -eu

source_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
remote=rpi
runtime_dir=/home/knox/.local/share/norcalisthenics/wii

ssh "$remote" mkdir -p "$runtime_dir"
rsync -a "$source_dir/" "$remote:$runtime_dir/"

ssh "$remote" sudo install -m 644 "$runtime_dir/pi_wiiboard_power_button.service" "$runtime_dir/pi_wiiboard_weight_logger.service" /etc/systemd/system/
ssh "$remote" sudo systemctl daemon-reload
ssh "$remote" sudo systemctl restart pi_wiiboard_power_button.service pi_wiiboard_weight_logger.service
ssh "$remote" systemctl is-active pi_wiiboard_power_button.service pi_wiiboard_weight_logger.service
