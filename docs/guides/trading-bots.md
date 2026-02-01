# Building Trading Bots

Guide to building automated trading bots with ClawFi.

## Overview

This guide covers:
- Setting up real-time monitoring
- Implementing trading logic
- Risk management
- Error handling

## Prerequisites

```bash
npm install @clawfi/sdk ethers
```

## Basic Structure

```typescript
import { ClawFi } from '@clawfi/sdk';

interface TradingBot {
  start(): Promise<void>;
  stop(): void;
  onSignal(handler: SignalHandler): void;
}

class ClawFiTradingBot implements TradingBot {
  private clawfi: ClawFi;
  private running = false;
  private handlers: SignalHandler[] = [];
  
  constructor(config: BotConfig) {
    this.clawfi = new ClawFi(config);
  }
  
  async start() {
    this.running = true;
    await this.monitor();
  }
  
  stop() {
    this.running = false;
  }
  
  onSignal(handler: SignalHandler) {
    this.handlers.push(handler);
  }
  
  private async monitor() {
    while (this.running) {
      // Monitoring logic
      await this.sleep(30000);
    }
  }
}
```

## Token Scanner Bot

Scan for new tokens meeting criteria.

```typescript
interface ScanCriteria {
  minLiquidity: number;
  maxRiskScore: number;
  maxBuyTax: number;
  maxSellTax: number;
  minHolders: number;
}

class TokenScanner {
  private clawfi: ClawFi;
  private criteria: ScanCriteria;
  private scannedTokens = new Set<string>();
  
  constructor(criteria: ScanCriteria) {
    this.clawfi = new ClawFi();
    this.criteria = criteria;
  }
  
  async scanTrending(chain: string) {
    const trending = await this.clawfi.getTrending(chain, 50);
    const opportunities = [];
    
    for (const token of trending) {
      // Skip already scanned
      const key = `${token.chainId}:${token.tokenAddress}`;
      if (this.scannedTokens.has(key)) continue;
      this.scannedTokens.add(key);
      
      try {
        const analysis = await this.clawfi.analyzeToken(
          token.chainId,
          token.tokenAddress
        );
        
        if (this.meetsCriteria(analysis)) {
          opportunities.push({
            token,
            analysis,
            score: this.calculateScore(analysis),
          });
        }
      } catch (error) {
        console.error(`Error analyzing ${token.tokenAddress}:`, error);
      }
      
      // Rate limiting
      await this.sleep(100);
    }
    
    // Sort by score
    return opportunities.sort((a, b) => b.score - a.score);
  }
  
  private meetsCriteria(analysis: TokenAnalysis): boolean {
    // Not a honeypot
    if (analysis.honeypot.isHoneypot) return false;
    
    // Tax limits
    if (analysis.honeypot.buyTax > this.criteria.maxBuyTax) return false;
    if (analysis.honeypot.sellTax > this.criteria.maxSellTax) return false;
    
    // Risk score
    if (analysis.riskScore > this.criteria.maxRiskScore) return false;
    
    // Liquidity
    if ((analysis.market.liquidity ?? 0) < this.criteria.minLiquidity) return false;
    
    // Holders
    if (analysis.holders.total < this.criteria.minHolders) return false;
    
    return true;
  }
  
  private calculateScore(analysis: TokenAnalysis): number {
    let score = 100 - analysis.riskScore; // Lower risk = higher score
    
    // Bonus for verified contract
    if (analysis.contract.isVerified) score += 10;
    
    // Bonus for renounced ownership
    if (analysis.contract.isRenounced) score += 10;
    
    // Bonus for good holder distribution
    if (analysis.holders.top10Percentage < 30) score += 10;
    
    return score;
  }
  
  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Signal-Based Trading

React to signals in real-time.

```typescript
class SignalTrader {
  private clawfi: ClawFi;
  private watchlist: Map<string, WatchedToken> = new Map();
  
  constructor() {
    this.clawfi = new ClawFi();
  }
  
  addToWatchlist(chain: string, address: string, config: WatchConfig) {
    const key = `${chain}:${address}`;
    this.watchlist.set(key, { chain, address, config, lastSignals: [] });
  }
  
  async monitor() {
    while (true) {
      for (const [key, watched] of this.watchlist) {
        try {
          const signals = await this.clawfi.getSignals(
            watched.chain, 
            watched.address,
            { skipCache: true }
          );
          
          // Find new signals
          const newSignals = this.getNewSignals(watched, signals);
          
          for (const signal of newSignals) {
            await this.handleSignal(watched, signal);
          }
          
          watched.lastSignals = signals;
        } catch (error) {
          console.error(`Error monitoring ${key}:`, error);
        }
      }
      
      await this.sleep(30000);
    }
  }
  
  private getNewSignals(watched: WatchedToken, signals: Signal[]) {
    const lastIds = new Set(
      watched.lastSignals.map(s => `${s.type}-${s.timestamp}`)
    );
    
    return signals.filter(s => 
      !lastIds.has(`${s.type}-${s.timestamp}`)
    );
  }
  
