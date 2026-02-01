# Quick Start

Get started with ClawFi in under 5 minutes.

## Browser Extension

### Step 1: Install the Extension

Install from the Chrome Web Store or load manually (see [Installation](installation.md)).

### Step 2: Visit a Supported Site

Navigate to any supported DEX or token platform:
- [Dexscreener](https://dexscreener.com)
- [Clanker](https://clanker.world)
- [Four.meme](https://four.meme)
- [Pump.fun](https://pump.fun)

### Step 3: View Token Analysis

When viewing a token page, ClawFi automatically:
1. Displays a floating action button (FAB) with risk indicators
2. Shows real-time signals and alerts
3. Provides detailed analysis in an expandable panel

### Step 4: Configure Settings

Click the ClawFi icon in your toolbar to:
- Enable/disable specific features
- Set alert preferences
- Configure display options

## SDK Quick Start

### Basic Usage

```typescript
import { ClawFi } from '@clawfi/sdk';

// Initialize client
const clawfi = new ClawFi({
  apiKey: 'your-api-key', // Optional for basic features
});

// Analyze a token
const analysis = await clawfi.analyzeToken('ethereum', '0x...');

console.log('Risk Score:', analysis.riskScore);
console.log('Signals:', analysis.signals);
```

### Get Market Data

```typescript
// Get token price and market data
const marketData = await clawfi.getMarketData('ethereum', '0x...');

console.log('Price:', marketData.priceUsd);
console.log('Liquidity:', marketData.liquidity);
console.log('24h Volume:', marketData.volume24h);
```

### Check for Honeypot

```typescript
// Quick honeypot check
const honeypotResult = await clawfi.checkHoneypot('ethereum', '0x...');

if (honeypotResult.isHoneypot) {
  console.log('WARNING: Token is a honeypot!');
  console.log('Reason:', honeypotResult.reason);
}
```

### Search Tokens

```typescript
// Search for tokens
const results = await clawfi.search('PEPE');

results.forEach(token => {
  console.log(`${token.name} (${token.symbol}) - ${token.chain}`);
});
```

## Real-Time Signals

```typescript
// Get active signals for a token
const signals = await clawfi.getSignals('ethereum', '0x...');

signals.forEach(signal => {
  console.log(`[${signal.type}] ${signal.message}`);
  console.log(`Severity: ${signal.severity}`);
});
```

## What's Next?

- [Extension Overview](../extension/overview.md) - Deep dive into extension features
- [SDK Configuration](../sdk/configuration.md) - Advanced SDK options
- [API Reference](../api/endpoints.md) - Full API documentation
- [Signal Types](../extension/signals.md) - Understanding different signals
