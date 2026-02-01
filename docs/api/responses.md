# Response Formats

Understanding ClawFi API response structure.

## Standard Response Format

All API responses follow this structure:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": 1706745600000,
    "cached": false,
    "cacheAge": null
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": 1706745600000
  }
}
```

## Response Fields

### success

| Value | Description |
|-------|-------------|
| `true` | Request succeeded |
| `false` | Request failed |

### data

Contains the requested data. Structure varies by endpoint.

### error

Present when `success: false`:

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Machine-readable error code |
| `message` | string | Human-readable description |
| `details` | object | Additional error context |

### meta

Request metadata:

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | string | Unique request identifier |
| `timestamp` | number | Response timestamp (Unix ms) |
| `cached` | boolean | Whether response was cached |
| `cacheAge` | number | Age of cached response (ms) |

## Data Types

### Token

```typescript
interface Token {
  address: string;      // Contract address
  name: string;         // Token name
  symbol: string;       // Token symbol
  decimals?: number;    // Decimal places
  totalSupply?: string; // Total supply (wei)
}
```

### Market Data

```typescript
interface MarketData {
  priceUsd: string;        // USD price
  priceNative: string;     // Price in native token
  marketCap?: number;      // Market cap (USD)
  fdv?: number;            // Fully diluted valuation
  volume24h?: number;      // 24h volume (USD)
  liquidity?: number;      // Liquidity (USD)
  priceChange24h?: number; // 24h price change (%)
}
```

### Risk Analysis

```typescript
interface RiskAnalysis {
  riskScore: number;          // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: RiskFactor[];
}

interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  weight: number;
}
```

### Honeypot

```typescript
interface HoneypotResult {
  isHoneypot: boolean;
  reason?: string;
  buyTax: number;
  sellTax: number;
  transferTax: number;
  canBuy: boolean;
  canSell: boolean;
}
```

### Signal

```typescript
interface Signal {
  type: string;
  severity: 'positive' | 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, unknown>;
  timestamp: number;
}
```

## Pagination

List endpoints support pagination:

### Request

```
GET /api/v1/search?q=pepe&limit=20&offset=0
```

### Response

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "hasMore": true
  }
}
```

### Pagination Fields

| Field | Description |
|-------|-------------|
| `limit` | Items per page |
| `offset` | Current offset |
| `total` | Total items available |
| `hasMore` | Whether more items exist |

### Iterating Pages

```typescript
async function* getAllResults(query: string) {
  let offset = 0;
  const limit = 50;
  
  while (true) {
    const response = await fetch(
      `https://api.clawfi.ai/api/v1/search?q=${query}&limit=${limit}&offset=${offset}`
    );
    const data = await response.json();
    
    yield* data.data;
    
    if (!data.pagination.hasMore) break;
    offset += limit;
  }
}

// Usage
for await (const token of getAllResults('meme')) {
  console.log(token.name);
}
```

## Null vs Undefined

| Value | Meaning |
|-------|---------|
| `null` | Explicitly no value |
| `undefined` (missing) | Not applicable/available |

Example:
```json
{
  "marketCap": 1000000,     // Has value
  "fdv": null,              // Explicitly unknown
  // liquidity not present  // Not available for this token
}
```

## Date/Time Format

All timestamps are Unix milliseconds:

```json
{
  "timestamp": 1706745600000,  // 2024-02-01T00:00:00.000Z
  "pairCreatedAt": 1706659200000
}
```

Convert in JavaScript:
```javascript
const date = new Date(response.timestamp);
```

## Number Precision

- **Prices**: String to preserve precision
- **Percentages**: Number with 2 decimal places
- **Counts**: Integer
- **Large numbers**: Scientific notation avoided

```json
{
  "priceUsd": "0.00000000001234",  // String - high precision
  "priceChange24h": 15.55,         // Number - percentage
  "volume24h": 125000000,          // Number - USD
  "decimals": 18                   // Integer
}
```

## SDK Response Handling

The SDK automatically:
- Parses JSON responses
- Validates response structure
- Converts types appropriately
- Extracts data from wrapper

```typescript
// API returns:
// { "success": true, "data": { ... } }

// SDK returns just the data:
const analysis = await clawfi.analyzeToken('ethereum', '0x...');
// analysis is the contents of "data", not the full response
```

## Next Steps

- [Error Codes](errors.md) - Error reference
- [Endpoints](endpoints.md) - Full endpoint docs
- [Rate Limits](rate-limits.md) - Rate limiting
