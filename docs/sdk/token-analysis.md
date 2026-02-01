# Token Analysis

Deep dive into ClawFi's token analysis capabilities.

## analyzeToken

The primary method for comprehensive token analysis.

```typescript
const analysis = await clawfi.analyzeToken(chain, address, options?);
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chain` | `ChainId` | Yes | Blockchain identifier |
| `address` | `string` | Yes | Token contract address |
| `options` | `RequestOptions` | No | Request options |

### Response Type

```typescript
interface TokenAnalysis {
  // Token info
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  };
  
  // Risk assessment
  riskScore: number;        // 0-100
  riskLevel: RiskLevel;     // 'low' | 'medium' | 'high'
  riskFactors: RiskFactor[];
  
  // Honeypot check
  honeypot: {
    isHoneypot: boolean;
    reason?: string;
    buyTax: number;
    sellTax: number;
    transferTax: number;
  };
  
  // Contract analysis
  contract: {
    isVerified: boolean;
    isProxy: boolean;
    hasOwner: boolean;
    isRenounced: boolean;
    ownerAddress?: string;
  };
  
  // Market data
  market: {
    priceUsd: string;
    priceNative: string;
    marketCap?: number;
    fdv?: number;
    volume24h?: number;
    liquidity?: number;
    priceChange24h?: number;
  };
  
  // Holder analysis
  holders: {
    total: number;
    top10Percentage: number;
    creatorPercentage: number;
  };
  
  // Active signals
  signals: Signal[];
  
  // Metadata
  chain: ChainId;
  analyzedAt: number;
}
```

### Example

```typescript
const analysis = await clawfi.analyzeToken(
  'ethereum',
  '0x6982508145454Ce325dDbE47a25d4ec3d2311933'
);

// Risk assessment
console.log(`Risk: ${analysis.riskScore}/100 (${analysis.riskLevel})`);

// Safety check
if (analysis.honeypot.isHoneypot) {
  console.log('⚠️ HONEYPOT - DO NOT BUY');
  return;
}

// Contract status
if (!analysis.contract.isVerified) {
  console.log('⚠️ Contract not verified');
}

if (!analysis.contract.isRenounced) {
  console.log('⚠️ Contract has owner:', analysis.contract.ownerAddress);
}

// Market overview
console.log(`Price: $${analysis.market.priceUsd}`);
console.log(`Market Cap: $${analysis.market.marketCap?.toLocaleString()}`);

// Signals
for (const signal of analysis.signals) {
  console.log(`[${signal.severity}] ${signal.message}`);
}
```

## checkHoneypot

Quick honeypot detection without full analysis.

```typescript
const result = await clawfi.checkHoneypot(chain, address);
```

### Response Type

```typescript
interface HoneypotResult {
  isHoneypot: boolean;
  reason?: string;
  buyTax: number;
  sellTax: number;
  transferTax: number;
  canBuy: boolean;
  canSell: boolean;
  maxBuyAmount?: string;
  maxSellAmount?: string;
}
```

### Example

```typescript
const result = await clawfi.checkHoneypot('bsc', '0x...');

if (result.isHoneypot) {
  console.log('🚫 HONEYPOT DETECTED');
  console.log('Reason:', result.reason);
} else {
  console.log('✅ Token appears tradeable');
  console.log(`Buy Tax: ${result.buyTax}%`);
  console.log(`Sell Tax: ${result.sellTax}%`);
}

// Tax warnings
if (result.buyTax > 10 || result.sellTax > 10) {
  console.log('⚠️ High tax detected');
}
```

## Risk Factors

Understanding what contributes to risk scores.

### Risk Factor Types

```typescript
interface RiskFactor {
  type: RiskFactorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  weight: number;
}

type RiskFactorType = 
  | 'honeypot'
  | 'high_tax'
  | 'unverified_contract'
  | 'owner_not_renounced'
  | 'proxy_contract'
  | 'low_liquidity'
  | 'unlocked_liquidity'
  | 'whale_concentration'
  | 'creator_holdings'
  | 'no_trading_history'
  | 'suspicious_activity';
```

