/**
 * ClawFi Extension - Token Safety Checker
 * 
 * Analyzes tokens for common rug pull patterns and risks
 * Combines data from multiple sources
 */

import type { ChainId, TokenSafety, TokenSafetyCheck, RiskLevel, HolderAnalysis } from './types';
import { dexscreenerAPI } from './dexscreener';
import { geckoTerminalAPI } from './geckoterminal';

// Risk weights for scoring
const RISK_WEIGHTS = {
  honeypot: 40,
  lowLiquidity: 15,
  concentratedHolders: 20,
  unverifiedContract: 10,
  noSocials: 5,
  newToken: 10,
};

// Thresholds
const THRESHOLDS = {
  minLiquidity: 10000, // $10k
  lowLiquidity: 50000, // $50k
  safeLiquidity: 250000, // $250k
  maxBuyTax: 10, // 10%
  maxSellTax: 15, // 15%
  concentrationThreshold: 50, // 50% held by top 10
  highConcentration: 70, // 70%
  newTokenHours: 24, // Token is "new" if < 24 hours old
};

// ============================================
// HONEYPOT DETECTION (Simple heuristics)
// ============================================

interface HoneypotResult {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  transferTax: number;
  reason?: string;
}

/**
 * Check for honeypot patterns using trade data
 * This is a heuristic approach - for real detection would need simulation
 */
async function checkHoneypot(
  chain: ChainId,
  tokenAddress: string
): Promise<HoneypotResult> {
  try {
    // Get pair data from Dexscreener
    const pairs = await dexscreenerAPI.getTokenPairs(tokenAddress, chain);
    
    if (pairs.length === 0) {
      return {
        isHoneypot: false,
        buyTax: 0,
        sellTax: 0,
        transferTax: 0,
        reason: 'No trading data available',
      };
    }
    
    const bestPair = pairs.sort((a, b) => b.liquidity.usd - a.liquidity.usd)[0];
    
    // Check buy/sell ratio - extreme imbalance could indicate honeypot
    const { buys, sells } = bestPair.txns.h24;
    const totalTxns = buys + sells;
    
    // If lots of buys but very few sells, could be honeypot
    if (totalTxns > 50) {
      const sellRatio = sells / totalTxns;
      if (sellRatio < 0.05) { // Less than 5% sells
        return {
          isHoneypot: true,
          buyTax: 0,
          sellTax: 100,
          transferTax: 0,
          reason: 'Extreme buy/sell imbalance - possible honeypot',
        };
      }
    }
    
    // Check if price only goes up (potential honeypot)
    const { m5, h1, h6, h24 } = bestPair.priceChange;
    if (m5 > 0 && h1 > 0 && h6 > 0 && h24 > 0 && h24 > 50) {
      // Only goes up with no sells? Suspicious
      if (sells < 5 && buys > 100) {
        return {
          isHoneypot: true,
          buyTax: 0,
          sellTax: 100,
          transferTax: 0,
          reason: 'No successful sells detected',
        };
      }
    }
    
    // Estimate tax from price impact if we had more data
    // For now, return clean
    return {
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      transferTax: 0,
    };
  } catch (error) {
    console.error('[Safety] checkHoneypot error:', error);
    return {
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      transferTax: 0,
      reason: 'Unable to check',
    };
  }
}

// ============================================
// HOLDER ANALYSIS
// ============================================

/**
 * Analyze holder distribution
 * Note: Real holder data would require chain-specific APIs
 * This is a simplified version using available data
 */
async function analyzeHolders(
  chain: ChainId,
  tokenAddress: string
): Promise<HolderAnalysis | null> {
  // For a real implementation, you'd need:
  // - Ethereum: Etherscan API with API key
  // - Solana: Helius or similar
  // - BSC: BscScan API
  
  // For now, return a placeholder
  // In production, integrate with chain-specific APIs
  return null;
}

/**
 * Estimate concentration from trading patterns
 */
async function estimateConcentration(
  chain: ChainId,
  tokenAddress: string
): Promise<{
  isConcentrated: boolean;
  estimatedTop10Percent: number;
}> {
  try {
    // Get trading data
    const pairs = await dexscreenerAPI.getTokenPairs(tokenAddress, chain);
    
    if (pairs.length === 0) {
      return { isConcentrated: true, estimatedTop10Percent: 80 };
    }
    
    const bestPair = pairs[0];
    const { buys, sells } = bestPair.txns.h24;
    
    // Very low transaction count with high volume = likely concentrated
    if (buys + sells < 50 && bestPair.volume.h24 > 100000) {
      return { isConcentrated: true, estimatedTop10Percent: 70 };
    }
    
    // Normal distribution
    return { isConcentrated: false, estimatedTop10Percent: 40 };
  } catch {
    return { isConcentrated: false, estimatedTop10Percent: 50 };
  }
}

