/**
 * Agent Routes - OpenClaw-style Command Interface
 * 
 * Provides a simple command interface for controlling ClawFi:
 * - watch token/wallet
 * - enable/disable strategy
 * - killswitch on/off
 * - status
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

// ============================================
// Command Schemas
// ============================================

const CommandSchema = z.object({
  command: z.string().min(1).max(500),
  args: z.record(z.unknown()).optional(),
});

// ============================================
// Command Parser
// ============================================

interface ParsedCommand {
  action: string;
  target?: string;
  args: Record<string, unknown>;
}

function parseCommand(input: string): ParsedCommand {
  const parts = input.trim().toLowerCase().split(/\s+/);
  const action = parts[0] || '';
  
  // Handle multi-word actions
  if (parts[0] === 'watch' && parts.length >= 3) {
    return {
      action: `watch_${parts[1]}`, // watch_token or watch_wallet
      target: parts[2],
      args: { chain: parts[3] || 'base' },
    };
  }
  
  if ((parts[0] === 'enable' || parts[0] === 'disable') && parts.length >= 3) {
    return {
      action: `${parts[0]}_${parts[1]}`, // enable_strategy or disable_strategy
      target: parts[2],
      args: {},
    };
  }
  
  if (parts[0] === 'killswitch') {
    return {
      action: 'killswitch',
      target: parts[1], // 'on' or 'off'
      args: {},
    };
  }
  
  if (parts[0] === 'unwatch' && parts.length >= 3) {
    return {
      action: `unwatch_${parts[1]}`,
      target: parts[2],
      args: { chain: parts[3] || 'base' },
    };
  }
  
  return {
    action,
    target: parts[1],
    args: {},
  };
}

// ============================================
// Command Results
// ============================================

interface CommandResult {
  success: boolean;
  action: string;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================
// Routes
// ============================================

export async function registerAgentRoutes(fastify: FastifyInstance): Promise<void> {
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
   * GET /agent/status
   * Overview of the agent state
   */
  fastify.get('/agent/status', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const startTime = Date.now();
    const uptime = process.uptime();
    
    const [
      policy,
      connectors,
      strategies,
      signalsToday,
      watchedTokens,
      watchedWallets,
    ] = await Promise.all([
      fastify.prisma.riskPolicy.findFirst(),
      fastify.connectorRegistry.getAllUnified(),
      fastify.prisma.strategy.findMany(),
      fastify.prisma.signal.count({
        where: {
          ts: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      fastify.prisma.watchedToken.count({ where: { enabled: true } }),
      fastify.prisma.watchedWallet.count({ where: { enabled: true } }),
    ]);

    const connectorsSummary = {
      total: connectors.length,
      connected: connectors.filter(c => c.status === 'connected').length,
      degraded: connectors.filter(c => c.status === 'degraded').length,
      offline: connectors.filter(c => c.status === 'offline').length,
      error: connectors.filter(c => c.status === 'error').length,
    };

    const strategiesSummary = {
      total: strategies.length,
      enabled: strategies.filter(s => s.status === 'enabled').length,
      disabled: strategies.filter(s => s.status === 'disabled').length,
      error: strategies.filter(s => s.status === 'error').length,
    };

    return {
      success: true,
      data: {
        version: '0.2.0',
        uptimeSeconds: Math.floor(uptime),
        uptimeFormatted: formatUptime(uptime),
        killSwitchActive: policy?.killSwitchActive ?? false,
        dryRunMode: policy?.dryRunMode ?? true,
        connectors: connectorsSummary,
        strategies: strategiesSummary,
        signalsToday,
        watchedTokens,
        watchedWallets,
        responseTimeMs: Date.now() - startTime,
      },
    };
  });

  /**
   * POST /agent/command
   * Execute a command
   */
  fastify.post('/agent/command', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = CommandSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid command format',
          details: result.error.format(),
        },
      });
    }

    const { command, args: extraArgs } = result.data;
    const parsed = parseCommand(command);
    
    // Merge extra args
    if (extraArgs) {
      Object.assign(parsed.args, extraArgs);
    }

    let commandResult: CommandResult;

    try {
      switch (parsed.action) {
        case 'watch_token':
          commandResult = await handleWatchToken(fastify, parsed.target!, parsed.args);
          break;
        
        case 'watch_wallet':
          commandResult = await handleWatchWallet(fastify, parsed.target!, parsed.args);
          break;
        
        case 'unwatch_token':
          commandResult = await handleUnwatchToken(fastify, parsed.target!, parsed.args);
          break;
        
        case 'unwatch_wallet':
          commandResult = await handleUnwatchWallet(fastify, parsed.target!, parsed.args);
          break;
        
        case 'enable_strategy':
          commandResult = await handleEnableStrategy(fastify, parsed.target!);
          break;
        
        case 'disable_strategy':
          commandResult = await handleDisableStrategy(fastify, parsed.target!);
          break;
        
        case 'killswitch':
          commandResult = await handleKillSwitch(fastify, parsed.target === 'on');
          break;
        
        case 'status':
          commandResult = await handleStatus(fastify);
          break;
        
        case 'help':
          commandResult = {
            success: true,
            action: 'help',
            message: 'Available commands',
            data: {
              commands: [
                'watch token <address> [chain]',
                'watch wallet <address> [chain]',
                'unwatch token <address> [chain]',
                'unwatch wallet <address> [chain]',
                'enable strategy <name>',
                'disable strategy <name>',
                'killswitch on',
                'killswitch off',
                'status',
                'help',
              ],
            },
          };
          break;
        
        default:
          commandResult = {
            success: false,
            action: parsed.action,
            message: `Unknown command: ${parsed.action}. Try "help" for available commands.`,
          };
      }
    } catch (error) {
      commandResult = {
        success: false,
        action: parsed.action,
        message: error instanceof Error ? error.message : 'Command failed',
      };
    }

    // Audit log
    await fastify.auditService.log({
      action: 'agent_command',
      userId: request.user.userId,
      details: {
        command,
        parsed,
        result: commandResult,
      },
      success: commandResult.success,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: commandResult.success,
      data: commandResult,
    };
  });

  /**
   * GET /agent/watchlist/tokens
   * List watched tokens
   */
  fastify.get('/agent/watchlist/tokens', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const tokens = await fastify.prisma.watchedToken.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: tokens.map(t => ({
        id: t.id,
        chain: t.chain,
        tokenAddress: t.tokenAddress,
        tokenSymbol: t.tokenSymbol,
        tokenName: t.tokenName,
        tags: t.tags,
        enabled: t.enabled,
        createdAt: t.createdAt.getTime(),
      })),
    };
  });

  /**
   * GET /agent/watchlist/wallets
   * List watched wallets
   */
  fastify.get('/agent/watchlist/wallets', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const wallets = await fastify.prisma.watchedWallet.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: wallets.map(w => ({
        id: w.id,
        chain: w.chain,
        walletAddress: w.walletAddress,
        label: w.label,
        tags: w.tags,
        enabled: w.enabled,
        createdAt: w.createdAt.getTime(),
      })),
    };
  });
}