### Example

```typescript
const analysis = await clawfi.analyzeToken('base', '0x...');

console.log('Risk Factors:');
for (const factor of analysis.riskFactors) {
  const icon = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  }[factor.severity];
  
  console.log(`${icon} ${factor.type}: ${factor.description}`);
}
```

## Batch Analysis

Analyze multiple tokens efficiently.

```typescript
// Parallel analysis
const addresses = ['0x...', '0x...', '0x...'];

const results = await Promise.all(
  addresses.map(addr => clawfi.analyzeToken('ethereum', addr))
);

// Process results
for (const analysis of results) {
  console.log(`${analysis.token.symbol}: ${analysis.riskScore}/100`);
}
```

### With Concurrency Control

```typescript
import pLimit from 'p-limit';

const limit = pLimit(5); // Max 5 concurrent requests

const addresses = ['0x...', '0x...', /* many more */];

const results = await Promise.all(
  addresses.map(addr => 
    limit(() => clawfi.analyzeToken('ethereum', addr))
  )
);
```

## Caching Strategies

### Default Caching

```typescript
// First call: fetches from API
const analysis1 = await clawfi.analyzeToken('ethereum', '0x...');

// Second call: returns cached result
const analysis2 = await clawfi.analyzeToken('ethereum', '0x...');
```

### Force Fresh Data

```typescript
const analysis = await clawfi.analyzeToken('ethereum', '0x...', {
  skipCache: true,
});
```

### Custom Cache TTL

```typescript
// Cache for 5 minutes
const analysis = await clawfi.analyzeToken('ethereum', '0x...', {
  cacheTtl: 300000,
});
```

## Error Handling

```typescript
import { 
  ClawFiError,
  NotFoundError,
  ValidationError,
  RateLimitError 
} from '@clawfi/sdk';

try {
  const analysis = await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  if (error instanceof NotFoundError) {
    // Token not found or not indexed
    console.log('Token not found');
  } else if (error instanceof ValidationError) {
    // Invalid response data
    console.log('Invalid data:', error.issues);
  } else if (error instanceof RateLimitError) {
    // Rate limited
    console.log('Rate limited, retry in', error.retryAfter, 's');
  } else if (error instanceof ClawFiError) {
    // Other ClawFi error
    console.log('Error:', error.code, error.message);
  } else {
    throw error;
  }
}
```

## Best Practices

### 1. Always Check Honeypot First

```typescript
const honeypot = await clawfi.checkHoneypot(chain, address);
if (honeypot.isHoneypot) {
  console.log('Skipping honeypot token');
  return;
}

// Only do full analysis for safe tokens
const analysis = await clawfi.analyzeToken(chain, address);
```

### 2. Set Risk Thresholds

```typescript
const MAX_RISK_SCORE = 50;

const analysis = await clawfi.analyzeToken(chain, address);

if (analysis.riskScore > MAX_RISK_SCORE) {
  console.log('Token exceeds risk threshold');
  return;
}
```

### 3. Monitor Multiple Factors

```typescript
function isTokenSafe(analysis: TokenAnalysis): boolean {
  // Not a honeypot
  if (analysis.honeypot.isHoneypot) return false;
  
  // Reasonable taxes
  if (analysis.honeypot.buyTax > 15) return false;
  if (analysis.honeypot.sellTax > 15) return false;
  
  // Risk score acceptable
  if (analysis.riskScore > 60) return false;
  
  // Has liquidity
  if (!analysis.market.liquidity || analysis.market.liquidity < 10000) return false;
  
  // Contract verified
  if (!analysis.contract.isVerified) return false;
  
  return true;
}
```

## Next Steps

- [Market Data](market-data.md) - Working with market data
- [Signal Detection](signals.md) - Understanding signals
- [Error Handling](errors.md) - Error handling patterns
