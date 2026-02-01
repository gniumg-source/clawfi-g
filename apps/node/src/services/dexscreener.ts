/**
 * Dexscreener Service - Full API Integration
 * 
 * All endpoints from https://docs.dexscreener.com/api/reference
 * Public API - no auth required, rate limit 60 req/min
 */

// ============================================
// TYPES
// ============================================

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
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: { url: string }[];
    socials?: { type: string; url: string }[];
  };
}

export interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: { type?: string; label?: string; url: string }[];
}

export interface TokenBoost {
  url: string;
  chainId: string;
  tokenAddress: string;
  amount: number;
  totalAmount: number;
  icon?: string;
  description?: string;
  links?: { type?: string; label?: string; url: string }[];
}

export interface CommunityTakeover {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: { type?: string; label?: string; url: string }[];
  claimDate: string;
}

export interface DexscreenerAd {
  url: string;
  chainId: string;
  tokenAddress: string;
  date: string;
  type: string;
  durationHours?: number;
  impressions?: number;
}

export interface TokenOrder {
  type: string;
  status: string;
  paymentTimestamp?: number;
}

export interface TokenMarketData {
  address: string;
  chain: string;
  name?: string;
  symbol?: string;
  priceUsd: number;
  priceNative: string;
  volume24h: number;
  volumeH1: number;
  volumeM5: number;
  priceChange24h: number;
  priceChangeH1: number;
  priceChangeM5: number;
  liquidity: number;
  marketCap?: number;
  fdv?: number;
  txns24h: { buys: number; sells: number };
  txnsH1: { buys: number; sells: number };
  pairAddress: string;
  dex: string;
  dexscreenerUrl: string;
  pairCreatedAt?: Date;
  imageUrl?: string;
  websites?: { url: string }[];
  socials?: { type: string; url: string }[];
}

// ============================================
// CONSTANTS
// ============================================

const API_BASE = 'https://api.dexscreener.com';
const CACHE_TTL_MS = 30000; // 30 seconds

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Map Dexscreener chain ID to ClawFi chain name
 */
function mapChainId(chainId: string): string {
  const mapping: Record<string, string> = {
    'ethereum': 'ethereum',
    'base': 'base',
    'arbitrum': 'arbitrum',
    'bsc': 'bsc',
    'polygon': 'polygon',
    'solana': 'solana',
    'avalanche': 'avalanche',
    'optimism': 'optimism',
  };
  return mapping[chainId] || chainId;
}

// ============================================
// TOKEN PROFILES
// ============================================

/**
 * GET /token-profiles/latest/v1
 * Get the latest token profiles
 */
export async function getLatestTokenProfiles(): Promise<TokenProfile[]> {
  const cacheKey = 'profiles:latest';
  const cached = getCached<TokenProfile[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/token-profiles/latest/v1`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = Array.isArray(data) ? data : [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] Token profiles error:', error);
    return [];
  }
}

// ============================================
// TOKEN BOOSTS
// ============================================

/**
 * GET /token-boosts/latest/v1
 * Get the latest boosted tokens
 */
export async function getLatestBoosts(): Promise<TokenBoost[]> {
  const cacheKey = 'boosts:latest';
  const cached = getCached<TokenBoost[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/token-boosts/latest/v1`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = Array.isArray(data) ? data : [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] Latest boosts error:', error);
    return [];
  }
}

/**
 * GET /token-boosts/top/v1
 * Get tokens with most active boosts
 */
export async function getTopBoosts(): Promise<TokenBoost[]> {
  const cacheKey = 'boosts:top';
  const cached = getCached<TokenBoost[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/token-boosts/top/v1`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = Array.isArray(data) ? data : [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] Top boosts error:', error);
    return [];
  }
}

// ============================================
// COMMUNITY TAKEOVERS
// ============================================

/**
 * GET /community-takeovers/latest/v1
 * Get the latest community takeovers
 */
export async function getLatestCommunityTakeovers(): Promise<CommunityTakeover[]> {
  const cacheKey = 'cto:latest';
  const cached = getCached<CommunityTakeover[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/community-takeovers/latest/v1`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = Array.isArray(data) ? data : [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] CTO error:', error);
    return [];
  }
}

// ============================================
// ADS
// ============================================

/**
 * GET /ads/latest/v1
 * Get the latest ads
 */
