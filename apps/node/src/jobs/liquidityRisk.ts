/**
 * Liquidity Risk Detection Job
 * 
 * Monitors liquidity changes for recently launched tokens.
 * Emits LiquidityRisk signals when:
 * - Liquidity is removed within first 24h
 * - Liquidity drops >= threshold (default 50%)
 * 
 * METHODOLOGY:
 * - Track LP events for Uniswap V2/V3 style pools
 * - Compare snapshots over time
 * - Detect significant removals
 * 
 * ASSUMPTIONS:
 * 1. Most Clanker tokens use Uniswap V2 style pools
 * 2. Pair created via factory with standard events
 * 3. Sync events indicate liquidity state changes
 */

import type { PrismaClient } from '@prisma/client';
import { createPublicClient, http, type PublicClient, parseAbiItem, decodeEventLog, formatEther } from 'viem';
import { base } from 'viem/chains';
import { withRetry, RateLimiter } from '@clawfi/connectors';
import type { SignalService } from '../services/signal.js';

// ============================================
// Types
// ============================================

export interface LiquidityConfig {
  rpcUrl: string;
  monitorWindowHours: number;    // Monitor tokens launched within this window
  dropThresholdPercent: number;  // Signal if liquidity drops >= X%
  minLiquidityUsd: number;       // Minimum liquidity to track
  rateLimit: number;
}

