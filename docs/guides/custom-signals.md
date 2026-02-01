# Custom Signals

Create your own signal detection logic with ClawFi.

## Overview

While ClawFi provides built-in signals, you can create custom detectors for:
- Specific trading patterns
- Custom risk thresholds
- Unique market conditions
- Integration with external data

## Creating Custom Detectors

### Basic Structure

```typescript
import { BaseDetector, Signal } from '@clawfi/signals';

interface MyDetectorConfig {
  threshold: number;
  alertOnCondition: boolean;
}

class MyCustomDetector extends BaseDetector {
  private config: MyDetectorConfig;
  
  constructor(config: MyDetectorConfig) {
    super();
    this.config = config;
  }
  
  async detect(data: TokenData): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    // Your detection logic here
    if (this.checkCondition(data)) {
      signals.push({
        type: 'my_custom_signal',
        severity: 'warning',
        message: 'Custom condition detected',
        details: {
          value: data.someValue,
          threshold: this.config.threshold,
        },
        timestamp: Date.now(),
      });
    }
    
    return signals;
  }
  
  private checkCondition(data: TokenData): boolean {
    return data.someValue > this.config.threshold;
  }
}
```

## Example Detectors

### Smart Money Detector

Detect when known "smart money" wallets are active.

```typescript
class SmartMoneyDetector extends BaseDetector {
  private smartWallets: Set<string>;
  
  constructor(wallets: string[]) {
    super();
    this.smartWallets = new Set(wallets.map(w => w.toLowerCase()));
  }
  
  async detect(transactions: Transaction[]): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    for (const tx of transactions) {
      const isSmartMoney = 
        this.smartWallets.has(tx.from.toLowerCase()) ||
        this.smartWallets.has(tx.to.toLowerCase());
      
      if (isSmartMoney) {
        const isBuy = this.smartWallets.has(tx.to.toLowerCase());
        
        signals.push({
          type: isBuy ? 'smart_money_buy' : 'smart_money_sell',
          severity: 'info',
          message: `Smart money ${isBuy ? 'buying' : 'selling'}`,
          details: {
            wallet: isBuy ? tx.to : tx.from,
            value: tx.value,
            txHash: tx.hash,
          },
          timestamp: tx.timestamp,
        });
      }
    }
    
    return signals;
  }
}

// Usage
const detector = new SmartMoneyDetector([
  '0x123...', // Known whale
  '0x456...', // Fund wallet
]);
```

### Liquidity Ratio Detector

Alert when liquidity to market cap ratio is unusual.

```typescript
interface LiquidityRatioConfig {
  minRatio: number;
  maxRatio: number;
}

class LiquidityRatioDetector extends BaseDetector {
  private config: LiquidityRatioConfig;
  
  constructor(config: LiquidityRatioConfig) {
    super();
    this.config = config;
  }
  
  async detect(market: MarketData): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    if (!market.liquidity || !market.marketCap) {
      return signals;
    }
    
    const ratio = market.liquidity / market.marketCap;
    
    if (ratio < this.config.minRatio) {
      signals.push({
        type: 'low_liquidity_ratio',
        severity: 'warning',
        message: `Low liquidity ratio: ${(ratio * 100).toFixed(2)}%`,
        details: {
          liquidity: market.liquidity,
          marketCap: market.marketCap,
          ratio,
        },
        timestamp: Date.now(),
      });
    }
    
    if (ratio > this.config.maxRatio) {
      signals.push({
        type: 'high_liquidity_ratio',
        severity: 'info',
        message: `High liquidity ratio: ${(ratio * 100).toFixed(2)}%`,
        details: {
          liquidity: market.liquidity,
          marketCap: market.marketCap,
          ratio,
        },
        timestamp: Date.now(),
      });
    }
    
    return signals;
  }
}
```

### Momentum Detector

Detect price momentum patterns.

```typescript
interface MomentumConfig {
  periods: number[];      // e.g., [5, 15, 60] minutes
  thresholds: number[];   // e.g., [5, 10, 20] percent
}

class MomentumDetector extends BaseDetector {
  private config: MomentumConfig;
  
  constructor(config: MomentumConfig) {
    super();
    this.config = config;
  }
  
  async detect(priceHistory: PricePoint[]): Promise<Signal[]> {
    const signals: Signal[] = [];
    const now = Date.now();
    
    for (let i = 0; i < this.config.periods.length; i++) {
      const period = this.config.periods[i];
      const threshold = this.config.thresholds[i];
      
      const periodStart = now - (period! * 60 * 1000);
      const startPrice = this.findPriceAt(priceHistory, periodStart);
      const currentPrice = priceHistory[priceHistory.length - 1]?.price;
      
      if (!startPrice || !currentPrice) continue;
      
      const change = ((currentPrice - startPrice) / startPrice) * 100;
      
      if (Math.abs(change) >= threshold!) {
        signals.push({
          type: change > 0 ? 'bullish_momentum' : 'bearish_momentum',
          severity: Math.abs(change) > threshold! * 2 ? 'warning' : 'info',
          message: `${Math.abs(change).toFixed(1)}% ${change > 0 ? 'up' : 'down'} in ${period} min`,
          details: {
            period,
            change,
            startPrice,
            currentPrice,
          },
          timestamp: now,
        });
      }
    }
    
    return signals;
  }
  
  private findPriceAt(history: PricePoint[], timestamp: number): number | null {
    // Find closest price to timestamp
    let closest = history[0];
    for (const point of history) {
      if (Math.abs(point.timestamp - timestamp) < 
          Math.abs(closest!.timestamp - timestamp)) {
        closest = point;
      }
    }
    return closest?.price ?? null;
  }
}
```

