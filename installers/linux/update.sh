#!/usr/bin/env bash
#
# ClawF Updater - Linux/Raspberry Pi
#
# Usage: sudo ./update.sh [--auto]
#

set -euo pipefail

INSTALL_DIR="${CLAWF_INSTALL_DIR:-/opt/clawfi}"
DATA_DIR="${CLAWF_DATA_DIR:-/opt/clawfi/data}"
AUTO_MODE="${1:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

backup_data() {
    log_info "Creating backup..."
    BACKUP_FILE="$DATA_DIR/backups/pre-update-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    tar -czf "$BACKUP_FILE" \
        -C "$DATA_DIR" \
        --exclude='backups' \
        --exclude='cache' \
        . 2>/dev/null || true
    
    log_success "Backup created: $BACKUP_FILE"
}

check_for_updates() {
    log_info "Checking for updates..."
    cd "$INSTALL_DIR"
    
    git fetch origin main --quiet
    
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    
    if [[ "$LOCAL" == "$REMOTE" ]]; then
        log_success "Already up to date"
        if [[ "$AUTO_MODE" == "--auto" ]]; then
            exit 0
        fi
        read -p "Force reinstall? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    else
        log_info "Update available: $LOCAL -> $REMOTE"
    fi
}

stop_services() {
    log_info "Stopping services..."
    systemctl stop clawfi-dashboard.service 2>/dev/null || true
    systemctl stop clawfi.service 2>/dev/null || true
    sleep 2
    log_success "Services stopped"
}

pull_updates() {
    log_info "Pulling updates..."
    cd "$INSTALL_DIR"
    git pull origin main
    log_success "Source updated"
}

install_dependencies() {
    log_info "Updating dependencies..."
    cd "$INSTALL_DIR"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    log_success "Dependencies updated"
}

rebuild() {
    log_info "Rebuilding..."
    cd "$INSTALL_DIR"
    pnpm build
    log_success "Build complete"
}

start_services() {
    log_info "Starting services..."
    systemctl start clawfi.service
    systemctl start clawfi-dashboard.service
    sleep 3
    
    if systemctl is-active --quiet clawfi.service; then
        log_success "ClawF agent started"
    else
        log_error "Agent failed to start"
    fi
    
    if systemctl is-active --quiet clawfi-dashboard.service; then
        log_success "Dashboard started"
    else
        log_warn "Dashboard may take a moment"
    fi
}

verify_health() {
    log_info "Verifying health..."
    sleep 2
    
    if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
        log_success "Health check passed"
    else
        log_warn "Health check pending (service may still be starting)"
    fi
}

print_version() {
    cd "$INSTALL_DIR"
    VERSION=$(node -p "require('./apps/node/package.json').version" 2>/dev/null || echo "unknown")
    COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    
    echo ""
    log_success "Update complete!"
    echo ""
    echo -e "  Version: ${GREEN}$VERSION${NC}"
    echo -e "  Commit:  ${GREEN}$COMMIT${NC}"
    echo ""
}

main() {
    echo ""
    echo -e "${BLUE}ClawF Updater${NC}"
    echo ""
    
    check_root
    backup_data
    check_for_updates
    stop_services
    pull_updates
    install_dependencies
    rebuild
    start_services
    verify_health
    print_version
}

main "$@"