export interface LiquidityState {
  tokenAddress: string;
  poolAddress?: string;
  liquidityUsd: number;
  liquidityToken: bigint;
  liquidityEth: bigint;
  timestamp: Date;
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: Partial<LiquidityConfig> = {
  monitorWindowHours: 24,
  dropThresholdPercent: 50,
  minLiquidityUsd: 100,
  rateLimit: 3,
};

// Uniswap V2 events
const SYNC_EVENT = parseAbiItem('event Sync(uint112 reserve0, uint112 reserve1)');
const MINT_EVENT = parseAbiItem('event Mint(address indexed sender, uint256 amount0, uint256 amount1)');
const BURN_EVENT = parseAbiItem('event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)');

// Uniswap V2 Factory on Base
const UNISWAP_V2_FACTORY = '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6';

// ============================================
// Liquidity Risk Detector
// ============================================

export class LiquidityRiskDetector {
  private client: PublicClient;
  private config: LiquidityConfig;
  private rateLimiter: RateLimiter;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly signalService: SignalService,
    config: Partial<LiquidityConfig> & { rpcUrl: string }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config } as LiquidityConfig;

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
   * Start periodic monitoring
   */
  start(intervalMinutes: number = 10): void {
    if (this.isRunning) {
      console.warn('[Liquidity] Detector already running');
      return;
    }

    this.isRunning = true;
    console.log(`[Liquidity] Starting monitoring every ${intervalMinutes} minutes`);

    this.runMonitoring();
    this.intervalId = setInterval(
      () => this.runMonitoring(),
      intervalMinutes * 60 * 1000
    );
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Liquidity] Detector stopped');
  }

  /**
   * Run liquidity monitoring
   */
  async runMonitoring(): Promise<void> {
    try {
      const windowStart = new Date(
        Date.now() - this.config.monitorWindowHours * 60 * 60 * 1000
      );

      // Get tokens launched within monitoring window
      const tokens = await this.prisma.launchpadToken.findMany({
        where: {
          chain: 'base',
          launchpad: 'clanker',
          createdAt: { gte: windowStart },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      console.log(`[Liquidity] Monitoring ${tokens.length} tokens`);

      for (const token of tokens) {
        try {
          await this.monitorTokenLiquidity(token);
        } catch (error) {
          console.warn(`[Liquidity] Failed to monitor ${token.tokenAddress}:`, error);
        }
      }
    } catch (error) {
      console.error('[Liquidity] Monitoring failed:', error);
    }
  }

  /**
   * Monitor liquidity for a single token
   */
  private async monitorTokenLiquidity(token: {
    id: string;
    tokenAddress: string;
    tokenSymbol?: string | null;
    blockNumber: bigint;
  }): Promise<void> {
    const address = token.tokenAddress.toLowerCase() as `0x${string}`;

    // Try to find the LP pair
    const poolAddress = await this.findLiquidityPool(address);
    if (!poolAddress) {
      return; // No pool found
    }

    // Get current liquidity state
    const currentState = await this.getLiquidityState(address, poolAddress);
    if (!currentState) {
      return;
    }

    // Get previous snapshot
    const previousSnapshot = await this.prisma.liquiditySnapshot.findFirst({
      where: {
        tokenAddress: token.tokenAddress.toLowerCase(),
        chain: 'base',
      },
      orderBy: { timestamp: 'desc' },
    });

    // Store current snapshot
    await this.storeSnapshot(token.id, currentState, previousSnapshot ? 'snapshot' : 'initial');

    // Check for significant changes
    if (previousSnapshot) {
      const previousLiquidity = previousSnapshot.liquidityUsd;
      const currentLiquidity = currentState.liquidityUsd;

      if (previousLiquidity > this.config.minLiquidityUsd && currentLiquidity < previousLiquidity) {
        const dropPercent = ((previousLiquidity - currentLiquidity) / previousLiquidity) * 100;

        if (dropPercent >= this.config.dropThresholdPercent) {
          await this.emitLiquiditySignal(token, previousLiquidity, currentLiquidity, dropPercent);
        }
      }
    }
  }

  /**
   * Find liquidity pool for token
   */
  private async findLiquidityPool(tokenAddress: `0x${string}`): Promise<`0x${string}` | null> {
    // Try to get pair from factory
    // This is a simplified approach - production would need more robust pool detection
    try {
      await this.rateLimiter.acquire();
      
      // WETH on Base
      const WETH = '0x4200000000000000000000000000000000000006' as const;
      
      const pairAddress = await this.client.readContract({
        address: UNISWAP_V2_FACTORY as `0x${string}`,
        abi: [parseAbiItem('function getPair(address, address) view returns (address)')],
        functionName: 'getPair',
        args: [tokenAddress, WETH],
      });

      if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
        return pairAddress as `0x${string}`;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get current liquidity state
   */
  private async getLiquidityState(
    tokenAddress: `0x${string}`,
    poolAddress: `0x${string}`
  ): Promise<LiquidityState | null> {
    try {
      await this.rateLimiter.acquire();
      
      // Get reserves from pair
      const reserves = await this.client.readContract({
        address: poolAddress,
        abi: [parseAbiItem('function getReserves() view returns (uint112, uint112, uint32)')],
        functionName: 'getReserves',
      });

      // Get token0 to determine which reserve is which
      const token0 = await this.client.readContract({
        address: poolAddress,
        abi: [parseAbiItem('function token0() view returns (address)')],
        functionName: 'token0',
      });

      const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
      const tokenReserve = isToken0 ? reserves[0] : reserves[1];
      const ethReserve = isToken0 ? reserves[1] : reserves[0];

      // Estimate USD value (using ETH price approximation)
      // In production, would fetch actual ETH price
      const ethPrice = 3000; // Placeholder
      const liquidityUsd = Number(formatEther(ethReserve)) * ethPrice * 2;

      return {
        tokenAddress: tokenAddress.toLowerCase(),
        poolAddress: poolAddress.toLowerCase(),
        liquidityUsd,
        liquidityToken: tokenReserve,
        liquidityEth: ethReserve,
        timestamp: new Date(),
      };
    } catch (error) {
      console.debug(`[Liquidity] Failed to get state for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Store liquidity snapshot
   */
  private async storeSnapshot(
    tokenId: string,
    state: LiquidityState,
    eventType: string
  ): Promise<void> {
    await this.prisma.liquiditySnapshot.create({
      data: {
        tokenId,
        tokenAddress: state.tokenAddress,
        chain: 'base',
        poolAddress: state.poolAddress,
        dex: 'uniswap_v2',
        liquidityUsd: state.liquidityUsd,
        liquidityToken: state.liquidityToken.toString(),
        liquidityEth: state.liquidityEth.toString(),
        eventType,
      },
    });
  }

  /**
   * Emit liquidity risk signal
   */
  private async emitLiquiditySignal(
    token: { tokenAddress: string; tokenSymbol?: string | null },
    previousLiquidity: number,
    currentLiquidity: number,
    dropPercent: number
  ): Promise<void> {
    const severity = 
      dropPercent >= 80 ? 'critical' :
      dropPercent >= 60 ? 'high' : 'medium';

    await this.signalService.create({
      severity,
      signalType: 'LiquidityRisk',
      title: 'Significant liquidity removal detected',
      summary: `${token.tokenSymbol || 'Token'} liquidity dropped ${dropPercent.toFixed(1)}% ($${previousLiquidity.toFixed(0)} → $${currentLiquidity.toFixed(0)})`,
      token: token.tokenAddress.toLowerCase() as `0x${string}`,
      tokenSymbol: token.tokenSymbol || undefined,
      chain: 'base',
      strategyId: 'liquidity-risk',
      evidence: {
        tokenAddress: token.tokenAddress.toLowerCase(),
        previousLiquidityUsd: previousLiquidity,
        currentLiquidityUsd: currentLiquidity,
        deltaPercent: -dropPercent,
      },
      recommendedAction: severity === 'critical' ? 'alert' : 'monitor',
    });

    console.log(`[Liquidity] Signal emitted for ${token.tokenAddress}: -${dropPercent.toFixed(1)}%`);
  }

  /**
   * Get liquidity history for a token
   */
  async getTokenLiquidityHistory(tokenAddress: string): Promise<LiquidityState[]> {
    const snapshots = await this.prisma.liquiditySnapshot.findMany({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        chain: 'base',
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return snapshots.map(s => ({
      tokenAddress: s.tokenAddress,
      poolAddress: s.poolAddress || undefined,
      liquidityUsd: s.liquidityUsd,
      liquidityToken: BigInt(s.liquidityToken),
      liquidityEth: s.liquidityEth ? BigInt(s.liquidityEth) : 0n,
      timestamp: s.timestamp,
    }));
  }
}

/**
 * Create liquidity risk detector
 */
export function createLiquidityRiskDetector(
  prisma: PrismaClient,
  signalService: SignalService,
  config: Partial<LiquidityConfig> & { rpcUrl: string }
): LiquidityRiskDetector {
  return new LiquidityRiskDetector(prisma, signalService, config);
}


