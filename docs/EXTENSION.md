# ClawFi Chrome Extension

The ClawFi Chrome Extension provides contextual crypto intelligence directly in your browser. It detects token addresses on supported pages and displays relevant signals from your ClawFi Node.

## Features

- **Token Detection**: Automatically detects token addresses from URLs and page content
- **Signal Overlay**: Shows latest ClawFi signals for detected tokens
- **Wallet Detection**: Identifies connected wallets (MetaMask, Phantom)
- **SPA Support**: Works with single-page applications via history API patching
- **Shadow DOM**: Styles are isolated to prevent conflicts with host pages

## Supported Sites

| Site | Chain Detection | Features |
|------|-----------------|----------|
| Etherscan | Ethereum | Token pages, addresses |
| Basescan | Base | Token pages, addresses |
| Arbiscan | Arbitrum | Token pages, addresses |
| Dexscreener | Multi-chain | Token charts, pair pages |
| Uniswap | Multi-chain | Token swap pages |
| **Clanker.world** | Base | Token pages, metadata extraction |

## Clanker.world Integration

### How It Works

The extension provides a first-class overlay experience on [Clanker.world](https://clanker.world):

1. **URL Detection**: When you visit `https://clanker.world/clanker/0x...`, the extension extracts the token address from the URL path
2. **Metadata Extraction**: Best-effort extraction of additional info from the page:
   - Clanker Version (V3, V3.1, V4)
   - Creator address
   - Admin address
   - Verification status
3. **Signal Fetch**: Queries your ClawFi Node for signals related to this token on Base chain
4. **SPA Navigation**: Automatically updates when navigating between tokens without page reload

### Overlay Features

The Clanker overlay displays:

- **Token Address**: With copy-to-clipboard button
- **Chain Badge**: Base (always for Clanker tokens)
- **Version Badge**: V3/V3.1/V4 if detected
- **Verified Badge**: If token is verified
- **Creator/Admin Links**: Clickable links to Basescan
- **Latest 5 Signals**: From your ClawFi Node
- **Dashboard Link**: Opens ClawFi dashboard filtered to this token

### Token Detection Logic

```
URL: https://clanker.world/clanker/0x1234...abcd
                                 └────────────┘
                                 Token Address
                                 (validated as 0x + 40 hex chars)
```

The token address **must** come from the URL for security. Page content is only used for optional metadata enrichment.

## Installation

### From Source

```bash
# Build the extension
cd apps/extension
pnpm build

# The built extension is in apps/extension/dist/
```

### Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `apps/extension/dist` directory

## Configuration

Click the ClawFi extension icon to open the options page:

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Node URL** | Your ClawFi Node API endpoint | `http://localhost:3001` |
| **Auth Token** | JWT token from dashboard login | (required) |
| **General Overlay** | Enable overlay on Etherscan, etc. | Enabled |
| **Clanker Overlay** | Enable overlay on clanker.world | Enabled |

### Getting Your Auth Token

1. Login to your ClawFi dashboard
2. Go to Settings or Profile
3. Copy the JWT token
4. Paste it in the extension options

## Architecture

```
apps/extension/
├── src/
│   ├── background/
│   │   └── index.ts          # Service worker (MV3)
│   ├── content/
│   │   ├── index.tsx         # Generic site content script
│   │   ├── sites/
│   │   │   └── clanker.ts    # Clanker-specific detection
│   │   └── overlay/
│   │       └── ClankerOverlay.ts  # Clanker overlay UI
│   ├── options/
│   │   └── index.html        # Settings page
│   └── manifest.json         # Extension manifest (MV3)
└── dist/                     # Built extension
```

### Content Script Architecture

**Generic Content Script** (`content/index.tsx`):
- Runs on Etherscan, Dexscreener, Uniswap, etc.
- Uses regex to detect addresses from URL and page content
- Renders React-based overlay

**Clanker Content Script** (`content/sites/clanker.ts`):
- Runs only on clanker.world
- Parses URL path for token address
- Patches history API for SPA navigation
- Extracts metadata from page content (best-effort)
- Renders shadow DOM overlay (no React, pure TS)

### Communication Flow

```
Content Script ──► Background Worker ──► ClawFi Node API
     │                    │
     │                    └── Stores settings
     │                    └── Fetches signals
     │
     └── Detects tokens
     └── Renders overlay
     └── Handles user interaction
```

## Security

### What the Extension DOES:

- ✅ Read token addresses from URLs
- ✅ Read optional metadata from page text
- ✅ Communicate with your configured ClawFi Node
- ✅ Display signals in an overlay
- ✅ Detect wallet presence (window.ethereum)

### What the Extension DOES NOT:

- ❌ Access wallet private keys
- ❌ Request transaction signatures
- ❌ Modify page content (beyond overlay)
- ❌ Send data anywhere except your Node
- ❌ Store sensitive credentials (only JWT token in local storage)

### Permissions Explained

```json
{
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["https://clanker.world/*", ...]
}
```

- **storage**: Save settings locally
- **activeTab**: Access current tab URL
- **host_permissions**: Inject content scripts on specified sites only

## Troubleshooting

### Overlay Not Showing

1. Check that overlay is enabled in options
2. Verify Node URL is correct
3. Confirm auth token is set
4. Check browser console for errors
5. Ensure you're on a supported page

### Signals Not Loading

1. Verify ClawFi Node is running
2. Check auth token is valid (not expired)
3. Confirm the token address is correct
4. Check Node logs for errors

### SPA Navigation Issues

The extension patches `history.pushState` and `history.replaceState`. If a site uses a different navigation method, the overlay may not update. Refresh the page as a workaround.

## Development

### Building

```bash
cd apps/extension
pnpm build
```

### Watch Mode

```bash
pnpm dev
```

### Testing Clanker Detection

1. Build and load the extension
2. Go to any Clanker token page, e.g.:
   `https://clanker.world/clanker/0x...`
3. Wait ~2 seconds for overlay to appear
4. Click the 🦀 FAB to expand
5. Navigate to another token - overlay should update

### Adding New Site Support

1. Add URL pattern to `manifest.json` host_permissions and content_scripts
2. Create new content script in `src/content/sites/`
3. Implement token detection and overlay rendering
4. Add entry to `vite.config.ts`
5. Update this documentation

## Version History

### v0.1.1
- Added Clanker.world overlay support
- SPA navigation detection
- Shadow DOM isolation
- Clanker metadata extraction (version, creator, admin, verified)
- Separate toggle for Clanker overlay

### v0.1.0
- Initial release
- Generic overlay for Etherscan, Dexscreener, Uniswap
- Basic token detection
- Signal display


