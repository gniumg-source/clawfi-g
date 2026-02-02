#!/usr/bin/env bash
#
# ClawF Status - Linux/Raspberry Pi
#

set -euo pipefail

INSTALL_DIR="${CLAWF_INSTALL_DIR:-/opt/clawfi}"
DATA_DIR="${CLAWF_DATA_DIR:-/opt/clawfi/data}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
    echo ""
    echo -e "${PURPLE}ClawF Status${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════${NC}"
    echo ""
}

check_service() {
    local service=$1
    local name=$2
    
    if systemctl is-active --quiet "$service"; then
        echo -e "  ${name}: ${GREEN}● Running${NC}"
        return 0
    elif systemctl is-enabled --quiet "$service" 2>/dev/null; then
        echo -e "  ${name}: ${YELLOW}○ Stopped (enabled)${NC}"
        return 1
    else
        echo -e "  ${name}: ${RED}○ Not installed${NC}"
        return 1
    fi
}

check_health() {
    echo -e "\n${CYAN}Health Checks:${NC}"
    
    # Agent API
    if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
        HEALTH=$(curl -sf http://localhost:3001/health 2>/dev/null | jq -r '.status // "unknown"')
        echo -e "  Agent API:  ${GREEN}● Healthy${NC} (status: $HEALTH)"
    else
        echo -e "  Agent API:  ${RED}● Unreachable${NC}"
    fi
    
    # Dashboard
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        echo -e "  Dashboard:  ${GREEN}● Responding${NC}"
    else
        echo -e "  Dashboard:  ${YELLOW}○ Not responding${NC}"
    fi
}

show_version() {
    echo -e "\n${CYAN}Version:${NC}"
    
    if [[ -d "$INSTALL_DIR" ]]; then
        cd "$INSTALL_DIR"
        VERSION=$(node -p "require('./apps/node/package.json').version" 2>/dev/null || echo "unknown")
        COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
        
        echo -e "  Version: ${GREEN}$VERSION${NC}"
        echo -e "  Commit:  ${GREEN}$COMMIT${NC}"
        echo -e "  Branch:  ${GREEN}$BRANCH${NC}"
    else
        echo -e "  ${RED}Not installed${NC}"
    fi
}

show_resources() {
    echo -e "\n${CYAN}Resources:${NC}"
    
    # Memory usage of ClawF processes
    AGENT_MEM=$(ps aux 2>/dev/null | grep "[c]lawfi.*node" | awk '{sum+=$6} END {print sum/1024}' || echo "0")
    echo -e "  Memory:     ${GREEN}${AGENT_MEM}MB${NC} (approx)"
    
    # Data directory size
    if [[ -d "$DATA_DIR" ]]; then
        DATA_SIZE=$(du -sh "$DATA_DIR" 2>/dev/null | cut -f1 || echo "unknown")
        echo -e "  Data Dir:   ${GREEN}$DATA_SIZE${NC}"
    fi
    
    # Disk space
    DISK_AVAIL=$(df -h "$INSTALL_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "unknown")
    echo -e "  Disk Avail: ${GREEN}$DISK_AVAIL${NC}"
}

show_urls() {
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    
    echo -e "\n${CYAN}URLs:${NC}"
    echo -e "  Dashboard:     ${BLUE}http://${LOCAL_IP}:3000${NC}"
    echo -e "  Agent API:     ${BLUE}http://${LOCAL_IP}:3001${NC}"
    echo -e "  Health:        ${BLUE}http://${LOCAL_IP}:3001/health${NC}"
    echo -e "  ClawF Gems:    ${BLUE}http://${LOCAL_IP}:3001/clawf/gems${NC}"
}

show_logs_hint() {
    echo -e "\n${CYAN}Logs:${NC}"
    echo -e "  View agent logs:     ${YELLOW}sudo journalctl -u clawfi -f${NC}"
    echo -e "  View dashboard logs: ${YELLOW}sudo journalctl -u clawfi-dashboard -f${NC}"
    echo -e "  Log files:           ${YELLOW}$DATA_DIR/logs/${NC}"
}

main() {
    print_banner
    
    echo -e "${CYAN}Services:${NC}"
    check_service "clawfi.service" "Agent"
    check_service "clawfi-dashboard.service" "Dashboard"
    
    check_health
    show_version
    show_resources
    show_urls
    show_logs_hint
    
    echo ""
}

main "$@"
