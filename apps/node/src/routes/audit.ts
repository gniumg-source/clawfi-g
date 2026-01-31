/**
 * Audit Routes
 * View audit logs
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuditLogFilter } from '@clawfi/core';

const AuditFilterSchema = z.object({
  action: z.string().optional(),
  userId: z.string().optional(),
  resource: z.string().optional(),
  success: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : val,
    z.boolean().optional()
  ),
  startTs: z.coerce.number().optional(),
  endTs: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function registerAuditRoutes(fastify: FastifyInstance): Promise<void> {
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
   * GET /audit
   * Get paginated audit logs
   */
  fastify.get('/audit', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = AuditFilterSchema.safeParse(request.query);
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

    const logs = await fastify.auditService.getLogs(
      filter as AuditLogFilter,
      page,
      limit
    );

    return {
      success: true,
      data: logs.data,
      pagination: logs.pagination,
    };
  });
}


