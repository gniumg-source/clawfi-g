# SDK Configuration

Detailed configuration options for the ClawFi SDK.

## Configuration Object

```typescript
interface ClawFiConfig {
  // Authentication
  apiKey?: string;
  
  // Network settings
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
  
  // Caching
  cache?: boolean;
  cacheTtl?: number;
  cacheAdapter?: CacheAdapter;
  
  // Rate limiting
  rateLimit?: number;
  
  // Validation
  validateResponses?: boolean;
  
  // Debugging
  debug?: boolean;
  
  // Custom implementations
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}
```

## Authentication

### API Key

```typescript
// From environment variable
const clawfi = new ClawFi({
  apiKey: process.env.CLAWFI_API_KEY,
});

// Direct configuration
const clawfi = new ClawFi({
  apiKey: 'clf_xxxxxxxxxxxxx',
});
```

### Public vs Authenticated

| Feature | Public | Authenticated |
|---------|--------|---------------|
| Token Analysis | ✅ | ✅ |
| Market Data | ✅ | ✅ |
| Honeypot Check | ✅ | ✅ |
| Search | ✅ | ✅ |
| Rate Limit | 10/min | 100/min |
| Priority Queue | ❌ | ✅ |
| Webhooks | ❌ | ✅ |

## Network Settings

### Base URL

```typescript
// Default (production)
const clawfi = new ClawFi();  // https://api.clawfi.ai

// Custom endpoint
const clawfi = new ClawFi({
  baseUrl: 'https://custom.api.example.com',
});

// Local development
const clawfi = new ClawFi({
  baseUrl: 'http://localhost:3000',
});
```

### Timeout

```typescript
const clawfi = new ClawFi({
  timeout: 30000, // 30 seconds (default)
});

// Short timeout for fast operations
const clawfi = new ClawFi({
  timeout: 5000, // 5 seconds
});
```

### Retry Configuration

```typescript
const clawfi = new ClawFi({
  retries: 3,          // Number of retry attempts
  retryDelay: 1000,    // Base delay (1 second)
  maxRetryDelay: 30000 // Maximum delay (30 seconds)
});
```

Retry behavior uses exponential backoff:
- Attempt 1: Wait 1s
- Attempt 2: Wait 2s
- Attempt 3: Wait 4s
- (capped at maxRetryDelay)

### Custom Fetch

```typescript
// Node.js with node-fetch
import fetch from 'node-fetch';

const clawfi = new ClawFi({
  fetch: fetch as any,
});

// With custom options
const customFetch = (url: string, options: RequestInit) => {
  return fetch(url, {
    ...options,
    agent: myProxyAgent,
  });
};

const clawfi = new ClawFi({
  fetch: customFetch,
});
```

### Custom Headers

```typescript
const clawfi = new ClawFi({
  headers: {
    'X-Custom-Header': 'value',
    'User-Agent': 'MyApp/1.0',
  },
});
```

## Caching

### Enable/Disable

```typescript
// Enabled (default)
const clawfi = new ClawFi({
  cache: true,
  cacheTtl: 60000, // 1 minute
});

// Disabled
const clawfi = new ClawFi({
  cache: false,
});
```

### Cache TTL by Request

```typescript
// Global TTL
const clawfi = new ClawFi({
  cacheTtl: 60000,
});

// Per-request TTL
const analysis = await clawfi.analyzeToken('ethereum', '0x...', {
  cacheTtl: 30000, // 30 seconds for this request
});
```

### Skip Cache

```typescript
// Skip cache for specific request
const analysis = await clawfi.analyzeToken('ethereum', '0x...', {
  skipCache: true,
});
```

### Custom Cache Adapter

```typescript
import { CacheAdapter } from '@clawfi/sdk';

class CustomCache implements CacheAdapter {
  async get<T>(key: string): Promise<T | undefined> {
    // Your implementation
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Your implementation
  }
  
  async delete(key: string): Promise<boolean> {
    // Your implementation
  }
  
  async clear(): Promise<void> {
    // Your implementation
  }
  
  async has(key: string): Promise<boolean> {
    // Your implementation
  }
  
  async stats(): Promise<CacheStats> {
    // Your implementation
  }
}

const clawfi = new ClawFi({
  cacheAdapter: new CustomCache(),
});
```

### Redis Cache

```typescript
import Redis from 'ioredis';
import { createRedisCacheAdapter } from '@clawfi/sdk';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'optional',
});

const clawfi = new ClawFi({
  cacheAdapter: createRedisCacheAdapter({
    client: redis,
    prefix: 'clawfi:',
    defaultTtl: 60000,
  }),
});
```

## Rate Limiting

### Configuration

```typescript
const clawfi = new ClawFi({
  rateLimit: 10, // Requests per second
});
```

### Handling Rate Limits

```typescript
import { RateLimitError } from '@clawfi/sdk';

try {
  const analysis = await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limited');
    console.log('Retry after:', error.retryAfter, 'seconds');
    
    // Wait and retry
    await sleep(error.retryAfter * 1000);
    const analysis = await clawfi.analyzeToken('ethereum', '0x...');
  }
}
```

### Check Rate Limit State

```typescript
const state = clawfi.getRateLimitState();

console.log('Remaining:', state.remaining);
console.log('Limit:', state.limit);
console.log('Reset at:', new Date(state.resetAt));
```

## Validation

### Response Validation

```typescript
// Enable strict validation (default)
const clawfi = new ClawFi({
  validateResponses: true,
});

// Disable validation (faster, less safe)
const clawfi = new ClawFi({
  validateResponses: false,
});
```

## Debugging

### Debug Mode

```typescript
const clawfi = new ClawFi({
  debug: true,
});
```

Debug mode logs:
- All API requests
- Cache hits/misses
- Rate limit events
- Retry attempts
- Response times

### Event Listening

```typescript
const clawfi = new ClawFi();

clawfi.on((event) => {
  const { type, timestamp, data } = event;
  
  console.log(`[${new Date(timestamp).toISOString()}] ${type}`);
  
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
});
```

### Event Types

| Event | Data | Description |
|-------|------|-------------|
| `request:start` | `{ endpoint, url }` | Request initiated |
| `request:success` | `{ endpoint, duration }` | Request completed |
| `request:error` | `{ endpoint, error }` | Request failed |
| `request:retry` | `{ endpoint, attempt, delay }` | Retrying request |
| `cache:hit` | `{ endpoint, key }` | Served from cache |
| `cache:miss` | `{ endpoint, key }` | Cache miss |
| `cache:set` | `{ endpoint, key, ttl }` | Cached response |
| `ratelimit:exceeded` | `{ retryAfter }` | Rate limited |

## Environment-Specific Config

### Node.js

```typescript
import { ClawFi } from '@clawfi/sdk';

const clawfi = new ClawFi({
  apiKey: process.env.CLAWFI_API_KEY,
  timeout: 30000,
  retries: 3,
});
```

### Browser

```typescript
import { ClawFi } from '@clawfi/sdk';

const clawfi = new ClawFi({
  timeout: 10000, // Shorter timeout for UX
  cache: true,
  cacheTtl: 30000, // Shorter TTL
});
```

### Serverless

```typescript
import { ClawFi } from '@clawfi/sdk';

// Disable in-memory cache (no persistence between invocations)
const clawfi = new ClawFi({
  cache: false,
  timeout: 10000, // Short timeout for cold starts
});
```

## Next Steps

- [Token Analysis](token-analysis.md) - Using analysis features
- [Market Data](market-data.md) - Fetching market data
- [Error Handling](errors.md) - Handling errors
