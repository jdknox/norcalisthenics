#!/bin/sh
set -eu

if [ "$#" -ne 0 ]; then
    printf '%s\n' 'Usage: deploy.sh' >&2
    exit 2
fi

repo_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
# git pushall also gets its push list from git remote.
remotes=$(git -C "$repo_dir" remote)
export GIT_SSH_COMMAND='ssh -o ConnectTimeout=5 -o ConnectionAttempts=1 -o ServerAliveInterval=5 -o ServerAliveCountMax=1 -o TCPKeepAlive=yes'

git -C "$repo_dir" push forgejo
ssh -t rpi 'cd dev/norcalisthenics && git pull --ff-only'

printf '%s\n' 'Server checkout updated. Reload the site.'

push_status=0
for remote in $remotes; do
    if [ "$remote" = forgejo ]; then
        continue
    fi
    printf 'Pushing %s\n' "$remote"
    if git -C "$repo_dir" push "$remote"; then
        :
    else
        printf 'Push failed: %s\n' "$remote" >&2
        push_status=1
    fi
done
exit "$push_status"
