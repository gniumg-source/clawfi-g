# Installation

This guide covers installing ClawFi components for different use cases.

## Browser Extension

### Chrome / Brave / Edge

1. Visit the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Developer Mode)

For development or testing the latest features:

```bash
# Clone the repository
git clone https://github.com/ClawFiAI/clawfi.git
cd clawfi

# Install dependencies
pnpm install

# Build the extension
pnpm build:extension
```

Then load in your browser:

1. Open `chrome://extensions` (or `brave://extensions`)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `apps/extension/dist` folder

## SDK Installation

### npm

```bash
npm install @clawfi/sdk
```

### yarn

```bash
yarn add @clawfi/sdk
```

### pnpm

```bash
pnpm add @clawfi/sdk
```

## Package Installation

Individual packages can be installed separately:

```bash
# Dexscreener TypeScript client
npm install dexscreener-ts

# Signal detection library
npm install @clawfi/signals

# Wallet tracking
npm install @clawfi/wallet-tracker

# Rug check API client
npm install @clawfi/rugcheck

# Chain utilities
npm install @clawfi/chain-utils
```

## System Requirements

### Browser Extension
- Chrome 88+ / Brave 1.20+ / Edge 88+
- Firefox 89+ (coming soon)

### SDK / Packages
- Node.js 18.0.0 or higher
- TypeScript 5.0+ (recommended)

## Verifying Installation

### Extension
After installation, you should see the ClawFi icon (🦀) in your browser toolbar. Click it to open the popup and verify the version.

### SDK

```typescript
import { ClawFi } from '@clawfi/sdk';

const clawfi = new ClawFi();
console.log('ClawFi SDK loaded successfully');
```

## Next Steps

- [Quick Start Guide](quickstart.md) - Get up and running in 5 minutes
- [Configuration](configuration.md) - Customize ClawFi settings
- [Extension Overview](../extension/overview.md) - Learn about extension features
