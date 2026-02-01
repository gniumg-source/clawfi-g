# Webhook Integration

Receive real-time alerts via webhooks.

## Overview

ClawFi webhooks notify your server when:
- Signals are detected
- Risk levels change
- Price targets are hit
- Custom conditions are met

## Setting Up Webhooks

### 1. Create Webhook Endpoint

Your server needs an endpoint to receive webhook events:

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Verify webhook signature
function verifySignature(payload: string, signature: string, secret: string) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

app.post('/webhooks/clawfi', (req, res) => {
  const signature = req.headers['x-clawfi-signature'] as string;
  const payload = JSON.stringify(req.body);
  
  // Verify signature
  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  handleWebhook(req.body);
  
  // Respond quickly
  res.status(200).json({ received: true });
});

function handleWebhook(event: WebhookEvent) {
  console.log('Webhook received:', event.type);
  
  switch (event.type) {
    case 'signal.detected':
      handleSignal(event.data);
      break;
    case 'risk.changed':
      handleRiskChange(event.data);
      break;
    case 'price.target':
      handlePriceTarget(event.data);
      break;
  }
}
```

### 2. Register Webhook (API)

```bash
curl -X POST https://api.clawfi.ai/api/v1/webhooks \
  -H "Authorization: Bearer clf_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourserver.com/webhooks/clawfi",
    "events": ["signal.detected", "risk.changed"],
    "secret": "your-webhook-secret"
  }'
```

### 3. Register Webhook (SDK)

```typescript
import { ClawFi } from '@clawfi/sdk';

const clawfi = new ClawFi({ apiKey: 'clf_xxx' });

const webhook = await clawfi.webhooks.create({
  url: 'https://yourserver.com/webhooks/clawfi',
  events: ['signal.detected', 'risk.changed', 'price.target'],
  secret: 'your-webhook-secret',
});

console.log('Webhook ID:', webhook.id);
```

## Webhook Events

### signal.detected

Fired when a new signal is detected.

```json
{
  "type": "signal.detected",
  "timestamp": 1706745600000,
  "data": {
    "chain": "ethereum",
    "tokenAddress": "0x...",
    "signal": {
      "type": "whale_sell",
      "severity": "warning",
      "message": "Large sale detected: $85,000",
      "details": {
        "value": 85000,
        "address": "0x...",
        "txHash": "0x..."
      }
    }
  }
}
```

### risk.changed

Fired when risk level changes significantly.

```json
{
  "type": "risk.changed",
  "timestamp": 1706745600000,
  "data": {
    "chain": "ethereum",
    "tokenAddress": "0x...",
    "previousRiskScore": 35,
    "currentRiskScore": 72,
    "previousRiskLevel": "medium",
    "currentRiskLevel": "high",
    "factors": [
      "liquidity_decreased",
      "whale_concentration_increased"
    ]
  }
}
```

### price.target

Fired when price target is hit.

```json
{
  "type": "price.target",
  "timestamp": 1706745600000,
  "data": {
    "chain": "ethereum",
    "tokenAddress": "0x...",
    "targetType": "above",
    "targetPrice": 0.001,
    "currentPrice": 0.00105,
    "alertId": "alert_xxx"
  }
}
```

## Webhook Configuration

### Event Filtering

Only receive specific events:

```typescript
await clawfi.webhooks.create({
  url: 'https://...',
  events: ['signal.detected'],
  filters: {
    chains: ['ethereum', 'base'],
    signalTypes: ['whale_sell', 'liquidity_remove'],
    minSeverity: 'warning',
  },
});
```

### Token Filtering

Only for specific tokens:

```typescript
await clawfi.webhooks.create({
  url: 'https://...',
  events: ['signal.detected', 'risk.changed'],
  tokens: [
    { chain: 'ethereum', address: '0x...' },
    { chain: 'base', address: '0x...' },
  ],
});
```

## Managing Webhooks

### List Webhooks

```typescript
const webhooks = await clawfi.webhooks.list();

for (const webhook of webhooks) {
  console.log(`${webhook.id}: ${webhook.url}`);
  console.log(`  Events: ${webhook.events.join(', ')}`);
  console.log(`  Status: ${webhook.status}`);
}
```

### Update Webhook

```typescript
await clawfi.webhooks.update('webhook_id', {
  events: ['signal.detected', 'risk.changed', 'price.target'],
  filters: {
    minSeverity: 'critical',
  },
});
```

### Delete Webhook

```typescript
await clawfi.webhooks.delete('webhook_id');
```

### Test Webhook

```typescript
await clawfi.webhooks.test('webhook_id');
```

## Handling Failures

### Retry Logic

ClawFi automatically retries failed deliveries:
- Retry 1: 1 minute
- Retry 2: 5 minutes
- Retry 3: 30 minutes
- Retry 4: 2 hours
- Retry 5: 24 hours

### Webhook Status

```typescript
const webhook = await clawfi.webhooks.get('webhook_id');

console.log('Status:', webhook.status);
console.log('Last delivery:', webhook.lastDelivery);
console.log('Failure count:', webhook.failureCount);
```

### Failure Notifications

Get notified of webhook failures:

```typescript
await clawfi.webhooks.update('webhook_id', {
  failureNotification: {
    email: 'alerts@example.com',
    threshold: 3, // After 3 failures
  },
});
```

## Integration Examples

### Discord Bot

```typescript
import { WebhookClient } from 'discord.js';

const discord = new WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL });

function handleSignal(data: SignalData) {
  const color = {
    positive: 0x00ff00,
    info: 0x0099ff,
    warning: 0xffff00,
    critical: 0xff0000,
  }[data.signal.severity];
  
  discord.send({
    embeds: [{
      title: `${data.signal.severity.toUpperCase()}: ${data.signal.type}`,
      description: data.signal.message,
      color,
      fields: [
        { name: 'Chain', value: data.chain, inline: true },
        { name: 'Token', value: data.tokenAddress.slice(0, 10) + '...', inline: true },
      ],
      timestamp: new Date(data.timestamp).toISOString(),
    }],
  });
}
```

### Telegram Bot

```typescript
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const chatId = process.env.TELEGRAM_CHAT_ID;

function handleSignal(data: SignalData) {
  const emoji = {
    positive: '🟢',
    info: '🔵',
    warning: '🟡',
    critical: '🔴',
  }[data.signal.severity];
  
  const message = `
${emoji} *${data.signal.type.toUpperCase()}*

${data.signal.message}

Chain: ${data.chain}
Token: \`${data.tokenAddress}\`
  `;
  
  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}
```

### Slack Integration

```typescript
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_TOKEN);

async function handleSignal(data: SignalData) {
  await slack.chat.postMessage({
    channel: '#crypto-alerts',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${data.signal.severity}: ${data.signal.type}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: data.signal.message,
        },
      },
    ],
  });
}
```

## Security Best Practices

1. **Always verify signatures** - Validate webhook authenticity
2. **Use HTTPS** - Never use HTTP endpoints
3. **Respond quickly** - Process async, respond in <5s
4. **Implement idempotency** - Handle duplicate deliveries
5. **Store secrets securely** - Use environment variables
