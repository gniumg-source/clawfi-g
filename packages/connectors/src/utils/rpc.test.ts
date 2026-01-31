/**
 * RPC Utilities Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateBackoff,
  sleep,
  classifyRpcError,
  isRetryableError,
  withRetry,
  RateLimiter,
  RpcErrorType,
  DEFAULT_RETRY_CONFIG,
} from './rpc.js';

describe('calculateBackoff', () => {
  it('should return base delay for first attempt', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0 };
    const delay = calculateBackoff(0, config);
    expect(delay).toBe(config.baseDelayMs);
  });

  it('should double delay for each attempt', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0 };
    const delay0 = calculateBackoff(0, config);
    const delay1 = calculateBackoff(1, config);
    const delay2 = calculateBackoff(2, config);

    expect(delay1).toBe(delay0 * 2);
    expect(delay2).toBe(delay0 * 4);
  });

  it('should cap delay at maxDelayMs', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0, maxDelayMs: 5000 };
    const delay = calculateBackoff(10, config); // Would be very large without cap
    expect(delay).toBe(5000);
  });

  it('should add jitter within expected range', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0.3 };
    const baseDelay = config.baseDelayMs;
    
    // Run multiple times to check jitter variation
    const delays = Array.from({ length: 100 }, () => calculateBackoff(0, config));
    
    const min = Math.min(...delays);
    const max = Math.max(...delays);
    
    // Should be within jitter range
    expect(min).toBeGreaterThanOrEqual(baseDelay * 0.7);
    expect(max).toBeLessThanOrEqual(baseDelay * 1.3);
    
    // Should have some variation
    expect(max - min).toBeGreaterThan(0);
  });
});

describe('sleep', () => {
  it('should resolve after specified delay', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some timing variance
    expect(elapsed).toBeLessThan(100);
  });
});

describe('classifyRpcError', () => {
  it('should classify rate limit errors', () => {
    expect(classifyRpcError(new Error('rate limit exceeded'))).toBe(RpcErrorType.RATE_LIMITED);
    expect(classifyRpcError(new Error('too many requests'))).toBe(RpcErrorType.RATE_LIMITED);
    expect(classifyRpcError(new Error('HTTP 429'))).toBe(RpcErrorType.RATE_LIMITED);
  });

  it('should classify timeout errors', () => {
    expect(classifyRpcError(new Error('request timeout'))).toBe(RpcErrorType.TIMEOUT);
    expect(classifyRpcError(new Error('ETIMEDOUT'))).toBe(RpcErrorType.TIMEOUT);
    expect(classifyRpcError(new Error('timed out'))).toBe(RpcErrorType.TIMEOUT);
  });

  it('should classify server errors', () => {
    expect(classifyRpcError(new Error('500 Internal Server Error'))).toBe(RpcErrorType.SERVER_ERROR);
    expect(classifyRpcError(new Error('502 Bad Gateway'))).toBe(RpcErrorType.SERVER_ERROR);
    expect(classifyRpcError(new Error('503 Service Unavailable'))).toBe(RpcErrorType.SERVER_ERROR);
  });

  it('should classify invalid request errors', () => {
    expect(classifyRpcError(new Error('400 Bad Request'))).toBe(RpcErrorType.INVALID_REQUEST);
    expect(classifyRpcError(new Error('invalid parameters'))).toBe(RpcErrorType.INVALID_REQUEST);
  });

  it('should classify network errors', () => {
    expect(classifyRpcError(new Error('ECONNREFUSED'))).toBe(RpcErrorType.NETWORK_ERROR);
    expect(classifyRpcError(new Error('ENOTFOUND'))).toBe(RpcErrorType.NETWORK_ERROR);
  });

  it('should return UNKNOWN for unrecognized errors', () => {
    expect(classifyRpcError(new Error('some random error'))).toBe(RpcErrorType.UNKNOWN);
    expect(classifyRpcError('string error')).toBe(RpcErrorType.UNKNOWN);
    expect(classifyRpcError(null)).toBe(RpcErrorType.UNKNOWN);
  });
});

describe('isRetryableError', () => {
  it('should return true for retryable errors', () => {
    expect(isRetryableError(RpcErrorType.RATE_LIMITED)).toBe(true);
    expect(isRetryableError(RpcErrorType.TIMEOUT)).toBe(true);
    expect(isRetryableError(RpcErrorType.SERVER_ERROR)).toBe(true);
    expect(isRetryableError(RpcErrorType.NETWORK_ERROR)).toBe(true);
  });

  it('should return false for non-retryable errors', () => {
    expect(isRetryableError(RpcErrorType.INVALID_REQUEST)).toBe(false);
    expect(isRetryableError(RpcErrorType.UNKNOWN)).toBe(false);
  });
});

describe('withRetry', () => {
  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { baseDelayMs: 10, maxDelayMs: 20 });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw immediately on non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('invalid parameters'));
    
    await expect(withRetry(fn)).rejects.toThrow('invalid parameters');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('timeout'));
    
    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 20 })
    ).rejects.toThrow('timeout');
    
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

describe('RateLimiter', () => {
  it('should allow requests up to limit', async () => {
    const limiter = new RateLimiter(10, 10);
    
    // Should have tokens available
    expect(limiter.isAvailable()).toBe(true);
    
    // Should be able to acquire multiple times quickly
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    
    expect(limiter.isAvailable()).toBe(true);
  });

  it('should refill tokens over time', async () => {
    const limiter = new RateLimiter(100, 2); // High rate, low burst
    
    // Drain tokens
    await limiter.acquire();
    await limiter.acquire();
    
    // Wait for refill
    await sleep(50);
    
    // Should have tokens again
    expect(limiter.isAvailable()).toBe(true);
  });
});


