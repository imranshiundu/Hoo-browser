#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="Zen Browser"
APP_ID="zen-browser"
REPO_URL="${ZEN_REPO_URL:-https://github.com/imranshiundu/zen-browser.git}"
BRANCH="${ZEN_BRANCH:-main}"
INSTALL_DIR="${ZEN_INSTALL_DIR:-$HOME/.local/share/zen-browser}"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
SYSTEMD_DIR="$HOME/.config/systemd/user"
LAUNCHER="$BIN_DIR/zen-browser"
DESKTOP_FILE="$DESKTOP_DIR/zen-browser.desktop"
UPDATE_SCRIPT="$INSTALL_DIR/scripts/update-zen.sh"
SERVICE_FILE="$SYSTEMD_DIR/zen-browser-update.service"
TIMER_FILE="$SYSTEMD_DIR/zen-browser-update.timer"

info() { printf '\033[1;34m[Zen]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[Zen warning]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[Zen error]\033[0m %s\n' "$*" >&2; exit 1; }

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
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
    git -C "$INSTALL_DIR" fetch origin "$BRANCH"
    git -C "$INSTALL_DIR" checkout "$BRANCH"
    git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
  elif [[ -f "package.json" && -d ".git" ]]; then
    info "Installing from current repository into $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  else
    info "Cloning Zen Browser from $REPO_URL"
    git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  fi
}

build_app() {
  info "Installing dependencies"
  npm --prefix "$INSTALL_DIR" install

  info "Building Zen Browser"
  npm --prefix "$INSTALL_DIR" run build
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
Name=$APP_NAME
Comment=DuckDuckGo-first Linux browser shell with isolated web apps
Exec=$LAUNCHER
Terminal=false
Type=Application
Categories=Network;WebBrowser;
StartupNotify=true
StartupWMClass=zen-browser
Icon=web-browser
Keywords=browser;web;duckduckgo;privacy;zen;
EOF
  chmod 644 "$DESKTOP_FILE"

  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
  fi

  info "Desktop entry installed at $DESKTOP_FILE"
}

write_update_timer() {
  mkdir -p "$SYSTEMD_DIR"

  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Update Zen Browser from GitHub
Documentation=https://github.com/imranshiundu/zen-browser

[Service]
Type=oneshot
Environment=ZEN_INSTALL_DIR=$INSTALL_DIR
Environment=ZEN_BRANCH=$BRANCH
ExecStart=$UPDATE_SCRIPT --quiet
EOF

  cat > "$TIMER_FILE" <<EOF
[Unit]
Description=Run Zen Browser update check every 7 days

[Timer]
OnBootSec=20min
OnUnitActiveSec=7d
Persistent=true
Unit=zen-browser-update.service

[Install]
WantedBy=timers.target
EOF

  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload || warn "Could not reload user systemd daemon. You may need to log out and back in."
    systemctl --user enable --now zen-browser-update.timer || warn "Could not enable update timer automatically. Run: systemctl --user enable --now zen-browser-update.timer"
    info "7-day update timer installed: zen-browser-update.timer"
  else
    warn "systemd user timers are unavailable. You can update manually with: $UPDATE_SCRIPT"
  fi
}

main() {
  ensure_linux_desktop
  install_system_packages_hint
  need_command git
  need_command npm
  need_command node

  clone_or_update_repo
  build_app
  write_launcher
  write_desktop_entry
  write_update_timer

  info "Installation complete. Start Zen Browser from your app launcher or run: zen-browser"
}

main "$@"
