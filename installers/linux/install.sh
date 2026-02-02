#!/usr/bin/env bash
#
# ClawF Appliance Installer - Linux/Raspberry Pi
# 
# One-line install:
#   curl -sL https://raw.githubusercontent.com/ClawFiAI/clawfi/main/installers/linux/install.sh | bash
#
# ClawF runs on your Raspberry Pi / Linux server 24/7. Your machine. Your rules.
#

set -euo pipefail

# ============================================
# Configuration
# ============================================

CLAWF_VERSION="${CLAWF_VERSION:-latest}"
INSTALL_DIR="${CLAWF_INSTALL_DIR:-/opt/clawfi}"
DATA_DIR="${CLAWF_DATA_DIR:-/opt/clawfi/data}"
REPO_URL="https://github.com/ClawFiAI/clawfi.git"
SERVICE_USER="${CLAWF_USER:-clawfi}"
NODE_VERSION="20"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================
# Helper Functions
# ============================================

print_banner() {
    echo -e "${PURPLE}"
    echo "  ██████╗██╗      █████╗ ██╗    ██╗███████╗"
    echo " ██╔════╝██║     ██╔══██╗██║    ██║██╔════╝"
    echo " ██║     ██║     ███████║██║ █╗ ██║█████╗  "
    echo " ██║     ██║     ██╔══██║██║███╗██║██╔══╝  "
    echo " ╚██████╗███████╗██║  ██║╚███╔███╔╝██║     "
    echo "  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝     "
    echo -e "${NC}"
    echo -e "${CYAN}ClawF Appliance Installer - Your AI Trading Agent${NC}"
    echo ""
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

detect_arch() {
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64|amd64)
            ARCH="x64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        armv7l|armv7)
            ARCH="armv7"
            ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    log_info "Detected architecture: $ARCH"
}

detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS_ID="$ID"
        OS_VERSION="$VERSION_ID"
    else
        log_error "Cannot detect OS. /etc/os-release not found."
        exit 1
    fi
    log_info "Detected OS: $OS_ID $OS_VERSION"
}

# ============================================
# Dependency Installation
# ============================================

install_dependencies() {
    log_info "Installing system dependencies..."
    
    apt-get update -qq
    
    # Core dependencies
    apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        ca-certificates \
        gnupg \
        lsb-release \
        jq \
        unzip \
        > /dev/null
    
    log_success "System dependencies installed"
}

install_nodejs() {
    if command -v node &> /dev/null; then
        CURRENT_NODE=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$CURRENT_NODE" -ge "$NODE_VERSION" ]]; then
            log_success "Node.js v$(node -v) already installed"
            return
        fi
    fi
    
    log_info "Installing Node.js ${NODE_VERSION}..."
    
    # Use NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null
    
    log_success "Node.js $(node -v) installed"
}

install_pnpm() {
    if command -v pnpm &> /dev/null; then
        log_success "pnpm already installed"
        return
    fi
    
    log_info "Installing pnpm..."
    npm install -g pnpm@latest > /dev/null 2>&1
    log_success "pnpm installed"
}

# ============================================
# User & Directory Setup
# ============================================

create_user() {
    if id "$SERVICE_USER" &>/dev/null; then
        log_success "User $SERVICE_USER already exists"
    else
        log_info "Creating service user: $SERVICE_USER"
        useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER" || true
        log_success "User $SERVICE_USER created"
    fi
}

create_directories() {
    log_info "Creating directories..."
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$DATA_DIR"
    mkdir -p "$DATA_DIR/logs"
    mkdir -p "$DATA_DIR/db"
    mkdir -p "$DATA_DIR/cache"
    mkdir -p "$DATA_DIR/backups"
    
    log_success "Directories created"
}

# ============================================
# ClawF Installation
# ============================================

