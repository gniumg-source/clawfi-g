# Analyzing New Tokens

A guide to safely analyzing and evaluating new crypto tokens.

## Overview

When evaluating a new token, follow this systematic approach:

1. **Safety Check** - Is it a honeypot/scam?
2. **Contract Analysis** - What does the code do?
3. **Market Analysis** - Is there real liquidity?
4. **Holder Analysis** - Who owns the tokens?
5. **Signal Monitoring** - What's happening in real-time?

## Step 1: Safety Check

Always check for honeypots first.

```typescript
import { ClawFi } from '@clawfi/sdk';

const clawfi = new ClawFi();

async function safetyCheck(chain: string, address: string) {
  // Quick honeypot check
  const honeypot = await clawfi.checkHoneypot(chain, address);
  
  if (honeypot.isHoneypot) {
    console.log('🚫 HONEYPOT DETECTED - DO NOT BUY');
    console.log('Reason:', honeypot.reason);
    return false;
  }
  
  // Check taxes
  if (honeypot.buyTax > 15 || honeypot.sellTax > 15) {
    console.log('⚠️ HIGH TAX WARNING');
    console.log(`Buy Tax: ${honeypot.buyTax}%`);
    console.log(`Sell Tax: ${honeypot.sellTax}%`);
    return false;
  }
  
  console.log('✅ Initial safety check passed');
  return true;
}
```

## Step 2: Contract Analysis

Examine the contract for red flags.

```typescript
async function analyzeContract(chain: string, address: string) {
  const analysis = await clawfi.analyzeToken(chain, address);
  
  console.log('=== CONTRACT ANALYSIS ===');
  
  // Verification
  if (analysis.contract.isVerified) {
    console.log('✅ Contract is verified');
  } else {
    console.log('⚠️ Contract NOT verified - higher risk');
  }
  
  // Ownership
  if (analysis.contract.isRenounced) {
    console.log('✅ Ownership renounced');
  } else if (analysis.contract.hasOwner) {
    console.log('⚠️ Contract has owner:', analysis.contract.ownerAddress);
    // Owner can potentially:
    // - Pause trading
    // - Change taxes
    // - Mint tokens
    // - Blacklist addresses
  }
  
  // Proxy
  if (analysis.contract.isProxy) {
    console.log('⚠️ Proxy contract - can be upgraded');
  }
  
  return analysis.contract;
}
```

## Step 3: Market Analysis

Evaluate liquidity and trading activity.

```typescript
async function analyzeMarket(chain: string, address: string) {
  const market = await clawfi.getMarketData(chain, address);
  
  console.log('=== MARKET ANALYSIS ===');
  console.log(`Price: $${market.priceUsd}`);
  console.log(`Market Cap: $${market.marketCap?.toLocaleString()}`);
  console.log(`Liquidity: $${market.liquidity?.toLocaleString()}`);
  console.log(`24h Volume: $${market.volume24h?.toLocaleString()}`);
  
  // Red flags
  const issues = [];
  
  if ((market.liquidity ?? 0) < 10000) {
    issues.push('Very low liquidity - high slippage risk');
  }
  
  if ((market.volume24h ?? 0) < 1000) {
    issues.push('Very low volume - may be difficult to sell');
  }
  
  if (market.priceChange24h && market.priceChange24h < -50) {
    issues.push('Massive price drop in 24h');
  }
  
  // Volume to liquidity ratio
  const volumeToLiquidity = (market.volume24h ?? 0) / (market.liquidity ?? 1);
  if (volumeToLiquidity > 10) {
    issues.push('Unusual volume/liquidity ratio - possible wash trading');
  }
  
  if (issues.length > 0) {
    console.log('\n⚠️ Market Issues:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
  
  return { market, issues };
}
```

## Step 4: Holder Analysis

Check token distribution.

```typescript
async function analyzeHolders(chain: string, address: string) {
  const analysis = await clawfi.analyzeToken(chain, address);
  
  console.log('=== HOLDER ANALYSIS ===');
  console.log(`Total Holders: ${analysis.holders.total}`);
  console.log(`Top 10 hold: ${analysis.holders.top10Percentage}%`);
  console.log(`Creator holds: ${analysis.holders.creatorPercentage}%`);
  
  const issues = [];
  
  if (analysis.holders.total < 100) {
    issues.push('Very few holders - early stage or dead token');
  }
  
  if (analysis.holders.top10Percentage > 50) {
    issues.push('Top 10 wallets control majority - whale risk');
  }
  
  if (analysis.holders.creatorPercentage > 10) {
    issues.push('Creator holds significant supply - dump risk');
  }
  
  if (issues.length > 0) {
    console.log('\n⚠️ Holder Issues:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
  
  return { holders: analysis.holders, issues };
}
```

