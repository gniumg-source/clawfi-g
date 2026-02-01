# Error Codes

Complete reference of ClawFi API error codes.

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { }
  }
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |
| 503 | Service Unavailable |

## Error Codes Reference

### Authentication Errors

#### UNAUTHORIZED

```json
{
  "code": "UNAUTHORIZED",
  "message": "API key required for this endpoint"
}
```
**Cause**: No API key provided for protected endpoint.
**Fix**: Add `Authorization: Bearer clf_xxx` header.

#### INVALID_API_KEY

```json
{
  "code": "INVALID_API_KEY",
  "message": "The provided API key is invalid"
}
```
**Cause**: API key format incorrect or not found.
**Fix**: Check API key is correct and active.

#### API_KEY_EXPIRED

```json
{
  "code": "API_KEY_EXPIRED",
  "message": "Your API key has expired"
}
```
**Cause**: API key past expiration date.
**Fix**: Generate new API key in dashboard.

#### INSUFFICIENT_PERMISSIONS

```json
{
  "code": "INSUFFICIENT_PERMISSIONS",
  "message": "API key does not have required permissions"
}
```
**Cause**: Key lacks permission for endpoint.
**Fix**: Create key with appropriate permissions.

### Validation Errors

#### INVALID_CHAIN

```json
{
  "code": "INVALID_CHAIN",
  "message": "Chain 'xyz' is not supported",
  "details": {
    "supported": ["ethereum", "bsc", "base", ...]
  }
}
```
**Cause**: Unsupported chain ID provided.
**Fix**: Use supported chain from list.

#### INVALID_ADDRESS

```json
{
  "code": "INVALID_ADDRESS",
  "message": "Invalid token address format",
  "details": {
    "address": "0xinvalid"
  }
}
```
**Cause**: Address doesn't match expected format.
**Fix**: Verify address is valid for the chain.

#### INVALID_QUERY

```json
{
  "code": "INVALID_QUERY",
  "message": "Search query must be at least 2 characters"
}
```
**Cause**: Query parameter validation failed.
**Fix**: Check query meets requirements.

#### VALIDATION_ERROR

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": {
    "issues": [
      "limit must be between 1 and 100",
      "offset must be non-negative"
    ]
  }
}
```
**Cause**: One or more parameters invalid.
**Fix**: Review and correct parameters.

### Resource Errors

#### NOT_FOUND

```json
{
  "code": "NOT_FOUND",
  "message": "Token not found",
  "details": {
    "chain": "ethereum",
    "address": "0x..."
  }
}
```
**Cause**: Token not in database or no trading data.
**Fix**: Verify token exists and has liquidity.

#### NO_DATA_AVAILABLE

```json
{
  "code": "NO_DATA_AVAILABLE",
  "message": "No market data available for this token"
}
```
**Cause**: Token exists but has no trading data.
**Fix**: Wait for token to have trades.

### Rate Limit Errors

#### RATE_LIMIT_EXCEEDED

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded",
  "details": {
    "limit": 100,
    "remaining": 0,
    "resetAt": 1706745660000,
    "retryAfter": 30
  }
}
```
**Cause**: Too many requests in time window.
**Fix**: Wait `retryAfter` seconds, implement backoff.

#### QUOTA_EXCEEDED

```json
{
  "code": "QUOTA_EXCEEDED",
  "message": "Daily quota exceeded",
  "details": {
    "quota": 10000,
    "used": 10000,
    "resetAt": 1706832000000
  }
}
```
**Cause**: Daily request limit reached.
**Fix**: Wait for reset or upgrade plan.

### Server Errors

#### INTERNAL_ERROR

```json
{
  "code": "INTERNAL_ERROR",
  "message": "An internal error occurred",
  "details": {
    "requestId": "req_abc123"
  }
}
```
**Cause**: Server-side error.
**Fix**: Retry request, report if persists.

#### SERVICE_UNAVAILABLE

```json
{
  "code": "SERVICE_UNAVAILABLE",
  "message": "Service temporarily unavailable",
  "details": {
    "retryAfter": 60
  }
}
```
**Cause**: Service maintenance or overload.
**Fix**: Wait and retry.

#### UPSTREAM_ERROR

```json
{
  "code": "UPSTREAM_ERROR",
  "message": "Error fetching data from upstream provider"
}
```
**Cause**: External data source error.
**Fix**: Retry request.

### Network Errors

#### TIMEOUT

```json
{
  "code": "TIMEOUT",
  "message": "Request timed out after 30000ms"
}
```
**Cause**: Request took too long.
**Fix**: Retry with longer timeout.

#### NETWORK_ERROR

```json
{
  "code": "NETWORK_ERROR",
  "message": "Network connection failed"
}
```
**Cause**: Connection issue.
**Fix**: Check network, retry.

## Error Handling Examples

### JavaScript/TypeScript

```typescript
try {
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!data.success) {
    switch (data.error.code) {
      case 'RATE_LIMIT_EXCEEDED':
        await sleep(data.error.details.retryAfter * 1000);
        return retry();
        
      case 'NOT_FOUND':
        return null;
        
      case 'INVALID_ADDRESS':
        throw new Error('Invalid token address');
        
      default:
        throw new Error(data.error.message);
    }
  }
  
  return data.data;
} catch (error) {
  // Network or parsing error
  console.error('Request failed:', error);
  throw error;
}
```

### With SDK

```typescript
import { 
  ClawFi,
  RateLimitError,
  NotFoundError,
  ValidationError 
} from '@clawfi/sdk';

try {
  const analysis = await clawfi.analyzeToken('ethereum', '0x...');
} catch (error) {
  if (error instanceof RateLimitError) {
    // Handle rate limiting
  } else if (error instanceof NotFoundError) {
    // Handle not found
  } else if (error instanceof ValidationError) {
    // Handle validation error
  }
}
```

## Retry Strategy

```typescript
const RETRYABLE_CODES = [
  'RATE_LIMIT_EXCEEDED',
  'SERVICE_UNAVAILABLE',
  'UPSTREAM_ERROR',
  'TIMEOUT',
  'NETWORK_ERROR',
  'INTERNAL_ERROR',
];

function shouldRetry(errorCode: string): boolean {
  return RETRYABLE_CODES.includes(errorCode);
}
```

## Next Steps

- [Rate Limits](rate-limits.md) - Rate limiting details
- [Authentication](authentication.md) - API authentication
- [Endpoints](endpoints.md) - API reference
