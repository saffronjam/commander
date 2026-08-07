# Satisfactory Dashboard task runner. Run `just` to list every recipe.

set shell := ["bash", "-euo", "pipefail", "-c"]

mod scrape-images 'scripts/scrape_images'
mod scrape-map 'scripts/scrape_map'

api := justfile_directory() / "api"
web := justfile_directory() / "dashboard"
assets := justfile_directory() / "assets"

# Map tile revision. Bump together with `version` in scripts/scrape_map/justfile.
map_revision := "1763022054"
icons_dir := web / "public/assets/images/satisfactory"
tiles_dir := icons_dir / "map" / map_revision

app_image := "ghcr.io/saffronjam/satisfactory-dashboard"
seed_image := "ghcr.io/saffronjam/satisfactory-dashboard-seed"
assets_image := "ghcr.io/saffronjam/satisfactory-dashboard-assets"
source_label := "org.opencontainers.image.source=https://github.com/saffronjam/satisfactory-dashboard"

sqlc_version := "1.31.0"

# Stamped into the Go binary and the SPA so a build can identify itself.
version := shell("git describe --tags --always --dirty 2>/dev/null || echo localbuild")

[private]
default:
    @just --list --unsorted

# --- setup -------------------------------------------------------------------

[group('setup')]
[doc('Install Go and frontend dependencies')]
install:
    cd {{ api }} && go mod tidy
    cd {{ web }} && bun install

[group('setup')]
[doc('Extract the git-lfs map tiles and icons into dashboard/public (run once after clone)')]
unpack-assets:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p "{{ tiles_dir }}"
    tar -xzf "{{ assets }}/map-realistic.tar.gz" -C "{{ tiles_dir }}"
    tar -xzf "{{ assets }}/map-game.tar.gz" -C "{{ tiles_dir }}"
    tar -xzf "{{ assets }}/scraped-images.tar.gz" --strip-components=1 -C "{{ icons_dir }}"

[group('setup')]
[doc('Repack dashboard/public tiles and icons into the git-lfs tarballs')]
pack-assets:
    #!/usr/bin/env bash
    set -euo pipefail
    tar -czf "{{ assets }}/scraped-images.tar.gz" -C "{{ icons_dir }}" \
        --transform 's,^,output/,' 16x16 32x32 64x64 128x128 256x256
    tar -czf "{{ assets }}/map-realistic.tar.gz" -C "{{ tiles_dir }}" realistic
    tar -czf "{{ assets }}/map-game.tar.gz" -C "{{ tiles_dir }}" game

# --- development -------------------------------------------------------------

[group('dev')]
[doc('Run the frontend (:3039) and backend (:8081) together with hot reload')]
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill 0' EXIT
    (cd "{{ api }}" && "$(go env GOPATH)/bin/air") &
    (cd "{{ web }}" && bun run dev) &
    wait

[group('dev')]
[working-directory('dashboard')]
[doc('Run the Vite dev server on :3039, proxying /graphql to the backend')]
web:
    bun run dev

[group('dev')]
[working-directory('api')]
[doc('Run the Go server on :8081')]
api:
    go run .

[group('dev')]
[working-directory('api')]
[doc('Run the Go server on :8081 with hot reload')]
api-live:
    "$(go env GOPATH)/bin/air"

[group('dev')]
[working-directory('api')]
[doc('Run a fake Ficsit Remote Monitoring server on :8080 — add a session at 127.0.0.1:8080')]
frmmock preset='industrial':
    go run ./cmd/frmmock --preset {{ preset }}

[group('dev')]
[doc('Stop stray dev processes (vite, air, go run)')]
kill:
    -pkill -f vite
    -pkill -f air
    -pkill -f 'go run'
    -pkill -f frmmock

# --- checks ------------------------------------------------------------------

[group('check')]
[doc('Everything CI runs: formatting, lint, typecheck, tests, codegen drift')]
check: format-check lint typecheck test check-generated

[group('check')]
[doc('Format Go and frontend source in place')]
format:
    cd {{ api }} && gofmt -s -w .
    cd {{ web }} && bun run format:fix

[group('check')]
[doc('Verify formatting without writing')]
format-check:
    #!/usr/bin/env bash
    set -euo pipefail
    unformatted="$(cd "{{ api }}" && gofmt -s -l .)"
    if [[ -n "$unformatted" ]]; then
        echo "gofmt: not formatted:" >&2
        echo "$unformatted" >&2
        exit 1
    fi
    cd "{{ web }}" && bun run format

[group('check')]
[doc('Run go vet and oxlint')]
lint:
    cd {{ api }} && go vet ./...
    cd {{ web }} && bun run lint

