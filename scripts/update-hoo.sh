#!/usr/bin/env bash
set -Eeuo pipefail

INSTALL_DIR="${HOO_INSTALL_DIR:-$HOME/.local/share/hoo-browser}"
BRANCH="${HOO_BRANCH:-main}"
QUIET="${1:-}"
NPM_CACHE_DIR="${HOO_NPM_CACHE_DIR:-$HOME/.cache/hoo-browser/npm}"
KEEP_NPM_CACHE="${HOO_KEEP_NPM_CACHE:-0}"

info() { [[ "$QUIET" == "--quiet" ]] || printf '\033[1;34m[Hoo update]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[Hoo update warning]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[Hoo update error]\033[0m %s\n' "$*" >&2; exit 1; }
size_of() { du -sh "$1" 2>/dev/null | awk '{print $1}' || printf 'unknown'; }

[[ -d "$INSTALL_DIR/.git" ]] || fail "No git install found at $INSTALL_DIR"
command -v git >/dev/null 2>&1 || fail "git is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"

cd "$INSTALL_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  warn "Local changes detected. Skipping automatic update to avoid overwriting work."
  exit 0
fi

info "Checking GitHub for updates"
git fetch --progress origin "$BRANCH"
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  info "Hoo Browser is already up to date."
  exit 0
fi

info "Updating Hoo Browser source"
git pull --ff-only --progress origin "$BRANCH"

info "Installing dependencies efficiently"
mkdir -p "$NPM_CACHE_DIR"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund --prefer-offline --cache "$NPM_CACHE_DIR"
else
  npm install --no-audit --no-fund --prefer-offline --cache "$NPM_CACHE_DIR"
fi
npm prune --omit=optional --no-audit --no-fund || true

info "Building Hoo Browser"
npm run build

if [[ "$KEEP_NPM_CACHE" != "1" ]]; then
  rm -rf "$NPM_CACHE_DIR" || true
fi
find "$INSTALL_DIR" -type d -name .cache -prune -exec rm -rf {} + 2>/dev/null || true

info "Update complete. Install size: $(size_of "$INSTALL_DIR"). Restart Hoo Browser to use the new version."
