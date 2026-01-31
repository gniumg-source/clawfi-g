/**
 * MoltWatch Strategy - Hardened
 * 
 * Detects "wallet molt" patterns where large holders rotate out of positions.
 * 
 * Molt Detection Criteria (to reduce false positives):
 * 1. Position must be >= minPositionUsd
 * 2. Sell must be >= moltThresholdPercent of baseline position
 * 3. Follow-up buy into another token OR bridge transfer within rotationWindowMinutes
 * 
 * State is tracked per wallet:token pair in wallet_positions table.
 */

import type { PrismaClient } from '@prisma/client';
import type { Event, Signal, CreateSignal, Chain } from '@clawfi/core';
import type { Redis } from 'ioredis';

// ============================================
// Types
// ============================================

export interface MoltWatchConfig {
  minPositionUsd: number;        // Minimum position value to track (default: 1000)
  moltThresholdPercent: number;  // Min % of position sold to trigger (default: 50)
  rotationWindowMinutes: number; // Time window to detect rotation (default: 60)
  cooldownMinutes: number;       // Cooldown between alerts for same wallet (default: 30)
  watchlistOnly: boolean;        // Only track wallets in watchlist (default: false)
  watchlist: string[];           // Wallet addresses to watch (if watchlistOnly=true)
}

export interface WalletPosition {
  chain: string;
  wallet: string;
  token: string;
  tokenSymbol?: string;
  baselineAmount: string;
  baselineUsd?: number;
  currentAmount: string;
  currentUsd?: number;
  lastBuyTs?: Date;
  lastSellTs?: Date;
  lastBuyTxHash?: string;
  lastSellTxHash?: string;
}

export interface MoltDetection {
  wallet: string;
  fromToken: string;
  fromTokenSymbol?: string;
  toToken?: string;
  toTokenSymbol?: string;
  percentSold: number;
  timeDeltaMinutes?: number;
  sellTxHash: string;
  buyTxHash?: string;
  sellAmountUsd?: number;
  buyAmountUsd?: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: MoltWatchConfig = {
  minPositionUsd: 1000,
  moltThresholdPercent: 50,
  rotationWindowMinutes: 60,
  cooldownMinutes: 30,
  watchlistOnly: false,
  watchlist: [],
};

// Event types we care about
const TRANSFER_EVENT = 'transfer';
const SWAP_EVENT = 'swap';
const BRIDGE_OUT_EVENT = 'bridge_out';
const BRIDGE_IN_EVENT = 'bridge_in';

// ============================================
// MoltWatch Strategy
// ============================================

export class MoltWatchStrategy {
  private readonly config: MoltWatchConfig;
  private readonly strategyId = 'moltwatch';

  // In-memory pending sells (wallet -> token -> sell info)
  private pendingSells: Map<string, Map<string, {
    sellTs: number;
    sellTxHash: string;
    percentSold: number;
    amountSold: string;
    amountUsd?: number;
    tokenSymbol?: string;
  }>> = new Map();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    config?: Partial<MoltWatchConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process an event and return any signals
   */
  async processEvent(event: Event): Promise<CreateSignal[]> {
    const signals: CreateSignal[] = [];

    // Skip if watchlist mode and wallet not in watchlist
    if (this.config.watchlistOnly && event.wallet) {
      if (!this.config.watchlist.includes(event.wallet.toLowerCase())) {
        return signals;
      }
    }

    switch (event.type) {
      case TRANSFER_EVENT:
      case SWAP_EVENT:
        await this.processTransferOrSwap(event, signals);
        break;

      case BRIDGE_OUT_EVENT:
      case BRIDGE_IN_EVENT:
        await this.processBridgeEvent(event, signals);
        break;
    }

    return signals;
  }

  /**
   * Process transfer or swap event
   */
  private async processTransferOrSwap(event: Event, signals: CreateSignal[]): Promise<void> {
    const token = event.tokenIn || event.tokenOut;
    if (!event.wallet || !token || !event.chain) return;

    const walletLower = event.wallet.toLowerCase();
    const tokenLower = token.toLowerCase();

    // Determine if buy or sell based on event data
    const isSell = this.isSellEvent(event);
    const isBuy = this.isBuyEvent(event);

    if (isSell) {
      await this.handleSell(event, walletLower, tokenLower, signals);
    }

    if (isBuy) {
      await this.handleBuy(event, walletLower, tokenLower, signals);
    }
  }

