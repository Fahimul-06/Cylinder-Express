#!/usr/bin/env bash
set -euo pipefail

echo "Using Node: $(node -v)"
echo "Using npm: $(npm -v)"

# Clean stale dependency folders left by failed Render builds.
rm -rf node_modules
rm -rf /tmp/npm-cache
mkdir -p /tmp/npm-cache
export npm_config_cache=/tmp/npm-cache
export npm_config_audit=false
export npm_config_fund=false
export npm_config_progress=false
export npm_config_prefer_offline=false

npm ci --omit=dev --no-audit --no-fund --prefer-online
