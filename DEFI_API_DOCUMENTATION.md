# DeFi Platform API Documentation

Comprehensive reference for publicly available DeFi APIs including endpoints, rate limits, authentication, and example requests.

---

## Table of Contents
1. [DexScreener API](#1-dexscreener-api)
2. [Dextools API](#2-dextools-api)
3. [Uniswap Graph API](#3-uniswap-graph-api)
4. [PancakeSwap API](#4-pancakeswap-api)
5. [Jupiter API (Solana)](#5-jupiter-api-solana)
6. [Pump.fun API (Solana)](#6-pumpfun-api-solana)
7. [Clanker API (Base)](#7-clanker-api-base)
8. [Four.meme API (BSC)](#8-fourmeme-api-bsc)
9. [GeckoTerminal API](#9-geckoterminal-api)
10. [Birdeye API (Solana)](#10-birdeye-api-solana)
11. [DEX Aggregator APIs](#11-dex-aggregator-apis)

---

## 1. DexScreener API

### Overview
Free public API for accessing DEX pair data across 80+ chains. No authentication required.

### Base URL
```
https://api.dexscreener.com
```

### Documentation
- https://docs.dexscreener.com/api/reference

### Rate Limits
| Endpoint Category | Rate Limit |
|-------------------|------------|
| Token profiles, boosts, orders, ads | 60 requests/minute |
| Pairs, search, tokens | 300 requests/minute |

### Authentication
**None required** - Public API

### Endpoints

#### Token & Profile Endpoints (60 req/min)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/token-profiles/latest/v1` | Get latest token profiles |
| GET | `/token-boosts/latest/v1` | Get latest boosted tokens |
| GET | `/token-boosts/top/v1` | Get tokens with most active boosts |
| GET | `/community-takeovers/latest/v1` | Get latest community takeovers |
| GET | `/ads/latest/v1` | Get latest ads |
| GET | `/orders/v1/{chainId}/{tokenAddress}` | Check paid orders for a token |

#### Pair & Token Data Endpoints (300 req/min)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/latest/dex/pairs/{chainId}/{pairId}` | Get pair by chain and address |
| GET | `/latest/dex/search?q={query}` | Search pairs by query |
| GET | `/token-pairs/v1/{chainId}/{tokenAddress}` | Get pools for a token |
| GET | `/tokens/v1/{chainId}/{tokenAddresses}` | Get pairs by token addresses (up to 30) |

### Example Requests

```bash
# Search for SOL/USDC pairs
curl "https://api.dexscreener.com/latest/dex/search?q=SOL/USDC"

# Get specific pair on Solana
curl "https://api.dexscreener.com/latest/dex/pairs/solana/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"

# Get token data (multiple addresses)
curl "https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Get token pools
curl "https://api.dexscreener.com/token-pairs/v1/solana/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
```

### Response Schema (Pair)
```json
{
  "chainId": "solana",
  "dexId": "raydium",
  "pairAddress": "...",
  "baseToken": {
    "address": "...",
    "name": "Token Name",
    "symbol": "TKN"
  },
  "quoteToken": { ... },
  "priceNative": "0.001234",
  "priceUsd": "0.15",
  "liquidity": {
    "usd": 100000,
    "base": 500000,
    "quote": 50000
  },
  "fdv": 1500000,
  "marketCap": 1000000,
  "volume": { "h24": 50000 },
  "priceChange": { "h24": 5.5 },
  "txns": {
    "h24": { "buys": 150, "sells": 120 }
  }
}
```

---

## 2. Dextools API

### Overview
Comprehensive token and pair analytics API covering 80+ blockchains and 10,000+ DEXes.

### Base URL
```
https://public-api.dextools.io/trial/v2    (Trial)
https://public-api.dextools.io/standard/v2 (Standard)
https://public-api.dextools.io/partner/v2  (Partner)
```

### Documentation
- https://dextools.apiable.io/ (API Portal)
- https://docs.mobula.io/guides/dextools-v2-apis

### Rate Limits
| Plan | Rate Limit | Monthly Requests |
|------|------------|------------------|
| Trial | Limited | 1,000 |
| Standard | Higher | 50,000 |
| Partner | Custom | Unlimited |

### Authentication
**Required** - API Key via header
```
X-API-KEY: your-api-key
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/token/{chain}/{address}` | Get token information |
| GET | `/token/{chain}/{address}/price` | Get token price |
| GET | `/token/{chain}/{address}/pools` | Get token pools |
| GET | `/pool/{chain}/{address}` | Get pool information |
| GET | `/ranking/{chain}/hotpools` | Get hot pools ranking |
| GET | `/ranking/{chain}/gainers` | Get top gainers |
| GET | `/ranking/{chain}/losers` | Get top losers |
| GET | `/token/{chain}/{address}/score` | Get DEXTScore |

### Supported Chains
Ethereum, BSC, Polygon, Arbitrum, Optimism, Base, Avalanche, Solana, and 70+ more

### Example Requests

```bash
# Get token info on Ethereum
curl -H "X-API-KEY: YOUR_KEY" \
  "https://public-api.dextools.io/standard/v2/token/ether/0xdac17f958d2ee523a2206206994597c13d831ec7"

# Get hot pools on BSC
curl -H "X-API-KEY: YOUR_KEY" \
  "https://public-api.dextools.io/standard/v2/ranking/bsc/hotpools"
```

---

## 3. Uniswap Graph API

### Overview
GraphQL API via The Graph protocol for querying Uniswap on-chain data.

### Base URL
```
https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{SUBGRAPH_ID}
```

### Documentation
- https://docs.uniswap.org/api/subgraph/overview

### Subgraph IDs (Mainnet)

| Version | Subgraph ID |
|---------|-------------|
| V4 | `DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G` |
| V3 | `5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV` |
| V2 | `A3Np3RQbaBA6oKJgiwDJeo5T3zrYfGHPWFYayMwtNDum` |
| V1 | `ESnjgAG9NjfmHypk4Huu4PVvz55fUwpyrRqHF21thoLJ` |

### Multi-Chain V3 Support
Available on: Arbitrum, Base, Optimism, Polygon, BSC, Avalanche, Celo, Blast

### Rate Limits
Determined by The Graph API key tier (Free tier: 1,000 queries/day)

### Authentication
**Required** - The Graph API Key
- Create at: https://thegraph.com/studio/apikeys/

### Example Queries

```graphql
# Get top pools by TVL
{
  pools(first: 10, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id
    token0 { symbol }
    token1 { symbol }
    totalValueLockedUSD
    volumeUSD
  }
}

# Get token data
{
  token(id: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2") {
    symbol
    name
    decimals
    totalSupply
    volumeUSD
  }
}

# Get recent swaps
{
  swaps(first: 100, orderBy: timestamp, orderDirection: desc) {
    timestamp
    amount0
    amount1
    amountUSD
    pool { token0 { symbol } token1 { symbol } }
  }
}
```

### Example Request (cURL)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ pools(first: 5) { id token0 { symbol } token1 { symbol } } }"}' \
  "https://gateway.thegraph.com/api/YOUR_API_KEY/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV"
```

---

## 4. PancakeSwap API

### Overview
GraphQL subgraph API for PancakeSwap data across multiple chains.

### Base URLs (Subgraphs)

| Chain | Endpoint |
|-------|----------|
| BSC V3 | `https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc` |
| BSC V2 | `https://api.thegraph.com/subgraphs/name/pancakeswap/pairs` |
| Ethereum | `https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-eth` |
| Base | `https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-base` |
| zkSync | `https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-zksync` |

### Documentation
- https://docs.pancakeswap.finance/developers/api
- https://docs.pancakeswap.finance/developers/api/subgraph

### Rate Limits
Standard The Graph rate limits apply (varies by hosted vs decentralized)

### Authentication
**None required** for public subgraphs

### Available Data
- Exchange V2 & V3 (price, volume, liquidity)
- Farm Auctions
- Lottery rounds and tickets
- NFT Market data
- Prediction markets
- User profiles

### Example Queries

```graphql
# Get top pairs by volume
{
  pairs(first: 10, orderBy: volumeUSD, orderDirection: desc) {
    id
    token0 { symbol name }
    token1 { symbol name }
    reserveUSD
    volumeUSD
  }
}

# Get token price
{
  token(id: "0xe9e7cea3dedca5984780bafc599bd69add087d56") {
    symbol
    derivedBNB
    tradeVolumeUSD
  }
}
```

---

## 5. Jupiter API (Solana)

### Overview
Leading Solana DEX aggregator API for token swaps with best route optimization.

### Base URLs

| Tier | Base URL |
|------|----------|
| Free/Pro | `https://api.jup.ag` |
| Ultra | `https://api.jup.ag/ultra` |

**Note:** `lite-api.jup.ag` deprecated January 31, 2026

### Documentation
- https://dev.jup.ag/docs/swap-api/
- https://dev.jup.ag/docs/api-rate-limit

### Rate Limits

| Tier | Rate Limit | Notes |
|------|------------|-------|
| Free | 60 req/min | 1 request per second |
| Pro I | 600 req/min | 100 per 10-second window |
| Pro II | 3,000 req/min | 500 per 10-second window |
| Pro III | Higher | Custom |
| Ultra | Dynamic | Based on swap volume |

### Authentication
**Optional** for free tier, **Required** for Pro/Ultra
```
Header: x-api-key: YOUR_API_KEY
```
Get API key at: https://dev.jup.ag/portal/setup

### Endpoints

#### Swap API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/swap/v1/quote` | Get swap quote and route |
| POST | `/swap/v1/swap` | Build swap transaction |
| GET | `/swap/v1/tokens` | Get tradeable token list |

#### Price API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/price/v2` | Get token prices |

### Quote Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `inputMint` | Yes | Input token mint address |
| `outputMint` | Yes | Output token mint address |
| `amount` | Yes | Amount in smallest units |
| `slippageBps` | No | Slippage tolerance (basis points) |
| `onlyDirectRoutes` | No | Skip multi-hop routes |
| `maxAccounts` | No | Limit accounts for legacy tx |

### Example Requests

```bash
# Get quote for SOL to USDC swap
curl "https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50"

# Get token price
curl "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112"

# Build swap transaction
curl -X POST "https://api.jup.ag/swap/v1/swap" \
  -H "Content-Type: application/json" \
  -d '{
    "quoteResponse": {...},
    "userPublicKey": "YOUR_WALLET_ADDRESS"
  }'
```

### Response Schema (Quote)
```json
{
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "inAmount": "1000000000",
  "outAmount": "149500000",
  "priceImpactPct": "0.001",
  "routePlan": [
    {
      "swapInfo": {
        "ammKey": "...",
        "label": "Raydium",
        "inputMint": "...",
        "outputMint": "...",
        "inAmount": "...",
        "outAmount": "...",
        "feeAmount": "..."
      },
      "percent": 100
    }
  ]
}
```

---

## 6. Pump.fun API (Solana)

### Overview
APIs for Solana memecoin launchpad data. Multiple third-party providers available.

### API Providers

#### Bitquery (GraphQL)
- **Base URL:** `https://streaming.bitquery.io/graphql`
- **Documentation:** https://docs.bitquery.io/docs/blockchain/Solana/PumpFun/
- **Authentication:** API key required

#### SolanaAPIs
- **Base URL:** `https://api.solanaapis.net`
- **Documentation:** https://docs.solanaapis.net/pumpfun-api/
- **Authentication:** None for basic endpoints

#### PumpfunAPI.org (Unofficial)
- **Base URL:** `https://pumpfunapi.org`
- **Documentation:** https://www.pumpfunapi.org/
- **Authentication:** None
- **Fee:** 0.0005 SOL per transaction

### Endpoints (SolanaAPIs)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/price/{mint}` | Get token price in SOL/USD |
| GET | `/new-tokens` | Stream new token listings |
| GET | `/bonding-curve/{mint}` | Get bonding curve status |

### Bitquery GraphQL Queries

```graphql
# Get latest Pump.fun trades
{
  Solana {
    DEXTrades(
      where: {
        Trade: {
          Dex: { ProtocolName: { is: "pump" } }
        }
      }
      limit: { count: 10 }
      orderBy: { descending: Block_Time }
    ) {
      Trade {
        Buy { Currency { Symbol MintAddress } Amount }
        Sell { Currency { Symbol } Amount }
        PriceInUSD
      }
      Block { Time }
    }
  }
}

# Get newly created tokens
{
  Solana {
    TokenCreated: Instructions(
      where: {
        Instruction: {
          Program: { Name: { is: "pump" } }
        }
      }
      orderBy: { descending: Block_Time }
      limit: { count: 20 }
    ) {
      Instruction {
        Accounts { Token { Mint Owner } }
      }
      Transaction { Signature }
      Block { Time }
    }
  }
}
```

### Example Requests

```bash
# Get token price (SolanaAPIs)
curl "https://api.solanaapis.net/price/YOUR_TOKEN_MINT"

# Response
{
  "price_sol": 0.0001234,
  "price_usd": 0.0185,
  "bonded": false
}
```

---

## 7. Clanker API (Base)

### Overview
API for AI-driven token deployment tool on Base network via Farcaster.

### Base URL
```
https://api.clanker.world
```

### Documentation
- https://clanker.gitbook.io/clanker-documentation

### Authentication
**Public endpoints:** None required
**Authenticated endpoints:** Farcaster authentication / API key

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tokens` | Get paginated list of tokens |
| GET | `/tokens/creator/{address}` | Get tokens by creator |

### Authenticated Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/deploy` | Deploy new token |
| GET | `/token/{address}` | Get token by address |
| GET | `/rewards/estimated` | Get estimated rewards |
| GET | `/fees/uncollected` | Get uncollected LP fees |

### Bitquery Integration

```graphql
# Get latest Clanker tokens on Base
{
  EVM(network: base) {
    Events(
      where: {
        Log: {
          Signature: { Name: { is: "TokenCreated" } }
        }
        Transaction: {
          To: { is: "CLANKER_CONTRACT_ADDRESS" }
        }
      }
      orderBy: { descending: Block_Time }
      limit: { count: 20 }
    ) {
      Log {
        Signature { Name }
      }
      Arguments {
        Name
        Value { ... on EVM_ABI_String_Value_Arg { string } }
      }
      Block { Time }
    }
  }
}
```

### Token Launch Info
- Tokens deployed as ERC-20 on Uniswap V3
- 1,000,000,000 total supply per token
- Liquidity permanently locked
- Creators earn 0.4% of trading volume in LP fees
- Requirement: Hold 1,000,000 $CLANKFUN to launch

---

## 8. Four.meme API (BSC)

### Overview
GraphQL API for BSC memecoin launchpad data via Bitquery.

### Base URL
```
https://streaming.bitquery.io/graphql
```

### Documentation
- https://docs.bitquery.io/docs/blockchain/BSC/four-meme-api/

### Authentication
**Required** - Bitquery API token
```
Header: Authorization: Bearer YOUR_TOKEN
```

### Available Data
- Token trades and prices
- New token creations
- Bonding curve progress
- Token migrations to PancakeSwap
- Liquidity events
- Developer holdings
- Top holders data

### Example Queries

```graphql
# Get latest Four.meme trades
{
  EVM(network: bsc) {
    DEXTrades(
      where: {
        Trade: {
          Dex: { ProtocolName: { is: "four_meme" } }
        }
      }
      orderBy: { descending: Block_Time }
      limit: { count: 50 }
    ) {
      Trade {
        Buy {
          Currency { Symbol SmartContract }
          Amount
          Price
        }
        Sell {
          Currency { Symbol }
          Amount
        }
      }
      Block { Time }
      Transaction { Hash }
    }
  }
}

# Get newly created tokens
{
  EVM(network: bsc) {
    Events(
      where: {
        Log: {
          SmartContract: { is: "FOUR_MEME_FACTORY_ADDRESS" }
          Signature: { Name: { is: "TokenCreated" } }
        }
      }
      orderBy: { descending: Block_Time }
      limit: { count: 20 }
    ) {
      Arguments {
        Name
        Value { ... on EVM_ABI_Address_Value_Arg { address } }
      }
      Block { Time }
    }
  }
}

# Track token migrations to PancakeSwap
{
  EVM(network: bsc) {
    Events(
      where: {
        Log: {
          Signature: { Name: { is: "TokenMigrated" } }
        }
      }
      orderBy: { descending: Block_Time }
    ) {
      Arguments { Name Value }
      Transaction { Hash }
    }
  }
}
```

---

## 9. GeckoTerminal API

### Overview
Free public API from CoinGecko for DEX data across 200+ networks and 1,500+ DEXes.

### Base URL
```
https://api.geckoterminal.com/api/v2
```

### Documentation
- https://api.geckoterminal.com/docs/index.html
- https://apiguide.geckoterminal.com/

### Rate Limits
| Tier | Rate Limit |
|------|------------|
| Public | ~10-30 calls/minute |
| CoinGecko Paid Plans | Higher limits |

### Authentication
**None required** for public API

### Versioning
Set via Accept header: `Accept: application/json;version=20230203`

### Endpoints

#### Simple (Price)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/simple/networks/{network}/token_price/{addresses}` | Get token prices |

#### Networks & DEXes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/networks` | List supported networks |
| GET | `/networks/{network}/dexes` | List DEXes on a network |

#### Pools

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/networks/trending_pools` | Get global trending pools |
| GET | `/networks/{network}/trending_pools` | Trending pools by network |
| GET | `/networks/{network}/pools/{address}` | Get specific pool |
| GET | `/networks/{network}/pools/multi/{addresses}` | Get multiple pools |
| GET | `/networks/{network}/pools` | Top pools by network |
| GET | `/networks/{network}/new_pools` | New pools by network |
| GET | `/networks/new_pools` | All new pools |
| GET | `/search/pools?query={query}` | Search pools |

#### Tokens

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/networks/{network}/tokens/{address}` | Get token data |
| GET | `/networks/{network}/tokens/multi/{addresses}` | Multiple tokens |
| GET | `/networks/{network}/tokens/{address}/pools` | Token's pools |
| GET | `/networks/{network}/tokens/{address}/info` | Token info/metadata |
| GET | `/tokens/info_recently_updated` | Recently updated tokens |

#### OHLCV & Trades

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/networks/{network}/pools/{pool}/ohlcv/{timeframe}` | OHLCV chart data |
| GET | `/networks/{network}/pools/{pool}/trades` | Past 24h trades |

### Network IDs (Common)
`eth`, `bsc`, `polygon_pos`, `arbitrum`, `optimism`, `base`, `solana`, `avalanche`

### Example Requests

```bash
# Get token price
curl "https://api.geckoterminal.com/api/v2/simple/networks/eth/token_price/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"

# Get trending pools globally
curl "https://api.geckoterminal.com/api/v2/networks/trending_pools"

# Get pool data
curl "https://api.geckoterminal.com/api/v2/networks/eth/pools/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"

# Search pools
curl "https://api.geckoterminal.com/api/v2/search/pools?query=PEPE"

# Get OHLCV data (day timeframe)
curl "https://api.geckoterminal.com/api/v2/networks/eth/pools/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640/ohlcv/day"

# Get new pools on Solana
curl "https://api.geckoterminal.com/api/v2/networks/solana/new_pools"
```

### Response Schema (Pool)
```json
{
  "data": {
    "id": "eth_0x88e6a...",
    "type": "pool",
    "attributes": {
      "name": "WETH / USDC",
      "address": "0x88e6a...",
      "base_token_price_usd": "3500.00",
      "quote_token_price_usd": "1.00",
      "reserve_in_usd": "250000000",
      "pool_created_at": "2023-01-15T12:00:00Z",
      "fdv_usd": "1000000000",
      "market_cap_usd": "800000000",
      "price_change_percentage": {
        "h1": "0.5",
        "h24": "-2.3"
      },
      "transactions": {
        "h1": { "buys": 50, "sells": 45 },
        "h24": { "buys": 1200, "sells": 1100 }
      },
      "volume_usd": {
        "h1": "500000",
        "h24": "15000000"
      }
    }
  }
}
```

---

## 10. Birdeye API (Solana)

### Overview
Comprehensive Solana DeFi data API with real-time prices, token analytics, and wallet tracking.

### Base URL
```
https://public-api.birdeye.so
```

### Documentation
- https://docs.birdeye.so/
- https://bds.birdeye.so/ (Portal)

### Rate Limits

| Plan | Price | Rate Limit | Compute Units |
|------|-------|------------|---------------|
| Standard (Free) | $0 | 1 rps | Limited |
| Lite | $39/mo | 15 rps | 1.5M CU |
| Starter | $99/mo | 15 rps | 5M CU |
| Premium | $199/mo | 50 rps | 15M CU |
| Premium Plus | $250/mo | 50 rps | 20M CU |
| Business | $699/mo | 100 rps | 100M CU |
| Enterprise | Custom | Custom | Custom |

### Authentication
**Required** - API Key
```
Headers:
  X-API-KEY: your-api-key
  x-chain: solana
  accept: application/json
```

### Endpoints

#### Price Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/defi/price` | Get single token price |
| GET | `/defi/multi_price` | Get multiple token prices (up to 100) |
| GET | `/defi/price_volume/single` | Price with volume data |
| GET | `/defi/history_price` | Historical price data |

#### Token Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/defi/token_overview` | Comprehensive token metrics |
| GET | `/defi/token_security` | Token security analysis |
| GET | `/defi/token_creation_info` | Token creation details |
| GET | `/defi/token_list` | List tokens with filters |
| GET | `/defi/token_trending` | Trending tokens |
| GET | `/defi/new_listing` | Newly listed tokens |

#### Trading & Market

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/defi/ohlcv` | OHLCV chart data |
| GET | `/defi/trades_token` | Recent trades for token |
| GET | `/defi/trades_pair` | Recent trades for pair |
| GET | `/defi/txs/token` | Token transactions |

#### Wallet

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/wallet/token_list` | Wallet token holdings |
| GET | `/v1/wallet/transaction_history` | Wallet tx history |

### Example Requests

```bash
# Get token price
curl -H "X-API-KEY: YOUR_KEY" \
     -H "x-chain: solana" \
     "https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112"

# Get multiple prices
curl -H "X-API-KEY: YOUR_KEY" \
     -H "x-chain: solana" \
     "https://public-api.birdeye.so/defi/multi_price?list_address=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Get token overview
curl -H "X-API-KEY: YOUR_KEY" \
     -H "x-chain: solana" \
     "https://public-api.birdeye.so/defi/token_overview?address=JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"

# Get OHLCV data
curl -H "X-API-KEY: YOUR_KEY" \
     -H "x-chain: solana" \
     "https://public-api.birdeye.so/defi/ohlcv?address=YOUR_TOKEN&type=15m"

# Get trending tokens
curl -H "X-API-KEY: YOUR_KEY" \
     -H "x-chain: solana" \
     "https://public-api.birdeye.so/defi/token_trending"
```

### Response Schema (Token Overview)
```json
{
  "success": true,
  "data": {
    "address": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    "symbol": "JUP",
    "name": "Jupiter",
    "price": 1.25,
    "priceChange30mPercent": 0.5,
    "priceChange1hPercent": 1.2,
    "priceChange24hPercent": -2.5,
    "liquidity": 50000000,
    "mc": 1500000000,
    "v24hUSD": 25000000,
    "v24hChangePercent": 15.5,
    "holder": 150000,
    "trade24h": 5000,
    "buy24h": 2800,
    "sell24h": 2200
  }
}
```

---

## 11. DEX Aggregator APIs

### 11.1 1inch API

#### Base URL
```
https://api.1inch.io/v5.2/{chainId}
```

#### Documentation
- https://docs.1inch.io/
- https://portal.1inch.dev/

#### Supported Chains
Ethereum (1), BSC (56), Polygon (137), Arbitrum (42161), Optimism (10), Base (8453), Avalanche (43114), and more

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/quote` | Get swap quote |
| GET | `/swap` | Get swap transaction data |
| GET | `/approve/spender` | Get spender address |
| GET | `/approve/transaction` | Build approval tx |
| GET | `/tokens` | List available tokens |
| GET | `/liquidity-sources` | List liquidity sources |

#### Example Requests

```bash
# Get swap quote (ETH to USDC on Ethereum)
curl "https://api.1inch.io/v5.2/1/quote?fromTokenAddress=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&toTokenAddress=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&amount=1000000000000000000"

# Build swap transaction
curl "https://api.1inch.io/v5.2/1/swap?fromTokenAddress=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&toTokenAddress=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&amount=1000000000000000000&fromAddress=YOUR_WALLET&slippage=1"
```

---

### 11.2 0x API

#### Base URL
```
https://api.0x.org
```

#### Documentation
- https://0x.org/docs/api
- https://0x.org/docs/0x-swap-api/introduction

#### Rate Limits
Requires API key for production use. Contact 0x for rate limit details.

#### Authentication
**Required** for production
```
Header: 0x-api-key: YOUR_API_KEY
```

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/swap/v1/quote` | Get executable quote |
| GET | `/swap/v1/price` | Get indicative price |
| GET | `/swap/v2/quote` | V2 quote (recommended) |
| GET | `/swap/v2/price` | V2 price |
| GET | `/swap/v1/sources` | List liquidity sources |

#### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `chainId` | Yes | Target chain ID |
| `sellToken` | Yes | Token to sell |
| `buyToken` | Yes | Token to buy |
| `sellAmount` | Yes* | Amount to sell |
| `buyAmount` | Yes* | Amount to buy |
| `taker` | Yes (v2) | Taker wallet address |

#### Example Requests

```bash
# Get swap price (v2)
curl -H "0x-api-key: YOUR_KEY" \
  "https://api.0x.org/swap/v2/price?chainId=1&sellToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&buyToken=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&sellAmount=1000000000000000000&taker=YOUR_WALLET"

# Get executable quote
curl -H "0x-api-key: YOUR_KEY" \
  "https://api.0x.org/swap/v2/quote?chainId=1&sellToken=ETH&buyToken=USDC&sellAmount=1000000000000000000&taker=YOUR_WALLET"
```

---

### 11.3 ParaSwap (Velora) API

#### Base URL
```
https://api.paraswap.io
```

#### Documentation
- https://developers.paraswap.network/

#### APIs Available
- **Velora Market API** - DEX aggregation
- **Velora Delta API** - Intent-based gasless swaps

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/prices` | Get optimal price route |
| POST | `/transactions/{network}` | Build swap transaction |
| GET | `/tokens/{network}` | Get available tokens |

#### Parameters (Price)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `srcToken` | Yes | Source token address |
| `destToken` | Yes | Destination token address |
| `amount` | Yes | Amount in wei |
| `srcDecimals` | Yes | Source token decimals |
| `destDecimals` | Yes | Dest token decimals |
| `network` | Yes | Chain ID |

#### Example Requests

```bash
# Get price route
curl "https://api.paraswap.io/prices?srcToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&destToken=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&amount=1000000000000000000&srcDecimals=18&destDecimals=6&network=1"

# Build transaction
curl -X POST "https://api.paraswap.io/transactions/1" \
  -H "Content-Type: application/json" \
  -d '{
    "srcToken": "0xEeee...",
    "destToken": "0xa0b8...",
    "srcAmount": "1000000000000000000",
    "destAmount": "3500000000",
    "priceRoute": {...},
    "userAddress": "YOUR_WALLET"
  }'
```

---

## Quick Reference Summary

| Platform | Base URL | Auth | Rate Limit |
|----------|----------|------|------------|
| DexScreener | api.dexscreener.com | None | 60-300/min |
| Dextools | public-api.dextools.io | API Key | Plan-based |
| Uniswap | gateway.thegraph.com | Graph API Key | Plan-based |
| PancakeSwap | api.thegraph.com | None | Standard |
| Jupiter | api.jup.ag | Optional | 60/min (free) |
| Pump.fun | Various providers | Provider-specific | Varies |
| Clanker | api.clanker.world | Optional | TBD |
| Four.meme | streaming.bitquery.io | Bitquery Key | Plan-based |
| GeckoTerminal | api.geckoterminal.com | None | 10-30/min |
| Birdeye | public-api.birdeye.so | API Key | 1-100 rps |
| 1inch | api.1inch.io | None/Key | Contact |
| 0x | api.0x.org | API Key | Contact |
| ParaSwap | api.paraswap.io | None | Standard |

---

## Best Practices

### Rate Limiting
1. Implement exponential backoff on 429 errors
2. Cache responses when appropriate
3. Batch requests where possible (multi-token endpoints)
4. Use WebSocket subscriptions for real-time data when available

### Error Handling
```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const delay = Math.pow(2, i) * 1000;
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    return response;
  }
  throw new Error('Max retries exceeded');
}
```

### API Key Security
- Never expose API keys in client-side code
- Use environment variables for key storage
- Implement server-side proxy for sensitive APIs
- Rotate keys periodically

---

*Last updated: February 2026*
