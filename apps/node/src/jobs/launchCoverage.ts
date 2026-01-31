/**
 * Launch Coverage Verification Job
 * 
 * Answers: "How many Clanker launches did we detect vs how many actually happened?"
 * 
 * Methodology:
 * - Scans Base blocks for transactions TO Clanker factory addresses
 * - Counts candidate deploy transactions (successful txs to factories)
 * - Compares with detected tokens in LaunchpadToken table
 * - Stores coverage statistics
 * 
 * ASSUMPTIONS:
 * 1. Every transaction TO a factory address is a potential token deployment
 * 2. Some transactions may fail or not create tokens (false positives acceptable)
 * 3. Coverage > 100% indicates we're detecting more than factory txs (good)
 * 4. Coverage < 100% indicates potential missed launches
 */

import type { PrismaClient } from '@prisma/client';
import { createPublicClient, http, type PublicClient } from 'viem';
import { base } from 'viem/chains';
import { withRetry, RateLimiter } from '@clawfi/connectors';

// ============================================
// Types
// ============================================

export interface CoverageConfig {
  rpcUrl: string;
  factoryAddresses: string[];
  windowHours: number;
  rateLimit: number;
}

export interface CoverageResult {
  chain: string;
  launchpad: string;
  windowStart: Date;
  windowEnd: Date;
  detectedCount: number;
  estimatedTotal: number;
  coveragePercent: number;
  blockStart: bigint;
  blockEnd: bigint;
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: Partial<CoverageConfig> = {
  windowHours: 24,
  rateLimit: 3, // Conservative RPC rate
};

// Average block time on Base (seconds)
const BASE_BLOCK_TIME = 2;

// ============================================
// Coverage Job
// ============================================

export class LaunchCoverageJob {
  private client: PublicClient;
  private config: CoverageConfig;
  private rateLimiter: RateLimiter;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    config: Partial<CoverageConfig> & { rpcUrl: string; factoryAddresses: string[] }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config } as CoverageConfig;
    
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
   * Start periodic coverage checks
   */
  start(intervalMinutes: number = 60): void {
    if (this.isRunning) {
      console.warn('[Coverage] Job already running');
      return;
    }

    this.isRunning = true;
    console.log(`[Coverage] Starting periodic checks every ${intervalMinutes} minutes`);

    // Run immediately, then on interval
    this.runCoverageCheck();
    this.intervalId = setInterval(
      () => this.runCoverageCheck(),
      intervalMinutes * 60 * 1000
    );
  }

  /**
   * Stop periodic checks
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Coverage] Job stopped');
  }

  /**
   * Run a single coverage check
   */
  async runCoverageCheck(): Promise<CoverageResult | null> {
    try {
      console.log('[Coverage] Running coverage check...');
      const result = await this.calculateCoverage();
      
      if (result) {
        await this.storeCoverageResult(result);
        await this.storeMetric('coverage_percent', result.coveragePercent);
        await this.storeMetric('launches_detected', result.detectedCount);
        await this.storeMetric('launches_estimated', result.estimatedTotal);
        
        console.log(
          `[Coverage] ${result.coveragePercent.toFixed(1)}% coverage ` +
          `(${result.detectedCount}/${result.estimatedTotal})`
        );
      }

      return result;
    } catch (error) {
      console.error('[Coverage] Check failed:', error);
      return null;
    }
  }

  /**
   * Calculate coverage for the configured window
   */
  async calculateCoverage(): Promise<CoverageResult | null> {
    if (this.config.factoryAddresses.length === 0) {
      console.warn('[Coverage] No factory addresses configured');
      return null;
    }

    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - this.config.windowHours * 60 * 60 * 1000);

    // Get current block
    const currentBlock = await withRetry(
      async () => {
        await this.rateLimiter.acquire();
        return this.client.getBlockNumber();
      }
    );

    // Estimate block range for window
    const blocksPerHour = Math.floor(3600 / BASE_BLOCK_TIME);
    const blocksInWindow = BigInt(blocksPerHour * this.config.windowHours);
    const blockStart = currentBlock - blocksInWindow;
    const blockEnd = currentBlock;

