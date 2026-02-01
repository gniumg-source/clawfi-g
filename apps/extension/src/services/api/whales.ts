/**
 * ClawFi Extension - Whale Tracking Service
 * 
 * Tracks large wallet transactions and smart money movements
 * Uses public APIs and on-chain data
 */

import type { ChainId, WhaleTransaction, TrackedWallet } from './types';
import { dexscreenerAPI } from './dexscreener';

// Whale thresholds by chain (in USD)
const WHALE_THRESHOLDS: Record<ChainId, number> = {
  ethereum: 50000,
  base: 25000,
  arbitrum: 25000,
  optimism: 25000,
  polygon: 20000,
  bsc: 30000,
  avalanche: 25000,
  solana: 25000,
  sui: 20000,
  aptos: 20000,
  fantom: 15000,
  cronos: 15000,
  moonbeam: 15000,
  celo: 15000,
  gnosis: 15000,
};

// Known wallet labels
const KNOWN_WALLETS: Record<string, string> = {
  // DEXes
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch Router',
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3 Router',
  '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'PancakeSwap Router',
  
  // Bridges
  '0x8eb8a3b98659cce290402893d0123abb75e3ab28': 'Avalanche Bridge',
  '0x3ee18b2214aff97000d974cf647e7c347e8fa585': 'Wormhole Bridge',
  
  // CEXes
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance 14',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance 15',
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': 'Binance 16',
  '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': 'Binance Hot',
  '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be': 'Binance 1',
  '0xf977814e90da44bfa03b6295a0616a897441acec': 'Binance 8',
  '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8': 'Binance 7',
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': 'Coinbase 1',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase 10',
  '0x503828976d22510aad0339f595e83fb66be4e0e4': 'Coinbase 2',
  '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': 'Coinbase 3',
  '0x3cd751e6b0078be393132286c442345e5dc49699': 'Coinbase 4',
  '0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511': 'Coinbase 5',
  '0xeb2629a2734e272bcc07bda959863f316f4bd4cf': 'Coinbase 6',
  '0x02466e547bfdab679fc49e96bbfc62b9747d997c': 'Coinbase 8',
  
  // Famous wallets
  '0xab5801a7d398351b8be11c439e05c5b3259aec9b': 'Vitalik',
  
  // Solana
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1': 'Raydium AMM',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter V6',
};

// Smart money categories
type WalletCategory = 'whale' | 'smart_money' | 'dex' | 'cex' | 'bridge' | 'team' | 'unknown';

interface WhaleAlert {
  type: 'buy' | 'sell' | 'transfer';
  wallet: string;
  walletLabel?: string;
  category: WalletCategory;
  token: string;
  tokenSymbol?: string;
  chain: ChainId;
  amountUsd: number;
  timestamp: number;
  txHash?: string;
}

// ============================================
// WHALE TRACKING CLASS
// ============================================

export class WhaleTracker {
  private alerts: WhaleAlert[] = [];
  private listeners: Array<(alert: WhaleAlert) => void> = [];

  /**
   * Get wallet label
   */
  getWalletLabel(address: string): string | undefined {
    return KNOWN_WALLETS[address.toLowerCase()];
  }

  /**
   * Categorize wallet
   */
  categorizeWallet(address: string): WalletCategory {
    const label = this.getWalletLabel(address);
    if (!label) return 'unknown';
    
    const labelLower = label.toLowerCase();
    if (labelLower.includes('router') || labelLower.includes('swap')) return 'dex';
    if (labelLower.includes('binance') || labelLower.includes('coinbase') || labelLower.includes('kraken')) return 'cex';
    if (labelLower.includes('bridge')) return 'bridge';
    
    return 'whale';
  }

  /**
   * Check if transaction is whale-sized
   */
  isWhaleTransaction(chain: ChainId, amountUsd: number): boolean {
    const threshold = WHALE_THRESHOLDS[chain] || 25000;
    return amountUsd >= threshold;
  }

  /**
   * Get whale threshold for chain
   */
  getWhaleThreshold(chain: ChainId): number {
    return WHALE_THRESHOLDS[chain] || 25000;
  }