[group('check')]
[doc('Compile the Go packages and type-check the frontend')]
typecheck:
    cd {{ api }} && go build ./...
    cd {{ web }} && bunx tsc --noEmit

[group('check')]
[working-directory('api')]
[doc('Run the Go tests with the race detector')]
test:
    go test ./... -race -count=1

[group('check')]
[doc('Fail if any committed generated file is out of date')]
check-generated: generate
    @git diff --exit-code -- \
        api/internal/graph/generated.go \
        api/internal/graph/model \
        api/internal/store/sqlite \
        dashboard/src/gql \
        dashboard/src/apiTypes.ts \
        || { echo "generated code is stale — commit the files above" >&2; exit 1; }

# --- code generation ---------------------------------------------------------

[group('codegen')]
[doc('Regenerate everything: SQL, GraphQL server, GraphQL client, domain types')]
generate: sqlc gqlgen codegen tygo

[group('codegen')]
[working-directory('api')]
[doc('Generate the SQLite query layer from internal/store/{queries,migrations}')]
sqlc:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v sqlc >/dev/null || {
        echo "sqlc not installed (expected v{{ sqlc_version }})" >&2
        exit 1
    }
    sqlc generate

[group('codegen')]
[working-directory('api')]
[doc('Generate the gqlgen exec + models from schema.graphql (leaves resolvers_*.go alone)')]
gqlgen:
    go run github.com/99designs/gqlgen generate --config gqlgen.yml

[group('codegen')]
[working-directory('dashboard')]
[doc('Generate the typed GraphQL client into src/gql from schema.graphql')]
codegen:
    bun run codegen

[group('codegen')]
[working-directory('api')]
[doc('Generate dashboard/src/apiTypes.ts from the Go domain models')]
tygo:
    go run github.com/gzuidhof/tygo generate --config export/tygo.yml

# --- database ----------------------------------------------------------------

[group('db')]
[working-directory('api')]
[doc('Apply all pending migrations (the server also does this at boot)')]
migrate-up n="":
    go run . migrate up {{ n }}

[group('db')]
[working-directory('api')]
[doc('Roll back N migrations')]
migrate-down n="1":
    go run . migrate down {{ n }}

[group('db')]
[working-directory('api')]
[doc('Print the current migration version')]
migrate-version:
    go run . migrate version

# --- build -------------------------------------------------------------------

[group('build')]
[doc('Build the SPA into api/web/dist, then the Go binary into api/bin/api')]
build: build-web build-api

# Vite empties its output dir, so the .gitkeep that lets `go:embed all:dist`
# compile on a clean checkout has to be put back after every build.
[group('build')]
[working-directory('dashboard')]
[doc('Build the SPA into api/web/dist (embedded by the Go binary)')]
build-web:
    VITE_BUILD_VERSION={{ version }} bun run build
    touch {{ api }}/web/dist/.gitkeep

[group('build')]
[working-directory('api')]
[doc('Build the Go binary into api/bin/api')]
build-api:
    go build -ldflags "-X api/internal/version.Version={{ version }}" -o bin/api .

[group('build')]
[doc('Build the app and seeder container images tagged with the current version')]
package:
    docker build --build-arg VERSION={{ version }} --label {{ source_label }} \
        -t {{ app_image }}:{{ version }} -t {{ app_image }}:latest .
    docker build -f deploy/Dockerfile.seed --label {{ source_label }} \
        -t {{ seed_image }}:latest .

[group('build')]
[confirm('Remove build artifacts and the built SPA? [y/N]')]
[doc('Remove build artifacts')]
clean:
    #!/usr/bin/env bash
    set -euo pipefail
    rm -rf "{{ api }}/bin" "{{ web }}/dist"
    find "{{ api }}/web/dist" -mindepth 1 ! -name .gitkeep -delete
    cd "{{ api }}" && go clean

# --- deployment --------------------------------------------------------------

[group('deploy')]
[doc('Start the seeder and app containers')]
up:
    docker compose up -d

[group('deploy')]
[doc('Stop the containers')]
down:
    docker compose down

[group('deploy')]
[doc('Follow the app logs')]
logs:
    docker compose logs -f app

[group('deploy')]
[working-directory('assets')]
[confirm('Push the map/icon tiles artifact to the registry? [y/N]')]
[doc('Publish the map/icon tiles OCI artifact, e.g. `just assets-publish tiles-20260804`')]
assets-publish tag:
    git lfs pull
    oras push {{ assets_image }}:{{ tag }} \
        --artifact-type application/vnd.satisfactory-dashboard.assets \
        map-realistic.tar.gz:application/gzip \
        map-game.tar.gz:application/gzip \
        scraped-images.tar.gz:application/gzip
