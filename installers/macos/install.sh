#!/usr/bin/env bash
#
# ClawF Appliance Installer - macOS (Mac mini)
#
# One-line install:
#   curl -sL https://raw.githubusercontent.com/ClawFiAI/clawfi/main/installers/macos/install.sh | bash
#
# ClawF runs on your Mac mini 24/7. Your machine. Your rules.
#

set -euo pipefail

# ============================================
# Configuration
# ============================================

CLAWF_VERSION="${CLAWF_VERSION:-latest}"
INSTALL_DIR="${CLAWF_INSTALL_DIR:-/usr/local/opt/clawfi}"
DATA_DIR="${HOME}/Library/Application Support/ClawFi"
REPO_URL="https://github.com/ClawFiAI/clawfi.git"
LAUNCHD_DIR="${HOME}/Library/LaunchAgents"
NODE_VERSION="20"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

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
    echo -e "${CYAN}ClawF Appliance Installer - macOS${NC}"
    echo ""
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_macos() {
    if [[ "$(uname)" != "Darwin" ]]; then
        log_error "This installer is for macOS only"
        exit 1
    fi
    log_info "macOS detected: $(sw_vers -productVersion)"
}

detect_arch() {
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)
            ARCH="x64"
            ;;
        arm64)
            ARCH="arm64"
            ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    log_info "Architecture: $ARCH"
}

# ============================================
# Dependencies
# ============================================

install_homebrew() {
    if command -v brew &> /dev/null; then
        log_success "Homebrew already installed"
        return
    fi
    
    log_info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add brew to path for Apple Silicon
    if [[ "$ARCH" == "arm64" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    
    log_success "Homebrew installed"
}

install_nodejs() {
    if command -v node &> /dev/null; then
        CURRENT_NODE=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$CURRENT_NODE" -ge "$NODE_VERSION" ]]; then
            log_success "Node.js $(node -v) already installed"
            return
        fi
    fi
    
    log_info "Installing Node.js ${NODE_VERSION}..."
    brew install node@${NODE_VERSION}
    log_success "Node.js installed"
}

install_pnpm() {
    if command -v pnpm &> /dev/null; then
        log_success "pnpm already installed"
        return
    fi
    
    log_info "Installing pnpm..."
    npm install -g pnpm@latest
    log_success "pnpm installed"
}

install_dependencies() {
    log_info "Installing dependencies..."
    brew install git jq 2>/dev/null || true
    log_success "Dependencies installed"
}

# ============================================
# Directory Setup
# ============================================

create_directories() {
    log_info "Creating directories..."
    
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown -R "$USER" "$INSTALL_DIR"
    
    mkdir -p "$DATA_DIR"
    mkdir -p "$DATA_DIR/logs"
    mkdir -p "$DATA_DIR/db"
    mkdir -p "$DATA_DIR/cache"
    mkdir -p "$DATA_DIR/backups"
    mkdir -p "$LAUNCHD_DIR"
    
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
    log_info "Installing npm packages..."
    cd "$INSTALL_DIR"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    log_success "Packages installed"
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
    
    MASTER_KEY=$(openssl rand -hex 32)
    echo "$MASTER_KEY" > "$DATA_DIR/.master_key"
    chmod 600 "$DATA_DIR/.master_key"
    
    log_success "Secrets generated"
}

create_env_file() {
    ENV_FILE="$DATA_DIR/.env"
    
    if [[ -f "$ENV_FILE" ]]; then
        log_warn "Environment file exists, preserving..."
        return
    fi
    
    log_info "Creating environment configuration..."
    
    MASTER_KEY=$(cat "$DATA_DIR/.master_key" 2>/dev/null || openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    
    cat > "$ENV_FILE" << EOF
# ClawF Configuration - macOS
# Generated on $(date)

NODE_ENV=production
PORT=3001
HOST=0.0.0.0

JWT_SECRET=${JWT_SECRET}
MASTER_KEY=${MASTER_KEY}

DATA_DIR=${DATA_DIR}
LOG_DIR=${DATA_DIR}/logs
DATABASE_URL=file:${DATA_DIR}/db/clawfi.db
CACHE_DIR=${DATA_DIR}/cache

DASHBOARD_PORT=3000

INFERENCE_PROVIDER=local

KILL_SWITCH_ENABLED=true
KILL_SWITCH_DEFAULT=false

LOG_LEVEL=info
LOG_REDACT_SECRETS=true
EOF

    chmod 600 "$ENV_FILE"
    log_success "Environment file created"
}

# ============================================
# LaunchD Services
# ============================================

install_launchd_services() {
    log_info "Installing launchd services..."
    
    # Agent service
    cat > "$LAUNCHD_DIR/com.clawfi.agent.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.clawfi.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${INSTALL_DIR}/apps/node/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>DATA_DIR</key>
        <string>${DATA_DIR}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${DATA_DIR}/logs/clawfi.log</string>
    <key>StandardErrorPath</key>
    <string>${DATA_DIR}/logs/clawfi.error.log</string>
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
EOF

    # Dashboard service
    cat > "$LAUNCHD_DIR/com.clawfi.dashboard.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.clawfi.dashboard</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${INSTALL_DIR}/apps/dashboard-new/dist/server/entry.mjs</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}/apps/dashboard-new</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3000</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${DATA_DIR}/logs/dashboard.log</string>
    <key>StandardErrorPath</key>
    <string>${DATA_DIR}/logs/dashboard.error.log</string>
</dict>
</plist>
EOF

    log_success "LaunchD plists created"
}

start_services() {
    log_info "Starting services..."
    
    launchctl unload "$LAUNCHD_DIR/com.clawfi.agent.plist" 2>/dev/null || true
    launchctl unload "$LAUNCHD_DIR/com.clawfi.dashboard.plist" 2>/dev/null || true
    
    launchctl load "$LAUNCHD_DIR/com.clawfi.agent.plist"
    launchctl load "$LAUNCHD_DIR/com.clawfi.dashboard.plist"
    
    sleep 3
    
    if launchctl list | grep -q "com.clawfi.agent"; then
        log_success "Agent service started"
    else
        log_warn "Agent may take a moment to start"
    fi
    
    if launchctl list | grep -q "com.clawfi.dashboard"; then
        log_success "Dashboard service started"
    else
        log_warn "Dashboard may take a moment to start"
    fi
}

# ============================================
# Post-Install
# ============================================

print_success() {
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
    
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
    echo -e "    View logs:     ${PURPLE}tail -f \"$DATA_DIR/logs/clawfi.log\"${NC}"
    echo -e "    Check status:  ${PURPLE}$INSTALL_DIR/installers/macos/status.sh${NC}"
    echo -e "    Update:        ${PURPLE}$INSTALL_DIR/installers/macos/update.sh${NC}"
    echo ""
    echo -e "  ${YELLOW}Data Directory:${NC}  $DATA_DIR"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "  ${PURPLE}ClawF runs on your Mac mini 24/7. Your machine. Your rules.${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# ============================================
# Main
# ============================================

main() {
    print_banner
    check_macos
    detect_arch
    
    log_info "Starting ClawF installation..."
    echo ""
    
    install_homebrew
    install_dependencies
    install_nodejs
    install_pnpm
    create_directories
    clone_or_update_repo
    install_npm_packages
    build_project
    generate_secrets
    create_env_file
    install_launchd_services
    start_services
    
    print_success
}

main "$@"
