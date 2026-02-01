# Market Data

Fetching and using market data with the ClawFi SDK.

## getMarketData

Fetch current market data for a token.

```typescript
const market = await clawfi.getMarketData(chain, address, options?);
```

### Response Type

```typescript
interface MarketData {
  // Price
  priceUsd: string;
  priceNative: string;
  
  // Valuation
  marketCap?: number;
  fdv?: number;
  
  // Trading
  volume24h?: number;
  volume6h?: number;
  volume1h?: number;
  
  // Liquidity
  liquidity?: number;
  liquidityBase?: number;
  liquidityQuote?: number;
  
  // Changes
  priceChange24h?: number;
  priceChange6h?: number;
  priceChange1h?: number;
  priceChange5m?: number;
  
  // Transactions
  buys24h?: number;
  sells24h?: number;
  
  // Pair info
  pairAddress: string;
  dex: string;
  baseToken: Token;
  quoteToken: Token;
  
  // Metadata
  updatedAt: number;
}
```

### Example

```typescript
const market = await clawfi.getMarketData(
  'ethereum',
  '0x6982508145454Ce325dDbE47a25d4ec3d2311933'
);

console.log('=== MARKET DATA ===');
console.log(`Price: $${market.priceUsd}`);
console.log(`Market Cap: $${market.marketCap?.toLocaleString()}`);
console.log(`FDV: $${market.fdv?.toLocaleString()}`);
console.log(`24h Volume: $${market.volume24h?.toLocaleString()}`);
console.log(`Liquidity: $${market.liquidity?.toLocaleString()}`);
console.log();
console.log('=== PRICE CHANGES ===');
console.log(`5m:  ${market.priceChange5m?.toFixed(2)}%`);
console.log(`1h:  ${market.priceChange1h?.toFixed(2)}%`);
console.log(`6h:  ${market.priceChange6h?.toFixed(2)}%`);
console.log(`24h: ${market.priceChange24h?.toFixed(2)}%`);
console.log();
console.log('=== TRADING ===');
console.log(`Buys (24h):  ${market.buys24h}`);
console.log(`Sells (24h): ${market.sells24h}`);
console.log(`DEX: ${market.dex}`);
```

## search

Search for tokens by name, symbol, or address.

```typescript
const results = await clawfi.search(query, options?);
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | Search query |
| `options.chain` | `ChainId` | Filter by chain |
| `options.limit` | `number` | Max results (default 20) |

### Response Type

```typescript
interface SearchResult {
  address: string;
  name: string;
  symbol: string;
  chain: ChainId;
  priceUsd?: string;
  volume24h?: number;
  liquidity?: number;
  priceChange24h?: number;
  pairAddress: string;
  dex: string;
  url: string;
}
```

### Example

```typescript
// Search by name
const results = await clawfi.search('pepe');

// Search by symbol
const results = await clawfi.search('SHIB');

// Search by address
const results = await clawfi.search('0x6982508145454Ce325dDbE47a25d4ec3d2311933');

// Filter by chain
const results = await clawfi.search('pepe', { chain: 'base' });

// With limit
const results = await clawfi.search('meme', { limit: 50 });
```

## Formatting Utilities

### Price Formatting

```typescript
import { formatPrice, formatNumber, formatChange } from '@clawfi/sdk';

const market = await clawfi.getMarketData('ethereum', '0x...');

console.log(formatPrice(market.priceUsd));       // $0.00001234
console.log(formatNumber(market.marketCap));     // $1.23B
console.log(formatChange(market.priceChange24h)); // +15.50%
```

### Custom Formatting

```typescript
function formatUsd(value: number | undefined): string {
  if (value === undefined) return 'N/A';
  
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
```

## Real-Time Price Monitoring

### Polling

```typescript
async function monitorPrice(
  chain: ChainId,
  address: string,
  intervalMs: number = 30000
) {
  let lastPrice: string | null = null;
  
  while (true) {
    const market = await clawfi.getMarketData(chain, address, {
      skipCache: true,
    });
    
    if (lastPrice && lastPrice !== market.priceUsd) {
      const change = (
        (parseFloat(market.priceUsd) - parseFloat(lastPrice)) /
        parseFloat(lastPrice) * 100
      );
      
      console.log(`Price: $${market.priceUsd} (${change.toFixed(2)}%)`);
    }
    
    lastPrice = market.priceUsd;
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
```

### Price Alert

```typescript
async function watchForPriceAlert(
  chain: ChainId,
  address: string,
  targetPrice: number,
  direction: 'above' | 'below'
) {
  while (true) {
    const market = await clawfi.getMarketData(chain, address, {
      skipCache: true,
    });
    
    const currentPrice = parseFloat(market.priceUsd);
    
    const triggered = direction === 'above'
      ? currentPrice >= targetPrice
      : currentPrice <= targetPrice;
    
    if (triggered) {
      console.log(`🚨 ALERT: Price ${direction} $${targetPrice}`);
      console.log(`Current: $${market.priceUsd}`);
      return market;
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
```

## Multi-Token Comparison

```typescript
async function compareTokens(tokens: Array<{ chain: ChainId; address: string }>) {
  const results = await Promise.all(
    tokens.map(t => clawfi.getMarketData(t.chain, t.address))
  );
  
  // Sort by market cap
  results.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  
  console.log('Token Comparison:');
  console.log('─'.repeat(60));
  
  for (const market of results) {
    console.log(`${market.baseToken.symbol.padEnd(10)} | ` +
      `$${formatNumber(market.marketCap).padEnd(12)} | ` +
      `${formatChange(market.priceChange24h)}`);
  }
}
```

## Caching Considerations

Market data changes frequently. Consider your use case:

### Real-Time Display

```typescript
// Skip cache for real-time display
const market = await clawfi.getMarketData(chain, address, {
  skipCache: true,
});
```

### Dashboard/Overview

```typescript
// Cache for 30 seconds for dashboard
const market = await clawfi.getMarketData(chain, address, {
  cacheTtl: 30000,
});
```

### Historical Reference

```typescript
// Cache longer for historical comparison
const market = await clawfi.getMarketData(chain, address, {
  cacheTtl: 300000, // 5 minutes
});
```

## Error Handling

```typescript
try {
  const market = await clawfi.getMarketData('ethereum', '0x...');
} catch (error) {
  if (error instanceof NotFoundError) {
    // Token not listed or no liquidity
    console.log('Token not found on any DEX');
  } else {
    throw error;
  }
}
```

## Next Steps

- [Signal Detection](signals.md) - Monitoring token signals
- [Token Analysis](token-analysis.md) - Full token analysis
- [Error Handling](errors.md) - Handling errors
