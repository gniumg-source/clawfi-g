# rugcheck-api

API service for detecting rug pulls and honeypots using GoPlus Security.

## Installation

```bash
npm install @clawfi/rugcheck
```

## Quick Start

```typescript
import { RugChecker } from '@clawfi/rugcheck';

const checker = new RugChecker();

// Check token
const result = await checker.check('ethereum', '0x...');

console.log('Is Honeypot:', result.isHoneypot);
console.log('Risk Score:', result.riskScore);
console.log('Risk Level:', result.riskLevel);
```

## Features

- Honeypot detection
- Buy/sell tax analysis
- Contract security checks
- Risk scoring
- Multi-chain support (10+ EVM chains)
- Powered by GoPlus Security API

## Supported Chains

| Chain | Chain ID |
|-------|----------|
| Ethereum | 1 |
| BSC | 56 |
| Polygon | 137 |
| Arbitrum | 42161 |
| Optimism | 10 |
| Base | 8453 |
| Avalanche | 43114 |
| Fantom | 250 |
| Cronos | 25 |
| Gnosis | 100 |

## Methods

### check(chain, address)

Full security check.

```typescript
const result = await checker.check('ethereum', '0x...');

console.log('=== Security Check ===');
console.log('Honeypot:', result.isHoneypot);
console.log('Buy Tax:', result.buyTax);
console.log('Sell Tax:', result.sellTax);
console.log('Risk Score:', result.riskScore);
console.log('Risk Level:', result.riskLevel);

if (result.risks.length > 0) {
  console.log('\nRisks:');
  for (const risk of result.risks) {
    console.log(`- ${risk}`);
  }
}
```

### checkHoneypot(chain, address)

Quick honeypot check.

```typescript
const result = await checker.checkHoneypot('bsc', '0x...');

if (result.isHoneypot) {
  console.log('HONEYPOT!', result.reason);
} else {
  console.log('Token appears tradeable');
}
```

### getRiskScore(chain, address)

Get risk score only.

```typescript
const score = await checker.getRiskScore('base', '0x...');
console.log(`Risk: ${score}/100`);
```

### batchCheck(tokens)

Check multiple tokens.

```typescript
const results = await checker.batchCheck([
  { chain: 'ethereum', address: '0x...' },
  { chain: 'bsc', address: '0x...' },
  { chain: 'base', address: '0x...' },
]);

for (const result of results) {
  console.log(`${result.address}: ${result.riskScore}/100`);
}
```

## Response Types

```typescript
interface SecurityCheck {
  address: string;
  chain: string;
  
  // Honeypot
  isHoneypot: boolean;
  honeypotReason?: string;
  
  // Taxes
  buyTax: number;
  sellTax: number;
  transferTax: number;
  
  // Trading
  canBuy: boolean;
  canSell: boolean;
  
  // Contract
  isVerified: boolean;
  isProxy: boolean;
  hasOwner: boolean;
  isRenounced: boolean;
  
  // Risk
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  risks: string[];
  
  // Metadata
  checkedAt: number;
}
```

## Risk Factors

The risk score considers:

- **Honeypot status** (30%)
- **High taxes** (20%)
- **Contract ownership** (15%)
- **Verification status** (10%)
- **Proxy contract** (10%)
- **Trading restrictions** (15%)

## API Server

Run as HTTP service:

```typescript
import { createServer } from '@clawfi/rugcheck';

const server = createServer({
  port: 3000,
  rateLimit: 100,
});

server.listen();
```

### Endpoints

```
GET /check/:chain/:address
GET /honeypot/:chain/:address
GET /score/:chain/:address
POST /batch
```

## Fastify Plugin

```typescript
import Fastify from 'fastify';
import { rugcheckPlugin } from '@clawfi/rugcheck';

const app = Fastify();
await app.register(rugcheckPlugin);

// Routes automatically registered
```

## Links

- [GitHub](https://github.com/ClawFiAI/rugcheck-api)
- [npm](https://www.npmjs.com/package/@clawfi/rugcheck)
- [GoPlus Security](https://gopluslabs.io)
