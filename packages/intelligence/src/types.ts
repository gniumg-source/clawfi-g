/**
 * Provider-Agnostic Intelligence Types
 * 
 * These types define the interface for the explanation engine.
 * All implementations must be vendor-neutral.
 */

import { z } from 'zod';

// ============================================
// Configuration
// ============================================

export const InferenceConfigSchema = z.object({
  /** Provider type: 'local' | 'remote' | 'disabled' */
  provider: z.enum(['local', 'remote', 'disabled']).default('local'),
  
  /** Remote inference endpoint (if provider='remote') */
  endpoint: z.string().url().optional(),
  
  /** API key for remote provider (if required) */
  apiKey: z.string().optional(),
  
  /** Model identifier (provider-specific, neutral naming) */
  model: z.string().optional(),
  
  /** Request timeout in milliseconds */
  timeout: z.number().default(30000),
  
  /** Maximum tokens for response */
  maxTokens: z.number().default(500),
  
  /** Temperature for inference (0-1) */
  temperature: z.number().min(0).max(1).default(0.3),
});

export type InferenceConfig = z.infer<typeof InferenceConfigSchema>;

// ============================================
// Input Types
// ============================================

export interface TokenMetrics {
  symbol: string;
  chain: string;
  priceUsd: number;
  priceChange1h: number;
  priceChange6h?: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  buys24h: number;
  sells24h: number;
}

export interface TokenFlags {
  type: string;
  severity: 'info' | 'warning' | 'hard';
  message: string;
}

export interface TokenSignal {
  signal: string;
  confidence?: number;
}

export interface ExplanationContext {
  /** Token metrics */
  metrics: TokenMetrics;
  
  /** Risk flags */
  flags?: TokenFlags[];
  
  /** Generated signals */
  signals?: TokenSignal[];
  
  /** Conditions that passed/failed */
  conditions?: Array<{
    name: string;
    passed: boolean;
    value: string | number;
    threshold?: string;
    evidence?: string;
  }>;
  
  /** Composite score */
  score?: number;
  
  /** Additional context */
  context?: Record<string, unknown>;
}

// ============================================
// Output Types
// ============================================

export interface Explanation {
  /** Brief summary (1-2 sentences) */
  summary: string;
  
  /** Detailed rationale */
  rationale: string;
  
  /** Identified risks */
  risks: string[];
  
  /** Suggested actions (informational only, never financial advice) */
  suggestedActions: string[];
  
  /** Confidence level (0-1) */
  confidence: number;
  
  /** Provider used */
  provider: 'local' | 'remote';
  
  /** Generation timestamp */
  generatedAt: string;
}

// ============================================
// Provider Interface
// ============================================

export interface InferenceProvider {
  /** Provider identifier */
  readonly name: string;
  
  /** Whether provider is available */
  isAvailable(): Promise<boolean>;
  
  /** Generate explanation from context */
  generateExplanation(context: ExplanationContext): Promise<Explanation>;
}

// ============================================
// Factory Types
// ============================================

export type ProviderFactory = (config: InferenceConfig) => InferenceProvider;
