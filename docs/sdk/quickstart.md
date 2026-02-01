# SDK Quick Start

Get started with the ClawFi SDK in your TypeScript/JavaScript projects.

## Installation

```bash
npm install @clawfi/sdk
# or
yarn add @clawfi/sdk
# or
pnpm add @clawfi/sdk
```

## Basic Usage

### Initialize Client

```typescript
import { ClawFi } from '@clawfi/sdk';

// Basic initialization (works without API key for public features)
const clawfi = new ClawFi();

// With API key for full access
const clawfi = new ClawFi({
  apiKey: 'your-api-key',
});
```

### Analyze a Token

```typescript
const analysis = await clawfi.analyzeToken('ethereum', '0x6982508145454Ce325dDbE47a25d4ec3d2311933');

console.log('Token:', analysis.token.name);
console.log('Risk Score:', analysis.riskScore);
console.log('Is Honeypot:', analysis.honeypot.isHoneypot);
console.log('Signals:', analysis.signals.length);
```

### Get Market Data

```typescript
const market = await clawfi.getMarketData('ethereum', '0x...');

console.log('Price:', market.priceUsd);
console.log('Market Cap:', market.marketCap);
console.log('24h Volume:', market.volume24h);
console.log('Liquidity:', market.liquidity);
console.log('24h Change:', market.priceChange24h);
```

### Check for Honeypot

```typescript
const result = await clawfi.checkHoneypot('ethereum', '0x...');

if (result.isHoneypot) {
  console.log('⚠️ HONEYPOT DETECTED');
  console.log('Reason:', result.reason);
  console.log('Buy Tax:', result.buyTax);
  console.log('Sell Tax:', result.sellTax);
} else {
  console.log('✅ Token is tradeable');
}
```

### Get Active Signals

```typescript
const signals = await clawfi.getSignals('ethereum', '0x...');

for (const signal of signals) {
  console.log(`[${signal.severity}] ${signal.type}: ${signal.message}`);
}
```

### Search Tokens

```typescript
const results = await clawfi.search('PEPE');

for (const token of results) {
  console.log(`${token.name} (${token.symbol})`);
  console.log(`Chain: ${token.chain}`);
  console.log(`Address: ${token.address}`);
  console.log('---');
}
```

## TypeScript Support

The SDK is written in TypeScript with full type definitions:

```typescript
import { 
  ClawFi, 
  TokenAnalysis, 
  MarketData, 
  Signal,
  ChainId 
} from '@clawfi/sdk';

async function analyzeToken(
  chain: ChainId, 
  address: string
): Promise<TokenAnalysis> {
  const clawfi = new ClawFi();
  return clawfi.analyzeToken(chain, address);
}
```

## Error Handling

```typescript
import { 
  ClawFi, 
  ClawFiError, 
  RateLimitError, 
  NotFoundError 
} from '@clawfi/sdk';

const clawfi = new ClawFi();

try {
  const analysis = await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limited, retry after:', error.retryAfter);
  } else if (error instanceof NotFoundError) {
    console.log('Token not found');
  } else if (error instanceof ClawFiError) {
    console.log('ClawFi error:', error.message);
  } else {
    throw error;
  }
}
```

## Configuration Options

```typescript
const clawfi = new ClawFi({
  // Authentication
  apiKey: 'your-api-key',
  
  // Network
  baseUrl: 'https://api.clawfi.ai',
  timeout: 30000,
  retries: 3,
  
  // Caching
  cache: true,
  cacheTtl: 60000,
  
  // Rate limiting
  rateLimit: 10,
  
  // Debugging
  debug: false,
});
```

## Event Handling

```typescript
const clawfi = new ClawFi();

// Subscribe to events
const unsubscribe = clawfi.on((event) => {
  switch (event.type) {
    case 'request:start':
      console.log('Starting request...');
      break;
    case 'request:success':
      console.log('Request completed');
      break;
    case 'cache:hit':
      console.log('Served from cache');
      break;
    case 'ratelimit:exceeded':
      console.log('Rate limited');
      break;
  }
});

// Later: unsubscribe when done
unsubscribe();
```

## Complete Example

```typescript
import { ClawFi } from '@clawfi/sdk';

async function main() {
  const clawfi = new ClawFi({ debug: true });
  
  // Search for a token
  const searchResults = await clawfi.search('PEPE');
  
  if (searchResults.length === 0) {
    console.log('No tokens found');
    return;
  }
  
  const token = searchResults[0];
  console.log(`Found: ${token.name} on ${token.chain}`);
  
  // Get full analysis
  const analysis = await clawfi.analyzeToken(token.chain, token.address);
  
  console.log('\n=== TOKEN ANALYSIS ===');
  console.log(`Name: ${analysis.token.name} (${analysis.token.symbol})`);
  console.log(`Risk Score: ${analysis.riskScore}/100`);
  console.log(`Honeypot: ${analysis.honeypot.isHoneypot ? 'YES ⚠️' : 'No ✅'}`);
  
  console.log('\n=== MARKET DATA ===');
  console.log(`Price: $${analysis.market.priceUsd}`);
  console.log(`Market Cap: $${analysis.market.marketCap?.toLocaleString()}`);
  console.log(`24h Volume: $${analysis.market.volume24h?.toLocaleString()}`);
  
  console.log('\n=== SIGNALS ===');
  for (const signal of analysis.signals) {
    console.log(`[${signal.severity.toUpperCase()}] ${signal.message}`);
  }
}

main().catch(console.error);
```

## Next Steps

- [Configuration](configuration.md) - Advanced configuration options
- [Token Analysis](token-analysis.md) - Deep dive into analysis
- [Market Data](market-data.md) - Working with market data
- [Signal Detection](signals.md) - Understanding signals
- [Error Handling](errors.md) - Handling errors gracefully
