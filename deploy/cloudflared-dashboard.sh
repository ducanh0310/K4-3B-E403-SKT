#!/usr/bin/env bash
set -euo pipefail

url_file=/home/ubuntu/apps/discord-ta-bot/data/cloudflare-tunnel-url.txt
mkdir -p "$(dirname "$url_file")"

/home/ubuntu/bin/cloudflared tunnel --url http://127.0.0.1:18787 --no-autoupdate 2>&1 |
while IFS= read -r line; do
  printf '%s\n' "$line"
  if [[ $line =~ https://[a-z0-9-]+\.trycloudflare\.com ]]; then
    printf '%s\n' "${BASH_REMATCH[0]}" > "${url_file}.tmp"
    mv "${url_file}.tmp" "$url_file"
  fi
done
