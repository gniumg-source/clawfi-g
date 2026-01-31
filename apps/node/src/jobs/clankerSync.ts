/**
 * Clanker Token Sync Job
 * 
 * Syncs newly launched tokens from Clanker API into the database.
 * Also generates real-time signals based on token metadata:
 * - New Launch signals for every new token
 * - Warning signals for tokens with Clanker warnings
 * - Low market cap alerts
 * - Rapid creator activity detection
 * 
 * METHODOLOGY:
 * - Fetch latest tokens from Clanker API every N minutes
 * - Store new tokens in LaunchpadToken table
 * - Generate signals based on token metadata
 * 
 * API Docs: https://clanker.gitbook.io/clanker-documentation
 */

import type { PrismaClient } from '@prisma/client';
import type { SignalService } from '../services/signal.js';

// ============================================
// Types
// ============================================

export interface ClankerSyncConfig {
  syncIntervalMinutes: number;
  tokensPerSync: number;
}

interface ClankerToken {
  id: number;
  created_at: string;
  tx_hash: string;
  contract_address: string;
  name: string;
  symbol: string;
  description?: string;
  supply: string;
  img_url?: string;
  pool_address?: string;
  type: string;
  pair: string;
  chain_id: number;
  deployed_at: string;
  msg_sender: string;
  factory_address?: string;
  locker_address?: string;
  position_id?: string;
  warnings: string[];
  metadata?: Record<string, unknown>;
  pool_config?: Record<string, unknown>;
  social_context?: {
    platform?: string;
    messageId?: string;
  };
  extensions?: Record<string, unknown>;
  related?: {
    user?: {
      fid: number;
      username: string;
      displayName?: string;
      pfpUrl?: string;
    };
    market?: {
      marketCap?: number;
      price?: number;
      priceChange24h?: number;
    };
  };
}

interface ClankerResponse {
  data: ClankerToken[];
  total: number;
  cursor?: string;
}

// ============================================
// Constants
// ============================================

const CLANKER_API_URL = 'https://www.clanker.world/api';
const DEFAULT_CONFIG: ClankerSyncConfig = {
  syncIntervalMinutes: 2,
  tokensPerSync: 20,
};

// ============================================
// Clanker Sync Job
// ============================================

