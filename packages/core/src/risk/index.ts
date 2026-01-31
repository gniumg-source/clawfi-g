import { z } from 'zod';
import {
  ChainSchema,
  VenueSchema,
  EthAddressSchema,
  BasisPointsSchema,
  UsdAmountSchema,
  TimestampSchema,
  UuidSchema,
} from '../common/index.js';

/**
 * Risk policy model
 * Defines constraints for all trading actions
 */
export const RiskPolicySchema = z.object({
  id: UuidSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  
  // Order constraints
  maxOrderUsd: UsdAmountSchema.default(100),
  maxPositionUsd: UsdAmountSchema.default(1000),
  maxDailyLossUsd: UsdAmountSchema.default(500),
  maxSlippageBps: BasisPointsSchema.default(100), // 1%
  
  // Cooldowns
  cooldownSeconds: z.number().int().min(0).default(60),
  
  // Allowlists/Denylists
  tokenAllowlist: z.array(EthAddressSchema).default([]),
  tokenDenylist: z.array(EthAddressSchema).default([]),
  venueAllowlist: z.array(VenueSchema).default([]),
  chainAllowlist: z.array(ChainSchema).default([]),
  
  // Global switches
  killSwitchActive: z.boolean().default(false),
  dryRunMode: z.boolean().default(true), // Default to dry-run for safety
  
  // Metadata
  meta: z.record(z.unknown()).optional(),
});
export type RiskPolicy = z.infer<typeof RiskPolicySchema>;

/**
 * Risk policy update input
 */
export const UpdateRiskPolicySchema = RiskPolicySchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UpdateRiskPolicy = z.infer<typeof UpdateRiskPolicySchema>;

/**
 * Risk check result
 */
export const RiskCheckResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  violations: z.array(z.object({
    rule: z.string(),
    message: z.string(),
    actual: z.unknown(),
    limit: z.unknown(),
  })).default([]),
  warnings: z.array(z.string()).default([]),
});
export type RiskCheckResult = z.infer<typeof RiskCheckResultSchema>;

/**
 * Action request for risk checking
 */
export const ActionRequestSchema = z.object({
  type: z.enum(['order', 'swap', 'transfer']),
  venue: VenueSchema,
  chain: ChainSchema.optional(),
  token: EthAddressSchema.optional(),
  tokenSymbol: z.string().optional(),
  amountUsd: UsdAmountSchema,
  side: z.enum(['buy', 'sell']).optional(),
  slippageBps: BasisPointsSchema.optional(),
  meta: z.record(z.unknown()).optional(),
});
export type ActionRequest = z.infer<typeof ActionRequestSchema>;

/**
 * Daily loss tracking
 */
export const DailyLossTrackerSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  realizedLossUsd: UsdAmountSchema,
  unrealizedLossUsd: UsdAmountSchema,
  totalTrades: z.number().int(),
});
export type DailyLossTracker = z.infer<typeof DailyLossTrackerSchema>;

/**
 * Position tracking for risk calculations
 */
export const PositionSchema = z.object({
  token: EthAddressSchema,
  chain: ChainSchema,
  venue: VenueSchema,
  amountRaw: z.string(), // BigInt as string
  amountUsd: UsdAmountSchema,
  avgEntryPriceUsd: UsdAmountSchema,
  unrealizedPnlUsd: z.number(),
  updatedAt: TimestampSchema,
});
export type Position = z.infer<typeof PositionSchema>;

/**
 * Kill switch request
 */
export const KillSwitchRequestSchema = z.object({
  active: z.boolean(),
  reason: z.string().optional(),
});
export type KillSwitchRequest = z.infer<typeof KillSwitchRequestSchema>;


