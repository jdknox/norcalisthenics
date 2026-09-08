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
