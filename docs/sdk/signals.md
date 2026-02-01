# Signal Detection

Understanding and using ClawFi's signal detection system.

## getSignals

Fetch active signals for a token.

```typescript
const signals = await clawfi.getSignals(chain, address, options?);
```

### Response Type

```typescript
interface Signal {
  type: SignalType;
  severity: SignalSeverity;
  message: string;
  details: SignalDetails;
  timestamp: number;
}

type SignalType = 
  | 'whale_buy'
  | 'whale_sell'
  | 'whale_transfer'
  | 'liquidity_add'
  | 'liquidity_remove'
  | 'liquidity_lock'
  | 'volume_spike'
  | 'volume_drop'
  | 'price_pump'
  | 'price_dump'
  | 'honeypot'
  | 'rugpull_risk'
  | 'contract_change';

type SignalSeverity = 'positive' | 'info' | 'warning' | 'critical';

interface SignalDetails {
  value?: number;
  percentage?: number;
  address?: string;
  txHash?: string;
  previousValue?: number;
  currentValue?: number;
}
```

### Example

```typescript
const signals = await clawfi.getSignals('base', '0x...');

for (const signal of signals) {
  const icon = {
    positive: '🟢',
    info: '🔵',
    warning: '🟡',
    critical: '🔴',
  }[signal.severity];
  
  console.log(`${icon} [${signal.type}] ${signal.message}`);
  
  if (signal.details.value) {
    console.log(`   Value: $${signal.details.value.toLocaleString()}`);
  }
  
  if (signal.details.txHash) {
    console.log(`   TX: ${signal.details.txHash}`);
  }
  
  console.log(`   Time: ${new Date(signal.timestamp).toLocaleString()}`);
  console.log();
}
```

## Signal Types

### Whale Signals

#### whale_buy

```typescript
{
  type: 'whale_buy',
  severity: 'info',
  message: 'Large purchase detected: $125,000',
  details: {
    value: 125000,
    percentage: 1.5,  // % of supply
    address: '0x...',
    txHash: '0x...'
  }
}
```

#### whale_sell

```typescript
{
  type: 'whale_sell',
  severity: 'warning',
  message: 'Large sale detected: $85,000',
  details: {
    value: 85000,
    percentage: 0.8,
    address: '0x...',
    txHash: '0x...'
  }
}
```

### Liquidity Signals

#### liquidity_add

```typescript
{
  type: 'liquidity_add',
  severity: 'positive',
  message: 'Liquidity added: +$50,000 (15%)',
  details: {
    value: 50000,
    percentage: 15,
    previousValue: 333333,
    currentValue: 383333
  }
}
```

#### liquidity_remove

```typescript
{
  type: 'liquidity_remove',
  severity: 'critical',
  message: 'Liquidity removed: -$100,000 (25%)',
  details: {
    value: 100000,
    percentage: 25,
    previousValue: 400000,
    currentValue: 300000,
    address: '0x...',  // Who removed it
    txHash: '0x...'
  }
}
```

### Volume Signals

#### volume_spike

```typescript
{
  type: 'volume_spike',
  severity: 'warning',
  message: 'Volume spike: 5x average',
  details: {
    value: 500000,        // Current volume
    previousValue: 100000, // Average volume
    percentage: 400        // % increase
  }
}
```

### Risk Signals

#### honeypot

```typescript
{
  type: 'honeypot',
  severity: 'critical',
  message: 'HONEYPOT: Token cannot be sold',
  details: {
    // No additional details needed - this is binary
  }
}
```

#### rugpull_risk

```typescript
{
  type: 'rugpull_risk',
  severity: 'critical',
  message: 'High rug pull risk detected',
  details: {
    // Multiple factors contributing to risk
  }
}
```

## Filtering Signals

### By Severity

```typescript
const signals = await clawfi.getSignals('ethereum', '0x...');

// Only critical signals
const critical = signals.filter(s => s.severity === 'critical');

// Warnings and above
const important = signals.filter(s => 
  ['warning', 'critical'].includes(s.severity)
);
```

### By Type

```typescript
const signals = await clawfi.getSignals('ethereum', '0x...');

// Whale activity
const whaleSignals = signals.filter(s => 
  s.type.startsWith('whale_')
);

// Liquidity changes
const liquiditySignals = signals.filter(s => 
  s.type.startsWith('liquidity_')
);
```

