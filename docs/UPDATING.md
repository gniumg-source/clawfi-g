# Updating ClawF

ClawF updates are designed to be safe and preserve your data.

## Automatic Updates

Each update script:
1. Creates a backup of your data
2. Pulls the latest code
3. Installs any new dependencies
4. Rebuilds the application
5. Restarts services
6. Preserves all configuration and data

## Update Commands

### Raspberry Pi / Linux

```bash
sudo /opt/clawfi/installers/linux/update.sh
```

### macOS

```bash
/usr/local/opt/clawfi/installers/macos/update.sh
```

### Windows (as Administrator)

```powershell
C:\Program Files\ClawFi\installers\windows\update.ps1
```

## Manual Update

If you prefer manual control:

### Linux/Pi

```bash
# Stop services
sudo systemctl stop clawfi clawfi-dashboard

# Backup data
sudo cp -r /opt/clawfi/data /opt/clawfi/data.backup

# Pull updates
cd /opt/clawfi
sudo git pull origin main

# Rebuild
sudo pnpm install
sudo pnpm build

# Start services
sudo systemctl start clawfi clawfi-dashboard
```

### macOS

```bash
# Stop services
launchctl unload ~/Library/LaunchAgents/com.clawfi.*.plist

# Backup data
cp -r ~/Library/Application\ Support/ClawFi ~/ClawFi-backup

# Pull updates
cd /usr/local/opt/clawfi
git pull origin main

# Rebuild
pnpm install
pnpm build

# Start services
launchctl load ~/Library/LaunchAgents/com.clawfi.*.plist
```

## Rollback

If an update causes issues:

### Linux/Pi

```bash
# Stop services
sudo systemctl stop clawfi clawfi-dashboard

# Restore backup
sudo rm -rf /opt/clawfi/data
sudo mv /opt/clawfi/data.backup /opt/clawfi/data

# Checkout previous version (replace with specific version)
cd /opt/clawfi
sudo git checkout v0.x.x

# Rebuild and restart
sudo pnpm install && sudo pnpm build
sudo systemctl start clawfi clawfi-dashboard
```

## Version History

Check current version:

```bash
# Linux/Pi
curl -s http://localhost:3001/version | jq

# Or check package.json
cat /opt/clawfi/apps/node/package.json | jq .version
```

## Breaking Changes

Major version updates (1.x → 2.x) may include breaking changes. Always:

1. Read the release notes
2. Backup your data before updating
3. Test in a development environment if possible

---

**Updates preserve your data. Your machine. Your rules.**