### Social Sentiment Detector

Integrate with social data.

```typescript
interface SocialData {
  twitterMentions: number;
  telegramMessages: number;
  sentimentScore: number; // -1 to 1
}

class SocialSentimentDetector extends BaseDetector {
  private baselineMentions: number;
  private sentimentThreshold: number;
  
  constructor(config: { baselineMentions: number; sentimentThreshold: number }) {
    super();
    this.baselineMentions = config.baselineMentions;
    this.sentimentThreshold = config.sentimentThreshold;
  }
  
  async detect(social: SocialData): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    // Mention spike
    const mentionRatio = social.twitterMentions / this.baselineMentions;
    if (mentionRatio > 3) {
      signals.push({
        type: 'social_spike',
        severity: 'info',
        message: `Social mentions ${mentionRatio.toFixed(1)}x above baseline`,
        details: {
          mentions: social.twitterMentions,
          baseline: this.baselineMentions,
          ratio: mentionRatio,
        },
        timestamp: Date.now(),
      });
    }
    
    // Sentiment alert
    if (Math.abs(social.sentimentScore) > this.sentimentThreshold) {
      signals.push({
        type: social.sentimentScore > 0 ? 'positive_sentiment' : 'negative_sentiment',
        severity: 'info',
        message: `Strong ${social.sentimentScore > 0 ? 'positive' : 'negative'} sentiment detected`,
        details: {
          sentimentScore: social.sentimentScore,
        },
        timestamp: Date.now(),
      });
    }
    
    return signals;
  }
}
```

## Combining Detectors

```typescript
class CompositeDetector extends BaseDetector {
  private detectors: BaseDetector[];
  
  constructor(detectors: BaseDetector[]) {
    super();
    this.detectors = detectors;
  }
  
  async detect(data: any): Promise<Signal[]> {
    const allSignals: Signal[] = [];
    
    for (const detector of this.detectors) {
      try {
        const signals = await detector.detect(data);
        allSignals.push(...signals);
      } catch (error) {
        console.error(`Detector error:`, error);
      }
    }
    
    return allSignals;
  }
}

// Usage
const composite = new CompositeDetector([
  new SmartMoneyDetector(['0x...']),
  new LiquidityRatioDetector({ minRatio: 0.05, maxRatio: 0.5 }),
  new MomentumDetector({ periods: [5, 15, 60], thresholds: [5, 10, 20] }),
]);

const signals = await composite.detect(tokenData);
```

## Best Practices

### 1. Avoid False Positives

Set reasonable thresholds:
```typescript
// Too sensitive - many false positives
const threshold = 1; // 1% change

// Better - meaningful signals
const threshold = 10; // 10% change
```

### 2. Add Cooldowns

Prevent duplicate signals:
```typescript
class CooldownDetector extends BaseDetector {
  private lastSignal: Map<string, number> = new Map();
  private cooldownMs: number;
  
  constructor(cooldownMs: number) {
    super();
    this.cooldownMs = cooldownMs;
  }
  
  protected shouldEmit(signalType: string): boolean {
    const last = this.lastSignal.get(signalType) ?? 0;
    if (Date.now() - last < this.cooldownMs) {
      return false;
    }
    this.lastSignal.set(signalType, Date.now());
    return true;
  }
}
```

### 3. Include Context

Provide actionable information:
```typescript
// Not helpful
signals.push({
  type: 'alert',
  message: 'Something happened',
});

// Helpful
signals.push({
  type: 'whale_accumulation',
  message: '5 wallets accumulated $500k in 1 hour',
  details: {
    walletCount: 5,
    totalValue: 500000,
    timeframe: '1h',
    addresses: ['0x...', '0x...'],
  },
});
```

### 4. Test Thoroughly

```typescript
describe('MyDetector', () => {
  it('should detect condition', async () => {
    const detector = new MyDetector({ threshold: 10 });
    const signals = await detector.detect({ someValue: 15 });
    
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('my_custom_signal');
  });
  
  it('should not detect below threshold', async () => {
    const detector = new MyDetector({ threshold: 10 });
    const signals = await detector.detect({ someValue: 5 });
    
    expect(signals).toHaveLength(0);
  });
});
```
