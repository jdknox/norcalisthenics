# Protein site offline access

Preserve the ability to refresh and use the protein site when the Pi is unreachable. Keep the last usable app page across service worker updates. Serve the live page when reachable and show the cached version warning when serving the saved page. Leave the storage API on the network so the app can sync pending edits on reconnect.

Keep `tests/protein-offline-cache.py` passing when changing the service worker, startup, or page delivery. Run it from the repository root with a Chromium executable as its argument. Remove offline access only if the user explicitly requests its removal.
