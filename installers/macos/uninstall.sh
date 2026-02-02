#!/usr/bin/env bash
#
# ClawF Uninstaller - macOS
# Usage: ./uninstall.sh [--purge]
#

set -euo pipefail

INSTALL_DIR="${CLAWF_INSTALL_DIR:-/usr/local/opt/clawfi}"
DATA_DIR="${HOME}/Library/Application Support/ClawFi"
LAUNCHD_DIR="${HOME}/Library/LaunchAgents"
PURGE="${1:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}ClawF Uninstaller${NC}"

if [[ "$PURGE" == "--purge" ]]; then
    echo -e "${RED}WARNING: --purge will delete ALL data${NC}"
fi

read -p "Uninstall ClawF? [y/N] " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && exit 0

echo "Stopping services..."
launchctl unload "$LAUNCHD_DIR/com.clawfi.dashboard.plist" 2>/dev/null || true
launchctl unload "$LAUNCHD_DIR/com.clawfi.agent.plist" 2>/dev/null || true

echo "Removing launchd plists..."
rm -f "$LAUNCHD_DIR/com.clawfi.agent.plist"
rm -f "$LAUNCHD_DIR/com.clawfi.dashboard.plist"

echo "Removing installation..."
sudo rm -rf "$INSTALL_DIR"

if [[ "$PURGE" == "--purge" ]]; then
    echo "Removing all data..."
    rm -rf "$DATA_DIR"
else
    echo -e "${YELLOW}Data preserved at: $DATA_DIR${NC}"
fi

echo -e "${GREEN}ClawF uninstalled.${NC}"
