/**
 * Risk Routes
 * Policy management and kill switch
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const UpdatePolicySchema = z.object({
  maxOrderUsd: z.number().nonnegative().optional(),
  maxPositionUsd: z.number().nonnegative().optional(),
  maxDailyLossUsd: z.number().nonnegative().optional(),
  maxSlippageBps: z.number().int().min(0).max(10000).optional(),
  cooldownSeconds: z.number().int().min(0).optional(),
  tokenAllowlist: z.array(z.string()).optional(),
  tokenDenylist: z.array(z.string()).optional(),
  venueAllowlist: z.array(z.string()).optional(),
  chainAllowlist: z.array(z.string()).optional(),
  dryRunMode: z.boolean().optional(),
});

const KillSwitchSchema = z.object({
  active: z.boolean(),
  reason: z.string().optional(),
});

export async function registerRiskRoutes(fastify: FastifyInstance): Promise<void> {
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
   * GET /risk/policy
   * Get current risk policy
   */
  fastify.get('/risk/policy', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const policy = fastify.riskEngine.getPolicy();

    return {
      success: true,
      data: policy,
    };
  });

  /**
   * POST /risk/policy
   * Update risk policy
   */
  fastify.post('/risk/policy', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = UpdatePolicySchema.safeParse(request.body);
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

    const policy = await fastify.riskEngine.updatePolicy(result.data);

    await fastify.auditService.log({
      action: 'risk_policy_updated',
      userId: request.user.userId,
      resource: 'risk_policy',
      details: { updatedFields: Object.keys(result.data) },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: policy,
    };
  });

  /**
   * POST /risk/killswitch
   * Enable or disable kill switch
   */
  fastify.post('/risk/killswitch', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = KillSwitchSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
        },
      });
    }

    const { active, reason } = result.data;
    const newState = await fastify.riskEngine.setKillSwitch(active);

    await fastify.auditService.log({
      action: active ? 'kill_switch_enabled' : 'kill_switch_disabled',
      userId: request.user.userId,
      resource: 'kill_switch',
      details: { reason },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: { active: newState },
    };
  });
}