export class ClankerSyncJob {
  private config: ClankerSyncConfig;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastCursor: string | undefined;
  private creatorCounts: Map<string, number> = new Map();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly signalService: SignalService | null,
    config: Partial<ClankerSyncConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log(`[ClankerSync] Initialized with signalService: ${signalService ? 'YES' : 'NO'}`);
  }

  /**
   * Start periodic sync
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[ClankerSync] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[ClankerSync] Starting sync every ${this.config.syncIntervalMinutes} minutes`);

    // Run immediately
    this.runSync();
    
    // Then on interval
    this.intervalId = setInterval(
      () => this.runSync(),
      this.config.syncIntervalMinutes * 60 * 1000
    );
  }

  /**
   * Stop sync
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[ClankerSync] Stopped');
  }

  /**
   * Run a single sync
   */
  async runSync(): Promise<number> {
    try {
      console.log('[ClankerSync] Fetching latest tokens from Clanker...');
      
      const response = await this.fetchClankerTokens();
      
      if (!response || !response.data) {
        console.warn('[ClankerSync] No data received from Clanker');
        return 0;
      }

      let newCount = 0;
      
      for (const token of response.data) {
        try {
          const isNew = await this.upsertToken(token);
          if (isNew) newCount++;
        } catch (error) {
          console.warn(`[ClankerSync] Failed to upsert ${token.contract_address}:`, error);
        }
      }

      // Store cursor for next sync
      if (response.cursor) {
        this.lastCursor = response.cursor;
      }

      console.log(`[ClankerSync] Synced ${response.data.length} tokens, ${newCount} new`);
      return newCount;
    } catch (error) {
      console.error('[ClankerSync] Sync failed:', error);
      return 0;
    }
  }

  /**
   * Fetch latest tokens from Clanker API
   */
  private async fetchClankerTokens(): Promise<ClankerResponse | null> {
    try {
      const url = new URL(`${CLANKER_API_URL}/tokens`);
      url.searchParams.set('chainId', '8453'); // Base chain
      url.searchParams.set('limit', String(this.config.tokensPerSync));
      url.searchParams.set('sort', 'desc');
      url.searchParams.set('sortBy', 'deployed-at');
      url.searchParams.set('includeUser', 'true');
      url.searchParams.set('includeMarket', 'true');

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ClawFi-Node/1.0',
        },
      });

      if (!response.ok) {
        console.error(`[ClankerSync] API returned ${response.status}`);
        return null;
      }

      return await response.json() as ClankerResponse;
    } catch (error) {
      console.error('[ClankerSync] Fetch failed:', error);
      return null;
    }
  }

  /**
   * Upsert token into database
   * Returns true if this was a new token
   */
  private async upsertToken(token: ClankerToken): Promise<boolean> {
    const tokenAddress = token.contract_address.toLowerCase();
    
    // Check if token already exists
    const existing = await this.prisma.launchpadToken.findFirst({
      where: {
        tokenAddress,
        chain: 'base',
      },
    });

    if (existing) {
      // Update existing token with latest data
      await this.prisma.launchpadToken.update({
        where: { id: existing.id },
        data: {
          meta: {
            ...(existing.meta as Record<string, unknown> || {}),
            clankerType: token.type,
            pool: token.pool_address,
            pair: token.pair,
            warnings: token.warnings,
            socialContext: token.social_context,
            market: token.related?.market,
            creator: token.related?.user,
            lastSynced: new Date().toISOString(),
          },
        },
      });
      return false;
    }

    // Parse deployed_at timestamp
    let blockTimestamp: Date | undefined;
    try {
      blockTimestamp = new Date(token.deployed_at);
    } catch {
      // ignore
    }

    // Estimate block number from timestamp (Base ~2s blocks)
    // Current Base block is approximately 41.5 million as of Jan 2026
    const deployedAt = blockTimestamp || new Date(token.created_at);
    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - deployedAt.getTime()) / 1000);
    const currentBlock = 41500000n; // Approximate current Base block (Jan 2026)
    const estimatedBlock = currentBlock - BigInt(Math.floor(secondsAgo / 2));

    // Create new token
    await this.prisma.launchpadToken.create({
      data: {
        id: `clanker-${token.id}`,
        chain: 'base',
        launchpad: 'clanker',
        tokenAddress,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        creatorAddress: token.msg_sender.toLowerCase(),
        factoryAddress: token.factory_address?.toLowerCase(),
        txHash: token.tx_hash.toLowerCase(),
        blockNumber: estimatedBlock,
        blockTimestamp,
        version: token.type.replace('clanker_', ''),
        verified: false,
        meta: {
          clankerType: token.type,
          pool: token.pool_address,
          pair: token.pair,
          supply: token.supply,
          imgUrl: token.img_url,
          description: token.description,
          warnings: token.warnings,
          socialContext: token.social_context,
          market: token.related?.market,
          creator: token.related?.user,
          lastSynced: new Date().toISOString(),
        },
      },
    });

    console.log(`[ClankerSync] New token: ${token.symbol} (${tokenAddress.slice(0, 10)}...)`);
    
    // Generate signals for new tokens
    if (this.signalService) {
      try {
        await this.generateSignalsForToken(token);
        console.log(`[ClankerSync] Generated signals for ${token.symbol}`);
      } catch (error) {
        console.error(`[ClankerSync] Failed to generate signals for ${token.symbol}:`, error);
      }
    } else {
      console.log(`[ClankerSync] No signalService available`);
    }
    
    return true;
  }

  /**
   * Generate signals based on token metadata from Clanker
   */
  private async generateSignalsForToken(token: ClankerToken): Promise<void> {
    if (!this.signalService) return;
    
    const tokenAddress = token.contract_address.toLowerCase() as `0x${string}`;
    const marketCap = token.related?.market?.marketCap || 0;
    const creator = token.msg_sender.toLowerCase();
    
    // Track creator activity
    const prevCount = this.creatorCounts.get(creator) || 0;
    this.creatorCounts.set(creator, prevCount + 1);
    
    // 1. New Launch Signal (info level)
    await this.signalService.create({
      severity: 'info',
      signalType: 'LaunchDetected',
      title: `New Clanker launch: ${token.symbol}`,
      summary: `${token.name} ($${token.symbol}) launched on Base via Clanker${token.related?.user ? ` by @${token.related.user.username}` : ''}`,
      token: tokenAddress,
      tokenSymbol: token.symbol,
      chain: 'base',
      strategyId: 'clanker-sync',
      evidence: {
        tokenAddress,
        tokenName: token.name,
        clankerType: token.type,
        creator,
        creatorUsername: token.related?.user?.username,
        marketCap,
        deployedAt: token.deployed_at,
        socialPlatform: token.social_context?.platform,
      },
      recommendedAction: 'monitor',
    });

    // 2. Warning Signal - if Clanker flagged warnings
    if (token.warnings && token.warnings.length > 0) {
      await this.signalService.create({
        severity: 'medium',
        signalType: 'TokenWarning',
        title: `Clanker warning: ${token.symbol}`,
        summary: `${token.symbol} has ${token.warnings.length} warning(s): ${token.warnings.join(', ')}`,
        token: tokenAddress,
        tokenSymbol: token.symbol,
        chain: 'base',
        strategyId: 'clanker-sync',
        evidence: {
          tokenAddress,
          warnings: token.warnings,
          creator,
        },
        recommendedAction: 'alert',
      });
    }

    // 3. Rapid Creator Activity - same creator launching multiple tokens
    if (prevCount >= 2) {
      await this.signalService.create({
        severity: prevCount >= 5 ? 'high' : 'medium',
        signalType: 'RapidCreatorActivity',
        title: `Rapid launch activity: ${prevCount + 1} tokens`,
        summary: `Creator ${creator.slice(0, 10)}... has launched ${prevCount + 1} tokens recently, latest: ${token.symbol}`,
        token: tokenAddress,
        tokenSymbol: token.symbol,
        chain: 'base',
        wallet: creator as `0x${string}`,
        strategyId: 'clanker-sync',
        evidence: {
          tokenAddress,
          creator,
          launchCount: prevCount + 1,
          latestToken: token.symbol,
        },
        recommendedAction: 'monitor',
      });
    }

    // 4. Low Market Cap Alert - token with very low liquidity
    if (marketCap > 0 && marketCap < 1000) {
      await this.signalService.create({
        severity: 'low',
        signalType: 'LowLiquidity',
        title: `Low liquidity: ${token.symbol}`,
        summary: `${token.symbol} has very low market cap: $${marketCap.toFixed(2)}`,
        token: tokenAddress,
        tokenSymbol: token.symbol,
        chain: 'base',
        strategyId: 'clanker-sync',
        evidence: {
          tokenAddress,
          marketCapUsd: marketCap,
        },
        recommendedAction: 'monitor',
      });
    }
  }

  /**
   * Force sync a specific number of tokens
   */
  async syncBatch(limit: number = 100): Promise<number> {
    let total = 0;
    let cursor: string | undefined;
    
    while (total < limit) {
      const batchSize = Math.min(20, limit - total);
      
      try {
        const url = new URL(`${CLANKER_API_URL}/tokens`);
        url.searchParams.set('chainId', '8453');
        url.searchParams.set('limit', String(batchSize));
        url.searchParams.set('sort', 'desc');
        url.searchParams.set('sortBy', 'deployed-at');
        url.searchParams.set('includeUser', 'true');
        url.searchParams.set('includeMarket', 'true');
        if (cursor) url.searchParams.set('cursor', cursor);

        const response = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ClawFi-Node/1.0',
          },
        });

        if (!response.ok) break;
        
        const data = await response.json() as ClankerResponse;
        
        for (const token of data.data) {
          try {
            const isNew = await this.upsertToken(token);
            if (isNew) total++;
          } catch {
            // continue
          }
        }

        cursor = data.cursor;
        if (!cursor || data.data.length < batchSize) break;
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch {
        break;
      }
    }

    console.log(`[ClankerSync] Batch synced ${total} new tokens`);
    return total;
  }
}

/**
 * Create Clanker sync job
 */
export function createClankerSyncJob(
  prisma: PrismaClient,
  signalService: SignalService | null,
  config?: Partial<ClankerSyncConfig>
): ClankerSyncJob {
  return new ClankerSyncJob(prisma, signalService, config);
}