  /**
   * Check if event is a sell
   */
  private isSellEvent(event: Event): boolean {
    if (!event.meta) return false;
    const meta = event.meta as Record<string, unknown>;
    
    // Check for explicit direction
    if (meta.direction === 'sell' || meta.side === 'sell') return true;
    
    // Check for outgoing transfer
    if (meta.from && String(meta.from).toLowerCase() === event.wallet?.toLowerCase()) {
      return true;
    }

    // Check for negative amount change
    if (typeof meta.amountChange === 'number' && meta.amountChange < 0) {
      return true;
    }

    return false;
  }

  /**
   * Check if event is a buy
   */
  private isBuyEvent(event: Event): boolean {
    if (!event.meta) return false;
    const meta = event.meta as Record<string, unknown>;
    
    // Check for explicit direction
    if (meta.direction === 'buy' || meta.side === 'buy') return true;
    
    // Check for incoming transfer
    if (meta.to && String(meta.to).toLowerCase() === event.wallet?.toLowerCase()) {
      return true;
    }

    // Check for positive amount change
    if (typeof meta.amountChange === 'number' && meta.amountChange > 0) {
      return true;
    }

    return false;
  }

  /**
   * Handle sell event
   */
  private async handleSell(
    event: Event,
    wallet: string,
    token: string,
    signals: CreateSignal[]
  ): Promise<void> {
    // Get or create position
    const position = await this.getOrCreatePosition(event.chain!, wallet, token);
    
    if (!position) return;

    const meta = event.meta as Record<string, unknown> | undefined;
    const amountSold = String(meta?.amount || meta?.amountChange || '0');
    const amountUsd = typeof meta?.amountUsd === 'number' ? meta.amountUsd : undefined;

    // Check if position meets minimum threshold
    const positionUsd = position.baselineUsd ?? position.currentUsd ?? 0;
    if (positionUsd < this.config.minPositionUsd) {
      return;
    }

    // Calculate percent sold
    const baseline = BigInt(position.baselineAmount || '0');
    const sold = BigInt(amountSold.replace(/[^0-9-]/g, '') || '0');
    
    if (baseline <= 0n) return;

    const percentSold = Number((sold * 100n) / baseline);

    // Check if meets molt threshold
    if (percentSold < this.config.moltThresholdPercent) {
      return;
    }

    // Record pending sell for rotation detection
    if (!this.pendingSells.has(wallet)) {
      this.pendingSells.set(wallet, new Map());
    }
    
    this.pendingSells.get(wallet)!.set(token, {
      sellTs: event.ts,
      sellTxHash: String(meta?.txHash || event.id),
      percentSold,
      amountSold,
      amountUsd,
      tokenSymbol: meta?.tokenSymbol as string | undefined,
    });

    // Update position in DB
    await this.updatePositionSell(event.chain!, wallet, token, amountSold, meta?.txHash as string);

    // Check for immediate rotation (if buy happens in same event batch)
    await this.checkRotation(wallet, token, signals, event);
  }

  /**
   * Handle buy event
   */
  private async handleBuy(
    event: Event,
    wallet: string,
    token: string,
    signals: CreateSignal[]
  ): Promise<void> {
    // Update position in DB
    const meta = event.meta as Record<string, unknown> | undefined;
    const amountBought = String(meta?.amount || meta?.amountChange || '0');
    
    await this.updatePositionBuy(
      event.chain!,
      wallet,
      token,
      amountBought,
      meta?.tokenSymbol as string | undefined,
      meta?.txHash as string
    );

    // Check if this completes a rotation
    await this.checkRotation(wallet, token, signals, event);
  }

