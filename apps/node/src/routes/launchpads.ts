/**
 * Launchpad Routes
 * 
 * API endpoints for launchpad token data (Clanker, etc.)
 * Includes coverage verification and token intelligence.
 * Also provides proxy endpoints for Clanker API to avoid CORS issues.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Clanker API Base URL
const CLANKER_API_URL = 'https://www.clanker.world/api';

const LaunchpadQuerySchema = z.object({
  launchpad: z.string().optional(),
  chain: z.string().optional(),
  creator: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const CoverageQuerySchema = z.object({
  launchpad: z.string().default('clanker'),
  chain: z.string().default('base'),
});

export async function registerLaunchpadRoutes(fastify: FastifyInstance): Promise<void> {
  // Auth middleware
  const requireAuth = async (
    request: { jwtVerify: () => Promise<void> }, 
    reply: { status: (code: number) => { send: (body: unknown) => unknown } }
  ) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' },
      });
    }
  };

  /**
   * GET /launchpads/tokens
   * Get paginated list of launchpad tokens
   */
  fastify.get('/launchpads/tokens', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = LaunchpadQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: result.error.format(),
        },
      });
    }

    const { launchpad, chain, creator, page, limit } = result.data;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (launchpad) where.launchpad = launchpad;
    if (chain) where.chain = chain;
    if (creator) where.creatorAddress = creator.toLowerCase();

    const [tokens, total] = await Promise.all([
      fastify.prisma.launchpadToken.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          events: {
            take: 5,
            orderBy: { ts: 'desc' },
          },
        },
      }),
      fastify.prisma.launchpadToken.count({ where }),
    ]);

    return {
      success: true,
      data: tokens.map((t) => ({
        id: t.id,
        chain: t.chain,
        launchpad: t.launchpad,
        tokenAddress: t.tokenAddress,
        tokenName: t.tokenName,
        tokenSymbol: t.tokenSymbol,
        creatorAddress: t.creatorAddress,
        factoryAddress: t.factoryAddress,
        txHash: t.txHash,
        blockNumber: t.blockNumber.toString(),
        blockTimestamp: t.blockTimestamp?.toISOString(),
        version: t.version,
        verified: t.verified,
        meta: t.meta,
        createdAt: t.createdAt.toISOString(),
        events: t.events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          txHash: e.txHash,
          ts: e.ts.toISOString(),
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  /**
   * GET /launchpads/tokens/:address
   * Get specific token by address
   */
  fastify.get('/launchpads/tokens/:address', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { address } = request.params as { address: string };
    const { chain } = request.query as { chain?: string };

    const token = await fastify.prisma.launchpadToken.findFirst({
      where: {
        tokenAddress: address.toLowerCase(),
        ...(chain ? { chain } : {}),
      },
      include: {
        events: {
          orderBy: { ts: 'desc' },
          take: 20,
        },
      },
    });

    if (!token) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Token not found' },
      });
    }

    return {
      success: true,
      data: {
        id: token.id,
        chain: token.chain,
        launchpad: token.launchpad,
        tokenAddress: token.tokenAddress,
        tokenName: token.tokenName,
        tokenSymbol: token.tokenSymbol,
        creatorAddress: token.creatorAddress,
        factoryAddress: token.factoryAddress,
        txHash: token.txHash,
        blockNumber: token.blockNumber.toString(),
        blockTimestamp: token.blockTimestamp?.toISOString(),
        version: token.version,
        verified: token.verified,
        meta: token.meta,
        createdAt: token.createdAt.toISOString(),
        events: token.events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          data: e.data,
          txHash: e.txHash,
          blockNumber: e.blockNumber?.toString(),
          ts: e.ts.toISOString(),
        })),
      },
    };
  });

  /**
   * GET /launchpads/stats
   * Get launchpad statistics
   */
  fastify.get('/launchpads/stats', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { launchpad, chain } = request.query as { launchpad?: string; chain?: string };

    const where: Record<string, unknown> = {};
    if (launchpad) where.launchpad = launchpad;
    if (chain) where.chain = chain;

    const [total, last24h, last7d] = await Promise.all([
      fastify.prisma.launchpadToken.count({ where }),
      fastify.prisma.launchpadToken.count({
        where: {
          ...where,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      fastify.prisma.launchpadToken.count({
        where: {
          ...where,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Get top creators
    const topCreators = await fastify.prisma.launchpadToken.groupBy({
      by: ['creatorAddress'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    return {
      success: true,
      data: {
        totalTokens: total,
        tokensLast24h: last24h,
        tokensLast7d: last7d,
        topCreators: topCreators.map((c) => ({
          address: c.creatorAddress,
          count: c._count.id,
        })),
      },
    };
  });

  /**
   * GET /launchpads/coverage
   * Get launch detection coverage statistics
   */
  fastify.get('/launchpads/coverage', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = CoverageQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
        },
      });
    }

    const { launchpad, chain } = result.data;

    // Get latest coverage data
    const latest = await fastify.prisma.launchpadCoverage.findFirst({
      where: { chain, launchpad },
      orderBy: { windowEnd: 'desc' },
    });

    // Get historical coverage (last 7 days)
    const history = await fastify.prisma.launchpadCoverage.findMany({
      where: {
        chain,
        launchpad,
        windowEnd: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { windowEnd: 'desc' },
      take: 168, // Hourly data for 7 days
    });

    // Calculate average coverage
    const avgCoverage = history.length > 0
      ? history.reduce((sum, h) => sum + h.coveragePercent, 0) / history.length
      : null;

    return {
      success: true,
      data: {
        current: latest ? {
          coveragePercent: latest.coveragePercent,
          detectedCount: latest.detectedCount,
          estimatedTotal: latest.estimatedTotal,
          windowStart: latest.windowStart.toISOString(),
          windowEnd: latest.windowEnd.toISOString(),
          blockStart: latest.blockStart.toString(),
          blockEnd: latest.blockEnd.toString(),
        } : null,
        averageCoverage7d: avgCoverage,
        history: history.slice(0, 24).map(h => ({
          coveragePercent: h.coveragePercent,
          detectedCount: h.detectedCount,
          estimatedTotal: h.estimatedTotal,
          windowEnd: h.windowEnd.toISOString(),
        })),
        status: latest
          ? latest.coveragePercent >= 90 ? 'healthy'
          : latest.coveragePercent >= 80 ? 'warning'
          : 'critical'
          : 'unknown',
      },
    };
  });

  /**
   * GET /launchpads/tokens/:address/intelligence
   * Get intelligence data for a specific token
   */
  fastify.get('/launchpads/tokens/:address/intelligence', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { address } = request.params as { address: string };
    const tokenAddress = address.toLowerCase();

    // Get token
    const token = await fastify.prisma.launchpadToken.findFirst({
      where: { tokenAddress, chain: 'base' },
    });

    if (!token) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Token not found' },
      });
    }

    // Get holder snapshots
    const holderSnapshots = await fastify.prisma.holderSnapshot.findMany({
      where: { tokenAddress, chain: 'base' },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    // Get liquidity snapshots
    const liquiditySnapshots = await fastify.prisma.liquiditySnapshot.findMany({
      where: { tokenAddress, chain: 'base' },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    // Get signals for this token
    const signals = await fastify.prisma.signal.findMany({
      where: { token: tokenAddress, chain: 'base' },
      orderBy: { ts: 'desc' },
      take: 20,
    });

    // Calculate risk indicators
    const latestHolder = holderSnapshots[0];
    const latestLiquidity = liquiditySnapshots[0];
    const previousLiquidity = liquiditySnapshots[1];

    const riskIndicators = {
      highConcentration: latestHolder ? latestHolder.top10Percent >= 40 : false,
      creatorHolding: latestHolder ? latestHolder.creatorPercent >= 15 : false,
      liquidityDrop: (previousLiquidity && latestLiquidity)
        ? ((previousLiquidity.liquidityUsd - latestLiquidity.liquidityUsd) / previousLiquidity.liquidityUsd * 100) >= 30
        : false,
      lowLiquidity: latestLiquidity ? latestLiquidity.liquidityUsd < 1000 : false,
    };

    return {
      success: true,
      data: {
        token: {
          address: token.tokenAddress,
          name: token.tokenName,
          symbol: token.tokenSymbol,
          creator: token.creatorAddress,
          launchedAt: token.createdAt.toISOString(),
        },
        holders: latestHolder ? {
          top10Percent: latestHolder.top10Percent,
          top20Percent: latestHolder.top20Percent,
          creatorPercent: latestHolder.creatorPercent,
          holderCount: latestHolder.holderCount,
          concentrationScore: latestHolder.concentrationScore,
          lastUpdated: latestHolder.timestamp.toISOString(),
          topHolders: (latestHolder.meta as { topHolders?: unknown[] })?.topHolders || [],
        } : null,
        liquidity: latestLiquidity ? {
          currentUsd: latestLiquidity.liquidityUsd,
          poolAddress: latestLiquidity.poolAddress,
          dex: latestLiquidity.dex,
          lastUpdated: latestLiquidity.timestamp.toISOString(),
        } : null,
        liquidityHistory: liquiditySnapshots.map(l => ({
          liquidityUsd: l.liquidityUsd,
          eventType: l.eventType,
          timestamp: l.timestamp.toISOString(),
        })),
        signals: signals.map(s => ({
          id: s.id,
          type: s.signalType,
          severity: s.severity,
          title: s.title,
          summary: s.summary,
          ts: s.ts.toISOString(),
        })),
        riskIndicators,
        riskLevel: 
          Object.values(riskIndicators).filter(Boolean).length >= 3 ? 'high' :
          Object.values(riskIndicators).filter(Boolean).length >= 1 ? 'medium' : 'low',
      },
    };
  });

  // ==========================================
  // Clanker API Proxy Routes
  // ==========================================
  // These endpoints proxy requests to the Clanker API to avoid CORS issues
  // Docs: https://clanker.gitbook.io/clanker-documentation

  /**
   * GET /launchpads/clanker/tokens
   * Proxy to Clanker API: Get paginated list of tokens
   * 
   * Query params (all optional):
   * - q: Search query for token name or symbol
   * - fid: Filter by Farcaster user ID
   * - fids: Comma-separated Farcaster user IDs
   * - sort: 'asc' or 'desc' (default: desc)
   * - sortBy: 'market-cap', 'tx-h24', 'price-percent-h24', 'price-percent-h1', 'deployed-at'
   * - limit: Number of results (max 20)
   * - cursor: Pagination cursor
   * - includeUser: Include creator profile data
   * - includeMarket: Include real-time market data
   * - chainId: Filter by chain ID (8453 for Base)
   */
  fastify.get('/launchpads/clanker/tokens', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    try {
      const queryParams = request.query as Record<string, string | undefined>;
      const url = new URL(`${CLANKER_API_URL}/tokens`);
      
      // Forward all query parameters
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, value);
        }
      });

      // Default to Base chain if not specified
      if (!url.searchParams.has('chainId')) {
        url.searchParams.set('chainId', '8453');
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ClawFi-Dashboard/1.0',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error({ status: response.status, error: errorText }, 'Clanker API error');
        return reply.status(response.status).send({
          success: false,
          error: { 
            code: 'CLANKER_API_ERROR', 
            message: `Clanker API returned ${response.status}`,
            details: errorText,
          },
        });
      }

      const data = await response.json();
      return { success: true, ...data };
    } catch (error) {
      fastify.log.error(error, 'Failed to proxy Clanker API');
      return reply.status(500).send({
        success: false,
        error: { 
          code: 'PROXY_ERROR', 
          message: error instanceof Error ? error.message : 'Failed to fetch from Clanker API',
        },
      });
    }
  });

  /**
   * GET /launchpads/clanker/search
   * Proxy to Clanker API: Get tokens by creator (username or address)
   * 
   * Query params:
   * - q: Required - Farcaster username or wallet address
   * - limit: Number of results (1-50, default 20)
   * - offset: Pagination offset
   * - sort: 'asc' or 'desc'
   * - trustedOnly: Only return verified tokens
   */
  fastify.get('/launchpads/clanker/search', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { q } = request.query as { q?: string };
    
    if (!q) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Query parameter "q" is required' },
      });
    }

    try {
      const queryParams = request.query as Record<string, string | undefined>;
      const url = new URL(`${CLANKER_API_URL}/search-creator`);
      
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, value);
        }
      });

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ClawFi-Dashboard/1.0',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error({ status: response.status, error: errorText }, 'Clanker search API error');
        return reply.status(response.status).send({
          success: false,
          error: { 
            code: 'CLANKER_API_ERROR', 
            message: `Clanker API returned ${response.status}`,
          },
        });
      }

      const data = await response.json();
      return { success: true, ...data };
    } catch (error) {
      fastify.log.error(error, 'Failed to proxy Clanker search API');
      return reply.status(500).send({
        success: false,
        error: { 
          code: 'PROXY_ERROR', 
          message: error instanceof Error ? error.message : 'Failed to fetch from Clanker API',
        },
      });
    }
  });

  /**
   * GET /launchpads/clanker/token/:address
   * Proxy to Clanker API: Get token by contract address
   */
  fastify.get('/launchpads/clanker/token/:address', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { address } = request.params as { address: string };

    try {
      const url = new URL(`${CLANKER_API_URL}/tokens`);
      url.searchParams.set('q', address);
      url.searchParams.set('chainId', '8453');
      url.searchParams.set('includeMarket', 'true');
      url.searchParams.set('includeUser', 'true');

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ClawFi-Dashboard/1.0',
        },
      });

      if (!response.ok) {
        return reply.status(response.status).send({
          success: false,
          error: { code: 'CLANKER_API_ERROR', message: `Clanker API returned ${response.status}` },
        });
      }

      const data = await response.json() as { data?: unknown[] };
      
      if (!data.data || data.data.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Token not found on Clanker' },
        });
      }

      return { 
        success: true, 
        data: data.data[0],
      };
    } catch (error) {
      fastify.log.error(error, 'Failed to proxy Clanker token lookup');
      return reply.status(500).send({
        success: false,
        error: { 
          code: 'PROXY_ERROR', 
          message: error instanceof Error ? error.message : 'Failed to fetch from Clanker API',
        },
      });
    }
  });
}