export async function getLatestAds(): Promise<DexscreenerAd[]> {
  const cacheKey = 'ads:latest';
  const cached = getCached<DexscreenerAd[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/ads/latest/v1`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = Array.isArray(data) ? data : [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] Ads error:', error);
    return [];
  }
}

// ============================================
// ORDERS
// ============================================

/**
 * GET /orders/v1/{chainId}/{tokenAddress}
 * Check orders paid for a token
 */
export async function getTokenOrders(chainId: string, tokenAddress: string): Promise<TokenOrder[]> {
  const cacheKey = `orders:${chainId}:${tokenAddress}`;
  const cached = getCached<TokenOrder[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/orders/v1/${chainId}/${tokenAddress}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = Array.isArray(data) ? data : [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] Orders error:', error);
    return [];
  }
}

// ============================================
// PAIRS
// ============================================

/**
 * GET /latest/dex/pairs/{chainId}/{pairAddresses}
 * Get one or multiple pairs by chain and pair address
 */
export async function getPairsByAddress(chainId: string, pairAddresses: string | string[]): Promise<DexscreenerPair[]> {
  const addresses = Array.isArray(pairAddresses) ? pairAddresses.join(',') : pairAddresses;
  const cacheKey = `pairs:${chainId}:${addresses}`;
  const cached = getCached<DexscreenerPair[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/latest/dex/pairs/${chainId}/${addresses}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = data.pairs || [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] Pairs error:', error);
    return [];
  }
}

/**
 * GET /token-pairs/v1/{chainId}/{tokenAddress}
 * Get all pairs for a token on a specific chain
 */
export async function getTokenPairs(chainId: string, tokenAddress: string): Promise<DexscreenerPair[]> {
  const cacheKey = `token-pairs:${chainId}:${tokenAddress}`;
  const cached = getCached<DexscreenerPair[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/token-pairs/v1/${chainId}/${tokenAddress}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = data.pairs || [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] Token pairs error:', error);
    return [];
  }
}

// ============================================
// TOKENS
// ============================================

/**
 * GET /tokens/v1/{chainId}/{tokenAddresses}
 * Get tokens by chain and addresses (up to 30)
 */
export async function getTokensByChain(chainId: string, tokenAddresses: string[]): Promise<DexscreenerPair[]> {
  const addresses = tokenAddresses.slice(0, 30).join(',');
  const cacheKey = `tokens:${chainId}:${addresses}`;
  const cached = getCached<DexscreenerPair[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/tokens/v1/${chainId}/${addresses}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = data.pairs || [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] Tokens by chain error:', error);
    return [];
  }
}

/**
 * GET /latest/dex/tokens/{tokenAddresses}
 * Search for pairs matching token addresses (any chain)
 */
export async function getTokens(tokenAddresses: string | string[]): Promise<DexscreenerPair[]> {
  const addresses = Array.isArray(tokenAddresses) ? tokenAddresses.join(',') : tokenAddresses;
  const cacheKey = `tokens:${addresses}`;
  const cached = getCached<DexscreenerPair[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/latest/dex/tokens/${addresses}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = data.pairs || [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] Tokens error:', error);
    return [];
  }
}

// ============================================
// SEARCH
// ============================================

/**
 * GET /latest/dex/search?q={query}
 * Search for pairs matching query
 */
export async function searchTokens(query: string): Promise<DexscreenerPair[]> {
  const cacheKey = `search:${query}`;
  const cached = getCached<DexscreenerPair[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = data.pairs || [];
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Dexscreener] Search error:', error);
    return [];
  }
}

// ============================================
// HIGH-LEVEL FUNCTIONS
// ============================================

/**
 * Fetch complete token market data (combines multiple endpoints)
 */
export async function fetchTokenData(tokenAddress: string, chain?: string): Promise<TokenMarketData | null> {
  const cacheKey = `marketdata:${chain || 'any'}:${tokenAddress.toLowerCase()}`;
  const cached = getCached<TokenMarketData>(cacheKey);
  if (cached) return cached;

  try {
    let pairs: DexscreenerPair[];
    
    if (chain) {
      // Use chain-specific endpoint for better results
      pairs = await getTokenPairs(chain, tokenAddress);
    } else {
      // Search across all chains
      pairs = await getTokens(tokenAddress);
    }

    if (!pairs || pairs.length === 0) {
      return null;
    }

    // Filter by chain if specified
    if (chain) {
      pairs = pairs.filter(p => mapChainId(p.chainId) === chain);
    }

    if (pairs.length === 0) {
      return null;
    }

    // Get the pair with highest liquidity
    const bestPair = pairs.reduce((best, current) => {
      const bestLiq = best.liquidity?.usd || 0;
      const currentLiq = current.liquidity?.usd || 0;
      return currentLiq > bestLiq ? current : best;
    });

    const marketData: TokenMarketData = {
      address: bestPair.baseToken.address,
      chain: mapChainId(bestPair.chainId),
      name: bestPair.baseToken.name,
      symbol: bestPair.baseToken.symbol,
      priceUsd: parseFloat(bestPair.priceUsd) || 0,
      priceNative: bestPair.priceNative,
      volume24h: bestPair.volume?.h24 || 0,
      volumeH1: bestPair.volume?.h1 || 0,
      volumeM5: bestPair.volume?.m5 || 0,
      priceChange24h: bestPair.priceChange?.h24 || 0,
      priceChangeH1: bestPair.priceChange?.h1 || 0,
      priceChangeM5: bestPair.priceChange?.m5 || 0,
      liquidity: bestPair.liquidity?.usd || 0,
      marketCap: bestPair.marketCap,
      fdv: bestPair.fdv,
      txns24h: bestPair.txns?.h24 || { buys: 0, sells: 0 },
      txnsH1: bestPair.txns?.h1 || { buys: 0, sells: 0 },
      pairAddress: bestPair.pairAddress,
      dex: bestPair.dexId,
      dexscreenerUrl: bestPair.url,
      pairCreatedAt: bestPair.pairCreatedAt ? new Date(bestPair.pairCreatedAt) : undefined,
      imageUrl: bestPair.info?.imageUrl,
      websites: bestPair.info?.websites,
      socials: bestPair.info?.socials,
    };

    setCache(cacheKey, marketData);
    return marketData;
  } catch (error) {
    console.error('[Dexscreener] Fetch token data error:', error);
    return null;
  }
}

/**
 * Fetch multiple tokens at once
 */
export async function fetchMultipleTokens(tokenAddresses: string[]): Promise<Map<string, TokenMarketData>> {
  const results = new Map<string, TokenMarketData>();
  
  // Dexscreener supports comma-separated addresses (up to ~30)
  const chunks: string[][] = [];
  for (let i = 0; i < tokenAddresses.length; i += 30) {
    chunks.push(tokenAddresses.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    try {
      const pairs = await getTokens(chunk);
      
      if (!pairs) continue;

      // Group pairs by base token address
      const pairsByToken = new Map<string, DexscreenerPair[]>();
      for (const pair of pairs) {
        const addr = pair.baseToken.address.toLowerCase();
        const existing = pairsByToken.get(addr) || [];
        existing.push(pair);
        pairsByToken.set(addr, existing);
      }

      // Get best pair for each token
      for (const [addr, tokenPairs] of pairsByToken) {
        const bestPair = tokenPairs.reduce((best, current) => {
          const bestLiq = best.liquidity?.usd || 0;
          const currentLiq = current.liquidity?.usd || 0;
          return currentLiq > bestLiq ? current : best;
        });

        results.set(addr, {
          address: bestPair.baseToken.address,
          chain: mapChainId(bestPair.chainId),
          name: bestPair.baseToken.name,
          symbol: bestPair.baseToken.symbol,
          priceUsd: parseFloat(bestPair.priceUsd) || 0,
          priceNative: bestPair.priceNative,
          volume24h: bestPair.volume?.h24 || 0,
          volumeH1: bestPair.volume?.h1 || 0,
          volumeM5: bestPair.volume?.m5 || 0,
          priceChange24h: bestPair.priceChange?.h24 || 0,
          priceChangeH1: bestPair.priceChange?.h1 || 0,
          priceChangeM5: bestPair.priceChange?.m5 || 0,
          liquidity: bestPair.liquidity?.usd || 0,
          marketCap: bestPair.marketCap,
          fdv: bestPair.fdv,
          txns24h: bestPair.txns?.h24 || { buys: 0, sells: 0 },
          txnsH1: bestPair.txns?.h1 || { buys: 0, sells: 0 },
          pairAddress: bestPair.pairAddress,
          dex: bestPair.dexId,
          dexscreenerUrl: bestPair.url,
          pairCreatedAt: bestPair.pairCreatedAt ? new Date(bestPair.pairCreatedAt) : undefined,
          imageUrl: bestPair.info?.imageUrl,
          websites: bestPair.info?.websites,
          socials: bestPair.info?.socials,
        });
      }
    } catch (error) {
      console.error('[Dexscreener] Batch fetch error:', error);
    }
  }

  return results;
}

/**
 * Get trending tokens (combines boosts + profiles)
 */
export async function getTrendingTokens(chain?: string): Promise<TokenBoost[]> {
  const boosts = await getLatestBoosts();
  
  if (chain) {
    return boosts.filter(b => mapChainId(b.chainId) === chain);
  }
  
  return boosts;
}

// Export all functions
export const dexscreenerService = {
  // Token profiles
  getLatestTokenProfiles,
  
  // Boosts
  getLatestBoosts,
  getTopBoosts,
  
  // Community takeovers
  getLatestCommunityTakeovers,
  
  // Ads
  getLatestAds,
  
  // Orders
  getTokenOrders,
  
  // Pairs
  getPairsByAddress,
  getTokenPairs,
  
  // Tokens
  getTokensByChain,
  getTokens,
  
  // Search
  searchTokens,
  
  // High-level
  fetchTokenData,
  fetchMultipleTokens,
  getTrendingTokens,
};
