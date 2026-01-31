# ClawFi API Reference

## Base URL

```
http://localhost:3001
```

## Authentication

All endpoints (except `/health` and `/auth/*`) require a JWT token:

```
Authorization: Bearer <token>
```

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... }
}
```

Or for errors:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

---

## Authentication

### POST /auth/register

Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "minimum8chars",
  "name": "Optional Name"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt.token.here",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Optional Name"
    }
  }
}
```

### POST /auth/login

Login and get JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:** Same as register.

### GET /me

Get current user info.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Name",
    "createdAt": 1704067200000
  }
}
```

---

## Health & Status

### GET /health

Check API health (no auth required).

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": 1704067200000
  }
}
```

### GET /status

Get system status.

**Response:**
```json
{
  "success": true,
  "data": {
    "killSwitchActive": false,
    "activeConnectors": 1,
    "activeStrategies": 1,
    "signalsToday": 5
  }
}
```

---

## Connectors

### GET /connectors

List all connectors.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "cex",
      "venue": "binance",
      "label": "My Binance",
      "enabled": true,
      "status": "connected",
      "lastCheck": 1704067200000,
      "createdAt": 1704067200000
    }
  ]
}
```

### POST /connectors/binance

Add Binance connector.

**Request:**
```json
{
  "label": "My Binance Account",
  "apiKey": "your-api-key",
  "apiSecret": "your-api-secret",
  "testnet": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "cex",
    "venue": "binance",
    "label": "My Binance Account",
    "enabled": true,
    "status": "disconnected",
    "createdAt": 1704067200000
  }
}
```

### DELETE /connectors/:id

Remove a connector.

**Response:**
```json
{
  "success": true
}
```

### GET /connectors/:id/balances

Get balances for a connector.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "asset": "BTC",
      "free": "0.5",
      "locked": "0.1",
      "total": "0.6"
    }
  ]
}
```

### POST /connectors/:id/test

Test connector connectivity.

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "latencyMs": 150
  }
}
```

---

## Strategies

### GET /strategies

List all strategies.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "strategyType": "moltwatch",
      "name": "MoltWatch",
      "description": "Detects wallet rotations",
      "status": "enabled",
      "config": { ... },
      "createdAt": 1704067200000,
      "updatedAt": 1704067200000
    }
  ]
}
```

### GET /strategies/:id

Get a specific strategy.

### PATCH /strategies/:id

Update a strategy.

**Request:**
```json
{
  "status": "enabled",
  "name": "New Name",
  "config": {
    "moltThresholdPercent": 25
  }
}
```

---

## Signals

### GET /signals

Get paginated signals.

**Query Parameters:**
- `severity`: Filter by severity (low, medium, high, critical)
- `strategyId`: Filter by strategy
- `chain`: Filter by chain
- `token`: Filter by token address
- `wallet`: Filter by wallet address
- `acknowledged`: Filter by acknowledged status (true/false)
- `startTs`: Filter by start timestamp
- `endTs`: Filter by end timestamp
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "ts": 1704067200000,
      "severity": "high",
      "title": "Wallet Molt Detected",
      "summary": "Description...",
      "token": "0x...",
      "chain": "ethereum",
      "wallet": "0x...",
      "strategyId": "uuid",
      "evidence": [...],
      "recommendedAction": "monitor",
      "acknowledged": false
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

### GET /signals/token

Get signals for a specific token.

**Query Parameters:**
- `token`: Token address (required)
- `chain`: Chain name (optional)

### POST /signals/:id/acknowledge

Acknowledge a signal.

**Response:** Returns updated signal.

---

## Risk Policy

### GET /risk/policy

Get current risk policy.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "maxOrderUsd": 100,
    "maxPositionUsd": 1000,
    "maxDailyLossUsd": 500,
    "maxSlippageBps": 100,
    "cooldownSeconds": 60,
    "tokenAllowlist": [],
    "tokenDenylist": [],
    "venueAllowlist": [],
    "chainAllowlist": [],
    "killSwitchActive": false,
    "dryRunMode": true,
    "createdAt": 1704067200000,
    "updatedAt": 1704067200000
  }
}
```

### POST /risk/policy

Update risk policy.

**Request:**
```json
{
  "maxOrderUsd": 200,
  "maxSlippageBps": 150,
  "dryRunMode": false
}
```

### POST /risk/killswitch

Toggle kill switch.

**Request:**
```json
{
  "active": true,
  "reason": "Emergency stop"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "active": true
  }
}
```

---

## Audit Logs

### GET /audit

Get paginated audit logs.

**Query Parameters:**
- `action`: Filter by action type
- `userId`: Filter by user
- `resource`: Filter by resource type
- `success`: Filter by success (true/false)
- `startTs`: Filter by start timestamp
- `endTs`: Filter by end timestamp
- `page`: Page number
- `limit`: Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "ts": 1704067200000,
      "action": "user_login",
      "userId": "uuid",
      "resource": "auth",
      "success": true,
      "details": { ... }
    }
  ],
  "pagination": { ... }
}
```

---

## WebSocket

### GET /ws

Connect to WebSocket for real-time updates.

**Connection:**
```
ws://localhost:3001/ws?token=<jwt-token>
```

**Message Types:**

**Signal:**
```json
{
  "type": "signal",
  "data": { ... }
}
```

**System Status:**
```json
{
  "type": "system_status",
  "data": {
    "killSwitchActive": false,
    "activeConnectors": 1,
    "activeStrategies": 1
  }
}
```

**Ping/Pong:**
```json
{ "type": "ping" }
{ "type": "pong" }
```

---

## Dev Endpoints

Available only when `DEV_MODE=true`.

### POST /dev/simulate-event

Simulate an event to test signal generation.

**Request:**
```json
{
  "type": "molt",
  "wallet": "0x...",
  "token": "0x...",
  "chain": "ethereum",
  "severity": "high"
}
```

### POST /dev/reset-policy

Reset risk policy to defaults.


