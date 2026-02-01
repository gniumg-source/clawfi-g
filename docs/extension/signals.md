# Signal Types

ClawFi detects various signals that may indicate opportunities or risks.

## Signal Categories

### 🐋 Whale Signals

Large wallet activity that may impact price.

#### Whale Buy
```
Type: whale_buy
Severity: info
Trigger: Purchase > $50k or > 1% supply
```

**What it means**: A large wallet is accumulating. Could indicate confidence or preparation for pump.

#### Whale Sell
```
Type: whale_sell
Severity: warning
Trigger: Sale > $50k or > 1% supply
```

**What it means**: A large holder is exiting. Watch for continued selling pressure.

#### Whale Movement
```
Type: whale_transfer
Severity: info
Trigger: Large transfer between wallets
```

**What it means**: Tokens moving to new wallet. Could be exchange deposit (selling) or cold storage.

### 💧 Liquidity Signals

Changes to trading liquidity.

#### Liquidity Added
```
Type: liquidity_add
Severity: positive
Trigger: LP tokens added > 10%
```

**What it means**: More trading liquidity available. Generally positive for stability.

#### Liquidity Removed
```
Type: liquidity_remove
Severity: critical
Trigger: LP tokens removed > 5%
```

**What it means**: Trading liquidity decreasing. High severity - potential rug pull indicator.

#### Liquidity Locked
```
Type: liquidity_lock
Severity: positive
Trigger: LP tokens sent to lock contract
```

**What it means**: Liquidity cannot be removed. Reduces rug pull risk.

### 📊 Volume Signals

Unusual trading activity.

#### Volume Spike
```
Type: volume_spike
Severity: warning
Trigger: Volume > 3x average
```

**What it means**: Unusual trading activity. Could be organic interest or manipulation.

#### Volume Drop
```
Type: volume_drop
Severity: info
Trigger: Volume < 50% of average
```

**What it means**: Decreasing interest. May indicate waning momentum.

### 🚨 Risk Signals

Security and safety alerts.

#### Honeypot Detected
```
Type: honeypot
Severity: critical
Trigger: Token cannot be sold
```

**What it means**: SCAM - Do not buy! Tokens cannot be sold once purchased.

#### Rug Pull Risk
```
Type: rugpull_risk
Severity: critical
Trigger: Multiple rug indicators present
```

**What it means**: High probability of rug pull. Avoid this token.

#### Contract Change
```
Type: contract_change
Severity: warning
Trigger: Contract owner action detected
```

**What it means**: Owner made changes to contract. Review what was changed.

### 📈 Price Signals

Significant price movements.

#### Price Pump
```
Type: price_pump
Severity: info
Trigger: Price increase > 50% in 1 hour
```

**What it means**: Rapid price increase. Could be organic or coordinated pump.

#### Price Dump
```
Type: price_dump
Severity: warning
Trigger: Price decrease > 30% in 1 hour
```

**What it means**: Rapid price decrease. Selling pressure present.

## Signal Severity Levels

| Level | Color | Action |
|-------|-------|--------|
| `positive` | 🟢 Green | Good news, opportunity |
| `info` | 🔵 Blue | Informational, monitor |
| `warning` | 🟡 Yellow | Caution advised |
| `critical` | 🔴 Red | High risk, avoid |

## Signal Display

### In Extension

```
┌─────────────────────────────────────┐
│  ACTIVE SIGNALS (3)                 │
├─────────────────────────────────────┤
│  🔴 CRITICAL                        │
│  Liquidity removed: 15% LP pulled   │
│  2 minutes ago                      │
├─────────────────────────────────────┤
│  🟡 WARNING                         │
│  Whale sell: $125k sold             │
│  15 minutes ago                     │
├─────────────────────────────────────┤
│  🔵 INFO                            │
│  Volume spike: 5x average           │
│  1 hour ago                         │
└─────────────────────────────────────┘
```

### Signal Data

```typescript
interface Signal {
  type: string;
  severity: 'positive' | 'info' | 'warning' | 'critical';
  message: string;
  details: {
    value?: number;
    address?: string;
    timestamp: number;
  };
  timestamp: number;
}
```

## Configuring Signals

### Enable/Disable by Type

In extension settings:
```
☑️ Whale Alerts
☑️ Liquidity Alerts
☑️ Volume Alerts
☐ Price Alerts (disabled)
```

### Severity Threshold

Only show signals above certain severity:
```
Minimum Severity: [warning ▼]
```

### Notification Settings

```
☑️ Badge count on FAB
☐ Sound alerts
☐ Desktop notifications
```

## Using Signals for Trading

### Positive Signals
- Liquidity locked ✅
- Whale accumulation (with caution)
- Increasing volume (organic)

### Warning Signs
- Large whale sells
- Decreasing liquidity
- Volume manipulation patterns
- Multiple warning signals

### Exit Signals
- Honeypot detected
- Rug pull indicators
- Massive liquidity removal
- Creator dump

## Signal Accuracy

Signal detection is based on on-chain data:
- **High accuracy**: Honeypot, liquidity changes
- **Medium accuracy**: Whale movements
- **Variable**: Price predictions

Always combine signals with your own research.

## Next Steps

- [Risk Indicators](risk-indicators.md) - Understand risk scoring
- [Settings](settings.md) - Configure signal preferences
- [Custom Signals](../guides/custom-signals.md) - Build your own signals
