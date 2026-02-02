#!/usr/bin/env bash
#
# ClawF Status - macOS
#

INSTALL_DIR="${CLAWF_INSTALL_DIR:-/usr/local/opt/clawfi}"
DATA_DIR="${HOME}/Library/Application Support/ClawFi"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "\n${PURPLE}ClawF Status - macOS${NC}\n"

echo -e "${BLUE}Services:${NC}"
if launchctl list | grep -q "com.clawfi.agent"; then
    echo -e "  Agent:     ${GREEN}● Running${NC}"
else
    echo -e "  Agent:     ${RED}○ Stopped${NC}"
fi

if launchctl list | grep -q "com.clawfi.dashboard"; then
    echo -e "  Dashboard: ${GREEN}● Running${NC}"
else
    echo -e "  Dashboard: ${RED}○ Stopped${NC}"
fi

echo -e "\n${BLUE}Health:${NC}"
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "  API:       ${GREEN}● Healthy${NC}"
else
    echo -e "  API:       ${RED}○ Unreachable${NC}"
fi

if [[ -d "$INSTALL_DIR" ]]; then
    cd "$INSTALL_DIR"
    VERSION=$(node -p "require('./apps/node/package.json').version" 2>/dev/null || echo "?")
    echo -e "\n${BLUE}Version:${NC}   $VERSION"
fi

LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
echo -e "\n${BLUE}URLs:${NC}"
echo -e "  Dashboard: http://${LOCAL_IP}:3000"
echo -e "  API:       http://${LOCAL_IP}:3001"
echo ""
