#!/bin/bash
# -------------------------------------------------------------------
# Local auto-update tester
#
# Builds the app at v0.0.1 so electron-updater discovers the real
# latest GitHub release (v0.5.0+) as an available update.
# This lets you test the full Update → Download → Restart flow
# without pushing a new release.
#
# Usage:
#   bash scripts/test-update-local.sh          # build + open
#   bash scripts/test-update-local.sh --open   # skip build, open existing
# -------------------------------------------------------------------
set -e

TEST_VERSION="0.0.1"
ORIGINAL_VERSION=$(node -p "require('./package.json').version")

# --open flag: skip rebuild, just launch the existing test app
if [[ "$1" == "--open" ]]; then
  APP_PATH="release/$TEST_VERSION/mac-arm64/Harnss.app"
  if [[ ! -d "$APP_PATH" ]]; then
    APP_PATH="release/$TEST_VERSION/mac/Harnss.app"
  fi
  if [[ ! -d "$APP_PATH" ]]; then
    echo "No test app found at release/$TEST_VERSION/. Run without --open first."
    exit 1
  fi
  echo "Opening: $APP_PATH"
  open "$APP_PATH"
  exit 0
fi

echo ""
echo "=========================================="
echo " Building test app at v$TEST_VERSION"
echo " (current version: $ORIGINAL_VERSION)"
echo "=========================================="
echo ""

# 1. Temporarily set version to 0.0.1
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('package.json','utf8'));
  p.version = '$TEST_VERSION';
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"
echo "  package.json version set to $TEST_VERSION"

# 2. Build
echo ""
echo "  Building (pnpm dist:mac)..."
pnpm dist:mac

# 3. Restore original version
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('package.json','utf8'));
  p.version = '$ORIGINAL_VERSION';
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"
echo "  package.json version restored to $ORIGINAL_VERSION"

# 4. Find the built app
APP_PATH="release/$TEST_VERSION/mac-arm64/Harnss.app"
if [[ ! -d "$APP_PATH" ]]; then
  APP_PATH="release/$TEST_VERSION/mac/Harnss.app"
fi

echo ""
echo "=========================================="
echo " Done! Test app built at:"
echo "   $APP_PATH"
echo ""
echo " The app will auto-check GitHub releases"
echo " and find v$ORIGINAL_VERSION as an update."
echo ""
echo " Test flow:"
echo "   1. Wait ~5s for update banner"
echo "   2. Click 'Update' to download"
echo "   3. Click 'Restart' to test quitAndInstall"
echo ""
echo " Logs: ~/Library/Logs/Harnss/"
echo "=========================================="
echo ""

# 5. Open the app
echo "Opening test app..."
open "$APP_PATH"
