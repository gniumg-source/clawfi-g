/**
 * Connector Registry
 * 
 * Central registry for all ClawFi connectors.
 * Manages connector lifecycle and provides unified interface.
 * 
 * OpenClaw-style unified status for all connector types.
 */

import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { 
  ClankerConnector, 
  createClankerConnector, 
  type ClankerConnectorConfig,
  type DetectedToken,
} from '@clawfi/connectors';
import type { SignalService } from '../services/signal.js';

// ============================================
// Types
// ============================================

export interface ConnectorRegistryConfig {
  clanker?: ClankerConnectorConfig;
}

/**
 * Unified connector status for OpenClaw-style UX
 */
export type UnifiedConnectorStatus = 'connected' | 'degraded' | 'offline' | 'error';

/**
 * Unified connector info exposed via API
 */
export interface UnifiedConnectorInfo {
  id: string;
  name: string;
  type: 'cex' | 'dex' | 'launchpad' | 'wallet';
  venue: string;
  chain?: string;
  status: UnifiedConnectorStatus;
  enabled: boolean;
  lastSeen?: number;      // Unix timestamp
  lastPoll?: number;      // Unix timestamp
  latencyMs?: number;
  lastError?: string;
  meta?: Record<string, unknown>;
}

export interface RegisteredConnector {
  id: string;
  type: 'cex' | 'dex' | 'launchpad' | 'wallet';
  venue: string;
  chain?: string;
  status: 'running' | 'stopped' | 'error';
  lastSeen?: number;
  lastError?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
}

// ============================================
// Connector Registry
// ============================================

