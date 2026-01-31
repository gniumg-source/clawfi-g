# ClawFi Connectors

## Overview

Connectors are pluggable modules that integrate ClawFi with external exchanges, DEXs, and protocols. They follow a standard interface and handle all communication with external services.

## Available Connectors

### Binance (CEX)

**Status**: ✅ Implemented

**Capabilities**:
- Read account balances
- Read open orders
- Place market/limit orders
- Cancel orders

**NOT Supported (by design)**:
- Withdrawals
- Futures trading
- Margin trading

**Configuration**:
```json
{
  "testnet": true,
  "label": "My Binance Account"
}
```

**Setup**:
1. Create API key on Binance
2. Enable spot trading permissions
3. **DISABLE withdrawals**
4. Set IP whitelist
5. Add via dashboard or API

### EVM DEX (Uniswap V2/V3)

**Status**: ✅ Implemented (quote only)

**Capabilities**:
- Quote swap prices
- Read token metadata
- Check token balances

**Future**:
- Build unsigned swap transactions
- Multi-DEX aggregation

**Supported Chains**:
- Ethereum
- Arbitrum
- Base
- Polygon
- Optimism

## Connector Interface

All connectors implement a standard interface:

```typescript
interface IConnector {
  readonly id: string;
  readonly type: ConnectorType;
  readonly venue: Venue;

  initialize(): Promise<void>;
  getHealth(): Promise<ConnectorHealth>;
  shutdown(): Promise<void>;
}

interface ICexConnector extends IConnector {
  getBalances(): Promise<Balance[]>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  placeOrder(request: OrderRequest): Promise<Order>;
  cancelOrder(orderId: string, symbol: string): Promise<boolean>;
}

interface IDexConnector extends IConnector {
  getQuote(request: QuoteRequest): Promise<QuoteResponse>;
  buildSwapTx?(request: QuoteRequest): Promise<UnsignedTransaction>;
}
```

## Adding a New Connector

### 1. Define Types

Add the new venue to the schema:

```typescript
// packages/core/src/common/index.ts
export const VenueSchema = z.enum([
  'binance',
  'uniswap_v2',
  // Add new venue
  'kraken',
]);
```

### 2. Implement Connector

Create a new file in `packages/connectors/src/`:

```typescript
// packages/connectors/src/kraken/index.ts

export class KrakenConnector implements ICexConnector {
  readonly id: string;
  readonly type = 'cex' as const;
  readonly venue = 'kraken' as const;

  constructor(
    config: KrakenConfig,
    vault: Vault,
    getCredentials: () => Promise<EncryptedCredentials>
  ) {
    // Initialize
  }

  async initialize(): Promise<void> {
    // Decrypt credentials
    // Set up API client
  }

  async getHealth(): Promise<ConnectorHealth> {
    // Check API connectivity
  }

  async getBalances(): Promise<Balance[]> {
    // Fetch and normalize balances
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    // Fetch and normalize orders
  }

  async placeOrder(request: OrderRequest): Promise<Order> {
    // Execute order through risk engine
  }

  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    // Cancel order
  }

  async shutdown(): Promise<void> {
    // Clean up resources
  }
}
```

### 3. Register Routes

Add API routes in the node app:

```typescript
// apps/node/src/routes/connectors.ts

fastify.post('/connectors/kraken', async (request, reply) => {
  // Handle Kraken connector setup
});
```

### 4. Add Dashboard UI

Create UI components for the new connector:

```typescript
// apps/dashboard/src/app/dashboard/connectors/page.tsx
// Add form and display for Kraken
```

## Best Practices

### Security

1. **Never store plaintext credentials**
   - Always use vault encryption
   - Decrypt only when needed

2. **Limit permissions**
   - Request minimal API permissions
   - Document what's needed and why

3. **Validate responses**
   - Don't trust external data
   - Use Zod schemas for validation

### Reliability

1. **Handle rate limits**
   - Implement backoff strategies
   - Queue requests if needed

2. **Graceful errors**
   - Catch and wrap errors
   - Provide actionable messages

3. **Health checks**
   - Implement comprehensive health checks
   - Monitor connectivity

### Maintainability

1. **Normalize data**
   - Convert all external formats to internal schemas
   - Use consistent decimal handling

2. **Document assumptions**
   - API version requirements
   - Known limitations

3. **Write tests**
   - Unit tests for normalization
   - Integration tests with mocks

## Connector Lifecycle

```
1. Creation (via API)
   └── Credentials encrypted with vault
   └── Config stored in DB
   
2. Initialization
   └── Decrypt credentials
   └── Establish API connection
   └── Verify health
   
3. Operation
   └── Handle requests
   └── Apply risk checks
   └── Audit all actions
   
4. Shutdown
   └── Close connections
   └── Clear sensitive data
```

## Error Handling

Connectors should throw typed errors:

```typescript
class ConnectorError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

// Usage
throw new ConnectorError(
  'Insufficient balance',
  'INSUFFICIENT_FUNDS',
  false
);
```

Common error codes:
- `UNAUTHORIZED`: Invalid credentials
- `RATE_LIMITED`: Too many requests
- `INSUFFICIENT_FUNDS`: Not enough balance
- `INVALID_SYMBOL`: Unknown trading pair
- `ORDER_REJECTED`: Exchange rejected order
- `NETWORK_ERROR`: Connectivity issue


