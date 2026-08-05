# Map tile downloader

Downloads the interactive-map tiles from satisfactory-calculator.com and cleans them for the
dashboard's Leaflet map.

| File | Purpose |
| --- | --- |
| `download_tiles.py` | fetches a tile pyramid with parallel workers |
| `clean_tiles.py` | strips the gray background from downloaded tiles |
| `justfile` | the recipes below |

Two layers: `gameLayer` (stylized) and `realisticLayer` (satellite-style). Output is a tile pyramid,
`output/<revision>/<layer>/<zoom>/<x>/<y>.png`, copied to
`dashboard/public/assets/images/satisfactory/map/<revision>/`.

## Recipes

```bash
just scrape-map download-all           # both layers
just scrape-map download gameLayer     # one layer (default gameLayer)
just scrape-map clean-tiles            # strip backgrounds across output/
just scrape-map prod                   # clean, then copy into dashboard/public
just scrape-map clean                  # drop venv/ and output/
```

Updating tiles: `download-all` → `prod`.

## Revision

The tile revision (`1763022054`) is hardcoded in **four** places, and all of them must move together
when the game's map data changes:

| Where | Name |
| --- | --- |
| `scripts/scrape_map/justfile` | `revision` |
| root `justfile` | `map_revision` (used by `unpack-assets` / `pack-assets`) |
| `dashboard/src/sections/map/view/map-view.tsx` | the `TileLayer` url |
| `dashboard/src/components/popover-map/PopoverMap.tsx` | the `TileLayer` url |

A mismatch between the frontend URL and the directory on disk renders an empty map rather than an
error, so there is no build-time signal — grep for the old revision after a bump.

## Notes

- Downloads use 10 parallel workers, background cleaning 20.
- `prod` replaces the whole revision directory.
- `output/` is gitignored; `just pack-assets` at the repo root produces the committed git-lfs tarballs.
