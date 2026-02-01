/**
 * ClawFi Dashboard - Dexscreener API Client
 * Live market data for trending tokens, pairs, and market overview
 */

const BASE_URL = 'https://api.dexscreener.com';

// Cache for rate limiting
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

async function fetchWithCache<T>(url: string, ttl = CACHE_TTL): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
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

// Types
export interface DexscreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
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
  info?: {
    imageUrl?: string;
    socials?: Array<{ type: string; url: string }>;
    websites?: Array<{ url: string }>;
  };
}

export interface BoostToken {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  openGraph?: string;
  description?: string;
  links?: Array<{ label: string; url: string }>;
  amount?: number;
  totalAmount?: number;
}

export interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: Array<{ type: string; url: string }>;
}

// API Methods
export const dexscreenerApi = {
  /**
   * Get boosted tokens (trending/promoted)
   */
  async getBoostedTokens(): Promise<BoostToken[]> {
    try {
      const data = await fetchWithCache<BoostToken[]>(
        `${BASE_URL}/token-boosts/top/v1`,
        60000
      );
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[Dexscreener] getBoostedTokens error:', error);
      return [];
    }
  },

  /**
   * Get latest token boosts
   */
  async getLatestBoosts(): Promise<BoostToken[]> {
    try {
      const data = await fetchWithCache<BoostToken[]>(
        `${BASE_URL}/token-boosts/latest/v1`,
        60000
      );
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[Dexscreener] getLatestBoosts error:', error);
      return [];
    }
  },

  /**
   * Get token profiles
   */
  async getTokenProfiles(): Promise<TokenProfile[]> {
    try {
      const data = await fetchWithCache<TokenProfile[]>(
        `${BASE_URL}/token-profiles/latest/v1`,
        60000
      );
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[Dexscreener] getTokenProfiles error:', error);
      return [];
    }
  },

  /**
   * Get pairs for a token address
   */
  async getTokenPairs(tokenAddress: string): Promise<DexscreenerPair[]> {
    try {
      const data = await fetchWithCache<{ pairs?: DexscreenerPair[] }>(
        `${BASE_URL}/latest/dex/tokens/${tokenAddress}`
      );
      return data.pairs || [];
    } catch (error) {
      console.error('[Dexscreener] getTokenPairs error:', error);
      return [];
    }
  },

  /**
   * Search pairs by query
   */
  async searchPairs(query: string): Promise<DexscreenerPair[]> {
    try {
      const data = await fetchWithCache<{ pairs?: DexscreenerPair[] }>(
        `${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      return data.pairs || [];
    } catch (error) {
      console.error('[Dexscreener] searchPairs error:', error);
      return [];
    }
  },

  /**
   * Get pairs by chain and pair address
   */
  async getPair(chain: string, pairAddress: string): Promise<DexscreenerPair | null> {
    try {
      const data = await fetchWithCache<{ pairs?: DexscreenerPair[] }>(
        `${BASE_URL}/latest/dex/pairs/${chain}/${pairAddress}`
      );
      return data.pairs?.[0] || null;
    } catch (error) {
      console.error('[Dexscreener] getPair error:', error);
      return null;
    }
  },

  /**
   * Get multiple tokens by addresses
   */
  async getMultipleTokens(addresses: string[]): Promise<DexscreenerPair[]> {
    if (addresses.length === 0) return [];
    
    try {
      const chunks = [];
      for (let i = 0; i < addresses.length; i += 30) {
        chunks.push(addresses.slice(i, i + 30));
      }

      const results: DexscreenerPair[] = [];
      for (const chunk of chunks) {
        const data = await fetchWithCache<{ pairs?: DexscreenerPair[] }>(
          `${BASE_URL}/latest/dex/tokens/${chunk.join(',')}`
        );
        if (data.pairs) {
          results.push(...data.pairs);
        }
      }
      return results;
    } catch (error) {
      console.error('[Dexscreener] getMultipleTokens error:', error);
      return [];
    }
  },

  /**
   * Get paid orders (tokens with paid promotions)
   */
  async getPaidOrders(chain?: string): Promise<TokenProfile[]> {
    try {
      const url = chain 
        ? `${BASE_URL}/orders/v1/${chain}`
        : `${BASE_URL}/orders/v1/all`;
      const data = await fetchWithCache<TokenProfile[]>(url, 60000);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[Dexscreener] getPaidOrders error:', error);
      return [];
    }
  },
};

// Format helpers
export function formatPrice(price: number | string | undefined): string {
  if (!price) return '$0.00';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (num === 0) return '$0.00';
  if (num < 0.0000001) return `$${num.toExponential(2)}`;
  if (num < 0.0001) return `$${num.toFixed(8)}`;
  if (num < 1) return `$${num.toFixed(6)}`;
  if (num < 1000) return `$${num.toFixed(2)}`;
  return `$${(num / 1000).toFixed(1)}K`;
}

export function formatMarketCap(value: number | undefined): string {
  if (!value) return '-';
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatVolume(value: number | undefined): string {
  if (!value) return '-';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatChange(change: number | undefined): { text: string; positive: boolean } {
  if (change === undefined || change === null) return { text: '-', positive: true };
  const positive = change >= 0;
  return {
    text: `${positive ? '+' : ''}${change.toFixed(2)}%`,
    positive,
  };
}

export function formatLiquidity(value: number | undefined): string {
  if (!value) return '-';
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function getChainName(chainId: string): string {
  const chains: Record<string, string> = {
    ethereum: 'Ethereum',
    bsc: 'BNB Chain',
    polygon: 'Polygon',
    arbitrum: 'Arbitrum',
    optimism: 'Optimism',
    avalanche: 'Avalanche',
    base: 'Base',
    solana: 'Solana',
    fantom: 'Fantom',
    cronos: 'Cronos',
    moonbeam: 'Moonbeam',
    celo: 'Celo',
    harmony: 'Harmony',
    metis: 'Metis',
    gnosis: 'Gnosis',
    aurora: 'Aurora',
    klaytn: 'Klaytn',
    evmos: 'Evmos',
    kava: 'Kava',
    linea: 'Linea',
    scroll: 'Scroll',
    zksync: 'zkSync',
    mantle: 'Mantle',
    blast: 'Blast',
    pulsechain: 'PulseChain',
    sui: 'Sui',
    aptos: 'Aptos',
    ton: 'TON',
    tron: 'Tron',
  };
  return chains[chainId] || chainId.charAt(0).toUpperCase() + chainId.slice(1);
}

export function getChainColor(chainId: string): string {
  const colors: Record<string, string> = {
    ethereum: '#627EEA',
    bsc: '#F0B90B',
    polygon: '#8247E5',
    arbitrum: '#28A0F0',
    optimism: '#FF0420',
    avalanche: '#E84142',
    base: '#0052FF',
    solana: '#9945FF',
    fantom: '#1969FF',
    blast: '#FCFC03',
  };
  return colors[chainId] || '#3B82F6';
}

export function getDexscreenerUrl(chainId: string, pairAddress: string): string {
  return `https://dexscreener.com/${chainId}/${pairAddress}`;
}
