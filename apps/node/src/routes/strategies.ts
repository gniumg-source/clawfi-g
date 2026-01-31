/**
 * Strategy Routes
 * Enable, disable, and configure strategies
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const UpdateStrategySchema = z.object({
  status: z.enum(['enabled', 'disabled']).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  config: z.record(z.unknown()).optional(),
});

export async function registerStrategyRoutes(fastify: FastifyInstance): Promise<void> {
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
   * GET /strategies
   * List all strategies
   */
  fastify.get('/strategies', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const strategies = await fastify.prisma.strategy.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: strategies.map((s) => ({
        id: s.id,
        strategyType: s.strategyType,
        name: s.name,
        description: s.description ?? undefined,
        status: s.status,
        config: s.config,
        createdAt: s.createdAt.getTime(),
        updatedAt: s.updatedAt.getTime(),
      })),
    };
  });

  /**
   * GET /strategies/:id
   * Get a specific strategy
   */
  fastify.get('/strategies/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    const strategy = await fastify.prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Strategy not found' },
      });
    }

    return {
      success: true,
      data: {
        id: strategy.id,
        strategyType: strategy.strategyType,
        name: strategy.name,
        description: strategy.description ?? undefined,
        status: strategy.status,
        config: strategy.config,
        createdAt: strategy.createdAt.getTime(),
        updatedAt: strategy.updatedAt.getTime(),
      },
    };
  });

  /**
   * PATCH /strategies/:id
   * Update a strategy
   */
  fastify.patch('/strategies/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    const result = UpdateStrategySchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: result.error.format(),
        },
      });
    }

    const strategy = await fastify.prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Strategy not found' },
      });
    }

    const { status, name, description, config } = result.data;

    // Handle status changes through scheduler
    if (status && status !== strategy.status) {
      if (status === 'enabled') {
        await fastify.strategyScheduler.enableStrategy(id);
        await fastify.auditService.log({
          action: 'strategy_enabled',
          userId: request.user.userId,
          resource: 'strategy',
          resourceId: id,
          success: true,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });
      } else if (status === 'disabled') {
        await fastify.strategyScheduler.disableStrategy(id);
        await fastify.auditService.log({
          action: 'strategy_disabled',
          userId: request.user.userId,
          resource: 'strategy',
          resourceId: id,
          success: true,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }
    }

    // Update other fields
    const updated = await fastify.prisma.strategy.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(config && { config }),
      },
    });

    if (config) {
      await fastify.auditService.log({
        action: 'strategy_config_updated',
        userId: request.user.userId,
        resource: 'strategy',
        resourceId: id,
        details: { configKeys: Object.keys(config) },
        success: true,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
    }

    return {
      success: true,
      data: {
        id: updated.id,
        strategyType: updated.strategyType,
        name: updated.name,
        description: updated.description ?? undefined,
        status: updated.status,
        config: updated.config,
        createdAt: updated.createdAt.getTime(),
        updatedAt: updated.updatedAt.getTime(),
      },
    };
  });
}


