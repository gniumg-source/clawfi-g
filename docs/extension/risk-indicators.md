# Risk Indicators

Understanding ClawFi's risk scoring system and what each indicator means.

## Risk Score

ClawFi calculates a risk score from 0-100 based on multiple factors:

| Score Range | Level | Color | Meaning |
|-------------|-------|-------|---------|
| 0-30 | Low | 🟢 Green | Generally safe, standard risks |
| 31-70 | Medium | 🟡 Yellow | Some concerns, proceed with caution |
| 71-100 | High | 🔴 Red | Significant risks detected |

## Risk Factors

### Contract Analysis

#### Honeypot Detection
Checks if the token can be sold:
- Buy tax analysis
- Sell tax analysis
- Transfer restrictions
- Blacklist functions

```
✅ Not a honeypot - Token can be freely traded
⚠️ High tax - Buy/sell tax exceeds 10%
🚫 Honeypot - Cannot sell tokens
```

#### Ownership
Analyzes contract ownership:
- Owner address
- Renounced status
- Owner privileges
- Proxy contracts

```
✅ Renounced - No owner can modify
⚠️ Owner present - Owner can make changes
🚫 Dangerous owner - Owner has excessive control
```

#### Contract Verification
```
✅ Verified - Source code is public
⚠️ Unverified - Source code not available
```

### Liquidity Analysis

#### Pool Health
```
✅ Healthy liquidity - $100k+ locked
⚠️ Low liquidity - Under $50k
🚫 No liquidity - Trading not possible
```

#### Liquidity Lock
```
✅ Locked - LP tokens are locked
⚠️ Partial lock - Some LP unlocked
🚫 Unlocked - LP can be removed anytime
```

### Holder Analysis

#### Distribution
```
✅ Well distributed - No wallet > 5%
⚠️ Concentrated - Top wallets hold 20%+
🚫 Whale dominated - Single wallet > 50%
```

#### Creator Holdings
```
✅ Creator sold - No significant holdings
⚠️ Creator holding - Creator has 10%+ supply
🚫 Creator dumping - Active selling detected
```

## Risk Categories

### 1. Smart Contract Risks

| Risk | Weight | Description |
|------|--------|-------------|
| Honeypot | 30% | Cannot sell tokens |
| High Tax | 15% | Excessive buy/sell tax |
| Owner Risk | 15% | Dangerous owner functions |
| Proxy | 10% | Upgradeable contract |
| Unverified | 10% | No source code |

### 2. Liquidity Risks

| Risk | Weight | Description |
|------|--------|-------------|
| No Liquidity | 25% | Cannot trade |
| Low Liquidity | 15% | High slippage |
| Unlocked LP | 20% | Rug pull possible |
| Decreasing | 10% | Liquidity being removed |

### 3. Holder Risks

| Risk | Weight | Description |
|------|--------|-------------|
| Whale Dominated | 15% | Price manipulation risk |
| Creator Holdings | 15% | Dump risk |
| Bundled Launch | 10% | Coordinated buying |
| Bot Activity | 10% | Artificial volume |

## Risk Breakdown Display

```
┌─────────────────────────────────────┐
│  RISK SCORE: 45/100 (Medium)        │
├─────────────────────────────────────┤
│  Contract      ████████░░  80%  ✅  │
│  Liquidity     ██████░░░░  60%  ⚠️  │
│  Holders       ███░░░░░░░  30%  ⚠️  │
│  Activity      █████████░  90%  ✅  │
└─────────────────────────────────────┘
```

## Interpreting Scores

### Low Risk (0-30)
- Contract is verified and safe
- Healthy liquidity with locks
- Good holder distribution
- Normal trading activity

**Recommendation**: Standard due diligence still advised

### Medium Risk (31-70)
- Some flags detected
- May have concentrated holders
- Liquidity could be improved
- Watch for changes

**Recommendation**: Proceed with caution, set stop losses

### High Risk (71-100)
- Multiple serious concerns
- Possible scam indicators
- High probability of loss

**Recommendation**: Avoid or use extreme caution

## Dynamic Updates

Risk scores update in real-time based on:
- New contract interactions
- Liquidity changes
- Holder movements
- Trading activity

## Limitations

Risk analysis cannot guarantee safety:
- New scam techniques emerge constantly
- Some risks can't be detected on-chain
- Market conditions change rapidly
- DYOR (Do Your Own Research) always

## Next Steps

- [Signal Types](signals.md) - Understanding different alerts
- [Settings](settings.md) - Configure risk thresholds
- [Troubleshooting](troubleshooting.md) - Common issues
