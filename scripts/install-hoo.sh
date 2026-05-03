#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="Hoo Browser"
APP_ID="hoo-browser"
REPO_URL="${HOO_REPO_URL:-https://github.com/imranshiundu/Hoo-browser.git}"
BRANCH="${HOO_BRANCH:-main}"
INSTALL_DIR="${HOO_INSTALL_DIR:-$HOME/.local/share/hoo-browser}"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
SYSTEMD_DIR="$HOME/.config/systemd/user"
LAUNCHER="$BIN_DIR/hoo-browser"
DESKTOP_FILE="$DESKTOP_DIR/hoo-browser.desktop"
UPDATE_SCRIPT="$INSTALL_DIR/scripts/update-hoo.sh"
SERVICE_FILE="$SYSTEMD_DIR/hoo-browser-update.service"
TIMER_FILE="$SYSTEMD_DIR/hoo-browser-update.timer"
NPM_CACHE_DIR="${HOO_NPM_CACHE_DIR:-$HOME/.cache/hoo-browser/npm}"
KEEP_NPM_CACHE="${HOO_KEEP_NPM_CACHE:-0}"

info() { printf '\033[1;34m[Hoo]\033[0m %s\n' "$*"; }
step() { printf '\n\033[1;36m[Hoo %s/7]\033[0m %s\n' "$1" "$2"; }
warn() { printf '\033[1;33m[Hoo warning]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[Hoo error]\033[0m %s\n' "$*" >&2; exit 1; }

need_command() { command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"; }

human_size() {
  du -sh "$1" 2>/dev/null | awk '{print $1}' || printf 'unknown'
}

ensure_linux_desktop() {
  if [[ "${OSTYPE:-}" != linux* ]]; then
    fail "This installer currently supports Linux desktop systems only."
  fi
}

install_system_packages_hint() {
  if command -v apt >/dev/null 2>&1; then
    warn "If installation fails because Node.js/npm/git is missing, run: sudo apt update && sudo apt install -y git nodejs npm"
  elif command -v dnf >/dev/null 2>&1; then
    warn "If installation fails because Node.js/npm/git is missing, run: sudo dnf install -y git nodejs npm"
  elif command -v pacman >/dev/null 2>&1; then
    warn "If installation fails because Node.js/npm/git is missing, run: sudo pacman -S git nodejs npm"
  fi
}

clone_or_update_repo() {
  mkdir -p "$(dirname "$INSTALL_DIR")"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Existing installation found at $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch --progress origin "$BRANCH"
    git -C "$INSTALL_DIR" checkout "$BRANCH"
    git -C "$INSTALL_DIR" pull --ff-only --progress origin "$BRANCH"
  else
    info "Cloning Hoo Browser from $REPO_URL"
    git clone --progress --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  fi
  info "Source size: $(human_size "$INSTALL_DIR")"
}

install_dependencies() {
  mkdir -p "$NPM_CACHE_DIR"
  cd "$INSTALL_DIR"
  if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund --prefer-offline --cache "$NPM_CACHE_DIR"
  else
    npm install --no-audit --no-fund --prefer-offline --cache "$NPM_CACHE_DIR"
  fi
  npm prune --omit=optional --no-audit --no-fund || true
  info "node_modules size: $(human_size "$INSTALL_DIR/node_modules")"
}

build_app() {
  cd "$INSTALL_DIR"
  npm run build
}

cleanup_after_build() {
  if [[ "$KEEP_NPM_CACHE" != "1" ]]; then
    rm -rf "$NPM_CACHE_DIR" || true
  fi
  find "$INSTALL_DIR" -type d -name .cache -prune -exec rm -rf {} + 2>/dev/null || true
  info "Final install size: $(human_size "$INSTALL_DIR")"
}

write_launcher() {
  mkdir -p "$BIN_DIR"
  cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
set -e
cd "$INSTALL_DIR"
exec npm start -- "\$@"
EOF
  chmod +x "$LAUNCHER"
  info "Launcher installed at $LAUNCHER"
}

write_desktop_entry() {
  mkdir -p "$DESKTOP_DIR"
  cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Version=1.0
Name=$APP_NAME
GenericName=Web Browser
Comment=Owl-guided DuckDuckGo-first browser with isolated web apps
Exec=$LAUNCHER %U
Terminal=false
Type=Application
Categories=Network;WebBrowser;
StartupNotify=true
StartupWMClass=Hoo Browser
Icon=web-browser
MimeType=text/html;text/xml;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;
Keywords=browser;web;duckduckgo;privacy;hoo;owl;
EOF
  chmod 644 "$DESKTOP_FILE"
  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
  fi
  if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache "$HOME/.local/share/icons" >/dev/null 2>&1 || true
  fi
  info "Desktop entry installed at $DESKTOP_FILE"
}

write_update_timer() {
  mkdir -p "$SYSTEMD_DIR"
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Update Hoo Browser from GitHub
Documentation=https://github.com/imranshiundu/Hoo-browser

[Service]
Type=oneshot
Environment=HOO_INSTALL_DIR=$INSTALL_DIR
Environment=HOO_BRANCH=$BRANCH
ExecStart=$UPDATE_SCRIPT --quiet
EOF

  cat > "$TIMER_FILE" <<EOF
[Unit]
Description=Run Hoo Browser update check every 7 days

[Timer]
OnBootSec=20min
OnUnitActiveSec=7d
Persistent=true
Unit=hoo-browser-update.service

[Install]
WantedBy=timers.target
EOF

  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload || warn "Could not reload user systemd daemon. You may need to log out and back in."
    systemctl --user enable --now hoo-browser-update.timer || warn "Could not enable update timer automatically. Run: systemctl --user enable --now hoo-browser-update.timer"
    info "7-day update timer installed: hoo-browser-update.timer"
  else
    warn "systemd user timers are unavailable. You can update manually with: $UPDATE_SCRIPT"
  fi
}

main() {
  ensure_linux_desktop
  install_system_packages_hint
  step 1 "Checking required tools"
  need_command git
  need_command npm
  need_command node
  step 2 "Downloading Hoo source"
  clone_or_update_repo
  step 3 "Installing production build dependencies"
  install_dependencies
  step 4 "Building Hoo Browser"
  build_app
  step 5 "Cleaning temporary install cache"
  cleanup_after_build
  step 6 "Creating launcher and app menu entry"
  write_launcher
  write_desktop_entry
  step 7 "Installing 7-day update timer"
  write_update_timer
  info "Installation complete. Start Hoo Browser from your app launcher or run: hoo-browser"
  info "If the app list does not refresh immediately, log out/in or run: update-desktop-database $DESKTOP_DIR"
}

main "$@"
