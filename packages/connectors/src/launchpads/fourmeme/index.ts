/**
 * FourMeme Connector
 * 
 * Monitors new token launches on Four.meme (BSC)
 * 
 * Four.meme is a memecoin launchpad on BNB Smart Chain with 
 * bonding curves similar to Pump.fun.
 */

import type { LaunchpadConnector, LaunchpadToken, LaunchpadChain } from '../../types.js';

// ============================================
// Types
// ============================================

export interface FourMemeConfig {
  enabled?: boolean;
  pollIntervalMs?: number;
  maxTokensPerRequest?: number;
  minMarketCapUsd?: number;
}

export interface FourMemeToken {
  address: string;
  symbol: string;
  name: string;
  image?: string;
  description?: string;
  creator?: string;
  createdAt?: string;
  launchAt?: number;
  marketCap?: number;
  priceUsd?: number;
  holders?: number;
  volume24h?: number;
  priceChange24h?: number;
  bondingCurve?: string;
  graduated?: boolean;
  pancakePool?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  status?: 'active' | 'graduated' | 'failed';
}

export interface FourMemeApiResponse {
  success?: boolean;
  code?: number;
  data?: FourMemeToken[] | { list?: FourMemeToken[]; total?: number };
  message?: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG: Required<FourMemeConfig> = {
  enabled: true,
  pollIntervalMs: 15000,
  maxTokensPerRequest: 50,
  minMarketCapUsd: 0,
};

// Four.meme API is GraphQL-only (Bitquery), use GeckoTerminal for BSC data as fallback
const GECKOTERMINAL_API_URL = 'https://api.geckoterminal.com/api/v2';
const BSCSCAN_URL = 'https://bscscan.com';

// ============================================
// FourMeme Connector
// ============================================

export class FourMemeConnector implements LaunchpadConnector {
  readonly id = 'fourmeme';
  readonly name = 'Four.meme';
  readonly chain: LaunchpadChain = 'bsc';
  readonly type = 'launchpad' as const;

  private config: Required<FourMemeConfig>;
  private lastFetchTime = 0;
  private lastTokenAddresses = new Set<string>();

  constructor(config: Partial<FourMemeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if connector is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get connector status - uses GeckoTerminal BSC data
   */
  async getStatus(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    
    try {
      // Use GeckoTerminal to check BSC connectivity
      const response = await fetch(`${GECKOTERMINAL_API_URL}/networks/bsc/new_pools?page=1`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ClawFi/0.2.0',
        },
      });

      if (!response.ok) {
        return {
          connected: false,
          error: `GeckoTerminal API returned ${response.status}`,
        };
      }

      return {
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch recent token launches from GeckoTerminal (BSC new pools)
   */
  async fetchRecentLaunches(limit?: number): Promise<LaunchpadToken[]> {
    const tokensLimit = limit || this.config.maxTokensPerRequest;
    
    try {
      // Use GeckoTerminal to get latest BSC new pools
      const response = await fetch(`${GECKOTERMINAL_API_URL}/networks/bsc/new_pools?page=1`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ClawFi/0.2.0',
        },
      });

      if (!response.ok) {
        console.error(`[FourMeme] GeckoTerminal API error: ${response.status}`);
        return [];
      }

      interface GeckoPool {
        id: string;
        type: string;
        attributes: {
          name: string;
          address: string;
          base_token_price_usd: string | null;
          fdv_usd: string | null;
          reserve_in_usd: string | null;
          pool_created_at: string | null;
        };
        relationships?: {
          base_token?: { data?: { id: string } };
          quote_token?: { data?: { id: string } };
        };
      }

      const data = await response.json() as { data?: GeckoPool[] };
      const pools = data.data || [];

      this.lastFetchTime = Date.now();

      // Convert to our format
      const tokens: LaunchpadToken[] = [];
      
      for (const pool of pools.slice(0, tokensLimit)) {
        try {
          // Extract token address from relationship ID (format: "bsc_0x...")
          const baseTokenId = pool.relationships?.base_token?.data?.id;
          if (!baseTokenId) continue;
          
          const address = baseTokenId.replace('bsc_', '');
          const name = pool.attributes.name.split(' / ')[0] || 'Unknown';
          
          // Skip if it's a common quote token (WBNB, USDT, etc.)
          if (['WBNB', 'USDT', 'USDC', 'BUSD', 'BNB'].includes(name)) continue;

          const token: LaunchpadToken = {
            launchpad: 'fourmeme',
            chain: 'bsc',
            address: address,
            symbol: name,
            name: name,
            createdAt: pool.attributes.pool_created_at 
              ? new Date(pool.attributes.pool_created_at) 
              : new Date(),
            priceUsd: pool.attributes.base_token_price_usd 
              ? parseFloat(pool.attributes.base_token_price_usd) 
              : undefined,
            marketCapUsd: pool.attributes.fdv_usd 
              ? parseFloat(pool.attributes.fdv_usd) 
              : undefined,
            extensions: {
              liquidity: pool.attributes.reserve_in_usd 
                ? parseFloat(pool.attributes.reserve_in_usd) 
                : undefined,
              poolAddress: pool.attributes.address,
            },
          };
          
          tokens.push(token);
        } catch {
          // Skip failed tokens
        }
      }
      
      // Filter by minimum market cap if set
      if (this.config.minMarketCapUsd > 0) {
        return tokens.filter(t => (t.marketCapUsd || 0) >= this.config.minMarketCapUsd);
      }
      
      return tokens;
    } catch (error) {
      console.error('[FourMeme] Fetch error:', error);
      return [];
    }
  }

