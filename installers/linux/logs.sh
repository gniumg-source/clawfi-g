#!/usr/bin/env bash
#
# ClawF Logs Viewer - Linux/Raspberry Pi
#
# Usage: ./logs.sh [agent|dashboard|all] [--lines N] [--follow]
#

set -euo pipefail

SERVICE="${1:-all}"
LINES=100
FOLLOW=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        agent|dashboard|all)
            SERVICE="$1"
            shift
            ;;
        --lines|-n)
            LINES="$2"
            shift 2
            ;;
        --follow|-f)
            FOLLOW=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Colors
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

show_logs() {
    local service="$1"
    local unit=""
    
    case "$service" in
        agent)
            unit="clawfi.service"
            ;;
        dashboard)
            unit="clawfi-dashboard.service"
            ;;
    esac
    
    echo -e "${PURPLE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Logs: $service${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════${NC}"
    
    if [[ "$FOLLOW" == true ]]; then
        journalctl -u "$unit" -f --no-pager
    else
        journalctl -u "$unit" -n "$LINES" --no-pager
    fi
}

case "$SERVICE" in
    agent)
        show_logs agent
        ;;
    dashboard)
        show_logs dashboard
        ;;
    all)
        if [[ "$FOLLOW" == true ]]; then
            echo -e "${PURPLE}Following all ClawF logs (Ctrl+C to stop)${NC}"
            journalctl -u "clawfi*" -f --no-pager
        else
            show_logs agent
            echo ""
            show_logs dashboard
        fi
        ;;
    *)
        echo "Usage: $0 [agent|dashboard|all] [--lines N] [--follow|-f]"
        echo ""
        echo "Examples:"
        echo "  $0 agent           # Show last 100 agent logs"
        echo "  $0 dashboard -f    # Follow dashboard logs"
        echo "  $0 all -n 50       # Show last 50 logs from all services"
        exit 1
        ;;
esac
