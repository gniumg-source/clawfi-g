/**
 * Dev Routes
 * Development-only endpoints for testing
 * 
 * These routes are ONLY available when DEV_MODE=true
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CreateSignal, Chain, Event } from '@clawfi/core';

const SimulateEventSchema = z.object({
  type: z.enum(['LaunchDetected', 'MoltDetected', 'transfer', 'swap', 'custom']),
  wallet: z.string().optional(),
  token: z.string().optional(),
  tokenSymbol: z.string().optional(),
  chain: z.string().default('base'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  meta: z.record(z.unknown()).optional(),
});

const SimulateLaunchSchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenName: z.string().optional(),
  tokenSymbol: z.string().optional(),
  creatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  factoryAddress: z.string().optional(),
  txHash: z.string().optional(),
  blockNumber: z.number().optional(),
});

export async function registerDevRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.log.warn('⚠️  Dev routes are enabled. Do not use in production!');

  /**
   * POST /dev/simulate-event
   * Simulate an event to test signal generation and strategy engine
   */
  fastify.post('/dev/simulate-event', async (request, reply) => {
    // Require auth even in dev mode
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' },
      });
    }

    const result = SimulateEventSchema.safeParse(request.body);
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

    const { type, wallet, token, tokenSymbol, chain, severity, meta } = result.data;
    
    let signalType = type;
    let title = `[DEV] Simulated ${type}`;
    let summary = `Simulated event for testing`;

    // Handle specific signal types
    if (type === 'LaunchDetected') {
      title = '[DEV] Clanker launch detected';
      summary = `Simulated new token ${tokenSymbol || token || 'Unknown'} deployed on Clanker`;
    } else if (type === 'MoltDetected') {
      title = '[DEV] Wallet molt detected';
      summary = `Simulated wallet rotation from ${wallet || 'unknown'}`;
      signalType = 'MoltDetected';
    }

    // Create the signal
    const signalData: CreateSignal & { signalType?: string } = {
      severity,
      signalType,
      title,
      summary,
      token: token as `0x${string}` | undefined,
      tokenSymbol,
      chain: chain as Chain,
      wallet: wallet as `0x${string}` | undefined,
      strategyId: type === 'LaunchDetected' ? 'launch-detector' : 
                  type === 'MoltDetected' ? 'moltwatch' : 'dev-simulation',
      evidence: {
        simulated: true,
        timestamp: new Date().toISOString(),
        type,
        ...(meta || {}),
      },
      recommendedAction: 'monitor',
    };

    const signal = await fastify.signalService.create(signalData);

    await fastify.auditService.log({
      action: 'signal_created',
      userId: request.user.userId,
      resource: 'signal',
      resourceId: signal.id,
      details: { simulated: true, type },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: signal,
    };
  });

  /**
   * POST /dev/simulate-launch
   * Simulate a Clanker token launch
   */
  fastify.post('/dev/simulate-launch', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' },
      });
    }

    const result = SimulateLaunchSchema.safeParse(request.body);
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

    const { 
      tokenAddress, 
      tokenName, 
      tokenSymbol, 
      creatorAddress, 
      factoryAddress,
      txHash,
      blockNumber,
    } = result.data;

    // Store in database
    const token = await fastify.prisma.launchpadToken.upsert({
      where: {
        chain_tokenAddress: {
          chain: 'base',
          tokenAddress: tokenAddress.toLowerCase(),
        },
      },
      create: {
        chain: 'base',
        launchpad: 'clanker',
        tokenAddress: tokenAddress.toLowerCase(),
        tokenName,
        tokenSymbol,
        creatorAddress: creatorAddress.toLowerCase(),
        factoryAddress: factoryAddress?.toLowerCase(),
        txHash: txHash || `0xsim${Date.now().toString(16)}`,
        blockNumber: BigInt(blockNumber || Math.floor(Date.now() / 1000)),
        meta: { simulated: true },
      },
      update: {
        tokenName,
        tokenSymbol,
        updatedAt: new Date(),
      },
    });

    // Create launch event
    await fastify.prisma.launchpadEvent.create({
      data: {
        tokenId: token.id,
        eventType: 'launched',
        txHash: txHash || `0xsim${Date.now().toString(16)}`,
        data: { simulated: true },
      },
    });

    // Create signal
    const signal = await fastify.signalService.create({
      severity: 'medium',
      signalType: 'LaunchDetected',
      title: 'Clanker launch detected',
      summary: `New token ${tokenSymbol || tokenName || 'Unknown'} deployed on Clanker (Base)`,
      token: tokenAddress.toLowerCase() as `0x${string}`,
      tokenSymbol,
      chain: 'base',
      strategyId: 'launch-detector',
      evidence: {
        tokenAddress: tokenAddress.toLowerCase(),
        tokenName,
        tokenSymbol,
        creatorAddress: creatorAddress.toLowerCase(),
        factoryAddress: factoryAddress?.toLowerCase(),
        txHash: txHash || `0xsim${Date.now().toString(16)}`,
        launchpad: 'clanker',
        simulated: true,
      },
      recommendedAction: 'monitor',
    });

    await fastify.auditService.log({
      action: 'launch_simulated',
      userId: request.user.userId,
      resource: 'launchpad_token',
      resourceId: token.id,
      details: { tokenAddress, simulated: true },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        token: {
          id: token.id,
          tokenAddress: token.tokenAddress,
          tokenName: token.tokenName,
          tokenSymbol: token.tokenSymbol,
          creatorAddress: token.creatorAddress,
        },
        signal,
      },
    };
  });

  /**
   * POST /dev/reset-policy
   * Reset risk policy to defaults
   */
  fastify.post('/dev/reset-policy', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' },
      });
    }

    const policy = await fastify.riskEngine.updatePolicy({
      maxOrderUsd: 100,
      maxPositionUsd: 1000,
      maxDailyLossUsd: 500,
      maxSlippageBps: 100,
      cooldownSeconds: 60,
      tokenAllowlist: [],
      tokenDenylist: [],
      venueAllowlist: [],
      chainAllowlist: [],
      killSwitchActive: false,
      dryRunMode: true,
    });

    return {
      success: true,
      data: policy,
    };
  });

  /**
   * GET /dev/status
   * Get development status info
   */
  fastify.get('/dev/status', async () => {
    const [signalCount, tokenCount, connectorState] = await Promise.all([
      fastify.prisma.signal.count(),
      fastify.prisma.launchpadToken.count(),
      fastify.prisma.launchpadConnectorState.findFirst({
        where: { launchpad: 'clanker' },
      }),
    ]);

    return {
      success: true,
      data: {
        devMode: true,
        signalCount,
        tokenCount,
        connectorState: connectorState ? {
          lastBlockScanned: connectorState.lastBlockScanned.toString(),
          lastScanTs: connectorState.lastScanTs?.toISOString(),
          errorCount: connectorState.errorCount,
        } : null,
      },
    };
  });
}
