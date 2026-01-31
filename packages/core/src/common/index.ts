import { z } from 'zod';

/**
 * Supported blockchain chains
 */
export const ChainSchema = z.enum([
  'ethereum',
  'arbitrum',
  'base',
  'polygon',
  'optimism',
  'avalanche',
  'bsc',
  'solana',
]);
export type Chain = z.infer<typeof ChainSchema>;

/**
 * Supported venue types
 */
export const VenueTypeSchema = z.enum(['cex', 'dex', 'launchpad', 'bridge']);
export type VenueType = z.infer<typeof VenueTypeSchema>;

/**
 * Supported venues
 */
export const VenueSchema = z.enum([
  'binance',
  'uniswap_v2',
  'uniswap_v3',
  'sushiswap',
  'curve',
  'balancer',
  'raydium',
  'jupiter',
]);
export type Venue = z.infer<typeof VenueSchema>;

/**
 * Ethereum address validation
 */
export const EthAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
export type EthAddress = z.infer<typeof EthAddressSchema>;

/**
 * Transaction hash validation
 */
export const TxHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash');
export type TxHash = z.infer<typeof TxHashSchema>;

/**
 * Token metadata
 */
export const TokenSchema = z.object({
  address: EthAddressSchema,
  symbol: z.string().min(1).max(20),
  name: z.string().optional(),
  decimals: z.number().int().min(0).max(18),
  chain: ChainSchema,
});
export type Token = z.infer<typeof TokenSchema>;

/**
 * Pagination params
 */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Timestamp helper
 */
export const TimestampSchema = z.number().int().positive();
export type Timestamp = z.infer<typeof TimestampSchema>;

/**
 * UUID schema
 */
export const UuidSchema = z.string().uuid();
export type Uuid = z.infer<typeof UuidSchema>;

/**
 * Basis points (1 bp = 0.01%)
 */
export const BasisPointsSchema = z.number().int().min(0).max(10000);
export type BasisPoints = z.infer<typeof BasisPointsSchema>;

/**
 * USD amount (with decimals)
 */
export const UsdAmountSchema = z.number().nonnegative();
export type UsdAmount = z.infer<typeof UsdAmountSchema>;


