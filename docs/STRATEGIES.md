# ClawFi Strategies

## Overview

Strategies are the intelligence layer of ClawFi. They process normalized events, maintain state, and emit signals when notable conditions are detected.

## Available Strategies

### MoltWatch

**Purpose**: Detect when tracked wallets significantly reduce positions ("molting") and potentially rotate into new tokens.

**Heuristic** (v1 simplified):
1. Monitor ERC20 Transfer events from watched wallets
2. Track position changes per wallet/token pair
3. Trigger signal when:
   - Wallet sells ≥ X% of known position (default: 20%)
   - Optionally: detects buy of different token within time window

**Configuration**:
```json
{
  "watchedWallets": [
    {
      "address": "0x...",
      "label": "Smart Money 1",
      "chain": "ethereum",
      "enabled": true
    }
  ],
  "watchedTokens": [],
  "moltThresholdPercent": 20,
  "rotationWindowMinutes": 30,
  "minPositionUsd": 100,
  "chains": ["ethereum"],
  "pollIntervalSeconds": 60
}
```

**Signals Emitted**:
- Severity: `high` (≥50% sold) or `medium` (20-50%)
- Recommended Action: `reduce_exposure` or `monitor`

**Limitations (v1)**:
- Simplified balance tracking
- No USD price integration
- Polling-based (not real-time streaming)

## Strategy Interface

All strategies implement this interface:

```typescript
interface IStrategy<TConfig, TState> {
  readonly id: string;
  readonly name: string;

  // Initialize with configuration
  initialize(config: TConfig): Promise<void>;

  // Process incoming events
  processEvent(event: Event): Promise<CreateSignal[]>;

  // Get current state (for debugging/display)
  getState(): TState;

  // Update configuration
  updateConfig(config: Partial<TConfig>): Promise<void>;

  // Clean up resources
  shutdown(): Promise<void>;
}
```

## Creating a New Strategy

### 1. Define Schema

```typescript
// packages/core/src/strategies/index.ts

export const MyStrategyConfigSchema = BaseStrategyConfigSchema.extend({
  strategyType: z.literal('mystrategy'),
  
  // Your config fields
  threshold: z.number().min(0).max(100).default(50),
  watchlist: z.array(z.string()).default([]),
});

export type MyStrategyConfig = z.infer<typeof MyStrategyConfigSchema>;
```

### 2. Implement Strategy

```typescript
// apps/node/src/strategies/mystrategy.ts

import type { PrismaClient } from '@prisma/client';
import type { MyStrategyConfig, CreateSignal, Event } from '@clawfi/core';

export class MyStrategy implements IStrategy<MyStrategyConfig, MyState> {
  readonly id: string;
  readonly name: string = 'My Strategy';
  
  private config: MyStrategyConfig | null = null;
  private state: MyState = {};

  constructor(private readonly prisma: PrismaClient) {}

  async initialize(config: MyStrategyConfig): Promise<void> {
    this.config = config;
    (this as { id: string }).id = config.id;
    
    // Load state from DB
    await this.loadState();
    
    // Initialize any connections
  }

  async processEvent(event: Event): Promise<CreateSignal[]> {
    if (!this.config) return [];
    
    const signals: CreateSignal[] = [];
    
    // Your detection logic here
    if (this.detectCondition(event)) {
      signals.push({
        severity: 'medium',
        title: 'Condition Detected',
        summary: 'Description of what was detected',
        token: event.tokenIn,
        chain: event.chain,
        strategyId: this.id,
        recommendedAction: 'monitor',
      });
    }
    
    return signals;
  }

  private detectCondition(event: Event): boolean {
    // Implement your detection logic
    return false;
  }

  getState(): MyState {
    return this.state;
  }

  async updateConfig(config: Partial<MyStrategyConfig>): Promise<void> {
    if (this.config) {
      this.config = { ...this.config, ...config };
    }
  }

  async shutdown(): Promise<void> {
    // Clean up
  }

  private async loadState(): Promise<void> {
    // Load from prisma
  }

  private async saveState(): Promise<void> {
    // Persist to prisma
  }
}
```

### 3. Register with Scheduler

```typescript
// apps/node/src/services/scheduler.ts

private async initializeStrategy(strategy: DbStrategy): Promise<void> {
  if (strategy.strategyType === 'mystrategy') {
    const myStrategy = new MyStrategy(this.prisma);
    await myStrategy.initialize(strategy.config);
    this.strategies.set(strategy.id, myStrategy);
    // Schedule polling
  }
}
```

### 4. Add Seed Data

```typescript
// apps/node/src/db/seed.ts

await prisma.strategy.create({
  data: {
    id: randomUUID(),
    strategyType: 'mystrategy',
    name: 'My Strategy',
    description: 'What it does',
    status: 'disabled',
    config: {
      threshold: 50,
      watchlist: [],
    },
  },
});
```

## Signal Design

### Severity Levels

| Level | Use Case | UI Treatment |
|-------|----------|--------------|
| `critical` | Immediate action needed | Red alert, sound |
| `high` | Important, urgent | Orange highlight |
| `medium` | Notable, monitor | Yellow badge |
| `low` | Informational | Blue, subtle |

### Recommended Actions

| Action | Meaning |
|--------|---------|
| `none` | No action suggested |
| `monitor` | Keep watching |
| `alert` | User should be notified |
| `reduce_exposure` | Consider reducing position |
| `exit_position` | Consider exiting completely |
| `buy` | Opportunity to buy |
| `sell` | Opportunity to sell |

### Evidence

Include supporting data:
```typescript
evidence: [
  { type: 'transaction', value: txHash, link: etherscanUrl },
  { type: 'percentage', value: '45% sold' },
  { type: 'wallet', value: formatAddress(wallet) },
]
```

## State Management

Strategies persist state in the `strategy_state` table:

```typescript
// Save state
await this.prisma.strategyState.upsert({
  where: {
    strategyId_stateKey: {
      strategyId: this.id,
      stateKey: 'my-state-key',
    },
  },
  create: {
    strategyId: this.id,
    stateKey: 'my-state-key',
    stateData: myState,
  },
  update: {
    stateData: myState,
  },
});

// Load state
const states = await this.prisma.strategyState.findMany({
  where: { strategyId: this.id },
});
```

## Testing Strategies

### Unit Tests

```typescript
describe('MyStrategy', () => {
  it('should detect condition', async () => {
    const strategy = new MyStrategy(mockPrisma);
    await strategy.initialize(testConfig);
    
    const signals = await strategy.processEvent(testEvent);
    
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe('medium');
  });
});
```

### Simulation

Use the dev endpoint to test signal flow:

```bash
curl -X POST http://localhost:3001/dev/simulate-event \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "signal", "severity": "high"}'
```

## Best Practices

1. **False Positive Management**
   - Tune thresholds based on data
   - Add debouncing for noisy signals
   - Include confidence scores

2. **Performance**
   - Keep state minimal
   - Batch database operations
   - Use efficient data structures

3. **Reliability**
   - Handle missing data gracefully
   - Recover from partial state
   - Log important decisions

4. **Documentation**
   - Explain the heuristic clearly
   - Document known limitations
   - Provide configuration examples


