#!/usr/bin/env bash
set -Eeuo pipefail

INSTALL_DIR="${HOO_INSTALL_DIR:-$HOME/.local/share/hoo-browser}"
BRANCH="${HOO_BRANCH:-main}"
QUIET="${1:-}"

info() { [[ "$QUIET" == "--quiet" ]] || printf '\033[1;34m[Hoo update]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[Hoo update warning]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[Hoo update error]\033[0m %s\n' "$*" >&2; exit 1; }

[[ -d "$INSTALL_DIR/.git" ]] || fail "No git install found at $INSTALL_DIR"
command -v git >/dev/null 2>&1 || fail "git is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"

cd "$INSTALL_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  warn "Local changes detected. Skipping automatic update to avoid overwriting work."
  exit 0
fi

info "Checking GitHub for updates"
git fetch origin "$BRANCH"
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  info "Hoo Browser is already up to date."
  exit 0
fi

info "Updating Hoo Browser"
git pull --ff-only origin "$BRANCH"
npm install
npm run build
info "Update complete. Restart Hoo Browser to use the new version."
