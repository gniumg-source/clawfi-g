# Install globally (or use pnpm -C apps/cli dev)
npm install -g @clawfi/cli

# Login to your ClawFi node
clawfi login --host http://localhost:3001

# Check agent status
clawfi status

# List recent signals
clawfi signals --limit 10 --severity high

# Watch a token
clawfi watch token 0x1234...5678 --chain base

# Execute agent commands
clawfi cmd "watch wallet 0x1234...5678 base"
clawfi cmd "killswitch on"

# Stream real-time signals
clawfi stream

# List strategies
clawfi strategies
