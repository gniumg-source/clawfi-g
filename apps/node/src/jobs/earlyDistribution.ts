/**
 * Early Distribution Analysis Job
 * 
 * Analyzes token holder concentration for recently launched tokens.
 * Emits EarlyDistribution signals when concentration thresholds are exceeded.
 * 
 * METHODOLOGY:
 * - For tokens launched within the last 60 minutes
 * - Fetch token holders via Transfer event analysis
 * - Calculate top holder percentages
 * - Emit signal if thresholds exceeded
 * 
 * ASSUMPTIONS:
 * 1. Transfer events from zero address = mints
 * 2. We track net balance changes, not full ERC-20 state
 * 3. Small positions may be excluded for performance
 */

import type { PrismaClient } from '@prisma/client';
import { createPublicClient, http, type PublicClient, parseAbiItem, decodeEventLog } from 'viem';
import { base } from 'viem/chains';
import { withRetry, RateLimiter } from '@clawfi/connectors';
import type { SignalService } from '../services/signal.js';

// ============================================
// Types
// ============================================

export interface DistributionConfig {
  rpcUrl: string;
  analysisWindowMinutes: number;  // Analyze tokens launched within this window
  top10Threshold: number;         // Signal if top 10 holders >= X%
  creatorThreshold: number;       // Signal if creator holds >= X%
  minHolders: number;             // Minimum holders to analyze
  rateLimit: number;
}

export interface HolderAnalysis {
  tokenAddress: string;
  top10Percent: number;
  top20Percent: number;
  creatorPercent: number;
  holderCount: number;
  totalSupply: bigint;
  concentrationScore: number;
  topHolders: { address: string; balance: bigint; percent: number }[];
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: Partial<DistributionConfig> = {
  analysisWindowMinutes: 60,
  top10Threshold: 40,        // 40%
  creatorThreshold: 15,      // 15%
  minHolders: 5,
  rateLimit: 3,
};

// ERC-20 Transfer event
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ============================================
// Early Distribution Analyzer
// ============================================

export class EarlyDistributionAnalyzer {
  private client: PublicClient;
  private config: DistributionConfig;
  private rateLimiter: RateLimiter;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly signalService: SignalService,
    config: Partial<DistributionConfig> & { rpcUrl: string }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config } as DistributionConfig;

    this.client = createPublicClient({
      chain: base,
      transport: http(this.config.rpcUrl, {
        retryCount: 3,
        retryDelay: 1000,
      }),
    });

