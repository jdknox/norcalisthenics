#!/bin/sh
set -eu

if [ "$#" -ne 0 ]; then
    printf '%s\n' 'Usage: deploy.sh' >&2
    exit 2
fi

repo_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)

git -C "$repo_dir" pushall
ssh -t rpi 'cd dev/norcalisthenics && git pull --ff-only'

printf '%s\n' 'Server checkout updated. Reload the site.'
