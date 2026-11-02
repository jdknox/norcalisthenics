#!/bin/sh

address='00:1F:C5:AB:39:A6'
deadline=$(($(date +%s) + 30))

while [ "$(date +%s)" -lt "$deadline" ]
do
    if bluetoothctl info "$address" | grep -q 'Name: Nintendo RVL-WBC-01'
    then
        break
    fi
    sleep 0.2
done

if ! bluetoothctl info "$address" | grep -q 'Name: Nintendo RVL-WBC-01'
then
    printf '%s\n' 'Board was not discovered within 30 seconds.'
    exit 1
fi

if ! timeout 20 bluetoothctl pair "$address"
then
    printf '%s\n' 'Pairing failed.'
    exit 1
fi

if ! bluetoothctl info "$address" | grep -q 'Paired: yes'
then
    printf '%s\n' 'BlueZ did not save a pairing.'
    exit 1
fi

if ! timeout 20 bluetoothctl connect "$address"
then
    printf '%s\n' 'HID input connection failed.'
    exit 1
fi

if ! bluetoothctl info "$address" | grep -q 'Connected: yes'
then
    printf '%s\n' 'The board did not stay connected.'
    exit 1
fi

if ! bluetoothctl trust "$address"
then
    printf '%s\n' 'Could not mark the board trusted.'
    exit 1
fi

bluetoothctl info "$address"
