# Satisfactory Dashboard - Unified Development Makefile
# Run from project root directory

# Use bun from ~/.bun/bin if not in PATH
BUN := $(shell command -v bun 2>/dev/null || echo "$(HOME)/.bun/bin/bun")

# Container runtime: set CONTAINER_CMD=podman to use podman instead of docker
CONTAINER_CMD ?= docker

# Container image names
APP_IMAGE ?= ghcr.io/saffronjam/satisfactory-dashboard
SEED_IMAGE ?= ghcr.io/saffronjam/satisfactory-dashboard-seed
ASSETS_IMAGE ?= ghcr.io/saffronjam/satisfactory-dashboard-assets
ASSETS_TAG ?= latest

.PHONY: help run frontend backend backend-live kill lint format build clean generate install tidy unpack-assets pack-assets prepare-for-commit assets-publish test test-verbose

# Default target - show help
help:
	@echo "Satisfactory Dashboard Development Commands"
	@echo ""
	@echo "Main Commands:"
	@echo "  make run              - Run both frontend and backend with hot reload"
	@echo "  make frontend         - Run frontend development server (port 3039)"
	@echo "  make backend          - Run backend server (port 8081)"
	@echo "  make backend-live     - Run backend server with hot reload"
	@echo "  make kill             - Kill all development processes"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint             - Run all linters (backend + frontend)"
	@echo "  make format           - Format all code (Go + TypeScript)"
	@echo "  make prepare-for-commit - Run generate, format, and lint"
	@echo ""
	@echo "Build:"
	@echo "  make build            - Build both frontend and backend"
	@echo "  make frontend-build   - Build frontend for production"
	@echo "  make backend-build    - Build backend binary"
	@echo "  make clean            - Clean build artifacts"
	@echo ""
	@echo "Setup:"
	@echo "  make unpack-assets    - Extract LFS assets (run after clone)"
	@echo "  make pack-assets      - Pack assets back to tar files (after updates)"
	@echo "  make install          - Install all dependencies"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Run backend tests"
	@echo "  make test-verbose     - Run backend tests (verbose)"
	@echo ""
	@echo "Other:"
	@echo "  make generate         - Generate TypeScript types from Go structs"
	@echo "  make tidy             - Run go mod tidy"
	@echo ""
	@echo "Deployment (production):"
	@echo "  make docker-build     - Build the app + seeder images"
	@echo "  make assets-publish   - Push the map/icon tiles OCI artifact via ORAS"
	@echo "                          (maintainer-only; ASSETS_TAG=tiles-YYYYMMDD)"
	@echo ""

# ============================================================================
# Main development commands
# ============================================================================

run:
	@echo "Starting Satisfactory Dashboard (frontend + backend with hot reload)..."
	@echo "   Frontend: http://localhost:3039"
	@echo "   Backend:  http://localhost:8081"
	@echo "   Press Ctrl+C to stop both servers"
	@echo ""
	@trap 'kill 0' SIGINT; \
		(cd api && $(shell go env GOPATH)/bin/air) & \
		(cd dashboard && $(BUN) run dev) & \
		wait

frontend:
	@echo "Starting frontend development server..."
	cd dashboard && $(BUN) run dev

backend:
	@echo "Starting backend server..."
	cd api && go run main.go

backend-live:
	@echo "Starting backend server with hot reload..."
	@echo "Watching for changes in api/ directory"
	cd api && $(shell go env GOPATH)/bin/air

kill:
	@echo "Killing all development servers..."
	@-pkill -f "vite" 2>/dev/null || true
	@-pkill -f "air" 2>/dev/null || true
	@-pkill -f "go run" 2>/dev/null || true
	@echo "All servers stopped"

# ============================================================================
# Code quality
# ============================================================================

lint: lint-backend lint-frontend
	@echo "All linting complete"

lint-backend:
	@echo "Running backend linting..."
	cd api && go fmt ./...
	cd api && go vet ./...
	@echo "Backend linting complete"

lint-frontend:
	@echo "Running frontend linting (oxlint)..."
	cd dashboard && $(BUN) run lint
	@echo "Frontend linting complete"

format: format-backend format-frontend
	@echo "All formatting complete"

format-backend:
	@echo "Formatting backend Go code..."
	cd api && find . -name "*.go" -exec gofmt -s -w {} \;
	@echo "Backend formatting complete"

format-frontend:
	@echo "Formatting frontend TypeScript code..."
	cd dashboard && $(BUN) run format:fix
	@echo "Frontend formatting complete"

prepare-for-commit: generate format lint
	@echo "Ready to commit!"

# ============================================================================
# Build
# ============================================================================

build: frontend-build backend-build
	@echo "All builds complete"

