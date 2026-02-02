# ClawF on Raspberry Pi

**Your AI trading agent running 24/7 on your own hardware.**

ClawF transforms your Raspberry Pi into a dedicated trading intelligence appliance. No cloud dependencies, no subscription fees—your machine, your rules.

## Requirements

### Hardware
- **Raspberry Pi 4** (4GB+ RAM recommended) or **Raspberry Pi 5**
- 32GB+ microSD card (64GB recommended)
- Reliable internet connection
- Power supply (official RPi PSU recommended)

### Software
- Raspberry Pi OS (64-bit recommended)
- SSH access enabled

## Quick Install

One command to install ClawF:

```bash
curl -sL https://raw.githubusercontent.com/ClawFiAI/clawfi/main/installers/linux/install.sh | sudo bash
```

The installer will:
1. Install Node.js and dependencies
2. Clone and build ClawF
3. Configure systemd services for auto-start
4. Generate secure credentials
5. Start the ClawF agent and dashboard

## Post-Installation

After installation completes, you'll see:

```
Dashboard:     http://<your-pi-ip>:3000
Agent API:     http://<your-pi-ip>:3001
Health Check:  http://<your-pi-ip>:3001/health
```

### Verify Installation

```bash
# Check service status
sudo systemctl status clawfi

# View live logs
sudo journalctl -u clawfi -f

# Quick status check
sudo /opt/clawfi/installers/linux/status.sh
```

## Configuration

Configuration is stored in `/opt/clawfi/data/.env`:

```bash
# Edit configuration
sudo nano /opt/clawfi/data/.env

# Restart after changes
sudo systemctl restart clawfi
```

### Key Settings

```env
# RPC Endpoints (add your own for better performance)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
BASE_RPC_URL=https://mainnet.base.org

# Inference Provider (local = no external API needed)
INFERENCE_PROVIDER=local

# Kill Switch (safety feature)
KILL_SWITCH_ENABLED=true
KILL_SWITCH_DEFAULT=false
```

## Commands

### Service Management

```bash
# Start ClawF
sudo systemctl start clawfi

# Stop ClawF
sudo systemctl stop clawfi

# Restart ClawF
sudo systemctl restart clawfi

# Enable auto-start on boot
sudo systemctl enable clawfi
```

### Logs

```bash
# View agent logs
sudo journalctl -u clawfi -f

# View dashboard logs
sudo journalctl -u clawfi-dashboard -f

# View last 100 lines
sudo journalctl -u clawfi -n 100
```

### Updates

```bash
sudo /opt/clawfi/installers/linux/update.sh
```

Updates will:
- Create a backup of your data
- Pull the latest code
- Rebuild the application
- Restart services
- Preserve all configuration and data

## Data & Backups

### Data Location

All data is stored in `/opt/clawfi/data/`:
- `db/` - SQLite database
- `logs/` - Application logs
- `cache/` - Temporary cache
- `backups/` - Automatic backups
- `.env` - Configuration
- `.master_key` - Encryption key

### Manual Backup

```bash
# Create backup
sudo tar -czf ~/clawfi-backup-$(date +%Y%m%d).tar.gz -C /opt/clawfi/data .

# Restore backup
sudo tar -xzf ~/clawfi-backup-YYYYMMDD.tar.gz -C /opt/clawfi/data
sudo systemctl restart clawfi
```

## Ports

| Port | Service | Description |
|------|---------|-------------|
| 3000 | Dashboard | Web UI |
| 3001 | Agent API | REST API |

If you need to change ports, edit `/opt/clawfi/data/.env`:

```env
PORT=3001
DASHBOARD_PORT=3000
```

## Uninstall

```bash
# Keep data
sudo /opt/clawfi/installers/linux/uninstall.sh

# Remove everything including data
sudo /opt/clawfi/installers/linux/uninstall.sh --purge
```

## Troubleshooting

### Service Won't Start

```bash
# Check for errors
sudo journalctl -u clawfi -n 50 --no-pager

# Check disk space
df -h

# Check memory
free -h
```

### High Memory Usage

If your Pi runs out of memory:

```bash
# Add swap (if not present)
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### Permission Issues

```bash
# Fix permissions
sudo chown -R clawfi:clawfi /opt/clawfi
```

### Port Already in Use

```bash
# Find what's using the port
sudo lsof -i :3001

# Change port in config
sudo nano /opt/clawfi/data/.env
```

## Performance Tips

1. **Use a fast microSD card** - Class 10 or better
2. **Add a USB SSD** - For better database performance
3. **Use Raspberry Pi OS Lite** - Less overhead without desktop
4. **Enable cgroups** - For better resource management
5. **Use a dedicated Pi** - Don't run other heavy services

## Security Recommendations

1. **Change default SSH password**
2. **Enable firewall** - Only allow ports 3000, 3001
3. **Use HTTPS** - Put behind a reverse proxy with SSL
4. **Regular updates** - Keep your Pi OS and ClawF updated
5. **Network isolation** - Use a dedicated network/VLAN if possible

---

**ClawF runs on your Raspberry Pi 24/7. Your machine. Your rules.**
