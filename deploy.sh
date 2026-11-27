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

use_color=0
if [ -t 1 ]; then
    use_color=1
fi
ssh -t rpi "use_color=$use_color"'
set -e
cd dev/norcalisthenics
git pull --ff-only
reload_message="Server checkout updated. Reload the site."
if [ "$use_color" -eq 1 ]; then
    printf "\033[0;34m%s\033[0m\n" "$reload_message"
else
    printf "%s\n" "$reload_message"
fi
checkout_dir=$(pwd -P)
server_mtime=$(stat -c %Y shared-server.py)
now=$(date +%s)
processes=$(ps -eo pid=,etimes=,comm=,args=)
while read -r pid age process_name command script_path rest; do
    case "$process_name:$script_path" in
        python3:shared-server.py|python3:./shared-server.py) ;;
        *) continue ;;
    esac
    if [ "$(readlink "/proc/$pid/cwd")" != "$checkout_dir" ] || [ "$((now - age))" -ge "$server_mtime" ]; then
        continue
    fi

    restart_message="Restart the Python server to apply changes to shared-server.py."
    if [ "$use_color" -eq 1 ]; then
        printf "\033[1;38;5;208m%s\033[0m\n" "$restart_message"
    else
        printf "%s\n" "$restart_message"
    fi
    break
done <<EOF
$processes
EOF
'

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
