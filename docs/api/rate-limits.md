# Rate Limits

Understanding ClawFi API rate limits.

## Rate Limit Tiers

| Tier | Requests/Minute | Requests/Day | Cost |
|------|-----------------|--------------|------|
| Public | 10 | 1,000 | Free |
| Free | 100 | 10,000 | Free |
| Pro | 1,000 | 100,000 | $29/mo |
| Enterprise | Unlimited | Unlimited | Contact |

## Rate Limit Headers

All API responses include rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706745660
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests per minute |
| `X-RateLimit-Remaining` | Remaining requests |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

## Rate Limit Response

When rate limited, you'll receive:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please wait before making more requests.",
    "retryAfter": 30
  }
}
```

## Handling Rate Limits

### Check Before Requesting

```typescript
const clawfi = new ClawFi();

const state = clawfi.getRateLimitState();
if (state.remaining < 5) {
  console.log('Low on requests, waiting...');
  await sleep((state.resetAt - Date.now()) + 1000);
}

const analysis = await clawfi.analyzeToken('ethereum', '0x...');
```

### Handle 429 Responses

```typescript
try {
  const analysis = await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry in ${error.retryAfter}s`);
    await sleep(error.retryAfter * 1000);
    // Retry
    return clawfi.analyzeToken('ethereum', '0x...');
  }
  throw error;
}
```

### Automatic Retry

The SDK automatically handles retries with exponential backoff:

```typescript
const clawfi = new ClawFi({
  retries: 3,      // Will retry up to 3 times
  retryDelay: 1000 // Starting delay
});
```

## Endpoint-Specific Limits

Some endpoints have additional limits:

| Endpoint | Special Limit |
|----------|---------------|
| `/search` | 30/min (public) |
| `/analyze` | 60/min (public) |
| `/honeypot` | 120/min (public) |

## Batch Requests

For multiple tokens, use batch strategies:

### Parallel with Limit

```typescript
import pLimit from 'p-limit';

const limit = pLimit(10); // Max 10 concurrent

const addresses = ['0x...', '0x...', /* many */];

const results = await Promise.all(
  addresses.map(addr =>
    limit(() => clawfi.analyzeToken('ethereum', addr))
  )
);
```

### Sequential with Delay

```typescript
const results = [];

for (const address of addresses) {
  const analysis = await clawfi.analyzeToken('ethereum', address);
  results.push(analysis);
  
  // Wait between requests
  await sleep(100);
}
```

## Caching to Reduce Requests

Enable caching to reduce API calls:

```typescript
const clawfi = new ClawFi({
  cache: true,
  cacheTtl: 60000, // 1 minute
});

// First call: API request
const analysis1 = await clawfi.analyzeToken('ethereum', '0x...');

// Second call: From cache (no API request)
const analysis2 = await clawfi.analyzeToken('ethereum', '0x...');
```

## Monitoring Usage

### Dashboard

View your usage in the ClawFi dashboard:
- Total requests today
- Requests by endpoint
- Rate limit violations
- Usage trends

### Via API

```bash
curl -X GET \
  "https://api.clawfi.ai/api/v1/usage" \
  -H "Authorization: Bearer clf_xxx"
```

```json
{
  "usage": {
    "today": 1250,
    "limit": 10000,
    "remaining": 8750,
    "byEndpoint": {
      "analyze": 500,
      "market": 400,
      "search": 350
    }
  }
}
```

## Best Practices

### 1. Implement Backoff

```typescript
async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof RateLimitError) {
        const delay = error.retryAfter 
          ? error.retryAfter * 1000 
          : Math.pow(2, i) * 1000;
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 2. Use Caching

```typescript
// Cache longer for less frequently changing data
const clawfi = new ClawFi({
  cache: true,
  cacheTtl: 300000, // 5 minutes
});
```

### 3. Batch Smartly

```typescript
// Instead of checking each token individually
for (const addr of addresses) {
  await clawfi.checkHoneypot('ethereum', addr);
}

// Batch with controlled concurrency
await Promise.all(
  addresses.map(addr =>
    limit(() => clawfi.checkHoneypot('ethereum', addr))
  )
);
```

### 4. Monitor Your Usage

```typescript
const clawfi = new ClawFi();

clawfi.on((event) => {
  if (event.type === 'ratelimit:exceeded') {
    console.warn('Rate limit exceeded!');
    // Alert, log, etc.
  }
});
```

## Upgrading Your Limit

Need higher limits?

1. **Free → Pro**: Upgrade in dashboard
2. **Pro → Enterprise**: Contact sales@clawfi.io

## Next Steps

- [Response Formats](responses.md) - Understanding responses
- [Error Codes](errors.md) - Error handling
- [Authentication](authentication.md) - API keys