  /**
   * Check for completed rotation pattern
   */
  private async checkRotation(
    wallet: string,
    newToken: string,
    signals: CreateSignal[],
    event: Event
  ): Promise<void> {
    const walletSells = this.pendingSells.get(wallet);
    if (!walletSells || walletSells.size === 0) return;

    const windowMs = this.config.rotationWindowMinutes * 60 * 1000;
    const now = event.ts;

    // Check each pending sell for rotation
    for (const [fromToken, sellInfo] of walletSells) {
      // Skip if rotation to same token
      if (fromToken === newToken) continue;

      // Skip if outside time window
      if (now - sellInfo.sellTs > windowMs) {
        walletSells.delete(fromToken);
        continue;
      }

      // Check cooldown
      const cooldownKey = `moltwatch:cooldown:${wallet}`;
      const lastAlert = await this.redis.get(cooldownKey);
      if (lastAlert && now - parseInt(lastAlert, 10) < this.config.cooldownMinutes * 60 * 1000) {
        continue;
      }

      // Rotation detected!
      const timeDeltaMinutes = Math.round((now - sellInfo.sellTs) / 60000);
      const meta = event.meta as Record<string, unknown> | undefined;

      const detection: MoltDetection = {
        wallet,
        fromToken,
        fromTokenSymbol: sellInfo.tokenSymbol,
        toToken: newToken,
        toTokenSymbol: meta?.tokenSymbol as string | undefined,
        percentSold: sellInfo.percentSold,
        timeDeltaMinutes,
        sellTxHash: sellInfo.sellTxHash,
        buyTxHash: String(meta?.txHash || ''),
        sellAmountUsd: sellInfo.amountUsd,
        buyAmountUsd: typeof meta?.amountUsd === 'number' ? meta.amountUsd : undefined,
      };

      // Create signal
      signals.push(this.createMoltSignal(detection, event.chain!));

      // Set cooldown
      await this.redis.set(cooldownKey, String(now), 'EX', this.config.cooldownMinutes * 60);

      // Clear the pending sell
      walletSells.delete(fromToken);
    }
  }

  /**
   * Process bridge event (also counts as rotation)
   */
  private async processBridgeEvent(event: Event, signals: CreateSignal[]): Promise<void> {
    if (!event.wallet || !event.chain) return;

    const walletLower = event.wallet.toLowerCase();
    const walletSells = this.pendingSells.get(walletLower);
    
    if (!walletSells || walletSells.size === 0) return;

    const windowMs = this.config.rotationWindowMinutes * 60 * 1000;
    const now = event.ts;
    const meta = event.meta as Record<string, unknown> | undefined;

    // Bridge could complete any pending rotation
    for (const [fromToken, sellInfo] of walletSells) {
      if (now - sellInfo.sellTs > windowMs) {
        walletSells.delete(fromToken);
        continue;
      }

      const cooldownKey = `moltwatch:cooldown:${walletLower}`;
      const lastAlert = await this.redis.get(cooldownKey);
      if (lastAlert && now - parseInt(lastAlert, 10) < this.config.cooldownMinutes * 60 * 1000) {
        continue;
      }

      const detection: MoltDetection = {
        wallet: walletLower,
        fromToken,
        fromTokenSymbol: sellInfo.tokenSymbol,
        toToken: `bridge:${meta?.toChain || 'unknown'}`,
        percentSold: sellInfo.percentSold,
        timeDeltaMinutes: Math.round((now - sellInfo.sellTs) / 60000),
        sellTxHash: sellInfo.sellTxHash,
        buyTxHash: String(meta?.txHash || ''),
        sellAmountUsd: sellInfo.amountUsd,
      };

      signals.push(this.createMoltSignal(detection, event.chain));
      await this.redis.set(cooldownKey, String(now), 'EX', this.config.cooldownMinutes * 60);
      walletSells.delete(fromToken);
    }
  }

  /**
   * Create molt detection signal
   */
  private createMoltSignal(detection: MoltDetection, chain: Chain): CreateSignal {
    const fromSymbol = detection.fromTokenSymbol || detection.fromToken.slice(0, 10);
    const toSymbol = detection.toTokenSymbol || detection.toToken?.slice(0, 10) || 'unknown';

    return {
      severity: 'high',
      signalType: 'MoltDetected',
      title: 'Wallet molt detected',
      summary: `Wallet ${detection.wallet.slice(0, 8)}... sold ${detection.percentSold}% of ${fromSymbol} and rotated into ${toSymbol} within ${detection.timeDeltaMinutes}min`,
      token: detection.fromToken,
      tokenSymbol: detection.fromTokenSymbol,
      chain,
      wallet: detection.wallet,
      strategyId: this.strategyId,
      evidence: {
        wallet: detection.wallet,
        fromToken: detection.fromToken,
        fromTokenSymbol: detection.fromTokenSymbol,
        toToken: detection.toToken,
        toTokenSymbol: detection.toTokenSymbol,
        percentSold: detection.percentSold,
        timeDeltaMinutes: detection.timeDeltaMinutes,
        sellTxHash: detection.sellTxHash,
        buyTxHash: detection.buyTxHash,
        sellAmountUsd: detection.sellAmountUsd,
        buyAmountUsd: detection.buyAmountUsd,
      },
      recommendedAction: 'alert',
    };
  }