// ============================================
// Command Handlers
// ============================================

async function handleWatchToken(
  fastify: FastifyInstance,
  address: string,
  args: Record<string, unknown>
): Promise<CommandResult> {
  const chain = String(args.chain || 'base');
  const normalizedAddress = address.toLowerCase();

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return {
      success: false,
      action: 'watch_token',
      message: `Invalid token address: ${address}`,
    };
  }

  const existing = await fastify.prisma.watchedToken.findUnique({
    where: { chain_tokenAddress: { chain, tokenAddress: normalizedAddress } },
  });

  if (existing) {
    // Re-enable if disabled
    if (!existing.enabled) {
      await fastify.prisma.watchedToken.update({
        where: { id: existing.id },
        data: { enabled: true },
      });
      return {
        success: true,
        action: 'watch_token',
        message: `Re-enabled watching token ${normalizedAddress} on ${chain}`,
        data: { chain, tokenAddress: normalizedAddress },
      };
    }
    return {
      success: true,
      action: 'watch_token',
      message: `Already watching token ${normalizedAddress} on ${chain}`,
      data: { chain, tokenAddress: normalizedAddress, alreadyWatched: true },
    };
  }

  await fastify.prisma.watchedToken.create({
    data: {
      chain,
      tokenAddress: normalizedAddress,
      source: 'command',
      tags: args.tags || [],
    },
  });

  return {
    success: true,
    action: 'watch_token',
    message: `Now watching token ${normalizedAddress} on ${chain}`,
    data: { chain, tokenAddress: normalizedAddress },
  };
}

