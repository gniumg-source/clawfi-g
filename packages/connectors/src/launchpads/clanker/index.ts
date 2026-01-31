/**
 * Clanker Launchpad Connector
 * 
 * READ-ONLY indexer that detects new Clanker token deployments on Base.
 * Supports both event-based scanning and transaction receipt parsing.
 * 
 * Chain: Base (chainId 8453)
 * 
 * USAGE:
 * 1. Configure factory addresses in DB or env
 * 2. Connector polls new blocks on interval
 * 3. Scans for known events OR parses tx receipts to factory addresses
 * 4. Emits LaunchDetected signals
 * 
 * ADDING NEW EVENT TOPICS:
 * - Add topic0 hash to KNOWN_FACTORY_EVENTS
 * - Or configure via factoryConfig.eventTopics
 */

import { createPublicClient, http, type PublicClient, type Log, type Hash, parseAbiItem, decodeEventLog } from 'viem';
import { base } from 'viem/chains';
import { withRetry, RateLimiter, withRateLimit, type RetryConfig } from '../../utils/rpc.js';

// ============================================
// Types
// ============================================

export interface ClankerConnectorConfig {
  rpcUrl: string;
  chainId?: number;
  factoryAddresses: string[];
  eventTopics?: string[];
  pollIntervalMs?: number;
  maxBlocksPerScan?: number;
  startBlock?: bigint;
  retryConfig?: Partial<RetryConfig>;
  rateLimit?: number; // requests per second
}

export interface DetectedToken {
  tokenAddress: string;
  creatorAddress: string;
  factoryAddress: string;
  txHash: string;
  blockNumber: bigint;
  blockTimestamp?: bigint;
  version?: string;
  meta?: Record<string, unknown>;
}

export interface ScanResult {
  tokens: DetectedToken[];
  lastBlock: bigint;
  errors: string[];
}

export type TokenCallback = (token: DetectedToken) => void | Promise<void>;

// ============================================
// Constants
// ============================================

// Base chain config
const BASE_CHAIN_ID = 8453;

// Known Clanker factory event signatures
// Add new event topics here as they are discovered
export const KNOWN_FACTORY_EVENTS = {
  // ERC-20 Transfer from zero address (token mint)
  Transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  
  // Common factory patterns - add confirmed topics here
  // TokenCreated: '0x...', // topic0 for TokenCreated(address token, address creator)
  // ClankerLaunched: '0x...', // topic0 for ClankerLaunched event if exists
} as const;

// Transfer event ABI for decoding
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

// Default config
const DEFAULT_CONFIG: Partial<ClankerConnectorConfig> = {
  chainId: BASE_CHAIN_ID,
  pollIntervalMs: 10000, // 10 seconds
  maxBlocksPerScan: 100,
  rateLimit: 5, // 5 requests per second (conservative for public RPCs)
};

// ============================================
// Clanker Connector Class
// ============================================

export class ClankerConnector {
  private client: PublicClient;
  private config: Required<ClankerConnectorConfig>;
  private rateLimiter: RateLimiter;
  private isRunning = false;
  private pollTimeout: NodeJS.Timeout | null = null;
  private lastScannedBlock: bigint = 0n;
  private callbacks: Set<TokenCallback> = new Set();

  constructor(config: ClankerConnectorConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      retryConfig: {},
      eventTopics: [],
      startBlock: 0n,
      ...config,
    } as Required<ClankerConnectorConfig>;

    // Initialize viem client
    this.client = createPublicClient({
      chain: base,
      transport: http(this.config.rpcUrl, {
        retryCount: 3,
        retryDelay: 1000,
      }),
    }) as PublicClient;

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(this.config.rateLimit);