  /**
   * Get or create wallet position
   */
  private async getOrCreatePosition(
    chain: string,
    wallet: string,
    token: string
  ): Promise<WalletPosition | null> {
    const position = await this.prisma.walletPosition.findUnique({
      where: {
        chain_wallet_token: { chain, wallet, token },
      },
    });

    if (position) {
      return {
        chain: position.chain,
        wallet: position.wallet,
        token: position.token,
        tokenSymbol: position.tokenSymbol ?? undefined,
        baselineAmount: position.baselineAmount,
        baselineUsd: position.baselineUsd ?? undefined,
        currentAmount: position.currentAmount,
        currentUsd: position.currentUsd ?? undefined,
        lastBuyTs: position.lastBuyTs ?? undefined,
        lastSellTs: position.lastSellTs ?? undefined,
      };
    }

    return null;
  }

  /**
   * Update position after sell
   */
  private async updatePositionSell(
    chain: string,
    wallet: string,
    token: string,
    amountSold: string,
    txHash?: string
  ): Promise<void> {
    const existing = await this.prisma.walletPosition.findUnique({
      where: { chain_wallet_token: { chain, wallet, token } },
    });

    if (!existing) return;

    const current = BigInt(existing.currentAmount || '0');
    const sold = BigInt(amountSold.replace(/[^0-9-]/g, '') || '0');
    const newAmount = current - (sold < 0n ? -sold : sold);

    await this.prisma.walletPosition.update({
      where: { chain_wallet_token: { chain, wallet, token } },
      data: {
        currentAmount: newAmount.toString(),
        lastSellTs: new Date(),
        lastSellTxHash: txHash,
      },
    });
  }

  /**
   * Update position after buy
   */
  private async updatePositionBuy(
    chain: string,
    wallet: string,
    token: string,
    amountBought: string,
    tokenSymbol?: string,
    txHash?: string
  ): Promise<void> {
    const bought = BigInt(amountBought.replace(/[^0-9]/g, '') || '0');

    await this.prisma.walletPosition.upsert({
      where: { chain_wallet_token: { chain, wallet, token } },
      create: {
        chain,
        wallet,
        token,
        tokenSymbol,
        baselineAmount: bought.toString(),
        currentAmount: bought.toString(),
        lastBuyTs: new Date(),
        lastBuyTxHash: txHash,
      },
      update: {
        currentAmount: {
          // This is a simplification; in production would do proper BigInt arithmetic
          set: bought.toString(),
        },
        lastBuyTs: new Date(),
        lastBuyTxHash: txHash,
        tokenSymbol: tokenSymbol || undefined,
      },
    });
  }

  /**
   * Update position baseline (called periodically or on significant events)
   */
  async updateBaseline(chain: string, wallet: string, token: string, amount: string, usd?: number): Promise<void> {
    await this.prisma.walletPosition.upsert({
      where: { chain_wallet_token: { chain, wallet, token } },
      create: {
        chain,
        wallet,
        token,
        baselineAmount: amount,
        baselineUsd: usd,
        currentAmount: amount,
        currentUsd: usd,
      },
      update: {
        baselineAmount: amount,
        baselineUsd: usd,
        currentAmount: amount,
        currentUsd: usd,
      },
    });
  }

  /**
   * Get strategy configuration
   */
  getConfig(): MoltWatchConfig {
    return { ...this.config };
  }

  /**
   * Clean up expired pending sells
   */
  cleanup(): void {
    const windowMs = this.config.rotationWindowMinutes * 60 * 1000;
    const now = Date.now();

    for (const [wallet, tokenSells] of this.pendingSells) {
      for (const [token, sellInfo] of tokenSells) {
        if (now - sellInfo.sellTs > windowMs) {
          tokenSells.delete(token);
        }
      }
      if (tokenSells.size === 0) {
        this.pendingSells.delete(wallet);
      }
    }
  }
}

/**
 * Create MoltWatch strategy instance
 */
export function createMoltWatchStrategy(
  prisma: PrismaClient,
  redis: Redis,
  config?: Partial<MoltWatchConfig>
): MoltWatchStrategy {
  return new MoltWatchStrategy(prisma, redis, config);
}
