/**
 * Dexscreener API Routes - Full Integration
 * 
 * Exposes all Dexscreener endpoints via ClawFi API.
 * Based on https://docs.dexscreener.com/api/reference
 */

import type { FastifyInstance } from 'fastify';
import { 
  fetchTokenData, 
  fetchMultipleTokens, 
  searchTokens,
  getTrendingTokens,
  getLatestTokenProfiles,
  getLatestBoosts,
  getTopBoosts,
  getLatestCommunityTakeovers,
  getLatestAds,
  getTokenOrders,
  getPairsByAddress,
  getTokenPairs,
  getTokensByChain,
  getTokens,
  type TokenMarketData 
} from '../services/dexscreener.js';

export async function dexscreenerRoutes(app: FastifyInstance): Promise<void> {
  
  // ============================================
  // TOKEN MARKET DATA
  // ============================================

  /**
   * Get token market data
   * GET /dexscreener/token/:address
   */
  app.get<{
    Params: { address: string };
    Querystring: { chain?: string };
  }>('/dexscreener/token/:address', async (request, reply) => {
    const { address } = request.params;
    const { chain } = request.query;

    if (!address) {
      return reply.status(400).send({
        success: false,
        error: 'Token address required',
      });
    }

    const data = await fetchTokenData(address, chain);

    if (!data) {
      return reply.status(404).send({
        success: false,
        error: 'Token not found on Dexscreener',
      });
    }

    return { success: true, data };
  });

  /**
   * Get multiple tokens market data
   * POST /dexscreener/tokens
   */
  app.post<{
    Body: { addresses: string[] };
  }>('/dexscreener/tokens', async (request, reply) => {
    const { addresses } = request.body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Addresses array required',
      });
    }

    if (addresses.length > 100) {
      return reply.status(400).send({
        success: false,
        error: 'Maximum 100 addresses per request',
      });
    }

    const results = await fetchMultipleTokens(addresses);
    
    const data: Record<string, TokenMarketData> = {};
    for (const [addr, marketData] of results) {
      data[addr] = marketData;
    }

    return { success: true, data, count: results.size };
  });

  // ============================================
  // SEARCH
  // ============================================

  /**
   * Search tokens
   * GET /dexscreener/search
   */
  app.get<{
    Querystring: { q: string; chain?: string };
  }>('/dexscreener/search', async (request, reply) => {
    const { q, chain } = request.query;

    if (!q || q.length < 2) {
      return reply.status(400).send({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    let pairs = await searchTokens(q);

    if (chain) {
      pairs = pairs.filter(p => p.chainId === chain);
    }

    pairs = pairs.slice(0, 50);

    return {
      success: true,
      data: pairs.map(pair => ({
        address: pair.baseToken.address,
        name: pair.baseToken.name,
        symbol: pair.baseToken.symbol,
        chain: pair.chainId,
        priceUsd: pair.priceUsd,
        priceChange24h: pair.priceChange?.h24 || 0,
        volume24h: pair.volume?.h24 || 0,
        liquidity: pair.liquidity?.usd || 0,
        marketCap: pair.marketCap,
        dex: pair.dexId,
        pairAddress: pair.pairAddress,
        url: pair.url,
      })),
      count: pairs.length,
    };
  });

  // ============================================
  // TOKEN PROFILES
  // ============================================

  /**
   * Get latest token profiles
   * GET /dexscreener/profiles/latest
   */
  app.get('/dexscreener/profiles/latest', async () => {
    const profiles = await getLatestTokenProfiles();
    return { success: true, data: profiles, count: profiles.length };
  });

  // ============================================
  // TOKEN BOOSTS
  // ============================================

  /**
   * Get latest boosted tokens
   * GET /dexscreener/boosts/latest
   */
  app.get<{
    Querystring: { chain?: string };
  }>('/dexscreener/boosts/latest', async (request) => {
    const { chain } = request.query;
    let boosts = await getLatestBoosts();
    
    if (chain) {
      boosts = boosts.filter(b => b.chainId === chain);
    }
    
    return { success: true, data: boosts, count: boosts.length };
  });

  /**
   * Get top boosted tokens
   * GET /dexscreener/boosts/top
   */
  app.get<{
    Querystring: { chain?: string };
  }>('/dexscreener/boosts/top', async (request) => {
    const { chain } = request.query;
    let boosts = await getTopBoosts();
    
    if (chain) {
      boosts = boosts.filter(b => b.chainId === chain);
    }
    
    return { success: true, data: boosts, count: boosts.length };
  });

  /**
   * Get trending tokens (alias for boosts)
   * GET /dexscreener/trending
   */
  app.get<{
    Querystring: { chain?: string };
  }>('/dexscreener/trending', async (request) => {
    const { chain } = request.query;
    const tokens = await getTrendingTokens(chain);
    return { success: true, data: tokens.slice(0, 50), count: Math.min(tokens.length, 50) };
  });

  // ============================================
  // COMMUNITY TAKEOVERS
  // ============================================

  /**
   * Get latest community takeovers
   * GET /dexscreener/cto/latest
   */
  app.get<{
    Querystring: { chain?: string };
  }>('/dexscreener/cto/latest', async (request) => {
    const { chain } = request.query;
    let ctos = await getLatestCommunityTakeovers();
    
    if (chain) {
      ctos = ctos.filter(c => c.chainId === chain);
    }
    
    return { success: true, data: ctos, count: ctos.length };
  });

  // ============================================
  // ADS
  // ============================================

  /**
   * Get latest Dexscreener ads
   * GET /dexscreener/ads/latest
   */
  app.get<{
    Querystring: { chain?: string };
  }>('/dexscreener/ads/latest', async (request) => {
    const { chain } = request.query;
    let ads = await getLatestAds();
    
    if (chain) {
      ads = ads.filter(a => a.chainId === chain);
    }
    
    return { success: true, data: ads, count: ads.length };
  });

  // ============================================
  // ORDERS
  // ============================================

  /**
   * Get token orders (paid features)
   * GET /dexscreener/orders/:chainId/:tokenAddress
   */
  app.get<{
    Params: { chainId: string; tokenAddress: string };
  }>('/dexscreener/orders/:chainId/:tokenAddress', async (request, reply) => {
    const { chainId, tokenAddress } = request.params;

    if (!chainId || !tokenAddress) {
      return reply.status(400).send({
        success: false,
        error: 'chainId and tokenAddress required',
      });
    }

    const orders = await getTokenOrders(chainId, tokenAddress);
    return { success: true, data: orders, count: orders.length };
  });

  // ============================================
  // PAIRS
  // ============================================

  /**
   * Get pairs by address
   * GET /dexscreener/pairs/:chainId/:pairAddress
   */
  app.get<{
    Params: { chainId: string; pairAddress: string };
  }>('/dexscreener/pairs/:chainId/:pairAddress', async (request, reply) => {
    const { chainId, pairAddress } = request.params;

    if (!chainId || !pairAddress) {
      return reply.status(400).send({
        success: false,
        error: 'chainId and pairAddress required',
      });
    }

    const pairs = await getPairsByAddress(chainId, pairAddress);
    return { success: true, data: pairs, count: pairs.length };
  });

  /**
   * Get all pairs for a token on a chain
   * GET /dexscreener/token-pairs/:chainId/:tokenAddress
   */
  app.get<{
    Params: { chainId: string; tokenAddress: string };
  }>('/dexscreener/token-pairs/:chainId/:tokenAddress', async (request, reply) => {
    const { chainId, tokenAddress } = request.params;

    if (!chainId || !tokenAddress) {
      return reply.status(400).send({
        success: false,
        error: 'chainId and tokenAddress required',
      });
    }

    const pairs = await getTokenPairs(chainId, tokenAddress);
    return { 
      success: true, 
      data: pairs.map(p => ({
        pairAddress: p.pairAddress,
        dex: p.dexId,
        baseToken: p.baseToken,
        quoteToken: p.quoteToken,
        priceUsd: p.priceUsd,
        priceNative: p.priceNative,
        volume24h: p.volume?.h24,
        liquidity: p.liquidity?.usd,
        priceChange24h: p.priceChange?.h24,
        url: p.url,
      })),
      count: pairs.length,
    };
  });

  // ============================================
  // TOKENS BY CHAIN
  // ============================================

  /**
   * Get tokens by chain and addresses
   * POST /dexscreener/tokens/:chainId
   */
  app.post<{
    Params: { chainId: string };
    Body: { addresses: string[] };
  }>('/dexscreener/tokens/:chainId', async (request, reply) => {
    const { chainId } = request.params;
    const { addresses } = request.body;

    if (!chainId) {
      return reply.status(400).send({
        success: false,
        error: 'chainId required',
      });
    }

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Addresses array required',
      });
    }

    const pairs = await getTokensByChain(chainId, addresses);
    return { success: true, data: pairs, count: pairs.length };
  });

  // ============================================
  // RAW PAIRS DATA
  // ============================================

  /**
   * Get raw pairs data for tokens
   * GET /dexscreener/raw/:tokenAddress
   */
  app.get<{
    Params: { tokenAddress: string };
  }>('/dexscreener/raw/:tokenAddress', async (request, reply) => {
    const { tokenAddress } = request.params;

    if (!tokenAddress) {
      return reply.status(400).send({
        success: false,
        error: 'tokenAddress required',
      });
    }

    const pairs = await getTokens(tokenAddress);
    return { success: true, data: pairs, count: pairs.length };
  });

  // ============================================
  // LAUNCHPAD ENRICHMENT
  // ============================================

  /**
   * Enrich launchpad tokens with market data
   * GET /dexscreener/enrich-launchpad
   */
  app.get<{
    Querystring: { launchpad?: string; chain?: string; limit?: string };
  }>('/dexscreener/enrich-launchpad', async (request, reply) => {
    const { launchpad, chain, limit } = request.query;
    const maxLimit = Math.min(parseInt(limit || '20'), 50);

    const tokens = await request.server.prisma.launchpadToken.findMany({
      where: {
        ...(launchpad && { launchpad }),
        ...(chain && { chain }),
      },
      orderBy: { blockTimestamp: 'desc' },
      take: maxLimit,
    });

    if (tokens.length === 0) {
      return { success: true, data: [], count: 0 };
    }

    const addresses = tokens.map(t => t.tokenAddress);
    const marketDataMap = await fetchMultipleTokens(addresses);

    const enrichedTokens = tokens.map(token => {
      const marketData = marketDataMap.get(token.tokenAddress.toLowerCase());
      return {
        ...token,
        blockNumber: token.blockNumber?.toString(),
        marketData: marketData || null,
      };
    });

    return { success: true, data: enrichedTokens, count: enrichedTokens.length };
  });
}
