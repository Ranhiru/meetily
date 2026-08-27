#!/bin/bash

# Build the macOS app bundle and install it into /Applications.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEST_DIR="/Applications"
ASSUME_YES=false

for arg in "$@"; do
    case $arg in
        -y|--yes)
            ASSUME_YES=true
            ;;
        -h|--help)
            echo "Usage: $(basename "$0") [-y|--yes]"
            echo
            echo "Builds the app bundle and installs it to $DEST_DIR."
            echo "  -y, --yes   Replace an existing install without asking."
            echo
            echo "Set TAURI_GPU_FEATURE to override GPU auto-detection."
            exit 0
            ;;
        *)
            echo "Unknown option: $arg" >&2
            exit 1
            ;;
    esac
done

if [[ "$(uname)" != "Darwin" ]]; then
    echo "This script builds macOS app bundles only." >&2
    exit 1
fi

read_config() {
    python3 -c "import json; print(json.load(open('src-tauri/tauri.conf.json'))['$1'])"
}

APP_NAME="$(read_config productName)"
VERSION="$(read_config version)"
DEST="$DEST_DIR/$APP_NAME.app"

FEATURE="${TAURI_GPU_FEATURE:-$(node scripts/auto-detect-gpu.js 2>/dev/null | tail -n1)}"

echo "Building $APP_NAME $VERSION..."

# Signing the updater artifact fails without TAURI_SIGNING_PRIVATE_KEY, long after
# the app itself is built, so the bundle decides success rather than the exit code
set +e
if [[ -n "$FEATURE" && "$FEATURE" != "none" ]]; then
    echo "GPU features: $FEATURE"
    pnpm exec tauri build --bundles app -- --features "$FEATURE"
else
    echo "GPU features: none (CPU-only)"
    pnpm exec tauri build --bundles app
fi
BUILD_STATUS=$?
set -e

# Cargo workspaces put the target dir at the repo root, not under src-tauri
TARGET_DIR="$(cd src-tauri && cargo metadata --no-deps --format-version 1 \
    | python3 -c 'import json, sys; print(json.load(sys.stdin)["target_directory"])')"
BUILT="$TARGET_DIR/release/bundle/macos/$APP_NAME.app"

if [[ ! -d "$BUILT" ]]; then
    echo "Build failed (exit $BUILD_STATUS): $BUILT is missing." >&2
    exit 1
fi

if [[ $BUILD_STATUS -ne 0 ]]; then
    echo "Build reported exit $BUILD_STATUS but the app bundle is present; continuing."
fi

if [[ -e "$DEST" ]]; then
    if [[ "$ASSUME_YES" == false ]]; then
        read -rp "Replace existing $DEST? [y/N] " reply
        if [[ ! "$reply" =~ ^[Yy]$ ]]; then
            echo "Left $DEST untouched. Built app is at $BUILT"
            exit 0
        fi
    fi

    if pgrep -f "$DEST/Contents/MacOS/" > /dev/null 2>&1; then
        echo "Quitting the running $APP_NAME..."
        osascript -e "quit app \"$APP_NAME\"" 2> /dev/null || true
        sleep 2
        pkill -f "$DEST/Contents/MacOS/" 2> /dev/null || true
    fi

    rm -rf "$DEST"
fi

mv "$BUILT" "$DEST"
echo "Installed $DEST"
