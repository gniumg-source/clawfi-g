#!/usr/bin/env bash
#
# ClawF Uninstaller - Linux/Raspberry Pi
#
# Usage: sudo ./uninstall.sh [--purge]
#   --purge: Also remove all data (database, configs, logs)
#

set -euo pipefail

INSTALL_DIR="${CLAWF_INSTALL_DIR:-/opt/clawfi}"
DATA_DIR="${CLAWF_DATA_DIR:-/opt/clawfi/data}"
PURGE="${1:-}"

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

confirm_uninstall() {
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  WARNING: This will uninstall ClawF${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    if [[ "$PURGE" == "--purge" ]]; then
        echo -e "${RED}  --purge flag detected: ALL DATA WILL BE DELETED${NC}"
        echo -e "  This includes: database, configs, logs, backups"
        echo ""
    else
        echo -e "  Data directory will be preserved: $DATA_DIR"
        echo -e "  Use --purge to remove all data"
        echo ""
    fi
    
    read -p "Are you sure you want to continue? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Uninstall cancelled."
        exit 0
    fi
}

stop_services() {
    log_info "Stopping services..."
    systemctl stop clawfi-dashboard.service 2>/dev/null || true
    systemctl stop clawfi.service 2>/dev/null || true
    systemctl stop clawfi-update.timer 2>/dev/null || true
    log_success "Services stopped"
}

disable_services() {
    log_info "Disabling services..."
    systemctl disable clawfi-dashboard.service 2>/dev/null || true
    systemctl disable clawfi.service 2>/dev/null || true
    systemctl disable clawfi-update.timer 2>/dev/null || true
    log_success "Services disabled"
}

remove_service_files() {
    log_info "Removing service files..."
    rm -f /etc/systemd/system/clawfi.service
    rm -f /etc/systemd/system/clawfi-dashboard.service
    rm -f /etc/systemd/system/clawfi-update.service
    rm -f /etc/systemd/system/clawfi-update.timer
    systemctl daemon-reload
    log_success "Service files removed"
}

remove_installation() {
    log_info "Removing installation directory..."
    
    # Keep data directory unless purging
    if [[ "$PURGE" != "--purge" ]]; then
        # Move data dir temporarily
        if [[ -d "$DATA_DIR" ]]; then
            mv "$DATA_DIR" "/tmp/clawfi-data-backup-$$" 2>/dev/null || true
        fi
    fi
    
    rm -rf "$INSTALL_DIR"
    
    # Restore data if not purging
    if [[ "$PURGE" != "--purge" ]] && [[ -d "/tmp/clawfi-data-backup-$$" ]]; then
        mkdir -p "$(dirname "$DATA_DIR")"
        mv "/tmp/clawfi-data-backup-$$" "$DATA_DIR"
    fi
    
    log_success "Installation removed"
}

remove_data() {
    if [[ "$PURGE" == "--purge" ]]; then
        log_warn "Removing all data (--purge)..."
        rm -rf "$DATA_DIR"
        log_success "Data removed"
    else
        log_info "Data preserved at: $DATA_DIR"
    fi
}

remove_user() {
    if id "clawfi" &>/dev/null; then
        log_info "Removing service user..."
        userdel clawfi 2>/dev/null || true
        log_success "User removed"
    fi
}

print_complete() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ClawF Uninstalled${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    if [[ "$PURGE" != "--purge" ]]; then
        echo -e "  Data preserved at: ${YELLOW}$DATA_DIR${NC}"
        echo -e "  To completely remove, run: ${YELLOW}sudo rm -rf $DATA_DIR${NC}"
    else
        echo -e "  All data has been removed."
    fi
    
    echo ""
    echo -e "  To reinstall:"
    echo -e "    ${BLUE}curl -sL https://raw.githubusercontent.com/ClawFiAI/clawfi/main/installers/linux/install.sh | sudo bash${NC}"
    echo ""
}

main() {
    check_root
    confirm_uninstall
    stop_services
    disable_services
    remove_service_files
    remove_installation
    remove_data
    remove_user
    print_complete
}

main "$@"
