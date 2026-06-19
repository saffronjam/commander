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
oras pull "$SD_ASSETS_REF" -o "$tmp"

mkdir -p "$dest/map/1763022054"
tar -xzf "$tmp/map-realistic.tar.gz" -C "$dest/map/1763022054"
tar -xzf "$tmp/map-game.tar.gz" -C "$dest/map/1763022054"
tar -xzf "$tmp/scraped-images.tar.gz" --strip-components=1 -C "$dest"

rm -rf "$tmp"
printf '%s' "$SD_ASSETS_REF" > "$marker"
echo "seeded assets from $SD_ASSETS_REF"
