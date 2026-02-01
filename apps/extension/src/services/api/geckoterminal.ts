/**
 * ClawFi Extension - GeckoTerminal API Service
 * 
 * Direct integration with GeckoTerminal public API
 * No authentication required
 * Rate limit: ~30 requests/minute (be conservative)
 * 
 * @see https://www.geckoterminal.com/dex-api
 */

import type { ChainId, PairInfo, TokenInfo, TrendingToken, NewPool, MarketData } from './types';
import { CHAINS } from './types';

const BASE_URL = 'https://api.geckoterminal.com/api/v2';

// Cache for rate limiting
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute (conservative for GeckoTerminal)

/**
 * Fetch with caching, rate limiting, and timeout
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
      if (response.status === 429) {
        throw new Error('GeckoTerminal rate limit exceeded');
      }
      throw new Error(`GeckoTerminal API error: ${response.status}`);
    }

    const data = await response.json();
    cache.set(url, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================
// GECKOTERMINAL API TYPES
// ============================================

interface GeckoPool {
  id: string;
  type: string;
  attributes: {
    base_token_price_usd: string;
    quote_token_price_usd: string;
    base_token_price_native_currency: string;
    quote_token_price_native_currency: string;
    base_token_price_quote_token: string;
    quote_token_price_base_token: string;
    address: string;
    name: string;
    pool_created_at: string;
    fdv_usd: string;
    market_cap_usd: string | null;
    price_change_percentage: {
      m5: string;
      h1: string;
      h6: string;
      h24: string;
    };
    transactions: {
      m5: { buys: number; sells: number; buyers: number; sellers: number };
      h1: { buys: number; sells: number; buyers: number; sellers: number };
      h6: { buys: number; sells: number; buyers: number; sellers: number };
      h24: { buys: number; sells: number; buyers: number; sellers: number };
    };
    volume_usd: {
      m5: string;
      h1: string;
      h6: string;
      h24: string;
    };
    reserve_in_usd: string;
  };
  relationships: {
    base_token: { data: { id: string; type: string } };
    quote_token: { data: { id: string; type: string } };
    dex: { data: { id: string; type: string } };
  };
}

interface GeckoToken {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    image_url?: string;
    coingecko_coin_id?: string;
    total_supply?: string;
    price_usd?: string;
    fdv_usd?: string;
    total_reserve_in_usd?: string;
    volume_usd?: {
      h24: string;
    };
    market_cap_usd?: string;
  };
}

interface GeckoResponse<T> {
  data: T;
  included?: Array<GeckoToken | GeckoPool>;
}

// ============================================
// HELPERS
// ============================================

function getGeckoNetworkId(chain: ChainId): string {
  return CHAINS[chain]?.geckoTerminalId || chain;
}

function parseGeckoPool(pool: GeckoPool, networkId: string, included?: Array<GeckoToken | GeckoPool>): PairInfo {
  const attrs = pool.attributes;
  
  // Find tokens in included data
  const baseTokenId = pool.relationships.base_token.data.id;
  const quoteTokenId = pool.relationships.quote_token.data.id;
  
  const baseToken = included?.find(
    (item): item is GeckoToken => item.type === 'token' && item.id === baseTokenId
  );
  const quoteToken = included?.find(
    (item): item is GeckoToken => item.type === 'token' && item.id === quoteTokenId
  );
  
  const chain = Object.values(CHAINS).find(c => c.geckoTerminalId === networkId)?.id || networkId as ChainId;
  
  return {
    address: attrs.address,
    chain,
    dex: pool.relationships.dex.data.id.replace(`${networkId}_`, ''),
    baseToken: {
      address: baseToken?.attributes.address || baseTokenId.split('_').pop() || '',
      name: baseToken?.attributes.name || '',
      symbol: baseToken?.attributes.symbol || '',
      decimals: baseToken?.attributes.decimals || 18,
      logoUrl: baseToken?.attributes.image_url,
      chain,
    },
    quoteToken: {
      address: quoteToken?.attributes.address || quoteTokenId.split('_').pop() || '',
      name: quoteToken?.attributes.name || '',
      symbol: quoteToken?.attributes.symbol || '',
      decimals: quoteToken?.attributes.decimals || 18,
      logoUrl: quoteToken?.attributes.image_url,
      chain,
    },
    priceUsd: parseFloat(attrs.base_token_price_usd) || 0,
    priceNative: parseFloat(attrs.base_token_price_native_currency) || 0,
    priceChange: {
      m5: parseFloat(attrs.price_change_percentage?.m5) || 0,
      h1: parseFloat(attrs.price_change_percentage?.h1) || 0,
      h6: parseFloat(attrs.price_change_percentage?.h6) || 0,
      h24: parseFloat(attrs.price_change_percentage?.h24) || 0,
    },
    volume: {
      m5: parseFloat(attrs.volume_usd?.m5) || 0,
      h1: parseFloat(attrs.volume_usd?.h1) || 0,
      h6: parseFloat(attrs.volume_usd?.h6) || 0,
      h24: parseFloat(attrs.volume_usd?.h24) || 0,
    },
    txns: {
      m5: { buys: attrs.transactions?.m5?.buys || 0, sells: attrs.transactions?.m5?.sells || 0 },
      h1: { buys: attrs.transactions?.h1?.buys || 0, sells: attrs.transactions?.h1?.sells || 0 },
      h6: { buys: attrs.transactions?.h6?.buys || 0, sells: attrs.transactions?.h6?.sells || 0 },
      h24: { buys: attrs.transactions?.h24?.buys || 0, sells: attrs.transactions?.h24?.sells || 0 },
    },
    liquidity: {
      usd: parseFloat(attrs.reserve_in_usd) || 0,
      base: 0, // Not provided
      quote: 0,
    },
    fdv: parseFloat(attrs.fdv_usd) || undefined,
    marketCap: attrs.market_cap_usd ? parseFloat(attrs.market_cap_usd) : undefined,
    pairCreatedAt: attrs.pool_created_at ? new Date(attrs.pool_created_at).getTime() : undefined,
    url: `https://www.geckoterminal.com/${networkId}/pools/${attrs.address}`,
  };
}

// ============================================
// API CLASS
// ============================================

export class GeckoTerminalAPI {
  /**
   * Get supported networks
   */
  async getNetworks(): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await fetchWithCache<GeckoResponse<Array<{
        id: string;
        attributes: { name: string };
      }>>>(`${BASE_URL}/networks`, 300000); // 5 min cache
      
      return response.data.map(n => ({
        id: n.id,
        name: n.attributes.name,
      }));
    } catch (error) {
      console.error('[GeckoTerminal] getNetworks error:', error);
      return [];
    }
  }

  /**
   * Get trending pools across all networks
   */
  async getTrendingPools(page = 1): Promise<TrendingToken[]> {
    try {
      const response = await fetchWithCache<GeckoResponse<GeckoPool[]>>(
        `${BASE_URL}/networks/trending_pools?page=${page}`,
        120000 // 2 min cache
      );
      
      return response.data.map((pool, index) => {
        const networkId = pool.id.split('_')[0];
        const pairInfo = parseGeckoPool(pool, networkId, response.included);
        
        return {
          token: pairInfo.baseToken,
          pair: pairInfo,
          rank: (page - 1) * 20 + index + 1,
          source: 'geckoterminal' as const,
        };
      });
    } catch (error) {
      console.error('[GeckoTerminal] getTrendingPools error:', error);
      return [];
    }
  }

  /**
   * Get trending pools for a specific network
   */
  async getTrendingPoolsByNetwork(chain: ChainId, page = 1): Promise<TrendingToken[]> {
    try {
      const networkId = getGeckoNetworkId(chain);
      const response = await fetchWithCache<GeckoResponse<GeckoPool[]>>(
        `${BASE_URL}/networks/${networkId}/trending_pools?page=${page}`,
        120000
      );
      
      return response.data.map((pool, index) => {
        const pairInfo = parseGeckoPool(pool, networkId, response.included);
        return {
          token: pairInfo.baseToken,
          pair: pairInfo,
          rank: (page - 1) * 20 + index + 1,
          source: 'geckoterminal' as const,
        };
      });
    } catch (error) {
      console.error('[GeckoTerminal] getTrendingPoolsByNetwork error:', error);
      return [];
    }
  }

  /**
   * Get new pools for a network
   */
  async getNewPools(chain: ChainId, page = 1): Promise<NewPool[]> {
    try {
      const networkId = getGeckoNetworkId(chain);
      const response = await fetchWithCache<GeckoResponse<GeckoPool[]>>(
        `${BASE_URL}/networks/${networkId}/new_pools?page=${page}`,
        60000 // 1 min cache for new pools
      );
      
      return response.data.map(pool => {
        const pairInfo = parseGeckoPool(pool, networkId, response.included);
        return {
          pair: pairInfo,
          createdAt: pairInfo.pairCreatedAt || Date.now(),
          initialLiquidity: pairInfo.liquidity.usd,
          currentLiquidity: pairInfo.liquidity.usd,
        };
      });
    } catch (error) {
      console.error('[GeckoTerminal] getNewPools error:', error);
      return [];
    }
  }

  /**
   * Get pool by address
   */
  async getPool(chain: ChainId, poolAddress: string): Promise<PairInfo | null> {
    try {
      const networkId = getGeckoNetworkId(chain);
      const response = await fetchWithCache<GeckoResponse<GeckoPool>>(
        `${BASE_URL}/networks/${networkId}/pools/${poolAddress}`
      );
      
      return parseGeckoPool(response.data, networkId, response.included);
    } catch (error) {
      console.error('[GeckoTerminal] getPool error:', error);
      return null;
    }
  }

  /**
   * Get multiple pools
   */
  async getMultiplePools(chain: ChainId, poolAddresses: string[]): Promise<PairInfo[]> {
    try {
      const networkId = getGeckoNetworkId(chain);
      const addresses = poolAddresses.slice(0, 30).join(','); // Max 30
      const response = await fetchWithCache<GeckoResponse<GeckoPool[]>>(
        `${BASE_URL}/networks/${networkId}/pools/multi/${addresses}`
      );
      
      return response.data.map(pool => parseGeckoPool(pool, networkId, response.included));
    } catch (error) {
      console.error('[GeckoTerminal] getMultiplePools error:', error);
      return [];
    }
  }

  /**
   * Get top pools for a network
   */
  async getTopPools(chain: ChainId, page = 1): Promise<PairInfo[]> {
    try {
      const networkId = getGeckoNetworkId(chain);
      const response = await fetchWithCache<GeckoResponse<GeckoPool[]>>(
        `${BASE_URL}/networks/${networkId}/pools?page=${page}`,
        120000
      );
      
      return response.data.map(pool => parseGeckoPool(pool, networkId, response.included));
    } catch (error) {
      console.error('[GeckoTerminal] getTopPools error:', error);
      return [];
    }
  }

  /**
   * Get pools for a token
   */
  async getTokenPools(chain: ChainId, tokenAddress: string, page = 1): Promise<PairInfo[]> {
    try {
      const networkId = getGeckoNetworkId(chain);
      const response = await fetchWithCache<GeckoResponse<GeckoPool[]>>(
        `${BASE_URL}/networks/${networkId}/tokens/${tokenAddress}/pools?page=${page}`
      );
      
      return response.data.map(pool => parseGeckoPool(pool, networkId, response.included));
    } catch (error) {
      console.error('[GeckoTerminal] getTokenPools error:', error);
      return [];
    }
  }

  /**
   * Get token info
   */
  async getToken(chain: ChainId, tokenAddress: string): Promise<TokenInfo | null> {
    try {
      const networkId = getGeckoNetworkId(chain);
      const response = await fetchWithCache<GeckoResponse<GeckoToken>>(
        `${BASE_URL}/networks/${networkId}/tokens/${tokenAddress}`
      );
      
      const attrs = response.data.attributes;
      const chainInfo = Object.values(CHAINS).find(c => c.geckoTerminalId === networkId);
      
      return {
        address: attrs.address,
        name: attrs.name,
        symbol: attrs.symbol,
        decimals: attrs.decimals,
        logoUrl: attrs.image_url,
        chain: chainInfo?.id || networkId as ChainId,
      };
    } catch (error) {
      console.error('[GeckoTerminal] getToken error:', error);
      return null;
    }
  }

  /**
   * Get token price (simple)
   */
  async getTokenPrice(chain: ChainId, tokenAddress: string): Promise<number | null> {
    try {
      const networkId = getGeckoNetworkId(chain);
      const response = await fetchWithCache<{
        data: { id: string; type: string; attributes: { token_prices: Record<string, string> } };
      }>(
        `${BASE_URL}/simple/networks/${networkId}/token_price/${tokenAddress}`
      );
      
      const prices = response.data.attributes.token_prices;
      const price = prices[tokenAddress.toLowerCase()];
      return price ? parseFloat(price) : null;
    } catch (error) {
      console.error('[GeckoTerminal] getTokenPrice error:', error);
      return null;
    }
  }

  /**
   * Search pools
   */
  async searchPools(query: string, chain?: ChainId, page = 1): Promise<PairInfo[]> {
    try {
      let url = `${BASE_URL}/search/pools?query=${encodeURIComponent(query)}&page=${page}`;
      if (chain) {
        const networkId = getGeckoNetworkId(chain);
        url += `&network=${networkId}`;
      }
      
      const response = await fetchWithCache<GeckoResponse<GeckoPool[]>>(url);
      
      return response.data.map(pool => {
        const networkId = pool.id.split('_')[0];
        return parseGeckoPool(pool, networkId, response.included);
      });
    } catch (error) {
      console.error('[GeckoTerminal] searchPools error:', error);
      return [];
    }
  }

  /**
   * Get OHLCV data for a pool
   */
  async getPoolOHLCV(
    chain: ChainId,
    poolAddress: string,
    timeframe: 'minute' | 'hour' | 'day' = 'hour',
    aggregate = 1,
    limit = 100
  ): Promise<Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>> {
    try {
      const networkId = getGeckoNetworkId(chain);
      const response = await fetchWithCache<{
        data: {
          attributes: {
            ohlcv_list: Array<[number, number, number, number, number, number]>;
          };
        };
      }>(
        `${BASE_URL}/networks/${networkId}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`
      );
      
      return response.data.attributes.ohlcv_list.map(([timestamp, open, high, low, close, volume]) => ({
        timestamp: timestamp * 1000,
        open,
        high,
        low,
        close,
        volume,
      }));
    } catch (error) {
      console.error('[GeckoTerminal] getPoolOHLCV error:', error);
      return [];
    }
  }
}

// Export singleton
export const geckoTerminalAPI = new GeckoTerminalAPI();
