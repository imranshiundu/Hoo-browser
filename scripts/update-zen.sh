#!/usr/bin/env bash
set -Eeuo pipefail

INSTALL_DIR="${HOO_INSTALL_DIR:-$HOME/.local/share/hoo-browser}"
BRANCH="${HOO_BRANCH:-main}"
QUIET=0

if [[ "${1:-}" == "--quiet" ]]; then
  QUIET=1
fi

log() {
  if [[ "$QUIET" -eq 0 ]]; then
    printf '\033[1;34m[Hoo update]\033[0m %s\n' "$*"
  fi
}

warn() { printf '\033[1;33m[Hoo update warning]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[1;31m[Hoo update error]\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || fail "git is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"
[[ -d "$INSTALL_DIR/.git" ]] || fail "Hoo Browser is not installed at $INSTALL_DIR"

cd "$INSTALL_DIR"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  log "Switching from $CURRENT_BRANCH to $BRANCH"
  git checkout "$BRANCH"
fi

LOCAL_SHA="$(git rev-parse HEAD)"
log "Checking for updates on origin/$BRANCH"
git fetch origin "$BRANCH" --quiet
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  log "Already up to date"
  exit 0
fi

if ! git merge-base --is-ancestor "$LOCAL_SHA" "$REMOTE_SHA"; then
  warn "Local installation has commits not on origin/$BRANCH. Update skipped to avoid overwriting local work."
  exit 2
fi

log "Updating Hoo Browser"
git pull --ff-only origin "$BRANCH"
log "Installing dependencies"
npm install
log "Building app"
npm run build
log "Update complete"