async function handleWatchWallet(
  fastify: FastifyInstance,
  address: string,
  args: Record<string, unknown>
): Promise<CommandResult> {
  const chain = String(args.chain || 'base');
  const normalizedAddress = address.toLowerCase();

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return {
      success: false,
      action: 'watch_wallet',
      message: `Invalid wallet address: ${address}`,
    };
  }

  const existing = await fastify.prisma.watchedWallet.findUnique({
    where: { chain_walletAddress: { chain, walletAddress: normalizedAddress } },
  });

  if (existing) {
    if (!existing.enabled) {
      await fastify.prisma.watchedWallet.update({
        where: { id: existing.id },
        data: { enabled: true },
      });
      return {
        success: true,
        action: 'watch_wallet',
        message: `Re-enabled watching wallet ${normalizedAddress} on ${chain}`,
        data: { chain, walletAddress: normalizedAddress },
      };
    }
    return {
      success: true,
      action: 'watch_wallet',
      message: `Already watching wallet ${normalizedAddress} on ${chain}`,
      data: { chain, walletAddress: normalizedAddress, alreadyWatched: true },
    };
  }

  await fastify.prisma.watchedWallet.create({
    data: {
      chain,
      walletAddress: normalizedAddress,
      label: args.label as string | undefined,
      source: 'command',
      tags: args.tags || [],
    },
  });

  return {
    success: true,
    action: 'watch_wallet',
    message: `Now watching wallet ${normalizedAddress} on ${chain}`,
    data: { chain, walletAddress: normalizedAddress },
  };
}

async function handleUnwatchToken(
  fastify: FastifyInstance,
  address: string,
  args: Record<string, unknown>
): Promise<CommandResult> {
  const chain = String(args.chain || 'base');
  const normalizedAddress = address.toLowerCase();

  const existing = await fastify.prisma.watchedToken.findUnique({
    where: { chain_tokenAddress: { chain, tokenAddress: normalizedAddress } },
  });

  if (!existing) {
    return {
      success: false,
      action: 'unwatch_token',
      message: `Token ${normalizedAddress} was not being watched on ${chain}`,
    };
  }

  await fastify.prisma.watchedToken.update({
    where: { id: existing.id },
    data: { enabled: false },
  });

  return {
    success: true,
    action: 'unwatch_token',
    message: `Stopped watching token ${normalizedAddress} on ${chain}`,
    data: { chain, tokenAddress: normalizedAddress },
  };
}

async function handleUnwatchWallet(
  fastify: FastifyInstance,
  address: string,
  args: Record<string, unknown>
): Promise<CommandResult> {
  const chain = String(args.chain || 'base');
  const normalizedAddress = address.toLowerCase();

  const existing = await fastify.prisma.watchedWallet.findUnique({
    where: { chain_walletAddress: { chain, walletAddress: normalizedAddress } },
  });

  if (!existing) {
    return {
      success: false,
      action: 'unwatch_wallet',
      message: `Wallet ${normalizedAddress} was not being watched on ${chain}`,
    };
  }

  await fastify.prisma.watchedWallet.update({
    where: { id: existing.id },
    data: { enabled: false },
  });

  return {
    success: true,
    action: 'unwatch_wallet',
    message: `Stopped watching wallet ${normalizedAddress} on ${chain}`,
    data: { chain, walletAddress: normalizedAddress },
  };
}

