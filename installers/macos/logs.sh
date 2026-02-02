#!/usr/bin/env bash
#
# ClawF Logs - macOS
# Usage: ./logs.sh [agent|dashboard] [--follow]
#

DATA_DIR="${HOME}/Library/Application Support/ClawFi"
SERVICE="${1:-agent}"
FOLLOW="${2:-}"

case "$SERVICE" in
    agent)
        LOG_FILE="$DATA_DIR/logs/clawfi.log"
        ;;
    dashboard)
        LOG_FILE="$DATA_DIR/logs/dashboard.log"
        ;;
    *)
        echo "Usage: $0 [agent|dashboard] [--follow]"
        exit 1
        ;;
esac

if [[ ! -f "$LOG_FILE" ]]; then
    echo "Log file not found: $LOG_FILE"
    exit 1
fi

if [[ "$FOLLOW" == "--follow" ]] || [[ "$FOLLOW" == "-f" ]]; then
    tail -f "$LOG_FILE"
else
    tail -100 "$LOG_FILE"
fi