## Step 5: Signal Monitoring

Check for recent activity.

```typescript
async function checkSignals(chain: string, address: string) {
  const signals = await clawfi.getSignals(chain, address);
  
  console.log('=== ACTIVE SIGNALS ===');
  
  if (signals.length === 0) {
    console.log('No active signals');
    return [];
  }
  
  // Sort by severity
  const severityOrder = ['critical', 'warning', 'info', 'positive'];
  signals.sort((a, b) => 
    severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );
  
  for (const signal of signals) {
    const icon = {
      positive: '🟢',
      info: '🔵',
      warning: '🟡',
      critical: '🔴',
    }[signal.severity];
    
    console.log(`${icon} [${signal.type}] ${signal.message}`);
  }
  
  // Return critical signals
  return signals.filter(s => s.severity === 'critical');
}
```

## Complete Analysis Function

```typescript
async function fullTokenAnalysis(chain: string, address: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`ANALYZING: ${address}`);
  console.log(`Chain: ${chain}`);
  console.log(`${'='.repeat(50)}\n`);
  
  // 1. Safety check
  const isSafe = await safetyCheck(chain, address);
  if (!isSafe) {
    return { safe: false, reason: 'Failed safety check' };
  }
  
  console.log();
  
  // 2. Contract analysis
  const contract = await analyzeContract(chain, address);
  
  console.log();
  
  // 3. Market analysis
  const { market, issues: marketIssues } = await analyzeMarket(chain, address);
  
  console.log();
  
  // 4. Holder analysis
  const { holders, issues: holderIssues } = await analyzeHolders(chain, address);
  
  console.log();
  
  // 5. Signal check
  const criticalSignals = await checkSignals(chain, address);
  
  console.log(`\n${'='.repeat(50)}`);
  
  // Final verdict
  const allIssues = [...marketIssues, ...holderIssues];
  const hasCritical = criticalSignals.length > 0;
  
  if (hasCritical) {
    console.log('❌ VERDICT: HIGH RISK - Critical signals detected');
    return { safe: false, reason: 'Critical signals' };
  }
  
  if (allIssues.length > 3) {
    console.log('⚠️ VERDICT: PROCEED WITH CAUTION - Multiple issues');
    return { safe: false, reason: 'Multiple issues' };
  }
  
  if (allIssues.length > 0) {
    console.log('🟡 VERDICT: SOME CONCERNS - Review issues above');
    return { safe: true, warnings: allIssues };
  }
  
  console.log('✅ VERDICT: APPEARS SAFE - Standard due diligence still advised');
  return { safe: true };
}

// Usage
fullTokenAnalysis('ethereum', '0x...');
```

## Best Practices

### 1. Never Skip Safety Check
Always check for honeypots before any other analysis.

### 2. Set Your Risk Tolerance
Define acceptable thresholds:
```typescript
const THRESHOLDS = {
  maxBuyTax: 10,
  maxSellTax: 10,
  minLiquidity: 50000,
  maxTopHolderPercent: 30,
  maxRiskScore: 50,
};
```

### 3. Monitor After Buying
Continue monitoring for signals after purchase:
```typescript
const monitoring = setInterval(async () => {
  const signals = await clawfi.getSignals(chain, address);
  const critical = signals.filter(s => s.severity === 'critical');
  
  if (critical.length > 0) {
    console.log('🚨 ALERT: Critical signal detected!');
    // Consider exiting position
  }
}, 30000);
```

### 4. Document Your Process
Keep records of your analysis for learning.

## Red Flags Checklist

- [ ] Honeypot detected
- [ ] High buy/sell tax (>15%)
- [ ] Unverified contract
- [ ] Owner not renounced
- [ ] Very low liquidity (<$10k)
- [ ] Top holders control >50%
- [ ] Creator holds >10%
- [ ] No trading history
- [ ] Critical signals present
- [ ] Unlocked liquidity