async function handleEnableStrategy(
  fastify: FastifyInstance,
  strategyName: string
): Promise<CommandResult> {
  // Find strategy by name or id
  const strategy = await fastify.prisma.strategy.findFirst({
    where: {
      OR: [
        { id: strategyName },
        { name: { contains: strategyName, mode: 'insensitive' } },
        { strategyType: strategyName },
      ],
    },
  });

  if (!strategy) {
    return {
      success: false,
      action: 'enable_strategy',
      message: `Strategy not found: ${strategyName}`,
    };
  }

  if (strategy.status === 'enabled') {
    return {
      success: true,
      action: 'enable_strategy',
      message: `Strategy "${strategy.name}" is already enabled`,
      data: { strategyId: strategy.id, strategyName: strategy.name },
    };
  }

  await fastify.strategyScheduler.enableStrategy(strategy.id);

  return {
    success: true,
    action: 'enable_strategy',
    message: `Enabled strategy "${strategy.name}"`,
    data: { strategyId: strategy.id, strategyName: strategy.name },
  };
}

async function handleDisableStrategy(
  fastify: FastifyInstance,
  strategyName: string
): Promise<CommandResult> {
  const strategy = await fastify.prisma.strategy.findFirst({
    where: {
      OR: [
        { id: strategyName },
        { name: { contains: strategyName, mode: 'insensitive' } },
        { strategyType: strategyName },
      ],
    },
  });

  if (!strategy) {
    return {
      success: false,
      action: 'disable_strategy',
      message: `Strategy not found: ${strategyName}`,
    };
  }

  if (strategy.status === 'disabled') {
    return {
      success: true,
      action: 'disable_strategy',
      message: `Strategy "${strategy.name}" is already disabled`,
      data: { strategyId: strategy.id, strategyName: strategy.name },
    };
  }

  await fastify.strategyScheduler.disableStrategy(strategy.id);

  return {
    success: true,
    action: 'disable_strategy',
    message: `Disabled strategy "${strategy.name}"`,
    data: { strategyId: strategy.id, strategyName: strategy.name },
  };
}

async function handleKillSwitch(
  fastify: FastifyInstance,
  active: boolean
): Promise<CommandResult> {
  await fastify.prisma.riskPolicy.updateMany({
    data: { killSwitchActive: active },
  });

  return {
    success: true,
    action: 'killswitch',
    message: active 
      ? '🛑 Kill switch ACTIVATED - all trading actions blocked'
      : '✅ Kill switch deactivated - normal operations resumed',
    data: { killSwitchActive: active },
  };
}

async function handleStatus(fastify: FastifyInstance): Promise<CommandResult> {
  const uptime = process.uptime();
  const connectors = await fastify.connectorRegistry.getAllUnified();
  const policy = await fastify.prisma.riskPolicy.findFirst();
  const signalsToday = await fastify.prisma.signal.count({
    where: {
      ts: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });

  return {
    success: true,
    action: 'status',
    message: `ClawFi v0.2.0 • Uptime: ${formatUptime(uptime)} • ${connectors.filter(c => c.status === 'connected').length}/${connectors.length} connectors online • ${signalsToday} signals today`,
    data: {
      version: '0.2.0',
      uptimeFormatted: formatUptime(uptime),
      killSwitchActive: policy?.killSwitchActive ?? false,
      connectorsOnline: connectors.filter(c => c.status === 'connected').length,
      connectorsTotal: connectors.length,
      signalsToday,
    },
  };
}

// ============================================
// Helpers
// ============================================

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  
  return parts.join(' ');
}


