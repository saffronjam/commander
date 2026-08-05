# Asset scripts

Standalone Python tools that fetch and process the external assets the dashboard ships: item/building
icons and map tiles. Neither runs as part of a build — they are maintainer tools, run only when the
upstream data changes.

| Directory | Produces |
| --- | --- |
| `scrape_images/` | item and building icons from satisfactory.wiki.gg |
| `scrape_map/` | Leaflet map tiles from satisfactory-calculator.com |

## Shared conventions

Each tool is self-contained: its own `venv/`, its own `requirement.txt`, output under `output/`, and
its own justfile module. Both `venv/` and `output/` are gitignored. Recipes depend on `venv`, so the
environment is created on first use.

```bash
just scrape-images         # list the icon recipes
just scrape-map            # list the tile recipes
```

## Asset pipeline

```
upstream  ──just scrape-<tool> download──>  output/
output/   ──just scrape-<tool> prod─────>  dashboard/public/assets/images/satisfactory/
dashboard ──just pack-assets───────────>  assets/*.tar.gz   (git-lfs)
assets/   ──just assets-publish <tag>──>  ghcr.io/...-assets:<tag>   (OCI artifact)
```

Only the last two steps touch the repo: the tarballs under `assets/` are the committed source of
truth, and deployments pull the published OCI artifact rather than git-lfs. Run these when a game
update adds items or buildings (`scrape-images`) or when the map data changes (`scrape-map`).
