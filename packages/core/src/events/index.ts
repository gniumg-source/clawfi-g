import { z } from 'zod';
import {
  ChainSchema,
  VenueSchema,
  EthAddressSchema,
  TxHashSchema,
  TimestampSchema,
  UuidSchema,
} from '../common/index.js';

/**
 * Event types for normalized crypto events
 */
export const EventTypeSchema = z.enum([
  'swap',
  'transfer',
  'mint',
  'burn',
  'bridge_out',
  'bridge_in',
  'deposit',
  'withdrawal',
  'order_placed',
  'order_filled',
  'order_cancelled',
  'liquidation',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * Normalized event model
 * Represents any on-chain or exchange event in a unified format
 */
export const EventSchema = z.object({
  id: UuidSchema,
  ts: TimestampSchema,
  source: z.string().min(1), // e.g., 'evm-logs', 'binance-ws'
  chain: ChainSchema,
  venue: VenueSchema.optional(),
  type: EventTypeSchema,
  wallet: EthAddressSchema,
  tokenIn: EthAddressSchema.optional(),
  tokenOut: EthAddressSchema.optional(),
  amountIn: z.string().optional(), // BigInt as string for precision
  amountOut: z.string().optional(),
  txHash: TxHashSchema.optional(),
  blockNumber: z.number().int().positive().optional(),
  meta: z.record(z.unknown()).optional(),
});
export type Event = z.infer<typeof EventSchema>;

/**
 * Event creation input (without auto-generated fields)
 */
export const CreateEventSchema = EventSchema.omit({ id: true, ts: true });
export type CreateEvent = z.infer<typeof CreateEventSchema>;

/**
 * Event filter for querying
 */
export const EventFilterSchema = z.object({
  chain: ChainSchema.optional(),
  venue: VenueSchema.optional(),
  type: EventTypeSchema.optional(),
  wallet: EthAddressSchema.optional(),
  token: EthAddressSchema.optional(), // matches tokenIn or tokenOut
  startTs: TimestampSchema.optional(),
  endTs: TimestampSchema.optional(),
});
export type EventFilter = z.infer<typeof EventFilterSchema>;

/**
 * Watched wallet configuration
 */
export const WatchedWalletSchema = z.object({
  address: EthAddressSchema,
  label: z.string().optional(),
  chain: ChainSchema,
  enabled: z.boolean().default(true),
  addedAt: TimestampSchema,
});
export type WatchedWallet = z.infer<typeof WatchedWalletSchema>;

/**
 * Watched token configuration
 */
export const WatchedTokenSchema = z.object({
  address: EthAddressSchema,
  symbol: z.string().optional(),
  chain: ChainSchema,
  enabled: z.boolean().default(true),
  addedAt: TimestampSchema,
});
export type WatchedToken = z.infer<typeof WatchedTokenSchema>;