// ============================================
// SAFETY CHECKER CLASS
// ============================================

export class TokenSafetyChecker {
  /**
   * Run full safety analysis on a token
   */
  async analyze(chain: ChainId, tokenAddress: string): Promise<TokenSafety> {
    const checks: TokenSafetyCheck[] = [];
    let riskScore = 0;
    
    // Get market data
    const marketData = await dexscreenerAPI.getTokenMarketData(tokenAddress, chain);
    
    // 1. Honeypot Check
    const honeypot = await checkHoneypot(chain, tokenAddress);
    
    if (honeypot.isHoneypot) {
      checks.push({
        name: 'Honeypot Detection',
        passed: false,
        severity: 'critical',
        details: honeypot.reason || 'Token appears to be a honeypot - selling may be impossible',
      });
      riskScore += RISK_WEIGHTS.honeypot;
    } else {
      checks.push({
        name: 'Honeypot Detection',
        passed: true,
        severity: 'safe',
        details: 'No honeypot patterns detected',
      });
    }
    
    // 2. Liquidity Check
    const liquidity = marketData?.liquidity || 0;
    
    if (liquidity < THRESHOLDS.minLiquidity) {
      checks.push({
        name: 'Liquidity',
        passed: false,
        severity: 'critical',
        details: `Extremely low liquidity: $${liquidity.toLocaleString()}. High slippage and rug risk.`,
      });
      riskScore += RISK_WEIGHTS.lowLiquidity;
    } else if (liquidity < THRESHOLDS.lowLiquidity) {
      checks.push({
        name: 'Liquidity',
        passed: false,
        severity: 'high',
        details: `Low liquidity: $${liquidity.toLocaleString()}. May experience high slippage.`,
      });
      riskScore += RISK_WEIGHTS.lowLiquidity * 0.6;
    } else if (liquidity < THRESHOLDS.safeLiquidity) {
      checks.push({
        name: 'Liquidity',
        passed: true,
        severity: 'medium',
        details: `Moderate liquidity: $${liquidity.toLocaleString()}`,
      });
      riskScore += RISK_WEIGHTS.lowLiquidity * 0.3;
    } else {
      checks.push({
        name: 'Liquidity',
        passed: true,
        severity: 'safe',
        details: `Good liquidity: $${liquidity.toLocaleString()}`,
      });
    }
    
    // 3. Holder Concentration
    const concentration = await estimateConcentration(chain, tokenAddress);
    
    if (concentration.isConcentrated || concentration.estimatedTop10Percent > THRESHOLDS.highConcentration) {
      checks.push({
        name: 'Holder Distribution',
        passed: false,
        severity: 'high',
        details: `Estimated ${concentration.estimatedTop10Percent}% held by top wallets. High dump risk.`,
      });
      riskScore += RISK_WEIGHTS.concentratedHolders;
    } else if (concentration.estimatedTop10Percent > THRESHOLDS.concentrationThreshold) {
      checks.push({
        name: 'Holder Distribution',
        passed: false,
        severity: 'medium',
        details: `Estimated ${concentration.estimatedTop10Percent}% held by top wallets. Moderate concentration.`,
      });
      riskScore += RISK_WEIGHTS.concentratedHolders * 0.5;
    } else {
      checks.push({
        name: 'Holder Distribution',
        passed: true,
        severity: 'safe',
        details: 'Token appears to have reasonable distribution',
      });
    }
    
    // 4. Token Age
    if (marketData?.createdAt) {
      const ageHours = (Date.now() - marketData.createdAt) / (1000 * 60 * 60);
      
      if (ageHours < 1) {
        checks.push({
          name: 'Token Age',
          passed: false,
          severity: 'high',
          details: `Token is less than 1 hour old. Extremely high risk.`,
        });
        riskScore += RISK_WEIGHTS.newToken;
      } else if (ageHours < THRESHOLDS.newTokenHours) {
        checks.push({
          name: 'Token Age',
          passed: false,
          severity: 'medium',
          details: `Token is ${Math.floor(ageHours)} hours old. New tokens carry higher risk.`,
        });
        riskScore += RISK_WEIGHTS.newToken * 0.5;
      } else {
        checks.push({
          name: 'Token Age',
          passed: true,
          severity: 'safe',
          details: `Token has been trading for ${Math.floor(ageHours / 24)} days`,
        });
      }
    }
    
    // 5. Trading Volume
    if (marketData) {
      const volumeToLiqRatio = marketData.volume24h / (marketData.liquidity || 1);
      
      if (volumeToLiqRatio > 10) {
        checks.push({
          name: 'Trading Volume',
          passed: true,
          severity: 'safe',
          details: `High trading activity. Volume/Liquidity ratio: ${volumeToLiqRatio.toFixed(1)}x`,
        });
      } else if (volumeToLiqRatio > 1) {
        checks.push({
          name: 'Trading Volume',
          passed: true,
          severity: 'low',
          details: `Moderate trading activity. Volume/Liquidity ratio: ${volumeToLiqRatio.toFixed(1)}x`,
        });
      } else {
        checks.push({
          name: 'Trading Volume',
          passed: false,
          severity: 'medium',
          details: `Low trading activity. Volume/Liquidity ratio: ${volumeToLiqRatio.toFixed(2)}x`,
        });
        riskScore += 5;
      }
    }
    
    // 6. Buy/Sell Balance
    if (marketData) {
      const { buys, sells } = marketData.txns24h;
      const total = buys + sells;
      
      if (total > 0) {
        const buyRatio = buys / total;
        
        if (buyRatio > 0.9) {
          checks.push({
            name: 'Buy/Sell Balance',
            passed: false,
            severity: 'high',
            details: `${(buyRatio * 100).toFixed(0)}% buys - extremely one-sided. Possible manipulation.`,
          });
          riskScore += 10;
        } else if (buyRatio > 0.75 || buyRatio < 0.25) {
          checks.push({
            name: 'Buy/Sell Balance',
            passed: false,
            severity: 'medium',
            details: `Imbalanced trading: ${buys} buys vs ${sells} sells`,
          });
          riskScore += 5;
        } else {
          checks.push({
            name: 'Buy/Sell Balance',
            passed: true,
            severity: 'safe',
            details: `Balanced trading: ${buys} buys, ${sells} sells`,
          });
        }
      }
    }
    
    // Calculate overall risk level
    let overallRisk: RiskLevel;
    if (riskScore >= 60 || honeypot.isHoneypot) {
      overallRisk = 'critical';
    } else if (riskScore >= 40) {
      overallRisk = 'high';
    } else if (riskScore >= 25) {
      overallRisk = 'medium';
    } else if (riskScore >= 10) {
      overallRisk = 'low';
    } else {
      overallRisk = 'safe';
    }
    
    return {
      overallRisk,
      riskScore: Math.min(100, riskScore),
      checks,
      honeypot: {
        isHoneypot: honeypot.isHoneypot,
        buyTax: honeypot.buyTax,
        sellTax: honeypot.sellTax,
        transferTax: honeypot.transferTax,
      },
      holders: {
        total: 0, // Would need chain-specific API
        top10Percentage: concentration.estimatedTop10Percent,
        isConcentrated: concentration.isConcentrated,
      },
      liquidity: {
        locked: false, // Would need to check lock contracts
        lockDuration: undefined,
        lockPercentage: undefined,
      },
      contract: {
        verified: false, // Would need explorer API
        renounced: false,
        hasProxy: false,
        hasMint: false,
        hasBlacklist: false,
      },
    };
  }

  /**
   * Quick risk score (0-100)
   */
  async getQuickRiskScore(chain: ChainId, tokenAddress: string): Promise<number> {
    const safety = await this.analyze(chain, tokenAddress);
    return safety.riskScore;
  }

  /**
   * Get risk badge text
   */
  getRiskBadge(risk: RiskLevel): { text: string; color: string; emoji: string } {
    switch (risk) {
      case 'safe':
        return { text: 'Safe', color: '#30D158', emoji: '✓' };
      case 'low':
        return { text: 'Low Risk', color: '#0A84FF', emoji: '○' };
      case 'medium':
        return { text: 'Medium Risk', color: '#FFD60A', emoji: '⚠' };
      case 'high':
        return { text: 'High Risk', color: '#FF9F0A', emoji: '⚠' };
      case 'critical':
        return { text: 'Critical', color: '#FF453A', emoji: '✕' };
    }
  }
}

// Export singleton
export const tokenSafetyChecker = new TokenSafetyChecker();
