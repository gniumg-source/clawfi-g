# clawfi-sdk

Official TypeScript SDK for the ClawFi crypto intelligence API.

## Installation

```bash
npm install @clawfi/sdk
```

## Quick Start

```typescript
import { ClawFi } from '@clawfi/sdk';

const clawfi = new ClawFi({
  apiKey: 'your-api-key', // Optional
});

// Analyze token
const analysis = await clawfi.analyzeToken('ethereum', '0x...');

// Check honeypot
const result = await clawfi.checkHoneypot('bsc', '0x...');

// Get signals
const signals = await clawfi.getSignals('base', '0x...');
```

## Features

- Full token risk analysis
- Honeypot detection
- Real-time signal monitoring
- Market data aggregation
- Multi-chain support
- Fallback to public APIs

## Configuration

```typescript
const clawfi = new ClawFi({
  apiKey: process.env.CLAWFI_API_KEY,
  timeout: 30000,
  retries: 3,
  cache: true,
  cacheTtl: 60000,
});
```

## Main Methods

### analyzeToken(chain, address)

Full risk analysis.

```typescript
const analysis = await clawfi.analyzeToken('ethereum', '0x...');

console.log('Risk:', analysis.riskScore);
console.log('Honeypot:', analysis.honeypot.isHoneypot);
console.log('Signals:', analysis.signals.length);
```

### checkHoneypot(chain, address)

Quick honeypot check.

```typescript
const result = await clawfi.checkHoneypot('bsc', '0x...');

if (result.isHoneypot) {
  console.log('WARNING: Honeypot!');
}
```

### getSignals(chain, address)

Get active signals.

```typescript
const signals = await clawfi.getSignals('base', '0x...');

for (const signal of signals) {
  console.log(`[${signal.severity}] ${signal.message}`);
}
```

### getMarketData(chain, address)

Get market data.

```typescript
const market = await clawfi.getMarketData('ethereum', '0x...');

console.log('Price:', market.priceUsd);
console.log('Market Cap:', market.marketCap);
```

### search(query)

Search tokens.

```typescript
const results = await clawfi.search('PEPE');
```

## Standalone Mode

Works without API key using public APIs:

```typescript
const clawfi = new ClawFi(); // No API key

// Uses Dexscreener + GoPlus as fallback
const analysis = await clawfi.analyzeToken('ethereum', '0x...');
```

## Error Handling

```typescript
import { 
  ClawFiError, 
  RateLimitError, 
  NotFoundError 
} from '@clawfi/sdk';

try {
  const analysis = await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limited');
  }
}
```

## Links

- [GitHub](https://github.com/ClawFiAI/clawfi-sdk)
- [npm](https://www.npmjs.com/package/@clawfi/sdk)