export class ConnectorRegistry {
  private connectors: Map<string, RegisteredConnector> = new Map();
  private clankerConnector: ClankerConnector | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly signalService: SignalService
  ) {}

  /**
   * Initialize all configured connectors
   */
  async initialize(config: ConnectorRegistryConfig): Promise<void> {
    console.log('[Registry] Initializing connectors...');

    // Initialize Clanker connector if configured
    if (config.clanker) {
      await this.initializeClanker(config.clanker);
    }

    console.log(`[Registry] Initialized ${this.connectors.size} connectors`);
  }

  /**
   * Initialize Clanker launchpad connector
   */
  private async initializeClanker(config: ClankerConnectorConfig): Promise<void> {
    try {
      // Get last scanned block from DB
      const state = await this.prisma.launchpadConnectorState.findFirst({
        where: {
          chain: 'base',
          launchpad: 'clanker',
        },
      });

      const startBlock = state?.lastBlockScanned 
        ? BigInt(state.lastBlockScanned) 
        : config.startBlock;

      // Create connector
      this.clankerConnector = createClankerConnector({
        ...config,
        startBlock,
      });

      // Subscribe to token detections
      this.clankerConnector.onToken(async (token) => {
        await this.handleClankerToken(token);
      });

      this.connectors.set('clanker-base', {
        id: 'clanker-base',
        type: 'launchpad',
        venue: 'clanker',
        chain: 'base',
        status: 'stopped',
        instance: this.clankerConnector,
      });

      console.log('[Registry] Clanker connector initialized');
    } catch (error) {
      console.error('[Registry] Failed to initialize Clanker connector:', error);
    }
  }

  /**
   * Handle detected Clanker token
   */
  private async handleClankerToken(token: DetectedToken): Promise<void> {
    try {
      // Get token metadata
      const metadata = this.clankerConnector 
        ? await this.clankerConnector.getTokenMetadata(token.tokenAddress)
        : {};

      // Store in database
      const dbToken = await this.prisma.launchpadToken.upsert({
        where: {
          chain_tokenAddress: {
            chain: 'base',
            tokenAddress: token.tokenAddress.toLowerCase(),
          },
        },
        create: {
          chain: 'base',
          launchpad: 'clanker',
          tokenAddress: token.tokenAddress.toLowerCase(),
          tokenName: metadata.name,
          tokenSymbol: metadata.symbol,
          creatorAddress: token.creatorAddress.toLowerCase(),
          factoryAddress: token.factoryAddress?.toLowerCase(),
          txHash: token.txHash,
          blockNumber: token.blockNumber,
          blockTimestamp: token.blockTimestamp 
            ? new Date(Number(token.blockTimestamp) * 1000)
            : undefined,
          version: token.version,
          meta: token.meta,
        },
        update: {
          tokenName: metadata.name,
          tokenSymbol: metadata.symbol,
          updatedAt: new Date(),
        },
      });

      // Create event record
      await this.prisma.launchpadEvent.create({
        data: {
          tokenId: dbToken.id,
          eventType: 'launched',
          txHash: token.txHash,
          blockNumber: token.blockNumber,
          data: {
            creatorAddress: token.creatorAddress,
            factoryAddress: token.factoryAddress,
          },
        },
      });

      // Emit signal
      await this.signalService.create({
        severity: 'medium',
        signalType: 'LaunchDetected',
        title: 'Clanker launch detected',
        summary: `New token ${metadata.symbol || 'Unknown'} deployed on Clanker (Base)`,
        token: token.tokenAddress.toLowerCase(),
        tokenSymbol: metadata.symbol,
        chain: 'base',
        strategyId: 'launch-detector',
        evidence: {
          tokenAddress: token.tokenAddress,
          tokenName: metadata.name,
          tokenSymbol: metadata.symbol,
          creatorAddress: token.creatorAddress,
          factoryAddress: token.factoryAddress,
          txHash: token.txHash,
          blockNumber: token.blockNumber.toString(),
          launchpad: 'clanker',
        },
        recommendedAction: 'monitor',
      });

      // Update connector state
      await this.updateClankerState(token.blockNumber);

      console.log(`[Registry] Processed Clanker token: ${token.tokenAddress}`);
    } catch (error) {
      console.error('[Registry] Error handling Clanker token:', error);
    }
  }

  /**
   * Update Clanker connector state in DB
   */
  private async updateClankerState(blockNumber: bigint): Promise<void> {
    await this.prisma.launchpadConnectorState.upsert({
      where: { connectorId: 'clanker-base' },
      create: {
        connectorId: 'clanker-base',
        chain: 'base',
        launchpad: 'clanker',
        lastBlockScanned: blockNumber,
        lastScanTs: new Date(),
      },
      update: {
        lastBlockScanned: blockNumber,
        lastScanTs: new Date(),
        errorCount: 0,
        lastError: null,
      },
    });
  }

  /**
   * Start all connectors
   */
  startAll(): void {
    for (const [id, connector] of this.connectors) {
      try {
        if (connector.status !== 'running') {
          connector.instance.start();
          connector.status = 'running';
          console.log(`[Registry] Started connector: ${id}`);
        }
      } catch (error) {
        connector.status = 'error';
        connector.lastError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Registry] Failed to start connector ${id}:`, error);
      }
    }
  }

  /**
   * Stop all connectors
   */
  stopAll(): void {
    for (const [id, connector] of this.connectors) {
      try {
        if (connector.status === 'running') {
          connector.instance.stop();
          connector.status = 'stopped';
          console.log(`[Registry] Stopped connector: ${id}`);
        }
      } catch (error) {
        console.error(`[Registry] Failed to stop connector ${id}:`, error);
      }
    }
  }

  /**
   * Get connector by ID
   */
  get(id: string): RegisteredConnector | undefined {
    return this.connectors.get(id);
  }

  /**
   * Get all connectors
   */
  getAll(): RegisteredConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Get Clanker connector instance
   */
  getClankerConnector(): ClankerConnector | null {
    return this.clankerConnector;
  }

  /**
   * Get unified status for all connectors (OpenClaw-style)
   * Includes both runtime connectors and DB-stored connectors
   */
  async getAllUnified(): Promise<UnifiedConnectorInfo[]> {
    const results: UnifiedConnectorInfo[] = [];

    // Add runtime connectors (Clanker, etc.)
    for (const [id, connector] of this.connectors) {
      const state = await this.prisma.launchpadConnectorState.findFirst({
        where: { connectorId: id },
      });

      const unifiedStatus: UnifiedConnectorStatus = 
        connector.status === 'running' ? 'connected' :
        connector.status === 'error' ? 'error' : 'offline';

      results.push({
        id: connector.id,
        name: `${connector.venue} (${connector.chain || 'multi'})`,
        type: connector.type,
        venue: connector.venue,
        chain: connector.chain,
        status: unifiedStatus,
        enabled: connector.status === 'running',
        lastSeen: state?.lastScanTs?.getTime(),
        lastPoll: state?.lastScanTs?.getTime(),
        lastError: connector.lastError || state?.lastError || undefined,
        meta: {
          lastBlockScanned: state?.lastBlockScanned?.toString(),
          errorCount: state?.errorCount,
        },
      });
    }

    // Add DB-stored connectors (Binance, etc.)
    const dbConnectors = await this.prisma.connector.findMany({
      orderBy: { createdAt: 'desc' },
    });

    for (const dbConn of dbConnectors) {
      const unifiedStatus: UnifiedConnectorStatus = 
        dbConn.status === 'connected' ? 'connected' :
        dbConn.status === 'error' ? 'error' :
        dbConn.status === 'disconnected' ? 'offline' : 'degraded';

      results.push({
        id: dbConn.id,
        name: dbConn.label || dbConn.venue,
        type: dbConn.type as 'cex' | 'dex' | 'launchpad' | 'wallet',
        venue: dbConn.venue,
        status: unifiedStatus,
        enabled: dbConn.enabled,
        lastSeen: dbConn.lastCheck?.getTime(),
        lastPoll: dbConn.lastCheck?.getTime(),
        meta: dbConn.config as Record<string, unknown>,
      });
    }

    return results;
  }

  /**
   * Get connector by ID (unified)
   */
  async getUnified(id: string): Promise<UnifiedConnectorInfo | null> {
    const all = await this.getAllUnified();
    return all.find(c => c.id === id) || null;
  }

  /**
   * Health check for a specific connector
   */
  async healthCheck(id: string): Promise<{ 
    status: UnifiedConnectorStatus; 
    latencyMs?: number; 
    error?: string;
  }> {
    // Check if it's a runtime connector
    const connector = this.connectors.get(id);
    if (connector) {
      // For Clanker, we can check if it's actively polling
      if (connector.status === 'running') {
        return { status: 'connected' };
      } else if (connector.status === 'error') {
        return { status: 'error', error: connector.lastError };
      }
      return { status: 'offline' };
    }

    // Check DB connectors - they have their own health check via routes
    const dbConn = await this.prisma.connector.findUnique({
      where: { id },
    });

    if (dbConn) {
      const status: UnifiedConnectorStatus = 
        dbConn.status === 'connected' ? 'connected' :
        dbConn.status === 'error' ? 'error' : 'offline';
      return { status };
    }

    return { status: 'offline', error: 'Connector not found' };
  }

  /**
   * Start a specific connector
   */
  async startConnector(id: string): Promise<boolean> {
    const connector = this.connectors.get(id);
    if (connector && connector.status !== 'running') {
      try {
        connector.instance.start();
        connector.status = 'running';
        return true;
      } catch (error) {
        connector.status = 'error';
        connector.lastError = error instanceof Error ? error.message : 'Unknown error';
        return false;
      }
    }

    // For DB connectors, just update enabled status
    const dbConn = await this.prisma.connector.findUnique({ where: { id } });
    if (dbConn) {
      await this.prisma.connector.update({
        where: { id },
        data: { enabled: true },
      });
      return true;
    }

    return false;
  }

  /**
   * Stop a specific connector
   */
  async stopConnector(id: string): Promise<boolean> {
    const connector = this.connectors.get(id);
    if (connector && connector.status === 'running') {
      try {
        connector.instance.stop();
        connector.status = 'stopped';
        return true;
      } catch {
        return false;
      }
    }

    // For DB connectors, update enabled status
    const dbConn = await this.prisma.connector.findUnique({ where: { id } });
    if (dbConn) {
      await this.prisma.connector.update({
        where: { id },
        data: { enabled: false },
      });
      return true;
    }

    return false;
  }
}

/**
 * Create connector registry
 */
export function createConnectorRegistry(
  prisma: PrismaClient,
  redis: Redis,
  signalService: SignalService
): ConnectorRegistry {
  return new ConnectorRegistry(prisma, redis, signalService);
}

