# Satisfactory Image Scraper

Scrapes item and building icons from the Satisfactory Wiki and renders them at every resolution the
dashboard uses.

```bash
just scrape-images              # list every recipe
just scrape-images scrape       # rebuild image_source.json from the wiki
just scrape-images download     # fetch everything in the manifest
just scrape-images prod         # scale and copy into dashboard/public
```

`output/` holds one directory per resolution — `16x16`, `32x32`, `64x64`, `128x128`, `256x256`,
`512x512`, `original` — of which the first five are copied to the dashboard.

For the scripts, the resolution policy, and how these icons reach a deployment, see
[AGENTS.md](AGENTS.md). To drive the scripts by hand:

```bash
source venv/bin/activate
python extract_images_wiki_gg.py --help
python download_images.py --help
python scale_images.py --help
```

Generated locally: `image_source.json` (URL manifest), `filename_map.json` (wiki name → filename),
`downloads/` (raw images), `output/` (scaled). Requires Python 3.x; packages are in `requirement.txt`.
