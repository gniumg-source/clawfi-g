/**
 * Local Rule-Based Provider
 * 
 * Generates deterministic explanations without any external API calls.
 * Uses rule-based logic to produce consistent, evidence-based explanations.
 * 
 * This provider works offline and is the default fallback.
 */

import {
  InferenceProvider,
  InferenceConfig,
  ExplanationContext,
  Explanation,
} from '../types.js';

export class LocalRuleProvider implements InferenceProvider {
  readonly name = 'local';
  
  constructor(private config: InferenceConfig) {}
  
  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }
  
  async generateExplanation(context: ExplanationContext): Promise<Explanation> {
    const { metrics, flags, signals, conditions, score } = context;
    
    // Build summary based on metrics
    const summary = this.buildSummary(metrics, score);
    
    // Build rationale from conditions and signals
    const rationale = this.buildRationale(metrics, conditions, signals);
    
    // Identify risks from flags and metrics
    const risks = this.identifyRisks(metrics, flags);
    
    // Generate suggested actions
    const suggestedActions = this.generateActions(metrics, score, risks);
    
    // Calculate confidence based on data completeness
    const confidence = this.calculateConfidence(context);
    
    return {
      summary,
      rationale,
      risks,
      suggestedActions,
      confidence,
      provider: 'local',
      generatedAt: new Date().toISOString(),
    };
  }
  
  private buildSummary(metrics: ExplanationContext['metrics'], score?: number): string {
    const { symbol, priceChange1h, fdv, liquidity } = metrics;
    
    const parts: string[] = [];
    
    // Price movement
    if (priceChange1h > 50) {
      parts.push(`${symbol} showing strong momentum with +${priceChange1h.toFixed(0)}% in the last hour`);
    } else if (priceChange1h > 10) {
      parts.push(`${symbol} displaying positive momentum at +${priceChange1h.toFixed(0)}% hourly`);
    } else if (priceChange1h < -20) {
      parts.push(`${symbol} experiencing significant decline at ${priceChange1h.toFixed(0)}% hourly`);
    } else {
      parts.push(`${symbol} showing stable price action around ${priceChange1h.toFixed(1)}% hourly change`);
    }
    
    // Market cap context
    if (fdv < 50000) {
      parts.push('Ultra-low market cap presents high volatility characteristics.');
    } else if (fdv < 500000) {
      parts.push('Low market cap with potential for significant price movements.');
    }
    
    // Score context
    if (score !== undefined) {
      if (score >= 80) {
        parts.push(`Composite score of ${score} indicates strong signal alignment.`);
      } else if (score >= 60) {
        parts.push(`Moderate composite score of ${score}.`);
      }
    }
    
    return parts.join(' ');
  }
  
  private buildRationale(
    metrics: ExplanationContext['metrics'],
    conditions?: ExplanationContext['conditions'],
    signals?: ExplanationContext['signals']
  ): string {
    const parts: string[] = [];
    
    // Metrics analysis
    const buyRatio = metrics.buys24h / (metrics.buys24h + metrics.sells24h + 1);
    const volumeToMcap = metrics.volume24h / (metrics.fdv + 1);
    const liqRatio = (metrics.liquidity / (metrics.fdv + 1)) * 100;
    
    parts.push('Analysis based on on-chain metrics:');
    
    // Buy pressure
    if (buyRatio > 0.65) {
      parts.push(`- Strong buy pressure detected (${(buyRatio * 100).toFixed(0)}% buyers)`);
    } else if (buyRatio < 0.4) {
      parts.push(`- Sell pressure observed (${(buyRatio * 100).toFixed(0)}% buyers)`);
    } else {
      parts.push(`- Balanced trading activity (${(buyRatio * 100).toFixed(0)}% buyers)`);
    }
    
    // Volume analysis
    if (volumeToMcap > 1) {
      parts.push(`- High volume relative to market cap (${(volumeToMcap * 100).toFixed(0)}%)`);
    } else if (volumeToMcap > 0.3) {
      parts.push(`- Moderate volume activity (${(volumeToMcap * 100).toFixed(0)}% of mcap)`);
    }
    
    // Liquidity
    if (liqRatio >= 10 && liqRatio <= 50) {
      parts.push(`- Healthy liquidity ratio (${liqRatio.toFixed(0)}%)`);
    } else if (liqRatio > 50) {
      parts.push(`- High liquidity ratio (${liqRatio.toFixed(0)}%)`);
    } else {
      parts.push(`- Low liquidity ratio (${liqRatio.toFixed(0)}%) - increased slippage risk`);
    }
    
    // Conditions
    if (conditions && conditions.length > 0) {
      const passed = conditions.filter(c => c.passed).length;
      parts.push(`\n${passed}/${conditions.length} detection conditions met:`);
      
      for (const condition of conditions.filter(c => c.passed)) {
        parts.push(`- ${condition.name}: ${condition.evidence || condition.value}`);
      }
    }
    
    // Signals
    if (signals && signals.length > 0) {
      parts.push(`\nActive signals: ${signals.map(s => s.signal).join(', ')}`);
    }
    
    return parts.join('\n');
  }
  
  private identifyRisks(
    metrics: ExplanationContext['metrics'],
    flags?: ExplanationContext['flags']
  ): string[] {
    const risks: string[] = [];
    
    // From flags
    if (flags) {
      for (const flag of flags) {
        if (flag.severity === 'hard') {
          risks.push(`HIGH: ${flag.message}`);
        } else if (flag.severity === 'warning') {
          risks.push(`MEDIUM: ${flag.message}`);
        }
      }
    }
    
    // Metric-based risks
    if (metrics.fdv < 50000) {
      risks.push('Ultra-low market cap tokens are extremely volatile');
    }
    
    if (metrics.liquidity < 10000) {
      risks.push('Low liquidity may result in high slippage on trades');
    }
    
    const buyRatio = metrics.buys24h / (metrics.buys24h + metrics.sells24h + 1);
    if (buyRatio < 0.4) {
      risks.push('Sell pressure detected - price may continue declining');
    }
    
    if (metrics.priceChange1h < -30) {
      risks.push('Significant recent price decline observed');
    }
    
    if (metrics.priceChange1h > 100) {
      risks.push('Parabolic price action may be unsustainable');
    }
    
    // Always add standard disclaimer
    if (risks.length === 0) {
      risks.push('Standard volatility risk for crypto assets');
    }
    
    return risks;
  }
  
  private generateActions(
    metrics: ExplanationContext['metrics'],
    score?: number,
    risks?: string[]
  ): string[] {
    const actions: string[] = [];
    
    // General research actions
    actions.push('Verify token contract on block explorer');
    actions.push('Check social channels for project updates');
    
    // Score-based suggestions
    if (score && score >= 80) {
      actions.push('Monitor for sustained momentum');
      actions.push('Consider setting price alerts');
    } else if (score && score >= 60) {
      actions.push('Continue monitoring before making decisions');
    } else {
      actions.push('Exercise caution - limited signal alignment');
    }
    
    // Risk-based suggestions
    if (risks && risks.some(r => r.includes('HIGH'))) {
      actions.push('Review identified risk factors carefully');
    }
    
    if (metrics.liquidity < 50000) {
      actions.push('Verify liquidity is sufficient for your position size');
    }
    
    // Always add disclaimer
    actions.push('This is not financial advice - DYOR');
    
    return actions;
  }
  
  private calculateConfidence(context: ExplanationContext): number {
    let score = 0.5; // Base confidence
    
    // Increase for complete data
    if (context.metrics.volume24h > 0) score += 0.1;
    if (context.metrics.liquidity > 0) score += 0.1;
    if (context.conditions && context.conditions.length > 0) score += 0.1;
    if (context.signals && context.signals.length > 0) score += 0.1;
    
    // Decrease for missing data
    if (context.metrics.priceChange6h === undefined) score -= 0.05;
    
    return Math.min(1, Math.max(0, score));
  }
}
