# Authentication

How to authenticate with the ClawFi API.

## API Keys

### Getting an API Key

1. Sign up at [clawfi.ai](https://clawfi.ai)
2. Navigate to Settings → API
3. Click "Generate API Key"
4. Copy and securely store your key

### Key Format

```
clf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

API keys start with `clf_` followed by 40 alphanumeric characters.

## Authentication Methods

### Header Authentication (Recommended)

```http
GET /api/v1/analyze/ethereum/0x...
Authorization: Bearer clf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Query Parameter

```http
GET /api/v1/analyze/ethereum/0x...?api_key=clf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Note**: Query parameter authentication is less secure and should only be used when headers aren't possible.

## SDK Authentication

```typescript
import { ClawFi } from '@clawfi/sdk';

const clawfi = new ClawFi({
  apiKey: 'clf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
});
```

### Environment Variables

```bash
# .env
CLAWFI_API_KEY=clf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```typescript
const clawfi = new ClawFi({
  apiKey: process.env.CLAWFI_API_KEY,
});
```

## Public vs Authenticated Access

### Public Access (No API Key)

| Feature | Limit |
|---------|-------|
| Token Analysis | 10/minute |
| Market Data | 10/minute |
| Search | 10/minute |
| Honeypot Check | 10/minute |

### Authenticated Access

| Plan | Rate Limit | Features |
|------|------------|----------|
| Free | 100/minute | All endpoints |
| Pro | 1000/minute | All + webhooks |
| Enterprise | Unlimited | All + priority |

## API Key Security

### Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** in production
3. **Rotate keys regularly** (monthly recommended)
4. **Use different keys** for dev/staging/prod
5. **Monitor usage** for anomalies

### If Your Key is Compromised

1. Immediately revoke the key in the dashboard
2. Generate a new key
3. Update all applications
4. Review API logs for unauthorized access

## Key Permissions

API keys can have different permission levels:

| Permission | Description |
|------------|-------------|
| `read` | Read-only access to all endpoints |
| `write` | Create webhooks, alerts |
| `admin` | Manage team settings |

### Creating Scoped Keys

```bash
# In dashboard, when creating a key:
Permissions: [x] Read  [ ] Write  [ ] Admin
```

## Testing Authentication

### cURL

```bash
curl -H "Authorization: Bearer clf_xxx" \
  https://api.clawfi.ai/api/v1/health
```

### JavaScript

```javascript
const response = await fetch('https://api.clawfi.ai/api/v1/health', {
  headers: {
    'Authorization': 'Bearer clf_xxx'
  }
});

const data = await response.json();
console.log(data);
// { status: 'ok', authenticated: true }
```

## Error Responses

### Missing API Key (for protected endpoints)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "API key required"
  }
}
```

### Invalid API Key

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid"
  }
}
```

### Expired API Key

```json
{
  "error": {
    "code": "API_KEY_EXPIRED",
    "message": "Your API key has expired"
  }
}
```

### Rate Limited

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "retryAfter": 60
  }
}
```

## Next Steps

- [Endpoints](endpoints.md) - API endpoint reference
- [Rate Limits](rate-limits.md) - Rate limit details
- [Error Codes](errors.md) - All error codes