### By Time

```typescript
const signals = await clawfi.getSignals('ethereum', '0x...');

// Last hour
const oneHourAgo = Date.now() - 60 * 60 * 1000;
const recentSignals = signals.filter(s => s.timestamp > oneHourAgo);

// Last 24 hours
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
const dailySignals = signals.filter(s => s.timestamp > oneDayAgo);
```

## Signal Monitoring

### Continuous Monitoring

```typescript
async function monitorSignals(
  chain: ChainId,
  address: string,
  callback: (signal: Signal) => void,
  intervalMs: number = 30000
) {
  const seenSignals = new Set<string>();
  
  while (true) {
    const signals = await clawfi.getSignals(chain, address, {
      skipCache: true,
    });
    
    for (const signal of signals) {
      // Create unique ID for deduplication
      const signalId = `${signal.type}-${signal.timestamp}`;
      
      if (!seenSignals.has(signalId)) {
        seenSignals.add(signalId);
        callback(signal);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

// Usage
monitorSignals('base', '0x...', (signal) => {
  if (signal.severity === 'critical') {
    console.log('🚨 CRITICAL SIGNAL:', signal.message);
    // Send notification, trigger alert, etc.
  }
});
```

### Alert System

```typescript
interface AlertConfig {
  minSeverity: SignalSeverity;
  types?: SignalType[];
  callback: (signal: Signal) => void;
}

class SignalAlertSystem {
  private configs: AlertConfig[] = [];
  
  addAlert(config: AlertConfig) {
    this.configs.push(config);
  }
  
  processSignals(signals: Signal[]) {
    const severityOrder = ['positive', 'info', 'warning', 'critical'];
    
    for (const signal of signals) {
      for (const config of this.configs) {
        const meetsMinSeverity = 
          severityOrder.indexOf(signal.severity) >= 
          severityOrder.indexOf(config.minSeverity);
        
        const meetsType = !config.types || 
          config.types.includes(signal.type);
        
        if (meetsMinSeverity && meetsType) {
          config.callback(signal);
        }
      }
    }
  }
}

// Usage
const alertSystem = new SignalAlertSystem();

// Alert on all critical signals
alertSystem.addAlert({
  minSeverity: 'critical',
  callback: (signal) => {
    console.log('🔴 CRITICAL:', signal.message);
  }
});

// Alert on whale activity
alertSystem.addAlert({
  minSeverity: 'info',
  types: ['whale_buy', 'whale_sell'],
  callback: (signal) => {
    console.log('🐋 WHALE:', signal.message);
  }
});

// Alert on liquidity changes
alertSystem.addAlert({
  minSeverity: 'warning',
  types: ['liquidity_remove'],
  callback: (signal) => {
    console.log('💧 LIQUIDITY:', signal.message);
  }
});
```

## Combining with Analysis

```typescript
async function fullTokenCheck(chain: ChainId, address: string) {
  // Get analysis and signals in parallel
  const [analysis, signals] = await Promise.all([
    clawfi.analyzeToken(chain, address),
    clawfi.getSignals(chain, address),
  ]);
  
  console.log('=== TOKEN CHECK ===');
  console.log(`Token: ${analysis.token.name} (${analysis.token.symbol})`);
  console.log(`Risk Score: ${analysis.riskScore}/100`);
  console.log();
  
  // Check for critical signals
  const criticalSignals = signals.filter(s => s.severity === 'critical');
  
  if (criticalSignals.length > 0) {
    console.log('🚨 CRITICAL ALERTS:');
    for (const signal of criticalSignals) {
      console.log(`  - ${signal.message}`);
    }
    console.log();
    return { safe: false, reason: 'critical signals detected' };
  }
  
  // Check honeypot
  if (analysis.honeypot.isHoneypot) {
    console.log('🚨 HONEYPOT DETECTED');
    return { safe: false, reason: 'honeypot' };
  }
  
  // Check risk score
  if (analysis.riskScore > 70) {
    console.log('⚠️ HIGH RISK SCORE');
    return { safe: false, reason: 'high risk score' };
  }
  
  console.log('✅ Token passed basic checks');
  return { safe: true, analysis, signals };
}
```

## Next Steps

- [Error Handling](errors.md) - Handling errors
- [Token Analysis](token-analysis.md) - Full analysis
- [Market Data](market-data.md) - Market data
