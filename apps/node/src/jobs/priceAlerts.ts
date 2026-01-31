/**
 * Price Alert Job
 * 
 * Monitors price changes for watched tokens and generates alerts
 * when significant price movements are detected.
 */

import type { PrismaClient } from '@prisma/client';
import type { SignalService } from '../services/signal.js';

// ============================================
// Types
// ============================================

export interface PriceAlertConfig {
  enabled?: boolean;
  checkIntervalMs?: number;
  priceChangeThresholdPercent?: number;
  lookbackMinutes?: number;
  maxTokensPerCheck?: number;
}

interface TokenPrice {
  address: string;
  chain: string;
  priceUsd: number;
  priceChange24h?: number;
  marketCapUsd?: number;
  volumeUsd24h?: number;
  timestamp: number;
}

interface PriceCache {
  [key: string]: {
    price: number;
    timestamp: number;
  };
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: Required<PriceAlertConfig> = {
  enabled: true,
  checkIntervalMs: 60000, // 1 minute
  priceChangeThresholdPercent: 10, // 10% change triggers alert
  lookbackMinutes: 60, // Compare against price from 1 hour ago
  maxTokensPerCheck: 50,
};

// DEX Screener API (free, no auth required)
const DEX_SCREENER_API = 'https://api.dexscreener.com/latest/dex';

// ============================================
// Price Alert Job
// ============================================

export class PriceAlertJob {
  private config: Required<PriceAlertConfig>;
  private priceCache: PriceCache = {};
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly signalService: SignalService | null,
    config: Partial<PriceAlertConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the price alert job
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('[PriceAlerts] Job disabled');
      return;
    }

    console.log('[PriceAlerts] Starting price monitoring...');
    
    // Run immediately
    this.checkPrices().catch(console.error);
    
    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkPrices().catch(console.error);
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop the price alert job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Check prices for all watched tokens
   */
  async checkPrices(): Promise<void> {
    try {
      // Get watched tokens
      const watchedTokens = await this.prisma.watchedToken.findMany({
        where: { enabled: true },
        take: this.config.maxTokensPerCheck,
        orderBy: { updatedAt: 'asc' },
      });

      if (watchedTokens.length === 0) {
        return;
      }

      // Group tokens by chain
      const tokensByChain: Record<string, string[]> = {};
      for (const token of watchedTokens) {
        if (!tokensByChain[token.chain]) {
          tokensByChain[token.chain] = [];
        }
        tokensByChain[token.chain].push(token.tokenAddress);
      }

      // Fetch prices for each chain
      const prices = await this.fetchPrices(tokensByChain);

      // Check for significant changes
      for (const price of prices) {
        await this.checkPriceChange(price);
      }

    } catch (error) {
      console.error('[PriceAlerts] Check prices error:', error);
    }
  }

  /**
   * Fetch prices from DEX Screener API
   */
  private async fetchPrices(tokensByChain: Record<string, string[]>): Promise<TokenPrice[]> {
    const prices: TokenPrice[] = [];

    for (const [chain, addresses] of Object.entries(tokensByChain)) {
      const chainId = this.mapChainToId(chain);
      if (!chainId) continue;

      // Batch addresses (DEX Screener supports multiple)
      const batchSize = 30;
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        
        try {
          const url = `${DEX_SCREENER_API}/tokens/${batch.join(',')}`;
          const response = await fetch(url, {
            headers: { 'User-Agent': 'ClawFi/0.2.0' },
          });

          if (!response.ok) {
            console.error(`[PriceAlerts] DEX Screener error: ${response.status}`);
            continue;
          }

          const data = await response.json() as { pairs?: Array<{
            baseToken: { address: string };
            chainId: string;
            priceUsd: string;
            priceChange?: { h24?: number };
            fdv?: number;
            volume?: { h24?: number };
          }> };

          if (data.pairs) {
            for (const pair of data.pairs) {
              if (!pair.priceUsd) continue;
              
              prices.push({
                address: pair.baseToken.address.toLowerCase(),
                chain,
                priceUsd: parseFloat(pair.priceUsd),
                priceChange24h: pair.priceChange?.h24,
                marketCapUsd: pair.fdv,
                volumeUsd24h: pair.volume?.h24,
                timestamp: Date.now(),
              });
            }
          }

          // Small delay between batches to avoid rate limits
          await new Promise(r => setTimeout(r, 200));
        } catch (error) {
          console.error(`[PriceAlerts] Fetch error for ${chain}:`, error);
        }
      }
    }

