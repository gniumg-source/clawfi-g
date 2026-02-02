# ClawF on Mac mini

**Your AI trading agent running 24/7 on Apple hardware.**

ClawF transforms your Mac mini into a dedicated trading intelligence appliance. Silent, efficient, always on—your machine, your rules.

## Requirements

### Hardware
- **Mac mini** (M1/M2/M3 or Intel)
- 8GB+ RAM (16GB recommended)
- 50GB+ free storage
- Reliable internet connection

### Software
- macOS 12+ (Monterey or later)
- Terminal access

## Quick Install

Open Terminal and run:

```bash
curl -sL https://raw.githubusercontent.com/ClawFiAI/clawfi/main/installers/macos/install.sh | bash
```

The installer will:
1. Install Homebrew (if needed)
2. Install Node.js and dependencies
3. Clone and build ClawF
4. Configure launchd for auto-start
5. Generate secure credentials
6. Start the ClawF agent and dashboard

## Post-Installation

After installation completes:

```
Dashboard:     http://localhost:3000
Agent API:     http://localhost:3001
Health Check:  http://localhost:3001/health
```

### Verify Installation

```bash
# Check status
~/Library/Application\ Support/ClawFi/../../../usr/local/opt/clawfi/installers/macos/status.sh

# Or simply
/usr/local/opt/clawfi/installers/macos/status.sh
```

## Configuration

Configuration is stored in `~/Library/Application Support/ClawFi/.env`:

```bash
# Edit configuration
nano ~/Library/Application\ Support/ClawFi/.env

# Restart after changes
launchctl kickstart -k gui/$(id -u)/com.clawfi.agent
```

## Commands

### Service Management

```bash
# Start services
launchctl load ~/Library/LaunchAgents/com.clawfi.agent.plist
launchctl load ~/Library/LaunchAgents/com.clawfi.dashboard.plist

# Stop services
launchctl unload ~/Library/LaunchAgents/com.clawfi.agent.plist
launchctl unload ~/Library/LaunchAgents/com.clawfi.dashboard.plist

# Restart
launchctl kickstart -k gui/$(id -u)/com.clawfi.agent
```

### Logs

```bash
# View agent logs
tail -f ~/Library/Application\ Support/ClawFi/logs/clawfi.log

# View dashboard logs
tail -f ~/Library/Application\ Support/ClawFi/logs/dashboard.log
```

### Updates

```bash
/usr/local/opt/clawfi/installers/macos/update.sh
```

## Data Location

All data is stored in `~/Library/Application Support/ClawFi/`:
- `db/` - SQLite database
- `logs/` - Application logs
- `cache/` - Temporary cache
- `backups/` - Automatic backups
- `.env` - Configuration

## Keep Mac mini Always On

For 24/7 operation:

1. **System Preferences > Energy Saver**
   - Check "Prevent your Mac from automatically sleeping"
   - Check "Start up automatically after a power failure"

2. **Disable screen sleep** (optional)
   - Or just let the display sleep, ClawF runs headless

## Uninstall

```bash
# Keep data
/usr/local/opt/clawfi/installers/macos/uninstall.sh

# Remove everything
/usr/local/opt/clawfi/installers/macos/uninstall.sh --purge
```

## Troubleshooting

### Service Not Starting

```bash
# Check launchd errors
launchctl list | grep clawfi

# View detailed errors
launchctl print gui/$(id -u)/com.clawfi.agent
```

### Permission Issues

```bash
# Fix permissions
sudo chown -R $(whoami) /usr/local/opt/clawfi
```

---

**ClawF runs on your Mac mini 24/7. Your machine. Your rules.**
