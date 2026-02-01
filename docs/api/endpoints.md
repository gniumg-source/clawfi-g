# API Endpoints

Complete reference for all ClawFi API endpoints.

## Base URL

```
https://api.clawfi.ai/api/v1
```

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analyze/{chain}/{address}` | Full token analysis |
| GET | `/market/{chain}/{address}` | Market data |
| GET | `/honeypot/{chain}/{address}` | Honeypot check |
| GET | `/signals/{chain}/{address}` | Active signals |
| GET | `/search` | Search tokens |
| GET | `/health` | API health check |

---

## Token Analysis

### GET /analyze/{chain}/{address}

Full token analysis including risk score, contract info, and signals.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chain` | path | Yes | Chain ID (ethereum, bsc, etc.) |
| `address` | path | Yes | Token contract address |

**Example Request:**

```bash
curl -X GET \
  "https://api.clawfi.ai/api/v1/analyze/ethereum/0x6982508145454Ce325dDbE47a25d4ec3d2311933" \
  -H "Authorization: Bearer clf_xxx"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "token": {
      "address": "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
      "name": "Pepe",
      "symbol": "PEPE",
      "decimals": 18,
      "totalSupply": "420690000000000000000000000000000"
    },
    "riskScore": 25,
    "riskLevel": "low",
    "riskFactors": [
      {
        "type": "owner_not_renounced",
        "severity": "low",
        "description": "Contract has an owner"
      }
    ],
    "honeypot": {
      "isHoneypot": false,
      "buyTax": 0,
      "sellTax": 0
    },
    "contract": {
      "isVerified": true,
      "isProxy": false,
      "hasOwner": true,
      "isRenounced": false
    },
    "market": {
      "priceUsd": "0.00001234",
      "marketCap": 5200000000,
      "volume24h": 125000000,
      "liquidity": 45000000
    },
    "signals": [],
    "chain": "ethereum",
    "analyzedAt": 1706745600000
  }
}
```

---

## Market Data

### GET /market/{chain}/{address}

Get current market data for a token.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chain` | path | Yes | Chain ID |
| `address` | path | Yes | Token address |

**Example Request:**

```bash
curl -X GET \
  "https://api.clawfi.ai/api/v1/market/ethereum/0x6982508145454Ce325dDbE47a25d4ec3d2311933" \
  -H "Authorization: Bearer clf_xxx"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "priceUsd": "0.00001234",
    "priceNative": "0.0000000052",
    "marketCap": 5200000000,
    "fdv": 5200000000,
    "volume24h": 125000000,
    "volume6h": 45000000,
    "volume1h": 8500000,
    "liquidity": 45000000,
    "priceChange24h": 15.5,
    "priceChange6h": 5.2,
    "priceChange1h": 1.8,
    "buys24h": 12500,
    "sells24h": 11200,
    "pairAddress": "0x...",
    "dex": "uniswap_v2",
    "baseToken": {
      "address": "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
      "name": "Pepe",
      "symbol": "PEPE"
    },
    "quoteToken": {
      "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "name": "Wrapped Ether",
      "symbol": "WETH"
    },
    "updatedAt": 1706745600000
  }
}
```

---

## Honeypot Check

### GET /honeypot/{chain}/{address}

Quick honeypot detection.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chain` | path | Yes | Chain ID |
| `address` | path | Yes | Token address |

**Example Request:**

```bash
curl -X GET \
  "https://api.clawfi.ai/api/v1/honeypot/bsc/0x..." \
  -H "Authorization: Bearer clf_xxx"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isHoneypot": false,
    "buyTax": 5,
    "sellTax": 5,
    "transferTax": 0,
    "canBuy": true,
    "canSell": true,
    "maxBuyAmount": null,
    "maxSellAmount": null
  }
}
```

**Honeypot Response:**

```json
{
  "success": true,
  "data": {
    "isHoneypot": true,
    "reason": "Sell function reverts",
    "buyTax": 0,
    "sellTax": 100,
    "canBuy": true,
    "canSell": false
  }
}
```

---

## Signals

### GET /signals/{chain}/{address}

Get active signals for a token.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chain` | path | Yes | Chain ID |
| `address` | path | Yes | Token address |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `severity` | string | all | Filter by severity |
| `type` | string | all | Filter by signal type |
| `limit` | number | 50 | Max results |

**Example Request:**

```bash
curl -X GET \
  "https://api.clawfi.ai/api/v1/signals/base/0x...?severity=warning" \
  -H "Authorization: Bearer clf_xxx"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "type": "whale_sell",
      "severity": "warning",
      "message": "Large sale detected: $85,000",
      "details": {
        "value": 85000,
        "percentage": 0.8,
        "address": "0x...",
        "txHash": "0x..."
      },
      "timestamp": 1706745600000
    }
  ]
}
```

---

## Search

### GET /search

Search for tokens by name, symbol, or address.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `chain` | string | No | Filter by chain |
| `limit` | number | No | Max results (default 20) |

**Example Request:**

```bash
curl -X GET \
  "https://api.clawfi.ai/api/v1/search?q=pepe&chain=ethereum&limit=10" \
  -H "Authorization: Bearer clf_xxx"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "address": "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
      "name": "Pepe",
      "symbol": "PEPE",
      "chain": "ethereum",
      "priceUsd": "0.00001234",
      "volume24h": 125000000,
      "liquidity": 45000000,
      "priceChange24h": 15.5,
      "pairAddress": "0x...",
      "dex": "uniswap_v2",
      "url": "https://dexscreener.com/ethereum/0x..."
    }
  ],
  "count": 1
}
```

---

## Health Check

### GET /health

Check API status and authentication.

**Example Request:**

```bash
curl -X GET \
  "https://api.clawfi.ai/api/v1/health" \
  -H "Authorization: Bearer clf_xxx"
```

**Response:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "authenticated": true,
  "rateLimit": {
    "remaining": 95,
    "limit": 100,
    "resetAt": 1706745660000
  }
}
```

---

## Supported Chains

| Chain ID | Name |
|----------|------|
| `ethereum` | Ethereum |
| `bsc` | BNB Smart Chain |
| `polygon` | Polygon |
| `arbitrum` | Arbitrum |
| `optimism` | Optimism |
| `base` | Base |
| `avalanche` | Avalanche |
| `fantom` | Fantom |
| `solana` | Solana |

## Next Steps

- [Rate Limits](rate-limits.md) - Rate limiting details
- [Response Formats](responses.md) - Response structure
- [Error Codes](errors.md) - Error reference
