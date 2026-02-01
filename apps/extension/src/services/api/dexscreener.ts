/**
 * ClawFi Extension - Dexscreener API Service
 * 
 * Direct integration with Dexscreener public API
 * No authentication required
 * Rate limit: ~300 requests/minute
 * 
 * @see https://docs.dexscreener.com/api/reference
 */

import type { ChainId, PairInfo, TokenInfo, MarketData, TrendingToken } from './types';
import { CHAINS } from './types';

const BASE_URL = 'https://api.dexscreener.com';

// Cache for rate limiting
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Fetch with caching, error handling, and timeout
 */
async function fetchWithCache<T>(url: string, ttl = CACHE_TTL): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Dexscreener API error: ${response.status}`);
    }

    const data = await response.json();
    cache.set(url, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Parse Dexscreener pair response into our PairInfo type
 */
function parsePair(pair: DexscreenerPair): PairInfo {
  return {
    address: pair.pairAddress,
    chain: pair.chainId as ChainId,
    dex: pair.dexId,
    baseToken: {
      address: pair.baseToken.address,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      decimals: 18, // Dexscreener doesn't provide this
      chain: pair.chainId as ChainId,
    },
    quoteToken: {
      address: pair.quoteToken.address,
      name: pair.quoteToken.name,
      symbol: pair.quoteToken.symbol,
      decimals: 18,
      chain: pair.chainId as ChainId,
    },
    priceUsd: parseFloat(pair.priceUsd || '0'),
    priceNative: parseFloat(pair.priceNative || '0'),
    priceChange: {
      m5: pair.priceChange?.m5 || 0,
      h1: pair.priceChange?.h1 || 0,
      h6: pair.priceChange?.h6 || 0,
      h24: pair.priceChange?.h24 || 0,
    },
    volume: {
      m5: pair.volume?.m5 || 0,
      h1: pair.volume?.h1 || 0,
      h6: pair.volume?.h6 || 0,
      h24: pair.volume?.h24 || 0,
    },
    txns: {
      m5: pair.txns?.m5 || { buys: 0, sells: 0 },
      h1: pair.txns?.h1 || { buys: 0, sells: 0 },
      h6: pair.txns?.h6 || { buys: 0, sells: 0 },
      h24: pair.txns?.h24 || { buys: 0, sells: 0 },
    },
    liquidity: {
      usd: pair.liquidity?.usd || 0,
      base: pair.liquidity?.base || 0,
      quote: pair.liquidity?.quote || 0,
    },
    fdv: pair.fdv,
    marketCap: pair.marketCap,
    pairCreatedAt: pair.pairCreatedAt,
    url: pair.url,
    boosts: pair.boosts,
  };
}

// ============================================
// DEXSCREENER API TYPES
// ============================================

interface DexscreenerToken {
  address: string;
  name: string;
  symbol: string;
}

interface DexscreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: DexscreenerToken;
  quoteToken: DexscreenerToken;
  priceNative?: string;
  priceUsd?: string;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  boosts?: { active: number };
}

interface DexscreenerSearchResponse {
  pairs: DexscreenerPair[];
}

interface DexscreenerTokenResponse {
  pairs: DexscreenerPair[];
}

interface DexscreenerBoostToken {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  openGraph?: string;
  description?: string;
  links?: Array<{ label: string; url: string }>;
}

interface DexscreenerTokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: Array<{ type: string; url: string }>;
}

// ============================================
// API METHODS
// ============================================

export class DexscreenerAPI {
  /**
   * Get pair by chain and pair address
   */
  async getPair(chain: ChainId, pairAddress: string): Promise<PairInfo | null> {
    try {
      const chainId = CHAINS[chain]?.dexscreenerId || chain;
      const response = await fetchWithCache<{ pairs: DexscreenerPair[] }>(
        `${BASE_URL}/latest/dex/pairs/${chainId}/${pairAddress}`
      );
      
      if (response.pairs && response.pairs.length > 0) {
        return parsePair(response.pairs[0]);
      }
      return null;
    } catch (error) {
      console.error('[Dexscreener] getPair error:', error);
      return null;
    }
  }

  /**
   * Get pairs for a token address
   */
  async getTokenPairs(tokenAddress: string, chain?: ChainId): Promise<PairInfo[]> {
    try {
      let url = `${BASE_URL}/latest/dex/tokens/${tokenAddress}`;
      if (chain) {
        const chainId = CHAINS[chain]?.dexscreenerId || chain;
        url = `${BASE_URL}/tokens/v1/${chainId}/${tokenAddress}`;
      }
      
      const response = await fetchWithCache<DexscreenerTokenResponse>(url);
      
      if (response.pairs) {
        return response.pairs.map(parsePair);
      }
      return [];
    } catch (error) {
      console.error('[Dexscreener] getTokenPairs error:', error);
      return [];
    }
  }

  /**
   * Search pairs by query
   */
  async searchPairs(query: string): Promise<PairInfo[]> {
    try {
      const response = await fetchWithCache<DexscreenerSearchResponse>(
        `${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      
      if (response.pairs) {
        return response.pairs.map(parsePair);
      }
      return [];
    } catch (error) {
      console.error('[Dexscreener] searchPairs error:', error);
      return [];
    }
  }

  /**
   * Get pairs by chain
   */
  async getPairsByChain(chain: ChainId, limit = 100): Promise<PairInfo[]> {
    try {
      const chainId = CHAINS[chain]?.dexscreenerId || chain;
      // This endpoint doesn't exist, but search by chain name works
      const response = await fetchWithCache<DexscreenerSearchResponse>(
        `${BASE_URL}/latest/dex/search?q=${chainId}`
      );
      
      if (response.pairs) {
        return response.pairs.slice(0, limit).map(parsePair);
      }
      return [];
    } catch (error) {
      console.error('[Dexscreener] getPairsByChain error:', error);
      return [];
    }
  }

  /**
   * Get boosted tokens (trending/promoted)
   */
  async getBoostedTokens(): Promise<TrendingToken[]> {
    try {
      const response = await fetchWithCache<DexscreenerBoostToken[]>(
        `${BASE_URL}/token-boosts/top/v1`,
        60000 // 1 minute cache
      );
      
      if (Array.isArray(response)) {
        return response.map((token, index) => ({
          token: {
            address: token.tokenAddress,
            name: token.description || 'Unknown',
            symbol: '',
            decimals: 18,
            logoUrl: token.icon,
            chain: token.chainId as ChainId,
          },
          pair: {
            address: '',
            chain: token.chainId as ChainId,
            dex: '',
            baseToken: {
              address: token.tokenAddress,
              name: '',
              symbol: '',
              decimals: 18,
              chain: token.chainId as ChainId,
            },
            quoteToken: {
              address: '',
              name: '',
              symbol: '',
              decimals: 18,
              chain: token.chainId as ChainId,
            },
            priceUsd: 0,
            priceNative: 0,
            priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 },
            volume: { m5: 0, h1: 0, h6: 0, h24: 0 },
            txns: {
              m5: { buys: 0, sells: 0 },
              h1: { buys: 0, sells: 0 },
              h6: { buys: 0, sells: 0 },
              h24: { buys: 0, sells: 0 },
            },
            liquidity: { usd: 0, base: 0, quote: 0 },
            url: token.url,
          },
          rank: index + 1,
          source: 'dexscreener' as const,
        }));
      }
      return [];
    } catch (error) {
      console.error('[Dexscreener] getBoostedTokens error:', error);
      return [];
    }
  }

  /**
   * Get latest token boosts
   */
  async getLatestBoosts(): Promise<DexscreenerBoostToken[]> {
    try {
      const response = await fetchWithCache<DexscreenerBoostToken[]>(
        `${BASE_URL}/token-boosts/latest/v1`,
        60000
      );
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('[Dexscreener] getLatestBoosts error:', error);
      return [];
    }
  }

  /**
   * Get token profiles (with social info)
   */
  async getTokenProfiles(): Promise<DexscreenerTokenProfile[]> {
    try {
      const response = await fetchWithCache<DexscreenerTokenProfile[]>(
        `${BASE_URL}/token-profiles/latest/v1`,
        60000
      );
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('[Dexscreener] getTokenProfiles error:', error);
      return [];
    }
  }

  /**
   * Get paid orders (tokens with paid promotions)
   */
  async getPaidOrders(chain?: ChainId): Promise<DexscreenerTokenProfile[]> {
    try {
      let url = `${BASE_URL}/orders/v1/all`;
      if (chain) {
        const chainId = CHAINS[chain]?.dexscreenerId || chain;
        url = `${BASE_URL}/orders/v1/${chainId}`;
      }
      
      const response = await fetchWithCache<DexscreenerTokenProfile[]>(url, 60000);
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('[Dexscreener] getPaidOrders error:', error);
      return [];
    }
  }

  /**
   * Convert pair to market data format
   */
  pairToMarketData(pair: PairInfo): MarketData {
    return {
      priceUsd: pair.priceUsd,
      priceNative: pair.priceNative,
      priceChange24h: pair.priceChange.h24,
      priceChangeH1: pair.priceChange.h1,
      priceChangeM5: pair.priceChange.m5,
      volume24h: pair.volume.h24,
      volumeH1: pair.volume.h1,
      liquidity: pair.liquidity.usd,
      marketCap: pair.marketCap,
      fdv: pair.fdv,
      txns24h: pair.txns.h24,
      txnsH1: pair.txns.h1,
      dex: pair.dex,
      pairAddress: pair.address,
      pairUrl: pair.url,
      createdAt: pair.pairCreatedAt,
    };
  }

  /**
   * Get best pair for a token (highest liquidity)
   */
  async getBestPair(tokenAddress: string, chain?: ChainId): Promise<PairInfo | null> {
    const pairs = await this.getTokenPairs(tokenAddress, chain);
    if (pairs.length === 0) return null;
    
    // Sort by liquidity and return the best
    pairs.sort((a, b) => b.liquidity.usd - a.liquidity.usd);
    return pairs[0];
  }

  /**
   * Get market data for a token
   */
  async getTokenMarketData(tokenAddress: string, chain?: ChainId): Promise<MarketData | null> {
    const pair = await this.getBestPair(tokenAddress, chain);
    if (!pair) return null;
    return this.pairToMarketData(pair);
  }

  /**
   * Get multiple tokens' market data
   */
  async getMultipleTokens(
    tokens: Array<{ address: string; chain: ChainId }>
  ): Promise<Map<string, MarketData>> {
    const results = new Map<string, MarketData>();
    
    // Batch requests (Dexscreener supports up to 30 addresses)
    const batches: Array<Array<{ address: string; chain: ChainId }>> = [];
    for (let i = 0; i < tokens.length; i += 30) {
      batches.push(tokens.slice(i, i + 30));
    }
    
    for (const batch of batches) {
      // Group by chain for efficient requests
      const byChain = new Map<ChainId, string[]>();
      for (const token of batch) {
        const existing = byChain.get(token.chain) || [];
        existing.push(token.address);
        byChain.set(token.chain, existing);
      }
      
      // Fetch each chain's tokens
      for (const [chain, addresses] of byChain) {
        try {
          const chainId = CHAINS[chain]?.dexscreenerId || chain;
          const response = await fetchWithCache<{ pairs: DexscreenerPair[] }>(
            `${BASE_URL}/tokens/v1/${chainId}/${addresses.join(',')}`
          );
          
          if (response.pairs) {
            for (const pair of response.pairs) {
              const pairInfo = parsePair(pair);
              const key = `${chain}:${pair.baseToken.address.toLowerCase()}`;
              const existing = results.get(key);
              
              // Keep pair with highest liquidity
              if (!existing || pairInfo.liquidity.usd > existing.liquidity) {
                results.set(key, this.pairToMarketData(pairInfo));
              }
            }
          }
        } catch (error) {
          console.error(`[Dexscreener] getMultipleTokens error for ${chain}:`, error);
        }
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const dexscreenerAPI = new DexscreenerAPI();
