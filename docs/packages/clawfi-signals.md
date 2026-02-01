# clawfi-signals

Signal detection and risk analysis library for crypto tokens.

## Installation

```bash
npm install @clawfi/signals
```

## Quick Start

```typescript
import { 
  SignalDetector, 
  RiskCalculator,
  WhaleDetector,
  LiquidityDetector 
} from '@clawfi/signals';

// Create detector
const detector = new SignalDetector();

// Detect signals
const signals = await detector.detect(tokenData);

// Calculate risk
const calculator = new RiskCalculator();
const risk = calculator.calculate(tokenData);
```

## Features

- Whale movement detection
- Liquidity change monitoring
- Honeypot detection
- Rug pull risk analysis
- Volume spike detection
- Customizable thresholds

## Detectors

### WhaleDetector

Detect large wallet movements.

```typescript
const detector = new WhaleDetector({
  minValueUsd: 50000,
  minSupplyPercent: 1,
});

const signals = await detector.detect(transactions);
```

### LiquidityDetector

Monitor liquidity changes.

```typescript
const detector = new LiquidityDetector({
  minChangePercent: 5,
  alertOnRemoval: true,
});

const signals = await detector.detect(liquidityEvents);
```

### HoneypotDetector

Check for honeypot characteristics.

```typescript
const detector = new HoneypotDetector();

const result = await detector.analyze(contractData);
if (result.isHoneypot) {
  console.log('Honeypot detected:', result.reason);
}
```

### RugPullDetector

Identify rug pull indicators.

```typescript
const detector = new RugPullDetector();

const risk = await detector.analyze({
  liquidity: liquidityData,
  holders: holderData,
  contract: contractData,
});
```

### VolumeSpikeDetector

Detect unusual volume activity.

```typescript
const detector = new VolumeSpikeDetector({
  multiplier: 3, // 3x average
  windowMinutes: 60,
});

const signals = await detector.detect(volumeData);
```

## Risk Calculator

Calculate overall risk score.

```typescript
const calculator = new RiskCalculator({
  weights: {
    honeypot: 0.30,
    liquidity: 0.25,
    holders: 0.20,
    contract: 0.15,
    activity: 0.10,
  },
});

const result = calculator.calculate({
  honeypot: honeypotResult,
  liquidity: liquidityData,
  holders: holderData,
  contract: contractData,
  activity: activityData,
});

console.log('Risk Score:', result.score);
console.log('Risk Level:', result.level);
console.log('Factors:', result.factors);
```

## Signal Types

```typescript
type SignalType = 
  | 'whale_buy'
  | 'whale_sell'
  | 'whale_transfer'
  | 'liquidity_add'
  | 'liquidity_remove'
  | 'liquidity_lock'
  | 'volume_spike'
  | 'volume_drop'
  | 'honeypot'
  | 'rugpull_risk'
  | 'contract_change';

type SignalSeverity = 
  | 'positive'
  | 'info'
  | 'warning'
  | 'critical';
```

## Custom Detector

Create your own detector:

```typescript
import { BaseDetector, Signal } from '@clawfi/signals';

class MyDetector extends BaseDetector {
  async detect(data: MyData): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    if (data.someCondition) {
      signals.push({
        type: 'my_signal',
        severity: 'warning',
        message: 'Custom signal detected',
        details: { value: data.value },
        timestamp: Date.now(),
      });
    }
    
    return signals;
  }
}
```

## Links

- [GitHub](https://github.com/ClawFiAI/clawfi-signals)
- [npm](https://www.npmjs.com/package/@clawfi/signals)
