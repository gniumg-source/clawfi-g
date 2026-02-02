/**
 * Intelligence Engine
 * 
 * Main orchestrator for the provider-agnostic inference system.
 * Handles provider selection, fallback logic, and caching.
 */

import {
  InferenceConfig,
  InferenceConfigSchema,
  InferenceProvider,
  ExplanationContext,
  Explanation,
} from './types.js';
import { LocalRuleProvider } from './providers/local.js';
import { RemoteProvider } from './providers/remote.js';

// ============================================
// Engine Configuration
// ============================================

interface EngineOptions {
  /** Enable caching of explanations */
  enableCache?: boolean;
  
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  
  /** Fall back to local if remote fails */
  fallbackToLocal?: boolean;
}

const DEFAULT_OPTIONS: Required<EngineOptions> = {
  enableCache: true,
  cacheTtl: 60000, // 1 minute
  fallbackToLocal: true,
};

// ============================================
// Cache Implementation
// ============================================

interface CacheEntry {
  explanation: Explanation;
  timestamp: number;
}

class ExplanationCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;
  
  constructor(ttl: number) {
    this.ttl = ttl;
  }
  
  private makeKey(context: ExplanationContext): string {
    // Create a stable key from context
    const { metrics, score } = context;
    return `${metrics.symbol}:${metrics.chain}:${metrics.priceUsd}:${score}`;
  }
  
  get(context: ExplanationContext): Explanation | null {
    const key = this.makeKey(context);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.explanation;
  }
  
  set(context: ExplanationContext, explanation: Explanation): void {
    const key = this.makeKey(context);
    this.cache.set(key, {
      explanation,
      timestamp: Date.now(),
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// ============================================
// Intelligence Engine
// ============================================

export class IntelligenceEngine {
  private config: InferenceConfig;
  private options: Required<EngineOptions>;
  private provider: InferenceProvider;
  private localProvider: LocalRuleProvider;
  private cache: ExplanationCache | null;
  
  constructor(
    config: Partial<InferenceConfig> = {},
    options: EngineOptions = {}
  ) {
    // Validate and merge config
    this.config = InferenceConfigSchema.parse(config);
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    // Initialize cache
    this.cache = this.options.enableCache
      ? new ExplanationCache(this.options.cacheTtl)
      : null;
    
    // Initialize providers
    this.localProvider = new LocalRuleProvider(this.config);
    this.provider = this.createProvider();
  }
  
  private createProvider(): InferenceProvider {
    switch (this.config.provider) {
      case 'remote':
        return new RemoteProvider(this.config);
      case 'local':
        return this.localProvider;
      case 'disabled':
      default:
        return this.localProvider;
    }
  }
  
  /**
   * Generate an explanation for the given context
   */
  async explain(context: ExplanationContext): Promise<Explanation> {
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(context);
      if (cached) {
        return { ...cached, generatedAt: cached.generatedAt + ' (cached)' };
      }
    }
    
    try {
      // Try primary provider
      const explanation = await this.provider.generateExplanation(context);
      
      // Cache result
      if (this.cache) {
        this.cache.set(context, explanation);
      }
      
      return explanation;
    } catch (error) {
      // If remote fails and fallback is enabled, use local
      if (
        this.config.provider === 'remote' &&
        this.options.fallbackToLocal
      ) {
        console.warn('Remote inference failed, falling back to local:', error);
        return this.localProvider.generateExplanation(context);
      }
      
      throw error;
    }
  }
  
  /**
   * Check if the configured provider is available
   */
  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }
  
  /**
   * Get provider info
   */
  getProviderInfo(): { name: string; type: 'local' | 'remote' } {
    return {
      name: this.provider.name,
      type: this.config.provider === 'remote' ? 'remote' : 'local',
    };
  }
  
  /**
   * Clear the explanation cache
   */
  clearCache(): void {
    this.cache?.clear();
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<InferenceConfig>): void {
    this.config = InferenceConfigSchema.parse({ ...this.config, ...config });
    this.provider = this.createProvider();
    this.cache?.clear();
  }
}

// ============================================
// Singleton Instance
// ============================================

let defaultEngine: IntelligenceEngine | null = null;

/**
 * Get or create the default intelligence engine
 */
export function getIntelligenceEngine(
  config?: Partial<InferenceConfig>,
  options?: EngineOptions
): IntelligenceEngine {
  if (!defaultEngine) {
    defaultEngine = new IntelligenceEngine(config, options);
  }
  return defaultEngine;
}

/**
 * Initialize the engine with config from environment
 */
export function initializeFromEnv(): IntelligenceEngine {
  const config: Partial<InferenceConfig> = {
    provider: (process.env.INFERENCE_PROVIDER || 'local') as 'local' | 'remote' | 'disabled',
    endpoint: process.env.INFERENCE_ENDPOINT,
    apiKey: process.env.INFERENCE_API_KEY,
    model: process.env.INFERENCE_MODEL,
    timeout: parseInt(process.env.INFERENCE_TIMEOUT || '30000', 10),
    maxTokens: parseInt(process.env.INFERENCE_MAX_TOKENS || '500', 10),
    temperature: parseFloat(process.env.INFERENCE_TEMPERATURE || '0.3'),
  };
  
  defaultEngine = new IntelligenceEngine(config);
  return defaultEngine;
}
