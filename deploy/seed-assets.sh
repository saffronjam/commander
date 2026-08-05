#!/bin/sh
set -eu
: "${SD_ASSETS_REF:?SD_ASSETS_REF must be set (e.g. ghcr.io/<owner>/satisfactory-dashboard-assets:tiles-YYYYMMDD)}"

dest="/assets/images/satisfactory"
marker="/assets/.assets-ref"

if [ -f "$marker" ] && [ "$(cat "$marker")" = "$SD_ASSETS_REF" ]; then
	echo "assets already present for $SD_ASSETS_REF — skipping"
	exit 0
fi

tmp="$(mktemp -d)"

# oras drops its progress bar when stdout is not a TTY, which is always the case
# under docker compose and kubectl logs. On a multi-gigabyte artifact that leaves
# several minutes of silence that reads like a hang, so report progress from the
# layer sizes in the manifest instead.
total_kb=$(
	oras manifest fetch "$SD_ASSETS_REF" 2>/dev/null |
		tr ',' '\n' | grep -o '"size":[0-9]*' | cut -d: -f2 |
		awk '{ sum += $1 } END { printf "%d", sum / 1024 }'
) || total_kb=0

echo "pulling assets from $SD_ASSETS_REF"

oras pull "$SD_ASSETS_REF" -o "$tmp" &
pull_pid=$!

while kill -0 "$pull_pid" 2>/dev/null; do
	sleep 10
	got_kb=$(du -sk "$tmp" 2>/dev/null | cut -f1) || continue
	if [ "${total_kb:-0}" -gt 0 ]; then
		echo "  ${got_kb}KiB of ${total_kb}KiB ($((got_kb * 100 / total_kb))%)"
	else
		echo "  ${got_kb}KiB"
	fi
done

# Propagates the pull's exit status under set -e, so a failed pull still fails
# the container rather than falling through to an empty extract.
wait "$pull_pid"

echo "extracting map tiles"
mkdir -p "$dest/map/1763022054"
tar -xzf "$tmp/map-realistic.tar.gz" -C "$dest/map/1763022054"
tar -xzf "$tmp/map-game.tar.gz" -C "$dest/map/1763022054"
echo "extracting icons"
tar -xzf "$tmp/scraped-images.tar.gz" --strip-components=1 -C "$dest"

rm -rf "$tmp"
printf '%s' "$SD_ASSETS_REF" > "$marker"
echo "seeded assets from $SD_ASSETS_REF"
