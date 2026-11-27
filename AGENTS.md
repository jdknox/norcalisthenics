# Start of each chat

1. Read [code-style](/home/knox/.config/agents/skills/code-style/SKILL.md) and [shell-command-rules](/home/knox/.config/agents/skills/shell-command-rules/SKILL.md). Give an extremely brief summary of what to avoid. Keep replies brief throughout the chat and avoid walls of text.
2. Give an extremely brief summary of what to do.

# Protein site offline access

Preserve the ability to refresh and use the protein site when the Pi is unreachable. Keep the last usable app page across service worker updates. Serve the live page when reachable and show the cached version warning when serving the saved page. Leave the storage API on the network so the app can sync pending edits on reconnect.

Keep `tests/protein-offline-cache.py` passing when changing the service worker, startup, or page delivery. Run it from the repository root with a Chromium executable as its argument. Remove offline access only if the user explicitly requests its removal.
