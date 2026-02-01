/**
 * Connector Routes
 * Add, list, and manage exchange/DEX connectors
 * 
 * OpenClaw-style unified connections API
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildConnectorContext } from '@clawfi/vault';
import { createBinanceConnector, BinanceConfigSchema } from '@clawfi/connectors';

const AddBinanceSchema = z.object({
  label: z.string().optional(),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  testnet: z.boolean().default(true),
});

export async function registerConnectorRoutes(fastify: FastifyInstance): Promise<void> {
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
   * GET /connections
   * OpenClaw-style unified connections list (all connector types)
   */
  fastify.get('/connections', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const connections = await fastify.connectorRegistry.getAllUnified();

    return {
      success: true,
      data: connections,
    };
  });

  /**
   * POST /connections/:id/start
   * Start/enable a connector
   */
  fastify.post('/connections/:id/start', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };
    const success = await fastify.connectorRegistry.startConnector(id);

    await fastify.auditService.log({
      action: 'connector_started',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: id,
      success,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success, data: { id, action: 'started' } };
  });

  /**
   * POST /connections/:id/stop
   * Stop/disable a connector
   */
  fastify.post('/connections/:id/stop', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };
    const success = await fastify.connectorRegistry.stopConnector(id);

    await fastify.auditService.log({
      action: 'connector_stopped',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: id,
      success,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success, data: { id, action: 'stopped' } };
  });

  /**
   * GET /connections/:id/health
   * Health check a connector
   */
  fastify.get('/connections/:id/health', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };
    const health = await fastify.connectorRegistry.healthCheck(id);

    return { success: true, data: health };
  });

  /**
   * GET /connectors
   * List all connectors for the current user (legacy endpoint)
   */
  fastify.get('/connectors', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const connectors = await fastify.prisma.connector.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: connectors.map((c) => ({
        id: c.id,
        type: c.type,
        venue: c.venue,
        label: c.label ?? undefined,
        enabled: c.enabled,
        status: c.status,
        lastCheck: c.lastCheck?.getTime() ?? undefined,
        createdAt: c.createdAt.getTime(),
      })),
    };
  });

  /**
   * POST /connectors/binance
   * Add or update Binance API keys
   * 
   * SECURITY WARNING:
   * - API keys should have withdrawals DISABLED on Binance
   * - Keys are encrypted in the database
   * - We recommend using testnet first
   */
  fastify.post('/connectors/binance', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = AddBinanceSchema.safeParse(request.body);
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

    const { label, apiKey, apiSecret, testnet } = result.data;
    const connectorId = randomUUID();

    // Encrypt API key and secret
    const context = `connector:binance:${connectorId}`;
    const encryptedApiKey = fastify.vault.encrypt(apiKey, `${context}:api_key`);
    const encryptedApiSecret = fastify.vault.encrypt(apiSecret, `${context}:api_secret`);

    // Create connector
    const connector = await fastify.prisma.connector.create({
      data: {
        id: connectorId,
        userId: request.user.userId,
        type: 'cex',
        venue: 'binance',
        label,
        enabled: true,
        config: { testnet },
        status: 'disconnected',
        secrets: {
          create: [
            {
              secretType: 'api_key',
              ciphertext: encryptedApiKey.ciphertext,
              iv: encryptedApiKey.iv,
              tag: encryptedApiKey.tag,
              salt: encryptedApiKey.salt,
              version: encryptedApiKey.version,
            },
            {
              secretType: 'api_secret',
              ciphertext: encryptedApiSecret.ciphertext,
              iv: encryptedApiSecret.iv,
              tag: encryptedApiSecret.tag,
              salt: encryptedApiSecret.salt,
              version: encryptedApiSecret.version,
            },
          ],
        },
      },
    });

    // Audit log (do NOT log the actual keys)
    await fastify.auditService.log({
      action: 'connector_added',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: connector.id,
      details: {
        venue: 'binance',
        testnet,
      },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        id: connector.id,
        type: connector.type,
        venue: connector.venue,
        label: connector.label ?? undefined,
        enabled: connector.enabled,
        status: connector.status,
        createdAt: connector.createdAt.getTime(),
      },
    };
  });

  /**
   * DELETE /connectors/:id
   * Remove a connector
   */
  fastify.delete('/connectors/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    const connector = await fastify.prisma.connector.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!connector) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Connector not found' },
      });
    }

    await fastify.prisma.connector.delete({ where: { id } });

    await fastify.auditService.log({
      action: 'connector_removed',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: id,
      details: { venue: connector.venue },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return { success: true };
  });

  /**
   * GET /connectors/:id/balances
   * Get balances for a connector
   */
  fastify.get('/connectors/:id/balances', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    const connector = await fastify.prisma.connector.findFirst({
      where: { id, userId: request.user.userId },
      include: { secrets: true },
    });

    if (!connector) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Connector not found' },
      });
    }

    if (connector.venue !== 'binance') {
      return reply.status(400).send({
        success: false,
        error: { code: 'UNSUPPORTED', message: 'Balances only supported for Binance' },
      });
    }

    try {
      // Create connector instance
      const config = connector.config as { testnet?: boolean };
      const binanceConfig = BinanceConfigSchema.parse({
        id: connector.id,
        label: connector.label,
        testnet: config.testnet ?? true,
      });

      const getEncryptedCredentials = async () => {
        const apiKeySecret = connector.secrets.find((s) => s.secretType === 'api_key');
        const apiSecretSecret = connector.secrets.find((s) => s.secretType === 'api_secret');

        if (!apiKeySecret || !apiSecretSecret) {
          return null;
        }

        return {
          apiKey: {
            ciphertext: apiKeySecret.ciphertext,
            iv: apiKeySecret.iv,
            tag: apiKeySecret.tag,
            salt: apiKeySecret.salt,
            version: apiKeySecret.version,
          },
          apiSecret: {
            ciphertext: apiSecretSecret.ciphertext,
            iv: apiSecretSecret.iv,
            tag: apiSecretSecret.tag,
            salt: apiSecretSecret.salt,
            version: apiSecretSecret.version,
          },
        };
      };

      const binanceConnector = createBinanceConnector(binanceConfig, fastify.vault, getEncryptedCredentials);
      await binanceConnector.initialize();
      
      const balances = await binanceConnector.getBalances();
      await binanceConnector.shutdown();

      // Update connector status
      await fastify.prisma.connector.update({
        where: { id },
        data: { status: 'connected', lastCheck: new Date() },
      });

      return {
        success: true,
        data: balances,
      };
    } catch (error) {
      // Update connector status to error
      await fastify.prisma.connector.update({
        where: { id },
        data: { status: 'error', lastCheck: new Date() },
      });

      return reply.status(500).send({
        success: false,
        error: {
          code: 'CONNECTOR_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  });

  /**
   * POST /connectors/:id/test
   * Test connector connectivity
   */
  fastify.post('/connectors/:id/test', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };

    const connector = await fastify.prisma.connector.findFirst({
      where: { id, userId: request.user.userId },
      include: { secrets: true },
    });

    if (!connector) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Connector not found' },
      });
    }

    if (connector.venue !== 'binance') {
      return reply.status(400).send({
        success: false,
        error: { code: 'UNSUPPORTED', message: 'Test only supported for Binance' },
      });
    }

    try {
      const config = connector.config as { testnet?: boolean };
      const binanceConfig = BinanceConfigSchema.parse({
        id: connector.id,
        label: connector.label,
        testnet: config.testnet ?? true,
      });

      const getEncryptedCredentials = async () => {
        const apiKeySecret = connector.secrets.find((s) => s.secretType === 'api_key');
        const apiSecretSecret = connector.secrets.find((s) => s.secretType === 'api_secret');

        if (!apiKeySecret || !apiSecretSecret) {
          return null;
        }

        return {
          apiKey: {
            ciphertext: apiKeySecret.ciphertext,
            iv: apiKeySecret.iv,
            tag: apiKeySecret.tag,
            salt: apiKeySecret.salt,
            version: apiKeySecret.version,
          },
          apiSecret: {
            ciphertext: apiSecretSecret.ciphertext,
            iv: apiSecretSecret.iv,
            tag: apiSecretSecret.tag,
            salt: apiSecretSecret.salt,
            version: apiSecretSecret.version,
          },
        };
      };

      const binanceConnector = createBinanceConnector(binanceConfig, fastify.vault, getEncryptedCredentials);
      const health = await binanceConnector.getHealth();

      await fastify.auditService.log({
        action: 'connector_test',
        userId: request.user.userId,
        resource: 'connector',
        resourceId: id,
        details: { success: health.status === 'connected', latencyMs: health.latencyMs },
        success: health.status === 'connected',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      // Update connector status
      await fastify.prisma.connector.update({
        where: { id },
        data: { status: health.status, lastCheck: new Date() },
      });

      return {
        success: true,
        data: {
          success: health.status === 'connected',
          latencyMs: health.latencyMs,
          error: health.error,
        },
      };
    } catch (error) {
      return {
        success: true,
        data: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });

  /**
   * POST /connectors/jupiter
   * Add a Jupiter (Solana DEX) connector
   */
  const AddJupiterSchema = z.object({
    label: z.string().optional(),
    walletAddress: z.string().min(32).max(44),
    slippageBps: z.number().default(50),
  });

  fastify.post('/connectors/jupiter', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = AddJupiterSchema.safeParse(request.body);
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

    const { label, walletAddress, slippageBps } = result.data;
    const connectorId = randomUUID();

    const connector = await fastify.prisma.connector.create({
      data: {
        id: connectorId,
        userId: request.user.userId,
        type: 'dex',
        venue: 'jupiter',
        label: label || 'Jupiter',
        enabled: true,
        config: { walletAddress, slippageBps, chain: 'solana' },
        status: 'connected',
      },
    });

    await fastify.auditService.log({
      action: 'connector_added',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: connector.id,
      details: { venue: 'jupiter', chain: 'solana' },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        id: connector.id,
        type: connector.type,
        venue: connector.venue,
        label: connector.label ?? undefined,
        enabled: connector.enabled,
        status: connector.status,
        createdAt: connector.createdAt.getTime(),
      },
    };
  });

  /**
   * POST /connectors/wallet
   * Add a wallet tracker connection
   */
  const AddWalletSchema = z.object({
    label: z.string().optional(),
    walletType: z.enum(['evm_wallet', 'solana_wallet']),
    address: z.string().min(1),
    chain: z.string().optional(),
    enableAlerts: z.boolean().default(true),
  });

  fastify.post('/connectors/wallet', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = AddWalletSchema.safeParse(request.body);
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

    const { label, walletType, address, chain, enableAlerts } = result.data;
    const connectorId = randomUUID();

    // Determine chain based on wallet type if not provided
    const resolvedChain = chain || (walletType === 'solana_wallet' ? 'solana' : 'ethereum');

    const connector = await fastify.prisma.connector.create({
      data: {
        id: connectorId,
        userId: request.user.userId,
        type: 'wallet',
        venue: walletType,
        label: label || `Wallet ${address.slice(0, 8)}...`,
        enabled: true,
        config: { address, chain: resolvedChain, enableAlerts },
        status: 'connected',
      },
    });

    await fastify.auditService.log({
      action: 'connector_added',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: connector.id,
      details: { venue: walletType, chain: resolvedChain },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        id: connector.id,
        type: connector.type,
        venue: connector.venue,
        label: connector.label ?? undefined,
        enabled: connector.enabled,
        status: connector.status,
        chain: resolvedChain,
        createdAt: connector.createdAt.getTime(),
      },
    };
  });

  /**
   * POST /connectors/dex/:venue
   * Add a generic DEX connector (Uniswap, PancakeSwap, etc.)
   */
  const AddDexSchema = z.object({
    label: z.string().optional(),
    walletAddress: z.string().min(1),
    chain: z.string().optional(),
    slippageBps: z.number().default(50),
  });

  fastify.post('/connectors/dex/:venue', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { venue } = request.params as { venue: string };
    const allowedVenues = ['uniswap', 'pancakeswap', 'sushiswap', '1inch'];
    
    if (!allowedVenues.includes(venue)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_VENUE',
          message: `Invalid DEX venue. Allowed: ${allowedVenues.join(', ')}`,
        },
      });
    }

    const result = AddDexSchema.safeParse(request.body);
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

    const { label, walletAddress, chain, slippageBps } = result.data;
    const connectorId = randomUUID();

    // Default chains for each venue
    const defaultChains: Record<string, string> = {
      uniswap: 'ethereum',
      pancakeswap: 'bsc',
      sushiswap: 'ethereum',
      '1inch': 'ethereum',
    };

    const resolvedChain = chain || defaultChains[venue];

    const connector = await fastify.prisma.connector.create({
      data: {
        id: connectorId,
        userId: request.user.userId,
        type: 'dex',
        venue,
        label: label || venue.charAt(0).toUpperCase() + venue.slice(1),
        enabled: true,
        config: { walletAddress, chain: resolvedChain, slippageBps },
        status: 'connected',
      },
    });

    await fastify.auditService.log({
      action: 'connector_added',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: connector.id,
      details: { venue, chain: resolvedChain },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        id: connector.id,
        type: connector.type,
        venue: connector.venue,
        label: connector.label ?? undefined,
        enabled: connector.enabled,
        status: connector.status,
        chain: resolvedChain,
        createdAt: connector.createdAt.getTime(),
      },
    };
  });

  /**
   * POST /connectors/launchpad/:venue
   * Add a launchpad monitor connector
   */
  const AddLaunchpadSchema = z.object({
    label: z.string().optional(),
    enableAlerts: z.boolean().default(true),
  });

  fastify.post('/connectors/launchpad/:venue', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const { venue } = request.params as { venue: string };
    const launchpadChains: Record<string, string> = {
      clanker: 'base',
      pumpfun: 'solana',
      fourmeme: 'bsc',
    };
    
    if (!launchpadChains[venue]) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_VENUE',
          message: `Invalid launchpad venue. Allowed: ${Object.keys(launchpadChains).join(', ')}`,
        },
      });
    }

    const result = AddLaunchpadSchema.safeParse(request.body);
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

    const { label, enableAlerts } = result.data;
    const connectorId = randomUUID();
    const chain = launchpadChains[venue];

    const connector = await fastify.prisma.connector.create({
      data: {
        id: connectorId,
        userId: request.user.userId,
        type: 'launchpad',
        venue,
        label: label || venue.charAt(0).toUpperCase() + venue.slice(1),
        enabled: true,
        config: { chain, enableAlerts },
        status: 'connected',
      },
    });

    await fastify.auditService.log({
      action: 'connector_added',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: connector.id,
      details: { venue, chain },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        id: connector.id,
        type: connector.type,
        venue: connector.venue,
        label: connector.label ?? undefined,
        enabled: connector.enabled,
        status: connector.status,
        chain,
        createdAt: connector.createdAt.getTime(),
      },
    };
  });

  /**
   * POST /connectors/okx
   * Add OKX exchange connector
   */
  const AddOkxSchema = z.object({
    label: z.string().optional(),
    apiKey: z.string().min(1),
    apiSecret: z.string().min(1),
    passphrase: z.string().min(1),
  });

  fastify.post('/connectors/okx', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = AddOkxSchema.safeParse(request.body);
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

    const { label, apiKey, apiSecret, passphrase } = result.data;
    const connectorId = randomUUID();

    // Encrypt credentials
    const context = `connector:okx:${connectorId}`;
    const encryptedApiKey = fastify.vault.encrypt(apiKey, `${context}:api_key`);
    const encryptedApiSecret = fastify.vault.encrypt(apiSecret, `${context}:api_secret`);
    const encryptedPassphrase = fastify.vault.encrypt(passphrase, `${context}:passphrase`);

    const connector = await fastify.prisma.connector.create({
      data: {
        id: connectorId,
        userId: request.user.userId,
        type: 'cex',
        venue: 'okx',
        label: label || 'OKX',
        enabled: true,
        config: {},
        status: 'disconnected',
        secrets: {
          create: [
            {
              secretType: 'api_key',
              ciphertext: encryptedApiKey.ciphertext,
              iv: encryptedApiKey.iv,
              tag: encryptedApiKey.tag,
              salt: encryptedApiKey.salt,
              version: encryptedApiKey.version,
            },
            {
              secretType: 'api_secret',
              ciphertext: encryptedApiSecret.ciphertext,
              iv: encryptedApiSecret.iv,
              tag: encryptedApiSecret.tag,
              salt: encryptedApiSecret.salt,
              version: encryptedApiSecret.version,
            },
            {
              secretType: 'passphrase',
              ciphertext: encryptedPassphrase.ciphertext,
              iv: encryptedPassphrase.iv,
              tag: encryptedPassphrase.tag,
              salt: encryptedPassphrase.salt,
              version: encryptedPassphrase.version,
            },
          ],
        },
      },
    });

    await fastify.auditService.log({
      action: 'connector_added',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: connector.id,
      details: { venue: 'okx' },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        id: connector.id,
        type: connector.type,
        venue: connector.venue,
        label: connector.label ?? undefined,
        enabled: connector.enabled,
        status: connector.status,
        createdAt: connector.createdAt.getTime(),
      },
    };
  });

  /**
   * POST /connectors/bybit
   * Add Bybit exchange connector
   */
  const AddBybitSchema = z.object({
    label: z.string().optional(),
    apiKey: z.string().min(1),
    apiSecret: z.string().min(1),
    testnet: z.boolean().default(true),
  });

  fastify.post('/connectors/bybit', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = AddBybitSchema.safeParse(request.body);
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

    const { label, apiKey, apiSecret, testnet } = result.data;
    const connectorId = randomUUID();

    // Encrypt credentials
    const context = `connector:bybit:${connectorId}`;
    const encryptedApiKey = fastify.vault.encrypt(apiKey, `${context}:api_key`);
    const encryptedApiSecret = fastify.vault.encrypt(apiSecret, `${context}:api_secret`);

    const connector = await fastify.prisma.connector.create({
      data: {
        id: connectorId,
        userId: request.user.userId,
        type: 'cex',
        venue: 'bybit',
        label: label || 'Bybit',
        enabled: true,
        config: { testnet },
        status: 'disconnected',
        secrets: {
          create: [
            {
              secretType: 'api_key',
              ciphertext: encryptedApiKey.ciphertext,
              iv: encryptedApiKey.iv,
              tag: encryptedApiKey.tag,
              salt: encryptedApiKey.salt,
              version: encryptedApiKey.version,
            },
            {
              secretType: 'api_secret',
              ciphertext: encryptedApiSecret.ciphertext,
              iv: encryptedApiSecret.iv,
              tag: encryptedApiSecret.tag,
              salt: encryptedApiSecret.salt,
              version: encryptedApiSecret.version,
            },
          ],
        },
      },
    });

    await fastify.auditService.log({
      action: 'connector_added',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: connector.id,
      details: { venue: 'bybit', testnet },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        id: connector.id,
        type: connector.type,
        venue: connector.venue,
        label: connector.label ?? undefined,
        enabled: connector.enabled,
        status: connector.status,
        createdAt: connector.createdAt.getTime(),
      },
    };
  });

  /**
   * POST /connectors/coinbase
   * Add Coinbase exchange connector
   */
  const AddCoinbaseSchema = z.object({
    label: z.string().optional(),
    apiKey: z.string().min(1),
    apiSecret: z.string().min(1),
  });

  fastify.post('/connectors/coinbase', async (request, reply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const result = AddCoinbaseSchema.safeParse(request.body);
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

    const { label, apiKey, apiSecret } = result.data;
    const connectorId = randomUUID();

    // Encrypt credentials
    const context = `connector:coinbase:${connectorId}`;
    const encryptedApiKey = fastify.vault.encrypt(apiKey, `${context}:api_key`);
    const encryptedApiSecret = fastify.vault.encrypt(apiSecret, `${context}:api_secret`);

    const connector = await fastify.prisma.connector.create({
      data: {
        id: connectorId,
        userId: request.user.userId,
        type: 'cex',
        venue: 'coinbase',
        label: label || 'Coinbase',
        enabled: true,
        config: {},
        status: 'disconnected',
        secrets: {
          create: [
            {
              secretType: 'api_key',
              ciphertext: encryptedApiKey.ciphertext,
              iv: encryptedApiKey.iv,
              tag: encryptedApiKey.tag,
              salt: encryptedApiKey.salt,
              version: encryptedApiKey.version,
            },
            {
              secretType: 'api_secret',
              ciphertext: encryptedApiSecret.ciphertext,
              iv: encryptedApiSecret.iv,
              tag: encryptedApiSecret.tag,
              salt: encryptedApiSecret.salt,
              version: encryptedApiSecret.version,
            },
          ],
        },
      },
    });

    await fastify.auditService.log({
      action: 'connector_added',
      userId: request.user.userId,
      resource: 'connector',
      resourceId: connector.id,
      details: { venue: 'coinbase' },
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        id: connector.id,
        type: connector.type,
        venue: connector.venue,
        label: connector.label ?? undefined,
        enabled: connector.enabled,
        status: connector.status,
        createdAt: connector.createdAt.getTime(),
      },
    };
  });
}

