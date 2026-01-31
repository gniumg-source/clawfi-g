# Clanker Integration

ClawFi provides first-class support for [Clanker](https://clanker.world), a token launchpad on Base. This document covers how ClawFi detects Clanker launches, configuration options, and known limitations.

## Overview

ClawFi integrates with Clanker in two ways:

1. **Chrome Extension Overlay**: Shows token context and signals when browsing Clanker token pages
2. **Launchpad Connector**: Indexes new token deployments on Base and emits LaunchDetected signals

## Chrome Extension Overlay

### How It Works

When you visit a Clanker token page (`https://clanker.world/clanker/0x...`):

1. The extension extracts the token address from the URL path
2. Validates the address format: `/^0x[a-fA-F0-9]{40}$/`
3. Fetches the last 5 signals for this token from your ClawFi Node
4. Renders an overlay card in the top-right corner

### SPA Navigation

Clanker is a single-page application (SPA), so the extension patches browser history methods:

- `history.pushState` - Navigation via links
- `history.replaceState` - URL updates without navigation
- `popstate` event - Browser back/forward buttons
- `hashchange` event - Hash-based routing (fallback)

This ensures the overlay updates when navigating between tokens without a full page reload.

### Metadata Extraction

The extension attempts best-effort extraction of additional metadata from the page:

| Field | Pattern | Example |
|-------|---------|---------|
| Version | `/\bV(3(?:\.1)?|4)\b/i` | "V3", "V3.1", "V4" |
| Creator | `Creator: 0x...` | Creator address |
| Admin | `Admin: 0x...` | Admin address |
| Verified | "Verified" keyword | Boolean |

**Important**: The token address always comes from the URL. Page metadata is supplementary and failures are silently ignored.

### Enabling/Disabling

1. Click the ClawFi extension icon
2. Toggle "Clanker Overlay" on/off
3. Changes take effect immediately

## Launchpad Connector

### Architecture

The Clanker connector is a **read-only indexer** that:

1. Polls new blocks on Base at configurable intervals (default: 10s)
2. Scans for token deployment events or transactions
3. Extracts token address, creator, factory, tx hash, block number
4. Stores in `launchpad_tokens` database table
5. Emits `LaunchDetected` signals

### Detection Modes

The connector supports two detection modes that run in parallel:

#### Mode A: Event-Based Scanning

Scans logs from configured factory addresses for known events:

```typescript
// Known event topics
const KNOWN_FACTORY_EVENTS = {
  Transfer: '0xddf252ad...', // ERC-20 Transfer
  // Add more as discovered
};
```

Detects token creation via Transfer events from zero address.

#### Mode B: Transaction Receipt Scanning

For transactions TO factory addresses:

1. Parses transaction receipts
2. Checks for `contractAddress` in receipt (direct deployment)
3. Looks for Transfer events in logs (factory pattern)

### Configuration

#### Environment Variables

```bash
# Required
BASE_RPC_URL=https://mainnet.base.org  # Or your preferred RPC

# Optional
CLANKER_FACTORY_ADDRESSES=0x...        # Comma-separated factory addresses
CLANKER_POLL_INTERVAL_MS=10000         # Polling interval (default: 10s)
CLANKER_MAX_BLOCKS_PER_SCAN=100        # Max blocks per scan (default: 100)
CLANKER_START_BLOCK=0                  # Start block (default: latest - 100)
CLANKER_RATE_LIMIT=5                   # RPC requests per second (default: 5)
```

#### Factory Addresses

To configure factory addresses, you can:

1. Set `CLANKER_FACTORY_ADDRESSES` env variable
2. Update the connector config in code
3. Store in database and load at startup

**Note**: Factory addresses may change between Clanker versions (V3, V3.1, V4). Check Clanker documentation for current addresses.

### Adding Event Topics

When new Clanker versions or event signatures are discovered:

1. Get the event signature (e.g., `event TokenCreated(address token, address creator)`)
2. Calculate topic0: `keccak256("TokenCreated(address,address)")`
3. Add to `KNOWN_FACTORY_EVENTS` in connector code
4. Or configure via `eventTopics` config option

```typescript
const connector = createClankerConnector({
  rpcUrl: process.env.BASE_RPC_URL,
  factoryAddresses: ['0x...'],
  eventTopics: [
    '0x...', // Your custom topic
  ],
});
```

### Rate Limiting

The connector implements conservative rate limiting to avoid RPC issues:

- Default: 5 requests per second
- Token bucket algorithm with burst capacity
- Exponential backoff on errors
- Configurable via `rateLimit` option

### Database Schema

```prisma
model LaunchpadToken {
  id              String   @id
  chain           String   // 'base'
  launchpad       String   // 'clanker'
  tokenAddress    String   // Unique per chain
  tokenName       String?
  tokenSymbol     String?
  creatorAddress  String
  factoryAddress  String?
  txHash          String
  blockNumber     BigInt
  blockTimestamp  DateTime?
  version         String?  // 'V3', 'V3.1', 'V4'
  verified        Boolean
  meta            Json?
}

model LaunchpadConnectorState {
  connectorId      String   @unique
  chain            String
  launchpad        String
  lastBlockScanned BigInt
  lastScanTs       DateTime?
  errorCount       Int
  lastError        String?
}
```

## Signals

### LaunchDetected

Emitted when a new Clanker token is detected:

```json
{
  "signalType": "LaunchDetected",
  "severity": "medium",
  "title": "Clanker launch detected",
  "summary": "New token SYMBOL deployed on Clanker (Base)",
  "token": "0x...",
  "tokenSymbol": "SYMBOL",
  "chain": "base",
  "evidence": {
    "tokenAddress": "0x...",
    "tokenName": "Token Name",
    "tokenSymbol": "SYMBOL",
    "creatorAddress": "0x...",
    "factoryAddress": "0x...",
    "txHash": "0x...",
    "blockNumber": "12345678",
    "launchpad": "clanker"
  }
}
```

### Notifications

LaunchDetected signals can trigger:

- Dashboard real-time updates (via WebSocket)
- Telegram notifications (if configured)
- Extension overlay updates

## API Endpoints

### GET /launchpads/tokens

List launchpad tokens with filtering and pagination.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$NODE_URL/launchpads/tokens?launchpad=clanker&chain=base&limit=20"
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "chain": "base",
      "launchpad": "clanker",
      "tokenAddress": "0x...",
      "tokenName": "Token Name",
      "tokenSymbol": "SYMBOL",
      "creatorAddress": "0x...",
      "txHash": "0x...",
      "blockNumber": "12345678",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### GET /launchpads/stats

Get launchpad statistics.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$NODE_URL/launchpads/stats?launchpad=clanker&chain=base"
```

Response:

```json
{
  "success": true,
  "data": {
    "totalTokens": 1234,
    "tokensLast24h": 50,
    "tokensLast7d": 300,
    "topCreators": [
      { "address": "0x...", "count": 25 }
    ]
  }
}
```

## Testing

### Simulate a Launch

Use the dev endpoint to test LaunchDetected signals:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "0x1234567890123456789012345678901234567890",
    "tokenSymbol": "TEST",
    "tokenName": "Test Token",
    "creatorAddress": "0xabcdefABCDEF1234567890123456789012345678"
  }' \
  "$NODE_URL/dev/simulate-launch"
```

This creates:
- A record in `launchpad_tokens`
- A `LaunchDetected` signal
- An audit log entry

## Known Limitations

1. **Factory Address Changes**: Clanker may deploy new factory contracts. Monitor for announcements and update configuration.

2. **Event Signature Discovery**: We may not know all event signatures. The connector supports both event and receipt scanning as fallback.

3. **RPC Dependencies**: Requires reliable Base RPC endpoint. Consider dedicated RPC for production.

4. **Metadata Accuracy**: Page metadata extraction may fail if Clanker changes their UI. Token address from URL is always authoritative.

5. **Block Reorgs**: The connector does not currently handle block reorganizations. Deep reorgs may cause missed or duplicate detections.

## Troubleshooting

### Connector Not Detecting Tokens

1. Check `BASE_RPC_URL` is correct and accessible
2. Verify factory addresses are configured
3. Check connector state: `GET /dev/status`
4. Review logs for RPC errors

### Extension Overlay Not Showing

1. Verify extension is installed and enabled
2. Check that Clanker overlay is toggled on in options
3. Confirm you're on a token page (`/clanker/0x...`)
4. Check browser console for errors

### High RPC Usage

1. Increase `pollIntervalMs` (e.g., 30000 for 30s)
2. Decrease `maxBlocksPerScan`
3. Lower `rateLimit` setting
4. Consider dedicated RPC endpoint

## Launch Coverage Verification (v0.1.1)

ClawFi verifies its own detection accuracy by comparing detected launches against on-chain activity.

### How It Works

A background job runs hourly:

1. Scans Base blocks for transactions to Clanker factory addresses
2. Counts total candidate deploy transactions
3. Compares with detected tokens in database
4. Calculates coverage percentage

### Coverage Status

| Percent | Status | Meaning |
|---------|--------|---------|
| ≥90% | Healthy (🟢) | Good detection coverage |
| 80-89% | Warning (🟡) | Some launches may be missed |
| <80% | Critical (🔴) | Review configuration |

### API Endpoint

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$NODE_URL/launchpads/coverage?launchpad=clanker&chain=base"
```

Response:

```json
{
  "success": true,
  "data": {
    "current": {
      "coveragePercent": 95.5,
      "detectedCount": 45,
      "estimatedTotal": 47,
      "windowStart": "2024-01-01T00:00:00.000Z",
      "windowEnd": "2024-01-02T00:00:00.000Z"
    },
    "averageCoverage7d": 93.2,
    "status": "healthy"
  }
}
```

### Configuration

```bash
COVERAGE_WINDOW_HOURS=24       # Analysis window (default: 24h)
INTELLIGENCE_RATE_LIMIT=3      # RPC rate limit for analysis jobs
```

### Assumptions

- Every transaction TO a factory address is a potential deployment
- Some factory transactions may fail (false positives acceptable)
- Coverage >100% indicates we're detecting more than factory txs

## Intelligence Signals (v0.1.1)

ClawFi analyzes newly launched tokens for risk indicators.

### EarlyDistribution Signal

Detects high holder concentration within the first 60 minutes.

**Triggers:**
- Top 10 holders ≥ 40% of supply
- Creator holds ≥ 15% of supply

**Evidence:**

```json
{
  "signalType": "EarlyDistribution",
  "severity": "medium",
  "evidence": {
    "tokenAddress": "0x...",
    "top10Percent": 45.5,
    "top20Percent": 62.3,
    "creatorPercent": 18.0,
    "holderCount": 150,
    "concentrationScore": 72.5
  }
}
```

**Configuration:**

```bash
DISTRIBUTION_WINDOW_MINUTES=60    # Analyze tokens this old (default: 60)
DISTRIBUTION_TOP10_THRESHOLD=40   # Top 10 threshold % (default: 40)
DISTRIBUTION_CREATOR_THRESHOLD=15 # Creator threshold % (default: 15)
```

### LiquidityRisk Signal

Detects liquidity removal or significant drops.

**Triggers:**
- Liquidity removed within first 24h
- Liquidity drops ≥ 50%

**Evidence:**

```json
{
  "signalType": "LiquidityRisk",
  "severity": "high",
  "evidence": {
    "tokenAddress": "0x...",
    "previousLiquidityUsd": 10000,
    "currentLiquidityUsd": 4000,
    "deltaPercent": -60
  }
}
```

**Configuration:**

```bash
LIQUIDITY_MONITOR_HOURS=24      # Monitor window (default: 24h)
LIQUIDITY_DROP_THRESHOLD=50     # Drop threshold % (default: 50)
```

## Extension Overlay Badges (v0.1.1)

The extension overlay shows risk badges when signals exist:

| Badge | Signal Type | Meaning |
|-------|-------------|---------|
| 🚀 Launch | LaunchDetected | Launch was detected |
| ⚠️ High Concentration | EarlyDistribution | Concentrated holdings |
| 🔥 Liquidity Risk | LiquidityRisk | Liquidity concerns |

Badges are clickable and link to the signals page.

## Token Intelligence API

Get full intelligence data for a token:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$NODE_URL/launchpads/tokens/0x.../intelligence"
```

Response includes:
- Holder concentration metrics
- Liquidity snapshots
- Signal history
- Risk indicators
- Overall risk level

## Prometheus Metrics

Export metrics for monitoring:

```bash
curl "$NODE_URL/metrics"
```

Available metrics:
- `clawfi_launch_coverage_percent`
- `clawfi_launches_detected_24h`
- `clawfi_launches_estimated_24h`
- `clawfi_signals_by_type_24h`

## Future Improvements

- [ ] WebSocket subscription for real-time detection
- [ ] Automatic factory address discovery
- [ ] Token verification status tracking
- [ ] Integration with Clanker API (if available)
- [ ] Support for additional launchpads
- [x] Launch coverage verification
- [x] Early distribution analysis
- [x] Liquidity risk detection
- [ ] Price impact analysis
- [ ] Creator wallet reputation scoring

