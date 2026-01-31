import { z } from 'zod';
import {
  ChainSchema,
  EthAddressSchema,
  TimestampSchema,
  UuidSchema,
} from '../common/index.js';
import { EventSchema, WatchedWalletSchema, WatchedTokenSchema } from '../events/index.js';
import { CreateSignalSchema } from '../signals/index.js';

/**
 * Strategy status
 */
export const StrategyStatusSchema = z.enum(['enabled', 'disabled', 'error']);
export type StrategyStatus = z.infer<typeof StrategyStatusSchema>;

/**
 * Base strategy configuration
 */
export const BaseStrategyConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  status: StrategyStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type BaseStrategyConfig = z.infer<typeof BaseStrategyConfigSchema>;

/**
 * MoltWatch strategy configuration
 * Detects partial sells and rotations by watched wallets
 */
export const MoltWatchConfigSchema = BaseStrategyConfigSchema.extend({
  strategyType: z.literal('moltwatch'),
  
  // Wallets to watch for molting behavior
  watchedWallets: z.array(WatchedWalletSchema).default([]),
  
  // Tokens to monitor (optional - if empty, watch all)
  watchedTokens: z.array(WatchedTokenSchema).default([]),
  
  // Thresholds
  moltThresholdPercent: z.number().min(1).max(100).default(20), // % of position sold to trigger
  rotationWindowMinutes: z.number().min(1).max(1440).default(30), // Time window to detect rotation
  minPositionUsd: z.number().min(0).default(100), // Minimum position value to track
  
  // Chains to monitor
  chains: z.array(ChainSchema).default(['ethereum']),
  
  // Polling interval (seconds)
  pollIntervalSeconds: z.number().int().min(10).default(60),
});
export type MoltWatchConfig = z.infer<typeof MoltWatchConfigSchema>;

/**
 * MoltWatch state for a wallet/token pair
 */
export const MoltWatchStateSchema = z.object({
  wallet: EthAddressSchema,
  token: EthAddressSchema,
  chain: ChainSchema,
  
  // Position tracking
  lastKnownBalance: z.string(), // BigInt as string
  lastKnownBalanceUsd: z.number(),
  
  // Recent activity
  recentSells: z.array(z.object({
    ts: TimestampSchema,
    amountRaw: z.string(),
    amountUsd: z.number(),
    txHash: z.string().optional(),
  })).default([]),
  
  recentBuys: z.array(z.object({
    ts: TimestampSchema,
    token: EthAddressSchema,
    amountUsd: z.number(),
    txHash: z.string().optional(),
  })).default([]),
  
  // State metadata
  updatedAt: TimestampSchema,
  lastMoltDetectedAt: TimestampSchema.optional(),
});
export type MoltWatchState = z.infer<typeof MoltWatchStateSchema>;

/**
 * Strategy configuration union
 */
export const StrategyConfigSchema = z.discriminatedUnion('strategyType', [
  MoltWatchConfigSchema,
]);
export type StrategyConfig = z.infer<typeof StrategyConfigSchema>;

/**
 * Strategy interface for implementations
 */
export interface IStrategy<TConfig extends BaseStrategyConfig, TState> {
  id: string;
  name: string;
  
  /**
   * Initialize the strategy with its configuration
   */
  initialize(config: TConfig): Promise<void>;
  
  /**
   * Process an event and optionally emit signals
   */
  processEvent(event: z.infer<typeof EventSchema>): Promise<z.infer<typeof CreateSignalSchema>[]>;
  
  /**
   * Get the current state
   */
  getState(): TState;
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<TConfig>): Promise<void>;
  
  /**
   * Clean up resources
   */
  shutdown(): Promise<void>;
}

/**
 * Strategy create/update input
 */
export const CreateStrategySchema = z.object({
  strategyType: z.enum(['moltwatch']),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  config: z.record(z.unknown()),
});
export type CreateStrategy = z.infer<typeof CreateStrategySchema>;

export const UpdateStrategySchema = z.object({
  status: StrategyStatusSchema.optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  config: z.record(z.unknown()).optional(),
});
export type UpdateStrategy = z.infer<typeof UpdateStrategySchema>;