    // Count transactions to factory addresses in window
    const estimatedTotal = await this.countFactoryTransactions(blockStart, blockEnd);

    // Count detected tokens in window
    const detectedCount = await this.prisma.launchpadToken.count({
      where: {
        chain: 'base',
        launchpad: 'clanker',
        createdAt: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    });

    // Calculate coverage percentage
    const coveragePercent = estimatedTotal > 0 
      ? (detectedCount / estimatedTotal) * 100 
      : 100;

    return {
      chain: 'base',
      launchpad: 'clanker',
      windowStart,
      windowEnd,
      detectedCount,
      estimatedTotal,
      coveragePercent,
      blockStart,
      blockEnd,
    };
  }

  /**
   * Count transactions to factory addresses in block range
   */
  private async countFactoryTransactions(
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<number> {
    const factories = new Set(
      this.config.factoryAddresses.map(a => a.toLowerCase())
    );

    let total = 0;
    const batchSize = 1000n; // Blocks per batch to avoid RPC limits

    for (let start = fromBlock; start <= toBlock; start += batchSize) {
      const end = start + batchSize > toBlock ? toBlock : start + batchSize;

      try {
        // Get logs from factory addresses
        // We look for any logs emitted by the factories as proxy for activity
        await this.rateLimiter.acquire();
        const logs = await withRetry(() =>
          this.client.getLogs({
            address: this.config.factoryAddresses.map(a => a as `0x${string}`),
            fromBlock: start,
            toBlock: end,
          })
        );

        // Count unique transactions
        const uniqueTxs = new Set(logs.map(l => l.transactionHash));
        total += uniqueTxs.size;
      } catch (error) {
        // Log but continue - we want best effort coverage
        console.warn(`[Coverage] Error scanning blocks ${start}-${end}:`, error);
      }
    }

    return total;
  }

  /**
   * Store coverage result in database
   */
  private async storeCoverageResult(result: CoverageResult): Promise<void> {
    await this.prisma.launchpadCoverage.create({
      data: {
        chain: result.chain,
        launchpad: result.launchpad,
        windowStart: result.windowStart,
        windowEnd: result.windowEnd,
        detectedCount: result.detectedCount,
        estimatedTotal: result.estimatedTotal,
        coveragePercent: result.coveragePercent,
        blockStart: result.blockStart,
        blockEnd: result.blockEnd,
        meta: {
          windowHours: this.config.windowHours,
          factoryCount: this.config.factoryAddresses.length,
        },
      },
    });
  }

  /**
   * Store a metric value
   */
  private async storeMetric(name: string, value: number): Promise<void> {
    await this.prisma.systemMetric.create({
      data: {
        name,
        value,
        labels: {
          chain: 'base',
          launchpad: 'clanker',
        },
      },
    });
  }

  /**
   * Get latest coverage for a launchpad
   */
  async getLatestCoverage(
    chain: string = 'base',
    launchpad: string = 'clanker'
  ): Promise<CoverageResult | null> {
    const coverage = await this.prisma.launchpadCoverage.findFirst({
      where: { chain, launchpad },
      orderBy: { windowEnd: 'desc' },
    });

    if (!coverage) return null;

    return {
      chain: coverage.chain,
      launchpad: coverage.launchpad,
      windowStart: coverage.windowStart,
      windowEnd: coverage.windowEnd,
      detectedCount: coverage.detectedCount,
      estimatedTotal: coverage.estimatedTotal,
      coveragePercent: coverage.coveragePercent,
      blockStart: coverage.blockStart,
      blockEnd: coverage.blockEnd,
    };
  }
}

/**
 * Create launch coverage job
 */
export function createLaunchCoverageJob(
  prisma: PrismaClient,
  config: Partial<CoverageConfig> & { rpcUrl: string; factoryAddresses: string[] }
): LaunchCoverageJob {
  return new LaunchCoverageJob(prisma, config);
}


