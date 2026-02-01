# Error Handling

Properly handling errors in the ClawFi SDK.

## Error Types

### ClawFiError (Base)

All SDK errors extend from `ClawFiError`:

```typescript
class ClawFiError extends Error {
  code: string;
  timestamp: number;
}
```

### HttpError

HTTP request failures:

```typescript
class HttpError extends ClawFiError {
  status: number;
  statusText: string;
  url: string;
  responseBody?: string;
}
```

### RateLimitError

Rate limit exceeded:

```typescript
class RateLimitError extends ClawFiError {
  retryAfter?: number; // Seconds to wait
}
```

### NetworkError

Connection failures:

```typescript
class NetworkError extends ClawFiError {
  cause?: Error;
}
```

### ValidationError

Response validation failures:

```typescript
class ValidationError extends ClawFiError {
  issues: string[];
}
```

### NotFoundError

Resource not found:

```typescript
class NotFoundError extends ClawFiError {
  resource: string;
}
```

### TimeoutError

Request timeout:

```typescript
class TimeoutError extends ClawFiError {
  timeoutMs: number;
}
```

### CacheError

Cache operation failures:

```typescript
class CacheError extends ClawFiError {
  operation: 'get' | 'set' | 'delete' | 'clear';
}
```

## Basic Error Handling

```typescript
import { ClawFi, ClawFiError } from '@clawfi/sdk';

const clawfi = new ClawFi();

try {
  const analysis = await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  if (error instanceof ClawFiError) {
    console.error(`ClawFi Error [${error.code}]: ${error.message}`);
  } else {
    throw error; // Re-throw unknown errors
  }
}
```

## Specific Error Handling

```typescript
import { 
  ClawFi,
  ClawFiError,
  HttpError,
  RateLimitError,
  NetworkError,
  ValidationError,
  NotFoundError,
  TimeoutError 
} from '@clawfi/sdk';

const clawfi = new ClawFi();

try {
  const analysis = await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  if (error instanceof RateLimitError) {
    // Handle rate limiting
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
    
    // Wait and retry
    if (error.retryAfter) {
      await sleep(error.retryAfter * 1000);
      return clawfi.analyzeToken('ethereum', '0x...');
    }
    
  } else if (error instanceof NotFoundError) {
    // Token not found
    console.log('Token not found:', error.resource);
    
  } else if (error instanceof NetworkError) {
    // Network issue
    console.log('Network error:', error.message);
    console.log('Cause:', error.cause);
    
  } else if (error instanceof TimeoutError) {
    // Request timed out
    console.log(`Request timed out after ${error.timeoutMs}ms`);
    
  } else if (error instanceof ValidationError) {
    // Invalid response data
    console.log('Validation failed:', error.issues.join(', '));
    
  } else if (error instanceof HttpError) {
    // HTTP error
    console.log(`HTTP ${error.status}: ${error.statusText}`);
    console.log('URL:', error.url);
    
  } else if (error instanceof ClawFiError) {
    // Other ClawFi error
    console.log(`Error [${error.code}]: ${error.message}`);
    
  } else {
    // Unknown error
    throw error;
  }
}
```

## Type Guards

```typescript
import { isDexscreenerError, isRetryableError } from '@clawfi/sdk';

try {
  const analysis = await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  // Check if it's a ClawFi error
  if (isDexscreenerError(error)) {
    console.log('ClawFi error:', error.code);
  }
  
  // Check if it should be retried
  if (isRetryableError(error)) {
    console.log('Will retry...');
    // Implement retry logic
  }
}
```

## Retry Pattern

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Don't wait after last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Handle rate limits specially
      if (error instanceof RateLimitError && error.retryAfter) {
        await sleep(error.retryAfter * 1000);
      } else {
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
      
      console.log(`Retrying (attempt ${attempt + 1}/${maxRetries})...`);
    }
  }
  
  throw lastError;
}

// Usage
const analysis = await withRetry(() => 
  clawfi.analyzeToken('ethereum', '0x...')
);
```

## Error Logging

```typescript
function logError(error: unknown, context?: object) {
  const timestamp = new Date().toISOString();
  
  if (error instanceof ClawFiError) {
    console.error({
      timestamp,
      type: 'ClawFiError',
      code: error.code,
      message: error.message,
      ...context,
      // Add type-specific info
      ...(error instanceof HttpError && {
        status: error.status,
        url: error.url,
      }),
      ...(error instanceof RateLimitError && {
        retryAfter: error.retryAfter,
      }),
      ...(error instanceof ValidationError && {
        issues: error.issues,
      }),
    });
  } else if (error instanceof Error) {
    console.error({
      timestamp,
      type: 'Error',
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context,
    });
  } else {
    console.error({
      timestamp,
      type: 'Unknown',
      error,
      ...context,
    });
  }
}

// Usage
try {
  await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  logError(error, { 
    chain: 'ethereum', 
    address: '0x...',
    operation: 'analyzeToken' 
  });
}
```

## Graceful Degradation

```typescript
async function safeAnalyze(chain: ChainId, address: string) {
  try {
    return await clawfi.analyzeToken(chain, address);
  } catch (error) {
    if (error instanceof NotFoundError) {
      // Return minimal data for unknown tokens
      return {
        token: { address, name: 'Unknown', symbol: '???' },
        riskScore: -1,
        riskLevel: 'unknown',
        signals: [],
      };
    }
    
    if (error instanceof RateLimitError) {
      // Return cached data if available
      console.log('Rate limited, returning stale data if available');
      // ... attempt to get cached data
    }
    
    throw error;
  }
}
```

## Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure: number = 0;
  private isOpen = false;
  
  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 60000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.isOpen) {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        // Try to reset
        this.isOpen = false;
        this.failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.failures = 0; // Reset on success
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      
      if (this.failures >= this.threshold) {
        this.isOpen = true;
        console.log('Circuit breaker opened');
      }
      
      throw error;
    }
  }
}

// Usage
const circuitBreaker = new CircuitBreaker();

async function analyzeWithProtection(chain: ChainId, address: string) {
  return circuitBreaker.execute(() =>
    clawfi.analyzeToken(chain, address)
  );
}
```

## Best Practices

### 1. Always Handle Rate Limits

```typescript
// Bad
const analysis = await clawfi.analyzeToken('ethereum', '0x...');

// Good
try {
  const analysis = await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  if (error instanceof RateLimitError) {
    // Handle appropriately
  }
  throw error;
}
```

### 2. Log Errors with Context

```typescript
// Bad
catch (error) {
  console.error(error);
}

// Good
catch (error) {
  logError(error, { 
    operation: 'analyzeToken',
    chain,
    address,
    userId: currentUser.id 
  });
}
```

### 3. Don't Swallow Errors

```typescript
// Bad
catch (error) {
  return null; // Silently fails
}

// Good
catch (error) {
  if (error instanceof NotFoundError) {
    return null; // Expected case
  }
  throw error; // Re-throw unexpected errors
}
```

### 4. Use Type-Safe Handlers

```typescript
// Bad
catch (error: any) {
  console.log(error.retryAfter);
}

// Good
catch (error) {
  if (error instanceof RateLimitError) {
    console.log(error.retryAfter);
  }
}
```

## Next Steps

- [Configuration](configuration.md) - Configure error handling
- [Token Analysis](token-analysis.md) - Main SDK features
- [Quick Start](quickstart.md) - Getting started
