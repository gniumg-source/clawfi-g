/**
 * Watchlist Routes
 * 
 * API endpoints for managing watched tokens and wallets
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============================================
// Types
// ============================================

interface WatchTokenParams {
  chain: string;
  address: string;
}

interface WatchTokenBody {
  tokenSymbol?: string;
  tokenName?: string;
  enabled?: boolean;
  priceAlertEnabled?: boolean;
  priceAlertThreshold?: number;
  notes?: string;
}

interface WatchWalletBody {
  chain: string;
  address: string;
  label?: string;
  enabled?: boolean;
  notes?: string;
}

interface ListParams {
  chain?: string;
  enabled?: string;
  limit?: string;
  offset?: string;
}

// ============================================
// Routes
// ============================================

export async function registerWatchlistRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /watchlist/tokens
   * List watched tokens
   */
  fastify.get('/watchlist/tokens', async (request: FastifyRequest<{ Querystring: ListParams }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { chain, enabled, limit = '50', offset = '0' } = request.query;

    const where: Record<string, unknown> = {};
    if (chain) where.chain = chain;
    if (enabled !== undefined) where.enabled = enabled === 'true';

    const [tokens, total] = await Promise.all([
      fastify.prisma.watchedToken.findMany({
        where,
        take: Math.min(parseInt(limit, 10), 100),
        skip: parseInt(offset, 10),
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.watchedToken.count({ where }),
    ]);

    return {
      success: true,
      data: tokens,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    };
  });

  /**
   * POST /watchlist/tokens
   * Add token to watchlist
   */
  fastify.post('/watchlist/tokens', async (request: FastifyRequest<{ Body: WatchTokenBody & { chain: string; address: string } }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { chain, address, tokenSymbol, tokenName, enabled = true, priceAlertEnabled, priceAlertThreshold, notes } = request.body;

    if (!chain || !address) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Chain and address are required' },
      });
    }

    const token = await fastify.prisma.watchedToken.upsert({
      where: {
        chain_tokenAddress: {
          chain: chain.toLowerCase(),
          tokenAddress: address.toLowerCase(),
        },
      },
      create: {
        chain: chain.toLowerCase(),
        tokenAddress: address.toLowerCase(),
        tokenSymbol,
        tokenName,
        enabled,
        priceAlertEnabled: priceAlertEnabled ?? false,
        priceAlertThreshold: priceAlertThreshold ?? 10,
        notes,
      },
      update: {
        tokenSymbol,
        tokenName,
        enabled,
        priceAlertEnabled,
        priceAlertThreshold,
        notes,
        updatedAt: new Date(),
      },
    });

    return reply.status(201).send({
      success: true,
      data: token,
    });
  });

  /**
   * GET /watchlist/tokens/:chain/:address
   * Get specific watched token
   */
  fastify.get('/watchlist/tokens/:chain/:address', async (request: FastifyRequest<{ Params: WatchTokenParams }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { chain, address } = request.params;

    const token = await fastify.prisma.watchedToken.findUnique({
      where: {
        chain_tokenAddress: {
          chain: chain.toLowerCase(),
          tokenAddress: address.toLowerCase(),
        },
      },
    });

    if (!token) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Token not found in watchlist' },
      });
    }

    return { success: true, data: token };
  });

  /**
   * PATCH /watchlist/tokens/:chain/:address
   * Update watched token
   */
  fastify.patch('/watchlist/tokens/:chain/:address', async (request: FastifyRequest<{ Params: WatchTokenParams; Body: WatchTokenBody }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { chain, address } = request.params;
    const updates = request.body;

    const token = await fastify.prisma.watchedToken.update({
      where: {
        chain_tokenAddress: {
          chain: chain.toLowerCase(),
          tokenAddress: address.toLowerCase(),
        },
      },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    return { success: true, data: token };
  });

  /**
   * DELETE /watchlist/tokens/:chain/:address
   * Remove token from watchlist
   */
  fastify.delete('/watchlist/tokens/:chain/:address', async (request: FastifyRequest<{ Params: WatchTokenParams }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { chain, address } = request.params;

    await fastify.prisma.watchedToken.delete({
      where: {
        chain_tokenAddress: {
          chain: chain.toLowerCase(),
          tokenAddress: address.toLowerCase(),
        },
      },
    });

    return { success: true, message: 'Token removed from watchlist' };
  });

  /**
   * GET /watchlist/wallets
   * List watched wallets
   */
  fastify.get('/watchlist/wallets', async (request: FastifyRequest<{ Querystring: ListParams }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { chain, enabled, limit = '50', offset = '0' } = request.query;

    const where: Record<string, unknown> = {};
    if (chain) where.chain = chain;
    if (enabled !== undefined) where.enabled = enabled === 'true';

    const [wallets, total] = await Promise.all([
      fastify.prisma.watchedWallet.findMany({
        where,
        take: Math.min(parseInt(limit, 10), 100),
        skip: parseInt(offset, 10),
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.watchedWallet.count({ where }),
    ]);

    return {
      success: true,
      data: wallets,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      },
    };
  });

  /**
   * POST /watchlist/wallets
   * Add wallet to watchlist
   */
  fastify.post('/watchlist/wallets', async (request: FastifyRequest<{ Body: WatchWalletBody }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { chain, address, label, enabled = true, notes } = request.body;

    if (!chain || !address) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Chain and address are required' },
      });
    }

    const wallet = await fastify.prisma.watchedWallet.upsert({
      where: {
        chain_walletAddress: {
          chain: chain.toLowerCase(),
          walletAddress: address.toLowerCase(),
        },
      },
      create: {
        chain: chain.toLowerCase(),
        walletAddress: address.toLowerCase(),
        label,
        enabled,
        notes,
      },
      update: {
        label,
        enabled,
        notes,
        updatedAt: new Date(),
      },
    });

    return reply.status(201).send({
      success: true,
      data: wallet,
    });
  });

  /**
   * DELETE /watchlist/wallets/:chain/:address
   * Remove wallet from watchlist
   */
  fastify.delete('/watchlist/wallets/:chain/:address', async (request: FastifyRequest<{ Params: WatchTokenParams }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { chain, address } = request.params;

    await fastify.prisma.watchedWallet.delete({
      where: {
        chain_walletAddress: {
          chain: chain.toLowerCase(),
          walletAddress: address.toLowerCase(),
        },
      },
    });

    return { success: true, message: 'Wallet removed from watchlist' };
  });

  /**
   * GET /watchlist/stats
   * Get watchlist statistics
   */
  fastify.get('/watchlist/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const [tokenCount, walletCount, tokensByChain, walletsByChain] = await Promise.all([
      fastify.prisma.watchedToken.count({ where: { enabled: true } }),
      fastify.prisma.watchedWallet.count({ where: { enabled: true } }),
      fastify.prisma.watchedToken.groupBy({
        by: ['chain'],
        _count: { chain: true },
        where: { enabled: true },
      }),
      fastify.prisma.watchedWallet.groupBy({
        by: ['chain'],
        _count: { chain: true },
        where: { enabled: true },
      }),
    ]);

    return {
      success: true,
      data: {
        tokens: {
          total: tokenCount,
          byChain: tokensByChain.reduce((acc, g) => ({ ...acc, [g.chain]: g._count.chain }), {}),
        },
        wallets: {
          total: walletCount,
          byChain: walletsByChain.reduce((acc, g) => ({ ...acc, [g.chain]: g._count.chain }), {}),
        },
      },
    };
  });
}
