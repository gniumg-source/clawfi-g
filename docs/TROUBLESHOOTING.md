# Troubleshooting ClawF

Common issues and solutions for the ClawF appliance.

## Quick Diagnostics

### Linux/Raspberry Pi

```bash
# Full status check
sudo /opt/clawfi/installers/linux/status.sh

# Service status
sudo systemctl status clawfi

# Recent logs
sudo journalctl -u clawfi -n 100 --no-pager

# Health check
curl -s http://localhost:3001/health | jq
curl -s http://localhost:3001/health/details | jq
```

### macOS

```bash
# Status check
/usr/local/opt/clawfi/installers/macos/status.sh

# View logs
tail -100 ~/Library/Application\ Support/ClawFi/logs/clawfi.log
```

## Common Issues

### Service Won't Start

**Symptoms:** `systemctl status clawfi` shows "failed"

**Solutions:**

1. Check logs for the actual error:
   ```bash
   sudo journalctl -u clawfi -n 50 --no-pager
   ```

2. Verify Node.js is installed:
   ```bash
   node -v  # Should be v20+
   ```

3. Check permissions:
   ```bash
   sudo chown -R clawfi:clawfi /opt/clawfi
   ```

4. Rebuild the project:
   ```bash
   cd /opt/clawfi
   sudo pnpm install
   sudo pnpm build
   sudo systemctl restart clawfi
   ```

### Port Already in Use

**Symptoms:** "EADDRINUSE" error in logs

**Solutions:**

1. Find what's using the port:
   ```bash
   sudo lsof -i :3001  # For agent
   sudo lsof -i :3000  # For dashboard
   ```

2. Change the port in config:
   ```bash
   sudo nano /opt/clawfi/data/.env
   # Change PORT=3001 to another port
   ```

3. Kill the conflicting process:
   ```bash
   sudo kill $(sudo lsof -t -i:3001)
   ```

### Out of Memory (Raspberry Pi)

**Symptoms:** Service crashes, OOM killer in logs

**Solutions:**

1. Add swap space:
   ```bash
   sudo dphys-swapfile setup
   sudo dphys-swapfile swapon
   ```

2. Increase swap size:
   ```bash
   sudo nano /etc/dphys-swapfile
   # Set CONF_SWAPSIZE=2048
   sudo dphys-swapfile setup
   sudo dphys-swapfile swapon
   ```

3. Reduce memory usage:
   - Close other applications
   - Use Raspberry Pi OS Lite
   - Disable dashboard if not needed

### Database Errors

**Symptoms:** "SQLITE_BUSY" or database corruption

**Solutions:**

1. Stop services:
   ```bash
   sudo systemctl stop clawfi clawfi-dashboard
   ```

2. Check database integrity:
   ```bash
   sqlite3 /opt/clawfi/data/db/clawfi.db "PRAGMA integrity_check;"
   ```

3. If corrupted, restore from backup:
   ```bash
   sudo cp /opt/clawfi/data/backups/latest.tar.gz /tmp/
   sudo tar -xzf /tmp/latest.tar.gz -C /opt/clawfi/data/
   ```

### API Returns 503

**Symptoms:** Health check returns unhealthy

**Solutions:**

1. Check detailed health:
   ```bash
   curl -s http://localhost:3001/health/details | jq
   ```

2. Verify RPC endpoints are configured:
   ```bash
   grep RPC /opt/clawfi/data/.env
   ```

3. Test RPC connectivity:
   ```bash
   curl -X POST $SOLANA_RPC_URL -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
   ```

### Dashboard Not Loading

**Symptoms:** Can't access http://localhost:3000

**Solutions:**

1. Check dashboard service:
   ```bash
   sudo systemctl status clawfi-dashboard
   ```

2. Check if port is listening:
   ```bash
   sudo netstat -tlnp | grep 3000
   ```

3. Check dashboard logs:
   ```bash
   sudo journalctl -u clawfi-dashboard -n 50
   ```

4. Rebuild dashboard:
   ```bash
   cd /opt/clawfi/apps/dashboard-new
   sudo pnpm build
   sudo systemctl restart clawfi-dashboard
   ```

### Updates Fail

**Symptoms:** Update script errors out

**Solutions:**

1. Check disk space:
   ```bash
   df -h
   ```

2. Manual update:
   ```bash
   cd /opt/clawfi
   sudo git stash  # Save local changes
   sudo git pull origin main
   sudo pnpm install
   sudo pnpm build
   sudo systemctl restart clawfi clawfi-dashboard
   ```

3. Clean install (preserves data):
   ```bash
   sudo cp -r /opt/clawfi/data /tmp/clawfi-data-backup
   sudo /opt/clawfi/installers/linux/uninstall.sh
   curl -sL https://raw.githubusercontent.com/ClawFiAI/clawfi/main/installers/linux/install.sh | sudo bash
   sudo cp -r /tmp/clawfi-data-backup/* /opt/clawfi/data/
   sudo systemctl restart clawfi
   ```

## Getting Help

1. **Check the logs** - Almost all issues have error messages in the logs
2. **GitHub Issues** - Report bugs at https://github.com/ClawFiAI/clawfi/issues
3. **Discord** - Join our community for help

When reporting issues, include:
- Your OS and version
- ClawF version (`curl -s http://localhost:3001/version`)
- Relevant log output
- Steps to reproduce

---

**Your machine. Your rules. Your debugging.**
