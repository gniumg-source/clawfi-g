# Configuration

Customize ClawFi to match your trading style and preferences.

## Extension Configuration

Access settings through the extension popup or options page.

### General Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Enable Overlay | `true` | Show floating action button on token pages |
| Auto-Expand | `false` | Automatically expand the analysis panel |
| Sound Alerts | `false` | Play sound for high-severity signals |
| Dark Mode | `auto` | Theme preference (auto/light/dark) |

### Risk Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Risk Threshold | `medium` | Minimum risk level to highlight |
| Show Warnings | `true` | Display warning badges |
| Honeypot Check | `true` | Enable honeypot detection |

### Signal Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Whale Alerts | `true` | Track large wallet movements |
| Liquidity Alerts | `true` | Monitor liquidity changes |
| Volume Alerts | `true` | Detect volume spikes |
| Price Alerts | `true` | Track significant price changes |

## SDK Configuration

### Basic Configuration

```typescript
import { ClawFi } from '@clawfi/sdk';

const clawfi = new ClawFi({
  // API key (optional for basic features)
  apiKey: 'your-api-key',
  
  // Request timeout in milliseconds
  timeout: 30000,
  
  // Number of retry attempts
  retries: 3,
  
  // Enable request caching
  cache: true,
  
  // Cache TTL in milliseconds
  cacheTtl: 60000,
  
  // Enable debug logging
  debug: false,
});
```

### Advanced Configuration

```typescript
const clawfi = new ClawFi({
  // Custom API endpoint (for self-hosted)
  baseUrl: 'https://api.clawfi.ai',
  
  // Rate limiting (requests per second)
  rateLimit: 10,
  
  // Custom headers
  headers: {
    'X-Custom-Header': 'value',
  },
  
  // Response validation
  validateResponses: true,
  
  // Retry configuration
  retryDelay: 1000,      // Base delay
  maxRetryDelay: 30000,  // Maximum delay
  
  // Custom fetch implementation (for Node.js < 18)
  fetch: customFetch,
});
```

### Environment Variables

```bash
# .env file
CLAWFI_API_KEY=your-api-key
CLAWFI_BASE_URL=https://api.clawfi.ai
CLAWFI_TIMEOUT=30000
CLAWFI_DEBUG=false
```

```typescript
// Load from environment
const clawfi = new ClawFi({
  apiKey: process.env.CLAWFI_API_KEY,
  baseUrl: process.env.CLAWFI_BASE_URL,
  timeout: parseInt(process.env.CLAWFI_TIMEOUT || '30000'),
  debug: process.env.CLAWFI_DEBUG === 'true',
});
```

## Cache Configuration

### In-Memory Cache (Default)

```typescript
const clawfi = new ClawFi({
  cache: true,
  cacheTtl: 60000, // 1 minute
});
```

### Redis Cache

```typescript
import Redis from 'ioredis';
import { ClawFi, createRedisCacheAdapter } from '@clawfi/sdk';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const clawfi = new ClawFi({
  cacheAdapter: createRedisCacheAdapter({
    client: redis,
    prefix: 'clawfi:',
    defaultTtl: 60000,
  }),
});
```

### Disable Caching

```typescript
const clawfi = new ClawFi({
  cache: false,
});
```

## Logging Configuration

### Enable Debug Mode

```typescript
const clawfi = new ClawFi({
  debug: true,
});

// Or subscribe to events
clawfi.on((event) => {
  console.log(`[${event.type}]`, event.data);
});
```

### Event Types

| Event | Description |
|-------|-------------|
| `request:start` | Request initiated |
| `request:success` | Request completed successfully |
| `request:error` | Request failed |
| `request:retry` | Request being retried |
| `cache:hit` | Response served from cache |
| `cache:miss` | Cache miss, fetching from API |
| `ratelimit:exceeded` | Rate limit reached |

## Chain Configuration

### Default Chains

ClawFi supports these chains by default:

```typescript
const SUPPORTED_CHAINS = [
  'ethereum',
  'bsc',
  'polygon',
  'arbitrum',
  'optimism',
  'base',
  'avalanche',
  'fantom',
  'solana',
  'sui',
];
```

### Chain-Specific Settings

```typescript
// Analyze on specific chain
const analysis = await clawfi.analyzeToken('base', '0x...');

// Search with chain filter
const results = await clawfi.search('PEPE', { chain: 'ethereum' });
```

## Next Steps

- [Token Analysis](../sdk/token-analysis.md) - Learn about analysis features
- [Signal Detection](../sdk/signals.md) - Configure signal alerts
- [Error Handling](../sdk/errors.md) - Handle errors gracefully
