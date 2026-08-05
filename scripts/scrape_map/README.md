# Satisfactory Map Tile Downloader

Downloads and processes map tiles from the Satisfactory Interactive Map for the dashboard's Leaflet
map component.

```bash
just scrape-map                # list every recipe
just scrape-map download-all   # fetch both tile layers
just scrape-map prod           # clean the tiles and copy them into dashboard/public
```

Output is a tile pyramid, `output/<revision>/<game|realistic>/<zoom>/<x>/<y>.png`.

For the scripts, the revision bump checklist, and how these tiles reach a deployment, see
[AGENTS.md](AGENTS.md). To drive the scripts by hand:

```bash
source venv/bin/activate
python download_tiles.py --help
python clean_tiles.py --help
```

Requires Python 3.x; packages are listed in `requirement.txt`.