  /**
   * Add whale alert listener
   */
  onAlert(callback: (alert: WhaleAlert) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Emit alert to all listeners
   */
  private emitAlert(alert: WhaleAlert): void {
    this.alerts.unshift(alert);
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }
    
    for (const listener of this.listeners) {
      try {
        listener(alert);
      } catch (e) {
        console.error('[WhaleTracker] Listener error:', e);
      }
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 20): WhaleAlert[] {
    return this.alerts.slice(0, limit);
  }

  /**
   * Get alerts for a specific token
   */
  getTokenAlerts(tokenAddress: string, chain: ChainId): WhaleAlert[] {
    return this.alerts.filter(
      a => a.token.toLowerCase() === tokenAddress.toLowerCase() && a.chain === chain
    );
  }

  /**
   * Analyze token for whale activity
   * Returns summary of recent whale movements
   */
  async analyzeWhaleActivity(
    tokenAddress: string,
    chain: ChainId
  ): Promise<{
    totalBuysUsd: number;
    totalSellsUsd: number;
    netFlow: number;
    recentWhales: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
  }> {
    // Get market data to estimate whale activity
    const marketData = await dexscreenerAPI.getTokenMarketData(tokenAddress, chain);
    
    if (!marketData) {
      return {
        totalBuysUsd: 0,
        totalSellsUsd: 0,
        netFlow: 0,
        recentWhales: 0,
        sentiment: 'neutral',
      };
    }

    // Estimate from transaction data
    const { buys, sells } = marketData.txns24h;
    const totalTxns = buys + sells;
    
    // Rough estimation based on volume distribution
    // Assume top 10% of transactions are whales
    const whalePercentage = 0.1;
    const avgTxSize = totalTxns > 0 ? marketData.volume24h / totalTxns : 0;
    const threshold = this.getWhaleThreshold(chain);
    
    // Estimate whale volume (transactions > threshold)
    const estimatedWhaleTxns = Math.floor(totalTxns * whalePercentage);
    const estimatedWhaleVolume = avgTxSize * 3 * estimatedWhaleTxns; // Whales avg 3x normal
    
    const buyRatio = totalTxns > 0 ? buys / totalTxns : 0.5;
    const totalBuysUsd = estimatedWhaleVolume * buyRatio;
    const totalSellsUsd = estimatedWhaleVolume * (1 - buyRatio);
    const netFlow = totalBuysUsd - totalSellsUsd;
    
    let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (netFlow > threshold) {
      sentiment = 'bullish';
    } else if (netFlow < -threshold) {
      sentiment = 'bearish';
    }
    
    return {
      totalBuysUsd,
      totalSellsUsd,
      netFlow,
      recentWhales: estimatedWhaleTxns,
      sentiment,
    };
  }

  /**
   * Get whale accumulation score (0-100)
   * Higher score = more whale buying
   */
  async getAccumulationScore(tokenAddress: string, chain: ChainId): Promise<number> {
    const activity = await this.analyzeWhaleActivity(tokenAddress, chain);
    
    if (activity.totalBuysUsd + activity.totalSellsUsd === 0) {
      return 50; // Neutral
    }
    
    const buyRatio = activity.totalBuysUsd / (activity.totalBuysUsd + activity.totalSellsUsd);
    return Math.round(buyRatio * 100);
  }

  /**
   * Format whale alert for display
   */
  formatAlert(alert: WhaleAlert): string {
    const emoji = alert.type === 'buy' ? '🟢' : alert.type === 'sell' ? '🔴' : '🔵';
    const action = alert.type.toUpperCase();
    const wallet = alert.walletLabel || `${alert.wallet.slice(0, 6)}...${alert.wallet.slice(-4)}`;
    const amount = this.formatUsd(alert.amountUsd);
    
    return `${emoji} ${action}: ${wallet} - $${amount} ${alert.tokenSymbol || ''}`;
  }

  /**
   * Format USD amount
   */
  private formatUsd(amount: number): string {
    if (amount >= 1000000) return (amount / 1000000).toFixed(2) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
    return amount.toFixed(0);
  }

  /**
   * Create simulated whale alert (for testing/demo)
   */
  simulateAlert(
    type: 'buy' | 'sell',
    token: string,
    chain: ChainId,
    amountUsd: number,
    wallet?: string
  ): void {
    const alert: WhaleAlert = {
      type,
      wallet: wallet || '0x' + Math.random().toString(16).slice(2, 42),
      category: 'whale',
      token,
      chain,
      amountUsd,
      timestamp: Date.now(),
    };
    
    this.emitAlert(alert);
  }
}

// Export singleton
export const whaleTracker = new WhaleTracker();