    return prices;
  }

  /**
   * Check if price change warrants an alert
   */
  private async checkPriceChange(price: TokenPrice): Promise<void> {
    const cacheKey = `${price.chain}:${price.address}`;
    const cached = this.priceCache[cacheKey];
    
    // Update cache
    this.priceCache[cacheKey] = {
      price: price.priceUsd,
      timestamp: price.timestamp,
    };

    // Skip if no previous price
    if (!cached) {
      return;
    }

    // Check if cached price is within lookback window
    const lookbackMs = this.config.lookbackMinutes * 60 * 1000;
    if (price.timestamp - cached.timestamp < lookbackMs / 2) {
      // Price update too recent, wait for more data
      return;
    }

    // Calculate price change percentage
    const changePercent = ((price.priceUsd - cached.price) / cached.price) * 100;

    // Check threshold
    if (Math.abs(changePercent) < this.config.priceChangeThresholdPercent) {
      return;
    }

    // Get token info from database
    const watchedToken = await this.prisma.watchedToken.findUnique({
      where: {
        chain_tokenAddress: {
          chain: price.chain,
          tokenAddress: price.address,
        },
      },
    });

    const tokenSymbol = watchedToken?.tokenSymbol || 'Unknown';
    const isIncrease = changePercent > 0;

    // Generate alert signal
    if (this.signalService) {
      await this.signalService.create({
        severity: Math.abs(changePercent) >= 25 ? 'high' : 'medium',
        signalType: isIncrease ? 'PriceIncrease' : 'PriceDecrease',
        title: `${isIncrease ? '📈' : '📉'} ${tokenSymbol} price ${isIncrease ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(1)}%`,
        summary: `${tokenSymbol} on ${price.chain} moved from $${cached.price.toFixed(6)} to $${price.priceUsd.toFixed(6)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`,
        token: price.address,
        tokenSymbol,
        chain: price.chain as 'base' | 'ethereum' | 'arbitrum' | 'solana' | 'bsc',
        strategyId: 'price-alerts',
        evidence: {
          previousPrice: cached.price,
          currentPrice: price.priceUsd,
          changePercent,
          timeElapsedMinutes: Math.round((price.timestamp - cached.timestamp) / 60000),
          marketCapUsd: price.marketCapUsd,
          volumeUsd24h: price.volumeUsd24h,
        },
        recommendedAction: 'review',
      });

      console.log(`[PriceAlerts] Generated ${isIncrease ? 'increase' : 'decrease'} alert for ${tokenSymbol}: ${changePercent.toFixed(1)}%`);
    }
  }

  /**
   * Map chain name to DEX Screener chain ID
   */
  private mapChainToId(chain: string): string | null {
    const mapping: Record<string, string> = {
      base: 'base',
      ethereum: 'ethereum',
      arbitrum: 'arbitrum',
      bsc: 'bsc',
      solana: 'solana',
    };
    return mapping[chain.toLowerCase()] || null;
  }
}

/**
 * Create price alert job from environment
 */
export function createPriceAlertJob(
  prisma: PrismaClient,
  signalService: SignalService | null
): PriceAlertJob {
  return new PriceAlertJob(prisma, signalService, {
    enabled: process.env.PRICE_ALERTS_ENABLED !== 'false',
    checkIntervalMs: parseInt(process.env.PRICE_ALERTS_INTERVAL_MS || '60000', 10),
    priceChangeThresholdPercent: parseFloat(process.env.PRICE_ALERTS_THRESHOLD || '10'),
    lookbackMinutes: parseInt(process.env.PRICE_ALERTS_LOOKBACK_MINUTES || '60', 10),
  });
}
