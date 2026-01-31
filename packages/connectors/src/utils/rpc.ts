/**
 * RPC Utilities with Retry/Backoff
 * 
 * Provides robust RPC communication with:
 * - Exponential backoff
 * - Jitter to prevent thundering herd
 * - Rate limiting
 * - Error classification
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.3,
};

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoff(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  
  // Add jitter: random value between -jitterFactor and +jitterFactor of the delay
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);
  
  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * RPC Error types for classification
 */
export enum RpcErrorType {
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Classify RPC error for retry decision
 */
export function classifyRpcError(error: unknown): RpcErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Rate limiting
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    ) {
      return RpcErrorType.RATE_LIMITED;
    }
    
    // Timeout
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('etimedout')
    ) {
      return RpcErrorType.TIMEOUT;
    }
    
    // Server errors (should retry)
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('internal server error')
    ) {
      return RpcErrorType.SERVER_ERROR;
    }
    
    // Invalid request (should not retry)
    if (
      message.includes('invalid') ||
      message.includes('400') ||
      message.includes('bad request')
    ) {
      return RpcErrorType.INVALID_REQUEST;
    }
    
    // Network errors
    if (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('network')
    ) {
      return RpcErrorType.NETWORK_ERROR;
    }
  }
  
  return RpcErrorType.UNKNOWN;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(errorType: RpcErrorType): boolean {
  return [
    RpcErrorType.RATE_LIMITED,
    RpcErrorType.TIMEOUT,
    RpcErrorType.SERVER_ERROR,
    RpcErrorType.NETWORK_ERROR,
  ].includes(errorType);
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const errorType = classifyRpcError(error);
      
      // Don't retry invalid requests
      if (!isRetryableError(errorType)) {
        throw error;
      }
      
      // Don't retry if we've exhausted attempts
      if (attempt === retryConfig.maxRetries) {
        break;
      }
      
      const delay = calculateBackoff(attempt, retryConfig);
      console.warn(
        `[RPC] Attempt ${attempt + 1} failed (${errorType}), retrying in ${delay}ms...`
      );
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Simple rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private readonly tokensPerSecond: number,
    private readonly maxTokens: number = tokensPerSecond * 2
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }
  
  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.tokensPerSecond;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
  
  /**
   * Wait until a token is available, then consume it
   */
  async acquire(): Promise<void> {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    
    // Wait for token to become available
    const waitTime = (1 - this.tokens) / this.tokensPerSecond * 1000;
    await sleep(waitTime);
    
    this.refill();
    this.tokens -= 1;
  }
  
  /**
   * Check if a token is available without consuming
   */
  isAvailable(): boolean {
    this.refill();
    return this.tokens >= 1;
  }
}

/**
 * Create a rate-limited function wrapper
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  limiter: RateLimiter
): T {
  return (async (...args: unknown[]) => {
    await limiter.acquire();
    return fn(...args);
  }) as T;
}


