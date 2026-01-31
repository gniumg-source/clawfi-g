# ClawFi Installation on Raspberry Pi

This guide covers installing ClawFi on a Raspberry Pi 4/5 for headless 24/7 operation.

## Requirements

- Raspberry Pi 4 (4GB+) or Raspberry Pi 5
- 32GB+ microSD card (or USB SSD for better performance)
- Raspberry Pi OS Lite (64-bit)
- Internet connection

## Step 1: Prepare the Pi

### Flash OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Select "Raspberry Pi OS Lite (64-bit)"
3. Configure:
   - Enable SSH
   - Set username/password
   - Configure WiFi (if needed)
4. Flash to SD card

### First Boot

```bash
# SSH into your Pi
ssh pi@raspberrypi.local

# Update system
sudo apt update && sudo apt upgrade -y

# Set timezone
sudo timedatectl set-timezone Your/Timezone

# Install required packages
sudo apt install -y curl git
```

## Step 2: Install Dependencies

### Node.js

```bash
# Install Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should be 20.x
```

### pnpm

```bash
# Install pnpm
sudo npm install -g pnpm

# Verify
pnpm --version
```

### PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER clawfi WITH PASSWORD 'clawfi';
CREATE DATABASE clawfi OWNER clawfi;
GRANT ALL PRIVILEGES ON DATABASE clawfi TO clawfi;
EOF
```

### Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Start and enable
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify
redis-cli ping  # Should return PONG
```

## Step 3: Install ClawFi

### Clone Repository

```bash
# Create app directory
sudo mkdir -p /opt/clawfi
sudo chown $USER:$USER /opt/clawfi

# Clone
cd /opt
git clone https://github.com/your-repo/clawfi.git
cd clawfi
```

### Install Dependencies

```bash
# Install all dependencies
pnpm install
```

### Build Packages

```bash
# Build all packages
pnpm build
```

### Configure Environment

```bash
# Create environment file
sudo mkdir -p /etc/clawfi
sudo touch /etc/clawfi/environment
sudo chmod 600 /etc/clawfi/environment

# Generate keys
MASTER_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

# Edit environment file
sudo tee /etc/clawfi/environment << EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DATABASE_URL=postgresql://clawfi:clawfi@localhost:5432/clawfi?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=$JWT_SECRET
CLAWFI_MASTER_KEY=$MASTER_KEY
DEV_MODE=false
EOF
```

**⚠️ IMPORTANT: Back up `/etc/clawfi/environment` securely. The master key cannot be recovered!**

### Initialize Database

```bash
# Generate Prisma client
cd /opt/clawfi
pnpm db:generate

# Push schema to database
pnpm db:push

# Run seed script
pnpm db:seed
```

## Step 4: Setup Systemd Service

### Install Service

```bash
# Copy service file
sudo cp /opt/clawfi/infra/systemd/clawfi-node.service /etc/systemd/system/

# Create clawfi user
sudo useradd -r -s /bin/false clawfi

# Set ownership
sudo chown -R clawfi:clawfi /opt/clawfi

# Create log directory
sudo mkdir -p /opt/clawfi/logs
sudo chown clawfi:clawfi /opt/clawfi/logs

# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable clawfi-node
```

### Start Service

```bash
# Start ClawFi
sudo systemctl start clawfi-node

# Check status
sudo systemctl status clawfi-node

# View logs
journalctl -u clawfi-node -f
```

## Step 5: Configure Firewall

```bash
# Install ufw if not present
sudo apt install -y ufw

# Allow SSH
sudo ufw allow ssh

# Allow ClawFi API (adjust as needed)
sudo ufw allow 3001/tcp

# Enable firewall
sudo ufw enable
```

## Step 6: Reverse Proxy (Optional)

For HTTPS support, install Caddy:

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Configure Caddy
sudo tee /etc/caddy/Caddyfile << EOF
clawfi.yourdomain.com {
    reverse_proxy localhost:3001
}
EOF

# Restart Caddy
sudo systemctl restart caddy
```

## Monitoring

### System Health

```bash
# Check service status
sudo systemctl status clawfi-node

# View recent logs
journalctl -u clawfi-node --since "1 hour ago"

# Monitor resource usage
htop
```

### API Health Check

```bash
# Check API
curl http://localhost:3001/health
```

## Maintenance

### Updates

```bash
# Stop service
sudo systemctl stop clawfi-node

# Pull updates
cd /opt/clawfi
git pull

# Install dependencies
pnpm install

# Rebuild
pnpm build

# Run migrations
pnpm db:push

# Start service
sudo systemctl start clawfi-node
```

### Backups

```bash
# Backup database
sudo -u postgres pg_dump clawfi > /backup/clawfi-$(date +%Y%m%d).sql

# Backup environment (store securely!)
sudo cp /etc/clawfi/environment /backup/
```

### Logs

```bash
# View logs
journalctl -u clawfi-node -f

# Rotate logs (automatic with journald)
# Or configure in /etc/systemd/journald.conf
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs for errors
journalctl -u clawfi-node -e

# Verify environment file
sudo cat /etc/clawfi/environment

# Test manually
sudo -u clawfi NODE_ENV=production node /opt/clawfi/apps/node/dist/index.js
```

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Verify connection
psql -U clawfi -d clawfi -h localhost -c "SELECT 1;"
```

### Memory Issues

Raspberry Pi 4 with 4GB should be sufficient. If you experience issues:

```bash
# Add swap (if not present)
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile  # Set CONF_SWAPSIZE=2048
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Monitor memory
free -h
```

## Performance Tips

1. **Use USB SSD** instead of SD card for better I/O
2. **Overclock** Pi 5 if thermal solution allows
3. **Reduce logging** in production
4. **Optimize PostgreSQL** for low memory (`shared_buffers = 256MB`)