  private async handleSignal(watched: WatchedToken, signal: Signal) {
    console.log(`[${watched.address}] New signal: ${signal.type}`);
    
    switch (signal.type) {
      case 'liquidity_remove':
        if (signal.severity === 'critical') {
          console.log('🚨 CRITICAL: Liquidity removal detected!');
          // Consider emergency exit
          await this.executeSell(watched, 'emergency');
        }
        break;
        
      case 'whale_sell':
        if (signal.details.percentage > 5) {
          console.log('⚠️ Large whale sell detected');
          // Consider partial exit
          await this.executeSell(watched, 'partial');
        }
        break;
        
      case 'whale_buy':
        console.log('🐋 Whale accumulation detected');
        // Could be bullish signal
        break;
        
      case 'volume_spike':
        console.log('📊 Volume spike detected');
        // Monitor closely
        break;
    }
  }
  
  private async executeSell(watched: WatchedToken, type: string) {
    console.log(`Executing ${type} sell for ${watched.address}`);
    // Implement actual sell logic
  }
}
```

## Risk Management

```typescript
class RiskManager {
  private positions: Map<string, Position> = new Map();
  private config: RiskConfig;
  
  constructor(config: RiskConfig) {
    this.config = config;
  }
  
  canEnterPosition(token: TokenAnalysis): { allowed: boolean; reason?: string } {
    // Check max positions
    if (this.positions.size >= this.config.maxPositions) {
      return { allowed: false, reason: 'Max positions reached' };
    }
    
    // Check risk score
    if (token.riskScore > this.config.maxRiskScore) {
      return { allowed: false, reason: 'Risk score too high' };
    }
    
    // Check chain exposure
    const chainExposure = this.getChainExposure(token.chain);
    if (chainExposure >= this.config.maxChainExposure) {
      return { allowed: false, reason: 'Max chain exposure reached' };
    }
    
    return { allowed: true };
  }
  
  calculatePositionSize(
    totalCapital: number,
    riskScore: number
  ): number {
    // Lower position size for higher risk
    const riskFactor = 1 - (riskScore / 100);
    const baseSize = totalCapital * this.config.maxPositionPercent;
    return baseSize * riskFactor;
  }
  
  shouldExit(position: Position, currentPrice: number): ExitDecision {
    const pnl = (currentPrice - position.entryPrice) / position.entryPrice;
    
    // Stop loss
    if (pnl <= -this.config.stopLossPercent) {
      return { shouldExit: true, reason: 'stop_loss', percentage: 100 };
    }
    
    // Take profit
    if (pnl >= this.config.takeProfitPercent) {
      return { shouldExit: true, reason: 'take_profit', percentage: 50 };
    }
    
    // Trailing stop
    if (position.maxPrice && 
        currentPrice < position.maxPrice * (1 - this.config.trailingStopPercent)) {
      return { shouldExit: true, reason: 'trailing_stop', percentage: 100 };
    }
    
    return { shouldExit: false };
  }
  
  private getChainExposure(chain: string): number {
    let count = 0;
    for (const position of this.positions.values()) {
      if (position.chain === chain) count++;
    }
    return count;
  }
}
```

## Complete Bot Example

```typescript
async function main() {
  const scanner = new TokenScanner({
    minLiquidity: 50000,
    maxRiskScore: 50,
    maxBuyTax: 10,
    maxSellTax: 10,
    minHolders: 100,
  });
  
  const riskManager = new RiskManager({
    maxPositions: 5,
    maxRiskScore: 50,
    maxChainExposure: 3,
    maxPositionPercent: 0.1,
    stopLossPercent: 0.2,
    takeProfitPercent: 0.5,
    trailingStopPercent: 0.15,
  });
  
  console.log('🤖 ClawFi Trading Bot Starting...\n');
  
  // Scan for opportunities
  console.log('Scanning trending tokens on Base...');
  const opportunities = await scanner.scanTrending('base');
  
  console.log(`\nFound ${opportunities.length} opportunities:\n`);
  
  for (const opp of opportunities.slice(0, 5)) {
    console.log(`${opp.analysis.token.name} (${opp.analysis.token.symbol})`);
    console.log(`  Score: ${opp.score}`);
    console.log(`  Risk: ${opp.analysis.riskScore}/100`);
    console.log(`  Liquidity: $${opp.analysis.market.liquidity?.toLocaleString()}`);
    console.log();
    
    // Check if we can enter
    const canEnter = riskManager.canEnterPosition(opp.analysis);
    if (canEnter.allowed) {
      console.log('  ✅ Meets entry criteria');
    } else {
      console.log(`  ❌ Cannot enter: ${canEnter.reason}`);
    }
    console.log();
  }
}

main().catch(console.error);
```

## Safety Considerations

1. **Start with paper trading** - Test without real money first
2. **Use small positions** - Never risk more than you can afford
3. **Implement stops** - Always have exit strategies
4. **Monitor continuously** - Bots need supervision
5. **Handle errors** - Network issues, API limits, etc.
6. **Audit your code** - Review logic carefully
