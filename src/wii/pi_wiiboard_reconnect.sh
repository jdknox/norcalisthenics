#!/bin/sh

trap 'exit 130' INT TERM

while :
do
    python3 /home/knox/prj/dev/norcalisthenics/src/wii/pi_wiiboard_raw.py
    sleep 0.25
done
