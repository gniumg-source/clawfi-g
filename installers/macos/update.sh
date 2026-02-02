#!/usr/bin/env bash
#
# ClawF Updater - macOS
#

set -euo pipefail

INSTALL_DIR="${CLAWF_INSTALL_DIR:-/usr/local/opt/clawfi}"
DATA_DIR="${HOME}/Library/Application Support/ClawFi"
LAUNCHD_DIR="${HOME}/Library/LaunchAgents"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }

backup_data() {
    log_info "Creating backup..."
    BACKUP_FILE="$DATA_DIR/backups/pre-update-$(date +%Y%m%d-%H%M%S).tar.gz"
    tar -czf "$BACKUP_FILE" -C "$DATA_DIR" --exclude='backups' --exclude='cache' . 2>/dev/null || true
    log_success "Backup: $BACKUP_FILE"
}

stop_services() {
    log_info "Stopping services..."
    launchctl unload "$LAUNCHD_DIR/com.clawfi.dashboard.plist" 2>/dev/null || true
    launchctl unload "$LAUNCHD_DIR/com.clawfi.agent.plist" 2>/dev/null || true
    sleep 2
    log_success "Services stopped"
}

pull_updates() {
    log_info "Pulling updates..."
    cd "$INSTALL_DIR"
    git pull origin main
    log_success "Source updated"
}

rebuild() {
    log_info "Rebuilding..."
    cd "$INSTALL_DIR"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    pnpm build
    log_success "Build complete"
}

start_services() {
    log_info "Starting services..."
    launchctl load "$LAUNCHD_DIR/com.clawfi.agent.plist"
    launchctl load "$LAUNCHD_DIR/com.clawfi.dashboard.plist"
    sleep 3
    log_success "Services started"
}

print_version() {
    cd "$INSTALL_DIR"
    VERSION=$(node -p "require('./apps/node/package.json').version" 2>/dev/null || echo "unknown")
    echo ""
    log_success "Update complete! Version: $VERSION"
}

main() {
    echo -e "\n${BLUE}ClawF Updater - macOS${NC}\n"
    backup_data
    stop_services
    pull_updates
    rebuild
    start_services
    print_version
}

main "$@"