    this.rateLimiter = new RateLimiter(this.config.rateLimit);
  }

  /**
   * Start periodic analysis
   */
  start(intervalMinutes: number = 5): void {
    if (this.isRunning) {
      console.warn('[Distribution] Analyzer already running');
      return;
    }

    this.isRunning = true;
    console.log(`[Distribution] Starting analysis every ${intervalMinutes} minutes`);

    this.runAnalysis();
    this.intervalId = setInterval(
      () => this.runAnalysis(),
      intervalMinutes * 60 * 1000
    );
  }

  /**
   * Stop periodic analysis
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Distribution] Analyzer stopped');
  }

  /**
   * Run analysis on recently launched tokens
   */
  async runAnalysis(): Promise<void> {
    try {
      const windowStart = new Date(
        Date.now() - this.config.analysisWindowMinutes * 60 * 1000
      );

      // Get recently launched tokens that haven't been analyzed yet
      const tokens = await this.prisma.launchpadToken.findMany({
        where: {
          chain: 'base',
          launchpad: 'clanker',
          createdAt: { gte: windowStart },
        },
        orderBy: { createdAt: 'desc' },
        take: 20, // Limit to avoid overwhelming RPC
      });

      console.log(`[Distribution] Analyzing ${tokens.length} recent tokens`);

      for (const token of tokens) {
        // Check if we've already analyzed this token recently
        const existingSnapshot = await this.prisma.holderSnapshot.findFirst({
          where: {
            tokenAddress: token.tokenAddress,
            chain: 'base',
            timestamp: { gte: windowStart },
          },
        });

        if (existingSnapshot) {
          continue; // Skip if already analyzed in this window
        }

        try {
          const analysis = await this.analyzeToken(
            token.tokenAddress,
            token.creatorAddress,
            token.blockNumber
          );

          if (analysis) {
            await this.storeSnapshot(token.id, analysis);
            await this.checkAndEmitSignal(token, analysis);
          }
        } catch (error) {
          console.warn(`[Distribution] Failed to analyze ${token.tokenAddress}:`, error);
        }
      }
    } catch (error) {
      console.error('[Distribution] Analysis failed:', error);
    }
  }

  /**
   * Analyze holder distribution for a token
   */
  async analyzeToken(
    tokenAddress: string,
    creatorAddress: string,
    fromBlock: bigint
  ): Promise<HolderAnalysis | null> {
    const address = tokenAddress.toLowerCase() as `0x${string}`;
    const creator = creatorAddress.toLowerCase();

    // Get all Transfer events for this token
    await this.rateLimiter.acquire();
    const logs = await withRetry(() =>
      this.client.getLogs({
        address,
        event: TRANSFER_EVENT,
        fromBlock,
        toBlock: 'latest',
      })
    );

    if (logs.length === 0) {
      return null;
    }

    // Build holder balances from transfer events
    const balances = new Map<string, bigint>();
    let totalMinted = 0n;

    for (const log of logs) {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data,
        topics: log.topics,
      });

      const from = decoded.args.from.toLowerCase();
      const to = decoded.args.to.toLowerCase();
      const value = decoded.args.value;

      // Track mints
      if (from === ZERO_ADDRESS) {
        totalMinted += value;
      }

      // Deduct from sender
      if (from !== ZERO_ADDRESS) {
        const current = balances.get(from) || 0n;
        balances.set(from, current - value);
      }

      // Add to receiver
      if (to !== ZERO_ADDRESS) {
        const current = balances.get(to) || 0n;
        balances.set(to, current + value);
      }
    }

    // Filter out zero/negative balances and sort
    const holders = Array.from(balances.entries())
      .filter(([_, balance]) => balance > 0n)
      .map(([address, balance]) => ({
        address,
        balance,
        percent: totalMinted > 0n 
          ? Number((balance * 10000n) / totalMinted) / 100 
          : 0,
      }))
      .sort((a, b) => Number(b.balance - a.balance));

    if (holders.length < this.config.minHolders) {
      return null;
    }

    // Calculate metrics
    const top10 = holders.slice(0, 10);
    const top20 = holders.slice(0, 20);
    const top10Percent = top10.reduce((sum, h) => sum + h.percent, 0);
    const top20Percent = top20.reduce((sum, h) => sum + h.percent, 0);
    
    const creatorHolder = holders.find(h => h.address === creator);
    const creatorPercent = creatorHolder?.percent || 0;

    // Concentration score: weighted average
    // Higher score = more concentrated = riskier
    const concentrationScore = Math.min(100, (
      (top10Percent * 0.5) +
      (creatorPercent * 2) +
      (100 - Math.min(holders.length, 100)) * 0.3
    ));

    return {
      tokenAddress: tokenAddress.toLowerCase(),
      top10Percent,
      top20Percent,
      creatorPercent,
      holderCount: holders.length,
      totalSupply: totalMinted,
      concentrationScore,
      topHolders: top10,
    };
  }

  /**
   * Store holder snapshot
   */
  private async storeSnapshot(tokenId: string, analysis: HolderAnalysis): Promise<void> {
    await this.prisma.holderSnapshot.create({
      data: {
        tokenId,
        tokenAddress: analysis.tokenAddress,
        chain: 'base',
        top10Percent: analysis.top10Percent,
        top20Percent: analysis.top20Percent,
        creatorPercent: analysis.creatorPercent,
        holderCount: analysis.holderCount,
        totalSupply: analysis.totalSupply.toString(),
        concentrationScore: analysis.concentrationScore,
        meta: {
          topHolders: analysis.topHolders.map(h => ({
            address: h.address,
            percent: h.percent,
          })),
        },
      },
    });
  }

  /**
   * Check thresholds and emit signal if exceeded
   */
  private async checkAndEmitSignal(
    token: { tokenAddress: string; tokenSymbol?: string | null },
    analysis: HolderAnalysis
  ): Promise<void> {
    const shouldSignal = 
      analysis.top10Percent >= this.config.top10Threshold ||
      analysis.creatorPercent >= this.config.creatorThreshold;

    if (!shouldSignal) {
      return;
    }

    const severity = 
      analysis.creatorPercent >= 30 || analysis.top10Percent >= 60 ? 'high' :
      analysis.creatorPercent >= 20 || analysis.top10Percent >= 50 ? 'medium' : 'low';

    const issues: string[] = [];
    if (analysis.top10Percent >= this.config.top10Threshold) {
      issues.push(`Top 10 hold ${analysis.top10Percent.toFixed(1)}%`);
    }
    if (analysis.creatorPercent >= this.config.creatorThreshold) {
      issues.push(`Creator holds ${analysis.creatorPercent.toFixed(1)}%`);
    }

    await this.signalService.create({
      severity,
      signalType: 'EarlyDistribution',
      title: 'High token concentration detected',
      summary: `${token.tokenSymbol || 'Token'} shows concentrated distribution: ${issues.join(', ')}`,
      token: token.tokenAddress.toLowerCase() as `0x${string}`,
      tokenSymbol: token.tokenSymbol || undefined,
      chain: 'base',
      strategyId: 'early-distribution',
      evidence: {
        tokenAddress: analysis.tokenAddress,
        top10Percent: analysis.top10Percent,
        top20Percent: analysis.top20Percent,
        creatorPercent: analysis.creatorPercent,
        holderCount: analysis.holderCount,
        concentrationScore: analysis.concentrationScore,
      },
      recommendedAction: severity === 'high' ? 'alert' : 'monitor',
    });

    console.log(`[Distribution] Signal emitted for ${token.tokenAddress}`);
  }

  /**
   * Get analysis for a specific token
   */
  async getTokenAnalysis(tokenAddress: string): Promise<HolderAnalysis | null> {
    const token = await this.prisma.launchpadToken.findFirst({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        chain: 'base',
      },
    });

    if (!token) return null;

    return this.analyzeToken(
      token.tokenAddress,
      token.creatorAddress,
      token.blockNumber
    );
  }
}

/**
 * Create early distribution analyzer
 */
export function createEarlyDistributionAnalyzer(
  prisma: PrismaClient,
  signalService: SignalService,
  config: Partial<DistributionConfig> & { rpcUrl: string }
): EarlyDistributionAnalyzer {
  return new EarlyDistributionAnalyzer(prisma, signalService, config);
}


