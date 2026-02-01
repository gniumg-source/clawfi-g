# dexscreener-ts

Production-grade TypeScript SDK for the Dexscreener API.

## Installation

```bash
npm install dexscreener-ts
```

## Quick Start

```typescript
import { Dexscreener } from 'dexscreener-ts';

const dex = new Dexscreener();

// Search for tokens
const results = await dex.searchPairs('PEPE');

// Get token pairs
const pairs = await dex.getTokenPairs('0x...');

// Get trending
const trending = await dex.getTrending('ethereum', 10);
```

## Features

- Full TypeScript support with Zod validation
- Automatic retries with exponential backoff
- Built-in rate limiting
- In-memory caching (Redis adapter available)
- Works in Node.js and browsers

## Configuration

```typescript
const dex = new Dexscreener({
  timeout: 30000,
  retries: 3,
  cache: true,
  cacheTtl: 60000,
  rateLimit: 10,
});
```

## Main Methods

### getPair(chainId, pairAddress)

Get a specific pair.

```typescript
const pair = await dex.getPair('ethereum', '0x...');
```

### getTokenPairs(tokenAddress, chain?)

Get all pairs for a token.

```typescript
const result = await dex.getTokenPairs('0x...');
console.log(result.bestPair);
console.log(result.totalLiquidity);
```

### searchPairs(query, options?)

Search for pairs.

```typescript
const results = await dex.searchPairs('PEPE', {
  sortBy: 'liquidity',
  sortOrder: 'desc',
  limit: 20,
});
```

### getTrending(chain?, limit?)

Get trending tokens.

```typescript
const trending = await dex.getTrending('base', 10);
```

## Services

Access granular APIs via services:

```typescript
// Pairs service
const pair = await dex.pairs.getPair('ethereum', '0x...');

// Tokens service
const price = await dex.tokens.getPrice('0x...');

// Search service
const tokens = await dex.search.tokens('PEPE');

// Trending service
const isTrending = await dex.trending.isTrending('0x...');
```

## Utilities

```typescript
import { 
  formatPrice, 
  formatNumber, 
  isValidEvmAddress,
  getChainInfo 
} from 'dexscreener-ts';

formatPrice(0.00001234);  // $0.00001234
formatNumber(1500000);    // $1.50M
isValidEvmAddress('0x...'); // true/false
getChainInfo('ethereum'); // { name, nativeCurrency, ... }
```

## Links

- [GitHub](https://github.com/ClawFiAI/dexscreener-ts)
- [npm](https://www.npmjs.com/package/dexscreener-ts)