    this.lastScannedBlock = this.config.startBlock;
  }

  /**
   * Subscribe to token detection events
   */
  onToken(callback: TokenCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Notify all subscribers of a detected token
   */
  private async notifyToken(token: DetectedToken): Promise<void> {
    for (const callback of this.callbacks) {
      try {
        await callback(token);
      } catch (error) {
        console.error('[Clanker] Callback error:', error);
      }
    }
  }

  /**
   * Start polling for new tokens
   */
  start(fromBlock?: bigint): void {
    if (this.isRunning) {
      console.warn('[Clanker] Connector already running');
      return;
    }

    if (fromBlock !== undefined) {
      this.lastScannedBlock = fromBlock;
    }

    this.isRunning = true;
    console.log(`[Clanker] Starting connector from block ${this.lastScannedBlock}`);
    this.poll();
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    console.log('[Clanker] Connector stopped');
  }

  /**
   * Get current scan position
   */
  getLastScannedBlock(): bigint {
    return this.lastScannedBlock;
  }

  /**
   * Set scan position (for resuming)
   */
  setLastScannedBlock(block: bigint): void {
    this.lastScannedBlock = block;
  }

  /**
   * Main polling loop
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const result = await this.scanNewBlocks();
      
      if (result.tokens.length > 0) {
        console.log(`[Clanker] Detected ${result.tokens.length} new tokens`);
        for (const token of result.tokens) {
          await this.notifyToken(token);
        }
      }

      if (result.lastBlock > this.lastScannedBlock) {
        this.lastScannedBlock = result.lastBlock;
      }

      if (result.errors.length > 0) {
        console.warn('[Clanker] Scan errors:', result.errors);
      }
    } catch (error) {
      console.error('[Clanker] Poll error:', error);
    }

    // Schedule next poll
    if (this.isRunning) {
      this.pollTimeout = setTimeout(() => this.poll(), this.config.pollIntervalMs);
    }
  }

  /**
   * Scan new blocks for token deployments
   */
  async scanNewBlocks(): Promise<ScanResult> {
    const result: ScanResult = {
      tokens: [],
      lastBlock: this.lastScannedBlock,
      errors: [],
    };

    try {
      // Get current block number with rate limiting
      const currentBlock = await withRetry(
        () => withRateLimit(() => this.client.getBlockNumber(), this.rateLimiter)(),
        this.config.retryConfig
      );

      // Calculate block range
      const fromBlock = this.lastScannedBlock > 0n 
        ? this.lastScannedBlock + 1n 
        : currentBlock - BigInt(this.config.maxBlocksPerScan);
      
      const toBlock = fromBlock + BigInt(this.config.maxBlocksPerScan) < currentBlock
        ? fromBlock + BigInt(this.config.maxBlocksPerScan)
        : currentBlock;

      if (fromBlock > currentBlock) {
        // Already up to date
        return result;
      }

      console.log(`[Clanker] Scanning blocks ${fromBlock} - ${toBlock}`);

      // Run both scan modes in parallel
      const [eventTokens, receiptTokens] = await Promise.all([
        this.scanByEvents(fromBlock, toBlock).catch((e) => {
          result.errors.push(`Event scan: ${e.message}`);
          return [] as DetectedToken[];
        }),
        this.scanByReceipts(fromBlock, toBlock).catch((e) => {
          result.errors.push(`Receipt scan: ${e.message}`);
          return [] as DetectedToken[];
        }),
      ]);

      // Deduplicate by token address
      const seenTokens = new Set<string>();
      for (const token of [...eventTokens, ...receiptTokens]) {
        const key = token.tokenAddress.toLowerCase();
        if (!seenTokens.has(key)) {
          seenTokens.add(key);
          result.tokens.push(token);
        }
      }

      result.lastBlock = toBlock;
    } catch (error) {
      result.errors.push(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Mode A: Event-based scanning
   * Scans for known factory events in the block range
   */
  private async scanByEvents(fromBlock: bigint, toBlock: bigint): Promise<DetectedToken[]> {
    const tokens: DetectedToken[] = [];
    const factoryAddresses = this.config.factoryAddresses.map((a) => a.toLowerCase() as `0x${string}`);

    if (factoryAddresses.length === 0) {
      return tokens;
    }

    // Build topics list (configured + known)
    const topics = [
      ...this.config.eventTopics,
      KNOWN_FACTORY_EVENTS.Transfer,
    ];

    try {
      // Get logs from factory addresses
      const logs = await withRetry(
        () => withRateLimit(
          () => this.client.getLogs({
            address: factoryAddresses,
            fromBlock,
            toBlock,
          }),
          this.rateLimiter
        )(),
        this.config.retryConfig
      );

      // Process logs
      for (const log of logs) {
        const token = await this.processLog(log);
        if (token) {
          tokens.push(token);
        }
      }
    } catch (error) {
      console.error('[Clanker] Event scan error:', error);
    }

    return tokens;
  }

  /**
   * Process a log entry to extract token info
   */
  private async processLog(log: Log): Promise<DetectedToken | null> {
    try {
      // Check if this is a Transfer from zero address (token creation)
      if (log.topics[0] === KNOWN_FACTORY_EVENTS.Transfer) {
        const decoded = decodeEventLog({
          abi: [TRANSFER_EVENT],
          data: log.data,
          topics: log.topics,
        });

        // Transfer from zero address indicates token mint/creation
        if (decoded.args.from === '0x0000000000000000000000000000000000000000') {
          // The log.address is the token address for Transfer events
          const block = await this.getBlockTimestamp(log.blockNumber!);
          
          return {
            tokenAddress: log.address,
            creatorAddress: decoded.args.to,
            factoryAddress: log.address, // For Transfer, source is the token itself
            txHash: log.transactionHash!,
            blockNumber: log.blockNumber!,
            blockTimestamp: block,
          };
        }
      }

      // Add handling for other known events here as they are discovered
      // Example:
      // if (log.topics[0] === KNOWN_FACTORY_EVENTS.TokenCreated) { ... }

    } catch (error) {
      console.debug('[Clanker] Log processing error:', error);
    }

    return null;
  }

  /**
   * Mode B: Transaction receipt scanning
   * Scans transactions to factory addresses and parses receipts
   */
  private async scanByReceipts(fromBlock: bigint, toBlock: bigint): Promise<DetectedToken[]> {
    const tokens: DetectedToken[] = [];
    const factoryAddresses = new Set(
      this.config.factoryAddresses.map((a) => a.toLowerCase())
    );

    if (factoryAddresses.size === 0) {
      return tokens;
    }

    try {
      // Get blocks in range
      for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
        const block = await withRetry(
          () => withRateLimit(
            () => this.client.getBlock({ 
              blockNumber: blockNum,
              includeTransactions: true,
            }),
            this.rateLimiter
          )(),
          this.config.retryConfig
        );

        // Check each transaction
        for (const tx of block.transactions) {
          if (typeof tx === 'string') continue; // Skip if not full tx
          
          // Check if transaction is to a factory address
          if (tx.to && factoryAddresses.has(tx.to.toLowerCase())) {
            const token = await this.processTransaction(tx.hash, block.timestamp);
            if (token) {
              tokens.push(token);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Clanker] Receipt scan error:', error);
    }

    return tokens;
  }

  /**
   * Process a transaction to extract created token
   */
  private async processTransaction(
    txHash: Hash,
    blockTimestamp: bigint
  ): Promise<DetectedToken | null> {
    try {
      const receipt = await withRetry(
        () => withRateLimit(
          () => this.client.getTransactionReceipt({ hash: txHash }),
          this.rateLimiter
        )(),
        this.config.retryConfig
      );

      // Look for created contract address
      if (receipt.contractAddress) {
        return {
          tokenAddress: receipt.contractAddress,
          creatorAddress: receipt.from,
          factoryAddress: receipt.to!,
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          blockTimestamp,
        };
      }

      // Look for Transfer from zero in logs (token creation pattern)
      for (const log of receipt.logs) {
        if (log.topics[0] === KNOWN_FACTORY_EVENTS.Transfer) {
          try {
            const decoded = decodeEventLog({
              abi: [TRANSFER_EVENT],
              data: log.data,
              topics: log.topics,
            });

            if (decoded.args.from === '0x0000000000000000000000000000000000000000') {
              return {
                tokenAddress: log.address,
                creatorAddress: decoded.args.to,
                factoryAddress: receipt.to!,
                txHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                blockTimestamp,
              };
            }
          } catch {
            // Skip logs that don't match Transfer
          }
        }
      }
    } catch (error) {
      console.debug('[Clanker] Transaction processing error:', error);
    }

    return null;
  }

  /**
   * Get block timestamp
   */
  private async getBlockTimestamp(blockNumber: bigint): Promise<bigint> {
    try {
      const block = await withRetry(
        () => withRateLimit(
          () => this.client.getBlock({ blockNumber }),
          this.rateLimiter
        )(),
        this.config.retryConfig
      );
      return block.timestamp;
    } catch {
      return 0n;
    }
  }

  /**
   * Get token metadata (name, symbol) from contract
   */
  async getTokenMetadata(tokenAddress: string): Promise<{ name?: string; symbol?: string }> {
    const result: { name?: string; symbol?: string } = {};

    try {
      const [name, symbol] = await Promise.all([
        this.client.readContract({
          address: tokenAddress as `0x${string}`,
          abi: [parseAbiItem('function name() view returns (string)')],
          functionName: 'name',
        }).catch(() => undefined),
        this.client.readContract({
          address: tokenAddress as `0x${string}`,
          abi: [parseAbiItem('function symbol() view returns (string)')],
          functionName: 'symbol',
        }).catch(() => undefined),
      ]);

      if (name) result.name = name as string;
      if (symbol) result.symbol = symbol as string;
    } catch {
      // Ignore metadata fetch errors
    }

    return result;
  }
}

/**
 * Create a Clanker connector instance
 */
export function createClankerConnector(config: ClankerConnectorConfig): ClankerConnector {
  return new ClankerConnector(config);
}

