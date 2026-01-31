/**
 * Signal Routes
 * List and acknowledge signals
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SignalFilter } from '@clawfi/core';

const SignalFilterSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  strategyId: z.string().optional(),
  chain: z.string().optional(),
  token: z.string().optional(),
  wallet: z.string().optional(),
  acknowledged: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : val,
    z.boolean().optional()
  ),
  startTs: z.coerce.number().optional(),
  endTs: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function registerSignalRoutes(fastify: FastifyInstance): Promise<void> {
  // Auth middleware
  const requireAuth = async (request: { jwtVerify: () => Promise<void> }, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) => {
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
   * GET /signals
   * Get paginated signals with optional filters
   */
  fastify.get('/signals', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = SignalFilterSchema.safeParse(request.query);
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

    const { page, limit, ...filter } = result.data;

    const signals = await fastify.signalService.getSignals(
      filter as SignalFilter,
      page,
      limit
    );

    return {
      success: true,
      data: signals.data,
      pagination: signals.pagination,
    };
  });

  /**
   * GET /signals/token
   * Get signals for a specific token (used by extension)
   * 
   * Query params:
   * - token: Token address (required)
   * - chain: Chain name (optional, e.g., 'base', 'eth')
   * - limit: Max number of signals to return (default: 10, max: 50)
   */
  fastify.get('/signals/token', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { token, chain, limit } = request.query as { 
      token?: string; 
      chain?: string; 
      limit?: string;
    };

    if (!token) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Token address is required' },
      });
    }

    // Parse and constrain limit
    const maxLimit = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50);

    const signals = await fastify.signalService.getSignalsByToken(
      token.toLowerCase(), 
      chain?.toLowerCase(),
      maxLimit
    );

    return {
      success: true,
      data: signals,
    };
  });

  /**
   * POST /signals/:id/acknowledge
   * Acknowledge a signal
   */
  fastify.post('/signals/:id/acknowledge', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    try {
      const signal = await fastify.signalService.acknowledge(id, request.user.userId);

      await fastify.auditService.log({
        action: 'signal_acknowledged',
        userId: request.user.userId,
        resource: 'signal',
        resourceId: id,
        success: true,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return {
        success: true,
        data: signal,
      };
    } catch (error) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Signal not found' },
      });
    }
  });
}