clone_or_update_repo() {
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        log_info "Updating existing installation..."
        cd "$INSTALL_DIR"
        git fetch origin
        if [[ "$CLAWF_VERSION" == "latest" ]]; then
            git checkout main
            git pull origin main
        else
            git checkout "v$CLAWF_VERSION"
        fi
    else
        log_info "Cloning ClawFi repository..."
        rm -rf "$INSTALL_DIR"/* 2>/dev/null || true
        git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi
    
    log_success "Source code ready"
}

install_npm_packages() {
    log_info "Installing npm packages (this may take a few minutes)..."
    cd "$INSTALL_DIR"
    
    # Install dependencies
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    
    log_success "npm packages installed"
}

build_project() {
    log_info "Building ClawF..."
    cd "$INSTALL_DIR"
    
    pnpm build
    
    log_success "Build complete"
}

# ============================================
# Configuration
# ============================================

generate_secrets() {
    log_info "Generating secrets..."
    
    # Generate master key
    MASTER_KEY=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    
    echo "$MASTER_KEY" > "$DATA_DIR/.master_key"
    chmod 600 "$DATA_DIR/.master_key"
    
    log_success "Secrets generated and secured"
}

create_env_file() {
    ENV_FILE="$DATA_DIR/.env"
    
    if [[ -f "$ENV_FILE" ]]; then
        log_warn "Environment file already exists, preserving..."
        return
    fi
    
    log_info "Creating environment configuration..."
    
    MASTER_KEY=$(cat "$DATA_DIR/.master_key" 2>/dev/null || openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    
    cat > "$ENV_FILE" << EOF
# ============================================
# ClawF Configuration
# Generated on $(date)
# ============================================

# Core
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Security
JWT_SECRET=${JWT_SECRET}
MASTER_KEY=${MASTER_KEY}

# Data Paths
DATA_DIR=${DATA_DIR}
LOG_DIR=${DATA_DIR}/logs

# Database (SQLite for appliance mode)
DATABASE_URL=file:${DATA_DIR}/db/clawfi.db

# Cache
CACHE_DIR=${DATA_DIR}/cache

# Dashboard
DASHBOARD_PORT=3000

# Inference Provider (provider-agnostic)
# Options: remote, local, disabled
INFERENCE_PROVIDER=local
# INFERENCE_API_KEY=
# INFERENCE_ENDPOINT=
# INFERENCE_MODEL=

# Connectors (enable as needed)
# SOLANA_RPC_URL=
# BASE_RPC_URL=
# ETHEREUM_RPC_URL=

# Social Signals (optional)
# SOCIAL_API_KEY=
# SOCIAL_RATE_LIMIT=60

# Kill Switch (safety)
KILL_SWITCH_ENABLED=true
KILL_SWITCH_DEFAULT=false

# Logging
LOG_LEVEL=info
LOG_REDACT_SECRETS=true

# Auto-update (optional)
AUTO_UPDATE=false
UPDATE_CHANNEL=stable
EOF

    chmod 600 "$ENV_FILE"
    log_success "Environment file created"
}

# ============================================
# Systemd Service
# ============================================

install_systemd_service() {
    log_info "Installing systemd service..."
    
    cat > /etc/systemd/system/clawfi.service << EOF
[Unit]
Description=ClawF Intelligence Agent
Documentation=https://github.com/ClawFiAI/clawfi
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${DATA_DIR}/.env
ExecStart=/usr/bin/node ${INSTALL_DIR}/apps/node/dist/index.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=append:${DATA_DIR}/logs/clawfi.log
StandardError=append:${DATA_DIR}/logs/clawfi.error.log

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=${DATA_DIR}
PrivateTmp=yes

# Resource limits
LimitNOFILE=65536
MemoryMax=512M

[Install]
WantedBy=multi-user.target
EOF

    # Dashboard service
    cat > /etc/systemd/system/clawfi-dashboard.service << EOF
[Unit]
Description=ClawF Dashboard
Documentation=https://github.com/ClawFiAI/clawfi
After=clawfi.service
Wants=clawfi.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}/apps/dashboard-new
EnvironmentFile=${DATA_DIR}/.env
ExecStart=/usr/bin/node ${INSTALL_DIR}/apps/dashboard-new/dist/server/entry.mjs
Restart=always
RestartSec=10
StandardOutput=append:${DATA_DIR}/logs/dashboard.log
StandardError=append:${DATA_DIR}/logs/dashboard.error.log

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=${DATA_DIR}
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF

    # Update timer (optional)
    cat > /etc/systemd/system/clawfi-update.service << EOF
[Unit]
Description=ClawF Auto-Update
After=network-online.target

[Service]
Type=oneshot
ExecStart=${INSTALL_DIR}/installers/linux/update.sh --auto
EOF

    cat > /etc/systemd/system/clawfi-update.timer << EOF
[Unit]
Description=ClawF Daily Update Check

[Timer]
OnCalendar=daily
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload
    log_success "Systemd services installed"
}

# ============================================
# Permissions & Startup
# ============================================

set_permissions() {
    log_info "Setting permissions..."
    
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
    
    # Secure sensitive files
    chmod 600 "$DATA_DIR/.env" 2>/dev/null || true
    chmod 600 "$DATA_DIR/.master_key" 2>/dev/null || true
    
    log_success "Permissions set"
}

start_services() {
    log_info "Starting ClawF services..."
    
    systemctl enable clawfi.service
    systemctl enable clawfi-dashboard.service
    systemctl start clawfi.service
    systemctl start clawfi-dashboard.service
    
    # Wait for services to start
    sleep 3
    
    if systemctl is-active --quiet clawfi.service; then
        log_success "ClawF agent service started"
    else
        log_error "ClawF agent failed to start. Check logs: journalctl -u clawfi"
    fi
    
    if systemctl is-active --quiet clawfi-dashboard.service; then
        log_success "ClawF dashboard service started"
    else
        log_warn "Dashboard may take a moment to start"
    fi
}

# ============================================
# Post-Install
# ============================================

print_success() {
    LOCAL_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ClawF Installation Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}Dashboard:${NC}     http://${LOCAL_IP}:3000"
    echo -e "  ${CYAN}Agent API:${NC}     http://${LOCAL_IP}:3001"
    echo -e "  ${CYAN}Health Check:${NC}  http://${LOCAL_IP}:3001/health"
    echo ""
    echo -e "  ${YELLOW}Useful Commands:${NC}"
    echo -e "    View logs:     ${PURPLE}sudo journalctl -u clawfi -f${NC}"
    echo -e "    Check status:  ${PURPLE}sudo systemctl status clawfi${NC}"
    echo -e "    Restart:       ${PURPLE}sudo systemctl restart clawfi${NC}"
    echo -e "    Update:        ${PURPLE}sudo ${INSTALL_DIR}/installers/linux/update.sh${NC}"
    echo ""
    echo -e "  ${YELLOW}Data Directory:${NC}  ${DATA_DIR}"
    echo -e "  ${YELLOW}Config File:${NC}     ${DATA_DIR}/.env"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "  ${PURPLE}ClawF runs on your device 24/7. Your machine. Your rules.${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# ============================================
# Main Installation Flow
# ============================================

main() {
    print_banner
    check_root
    detect_arch
    detect_os
    
    log_info "Starting ClawF installation..."
    echo ""
    
    install_dependencies
    install_nodejs
    install_pnpm
    create_user
    create_directories
    clone_or_update_repo
    install_npm_packages
    build_project
    generate_secrets
    create_env_file
    install_systemd_service
    set_permissions
    start_services
    
    print_success
}

# Run installation
main "$@"