  /**
   * Fetch token data from GeckoTerminal
   */
  private async fetchTokenFromGeckoTerminal(address: string): Promise<LaunchpadToken | null> {
    try {
      const response = await fetch(`${GECKOTERMINAL_API_URL}/networks/bsc/tokens/${address}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ClawFi/0.2.0',
        },
      });

      if (!response.ok) return null;

      interface GeckoToken {
        data?: {
          attributes?: {
            address: string;
            name: string;
            symbol: string;
            price_usd: string | null;
            fdv_usd: string | null;
            total_reserve_in_usd: string | null;
            image_url: string | null;
          };
        };
      }

      const data = await response.json() as GeckoToken;
      if (!data.data?.attributes) return null;

      const attrs = data.data.attributes;

      return {
        launchpad: 'fourmeme',
        chain: 'bsc',
        address: attrs.address,
        symbol: attrs.symbol,
        name: attrs.name,
        createdAt: new Date(),
        priceUsd: attrs.price_usd ? parseFloat(attrs.price_usd) : undefined,
        marketCapUsd: attrs.fdv_usd ? parseFloat(attrs.fdv_usd) : undefined,
        imageUrl: attrs.image_url || undefined,
        extensions: {
          liquidity: attrs.total_reserve_in_usd 
            ? parseFloat(attrs.total_reserve_in_usd) 
            : undefined,
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetch new launches since last check
   */
  async fetchNewLaunches(): Promise<LaunchpadToken[]> {
    const allTokens = await this.fetchRecentLaunches();
    
    // Filter to only new tokens
    const newTokens = allTokens.filter(t => !this.lastTokenAddresses.has(t.address));
    
    // Update cache
    const currentAddresses = new Set(allTokens.map(t => t.address));
    this.lastTokenAddresses = currentAddresses;
    
    return newTokens;
  }

  /**
   * Fetch token by address using GeckoTerminal
   */
  async fetchToken(address: string): Promise<LaunchpadToken | null> {
    return this.fetchTokenFromGeckoTerminal(address);
  }

  /**
   * Fetch graduated tokens (listed on PancakeSwap)
   * Using DexScreener BSC data as Four.meme API is not available
   */
  async fetchGraduatedTokens(limit: number = 20): Promise<LaunchpadToken[]> {
    // Return recent launches as graduation data is not available via DexScreener
    return this.fetchRecentLaunches(limit);
  }

  /**
   * Fetch trending tokens by market cap
   * Using DexScreener BSC data as Four.meme API is not available
   */
  async fetchTrendingTokens(limit: number = 10): Promise<LaunchpadToken[]> {
    // Return recent launches as trending data is not available via DexScreener
    return this.fetchRecentLaunches(limit);
  }

  /**
   * Map FourMeme token to LaunchpadToken
   */
  private mapToken(token: FourMemeToken): LaunchpadToken {
    const extensions: Record<string, unknown> = {};

    // Social links
    if (token.twitter) extensions.twitter = token.twitter;
    if (token.telegram) extensions.telegram = token.telegram;
    if (token.website) extensions.website = token.website;
    
    // Bonding curve data
    if (token.bondingCurve) extensions.bondingCurve = token.bondingCurve;
    
    // Graduation status
    extensions.graduated = token.graduated || token.status === 'graduated';
    if (token.pancakePool) extensions.pancakePool = token.pancakePool;
    
    // Market data
    if (token.holders !== undefined) extensions.holders = token.holders;
    if (token.volume24h !== undefined) extensions.volume24h = token.volume24h;
    if (token.priceChange24h !== undefined) extensions.priceChange24h = token.priceChange24h;
    
    // Status
    if (token.status) extensions.status = token.status;

    // Parse created date
    let createdAt: Date;
    if (token.launchAt) {
      createdAt = new Date(token.launchAt * 1000);
    } else if (token.createdAt) {
      createdAt = new Date(token.createdAt);
    } else {
      createdAt = new Date();
    }

    return {
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      chain: 'bsc',
      launchpad: 'fourmeme',
      creator: token.creator,
      createdAt,
      marketCapUsd: token.marketCap,
      priceUsd: token.priceUsd,
      imageUrl: token.image,
      description: token.description,
      verified: false,
      extensions,
      urls: {
        launchpad: `https://four.meme/token/${token.address}`,
        explorer: `${BSCSCAN_URL}/token/${token.address}`,
        dex: token.pancakePool 
          ? `https://pancakeswap.finance/swap?outputCurrency=${token.address}`
          : undefined,
      },
    };
  }
}

/**
 * Create FourMeme connector from environment
 */
export function createFourMemeConnector(): FourMemeConnector {
  return new FourMemeConnector({
    enabled: process.env.FOURMEME_ENABLED !== 'false',
    pollIntervalMs: parseInt(process.env.FOURMEME_POLL_INTERVAL_MS || '15000', 10),
    minMarketCapUsd: parseInt(process.env.FOURMEME_MIN_MARKET_CAP || '0', 10),
  });
}