backend-build:
	@echo "Building backend binary..."
	cd api && go build -o bin/api main.go
	@echo "Backend binary: api/bin/api"

frontend-build:
	@echo "Building frontend for production (embedded in the Go binary)..."
	cd dashboard && $(BUN) run build
	@touch api/web/dist/.gitkeep
	@echo "Frontend build: api/web/dist/"

# ============================================================================
# Cleanup
# ============================================================================

clean:
	@echo "Cleaning build artifacts..."
	cd api && rm -rf bin/
	cd api && go clean
	cd api && find web/dist -mindepth 1 ! -name .gitkeep -delete
	cd dashboard && rm -rf dist build
	@echo "Cleanup complete"

# ============================================================================
# Other
# ============================================================================

generate:
	@echo "Generating TypeScript types from Go structs..."
	cd api && tygo generate --config export/tygo.yml
	@echo "TypeScript types generated"

install:
	@echo "Installing all dependencies..."
	cd api && go mod tidy
	cd dashboard && $(BUN) install
	@echo "All dependencies installed"

tidy:
	@echo "Running go mod tidy..."
	cd api && go mod tidy
	@echo "Go mod tidy complete"

test:
	@echo "Running backend tests..."
	cd api && go test ./...

test-verbose:
	@echo "Running backend tests (verbose)..."
	cd api && go test -v ./...

# ============================================================================
# Asset management (unpack after clone, pack after updates)
# ============================================================================

# Asset paths
ASSETS_DIR := assets
MAP_DIR := dashboard/public/assets/images/satisfactory/map/1763022054
DASHBOARD_IMAGES := dashboard/public/assets/images/satisfactory

unpack-assets:
	@echo "Extracting LFS assets..."
	@mkdir -p $(MAP_DIR)
	tar -xzf $(ASSETS_DIR)/map-realistic.tar.gz -C $(MAP_DIR)
	tar -xzf $(ASSETS_DIR)/map-game.tar.gz -C $(MAP_DIR)
	@echo "Extracting icons to dashboard..."
	tar -xzf $(ASSETS_DIR)/scraped-images.tar.gz --strip-components=1 -C $(DASHBOARD_IMAGES)
	@echo "Assets unpacked successfully"

pack-assets:
	@echo "Packing assets to tar files..."
	@echo "Packing scraped-images.tar.gz..."
	tar -czf $(ASSETS_DIR)/scraped-images.tar.gz -C $(DASHBOARD_IMAGES) --transform 's,^,output/,' 16x16 32x32 64x64 128x128 256x256
	@echo "Packing map-realistic.tar.gz..."
	tar -czf $(ASSETS_DIR)/map-realistic.tar.gz -C $(MAP_DIR) realistic
	@echo "Packing map-game.tar.gz..."
	tar -czf $(ASSETS_DIR)/map-game.tar.gz -C $(MAP_DIR) game
	@echo "Assets packed successfully"

# ============================================================================
# Docker (full stack)
# ============================================================================

docker-build:
	@echo "Building app + seeder images..."
	$(CONTAINER_CMD) build -t $(APP_IMAGE):latest \
		--label org.opencontainers.image.source=https://github.com/saffronjam/satisfactory-dashboard .
	$(CONTAINER_CMD) build -f deploy/Dockerfile.seed -t $(SEED_IMAGE):latest \
		--label org.opencontainers.image.source=https://github.com/saffronjam/satisfactory-dashboard .

docker-up:
	@echo "Starting all Docker containers..."
	$(CONTAINER_CMD) compose up -d

docker-down:
	@echo "Stopping all Docker containers..."
	$(CONTAINER_CMD) compose down

docker-logs:
	@echo "Showing Docker logs..."
	$(CONTAINER_CMD) compose logs -f

# ============================================================================
# Assets (ORAS artifact publish — maintainer-only, rare)
# ============================================================================

# Publish the map/icon tiles as a versioned OCI artifact via ORAS. Requires the
# `oras` CLI and a registry login. Pull LFS first so the tarballs are real.
# Usage: make assets-publish ASSETS_TAG=tiles-YYYYMMDD
assets-publish:
	@echo "Publishing assets artifact $(ASSETS_IMAGE):$(ASSETS_TAG)..."
	git lfs pull
	cd $(ASSETS_DIR) && oras push $(ASSETS_IMAGE):$(ASSETS_TAG) \
		--artifact-type application/vnd.satisfactory-dashboard.assets \
		map-realistic.tar.gz:application/gzip \
		map-game.tar.gz:application/gzip \
		scraped-images.tar.gz:application/gzip
	@echo "Published $(ASSETS_IMAGE):$(ASSETS_TAG)"
