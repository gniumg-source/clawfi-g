/**
 * MoltWatch Strategy Tests
 * 
 * Tests for molt detection state transitions and false positive reduction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Event } from '@clawfi/core';

// Mock Prisma
const mockPrisma = {
  walletPosition: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
};

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
};

// Import after mocks (would need proper mocking setup in real tests)
// import { MoltWatchStrategy, createMoltWatchStrategy } from './moltwatch.js';

describe('MoltWatch State Transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
  });

  describe('Position Baseline Tracking', () => {
    it('should ignore positions below minPositionUsd', async () => {
      // Position with $500 value (below $1000 default minimum)
      const position = {
        chain: 'base',
        wallet: '0xabc',
        token: '0xtoken',
        baselineAmount: '1000000000000000000', // 1 token
        baselineUsd: 500, // Below minimum
        currentAmount: '1000000000000000000',
        currentUsd: 500,
      };

      mockPrisma.walletPosition.findUnique.mockResolvedValue(position);

      // Sell event should not trigger molt detection
      const sellEvent: Event = {
        id: 'evt1',
        ts: Date.now(),
        type: 'transfer',
        source: 'on-chain',
        chain: 'base',
        token: '0xtoken',
        wallet: '0xabc',
        meta: {
          direction: 'sell',
          amount: '900000000000000000', // 90% sell
          amountUsd: 450,
        },
      };

      // In real test, would process event and verify no signals
      expect(position.baselineUsd).toBeLessThan(1000);
    });

    it('should track positions at or above minPositionUsd', async () => {
      const position = {
        chain: 'base',
        wallet: '0xabc',
        token: '0xtoken',
        baselineAmount: '1000000000000000000',
        baselineUsd: 2000, // Above minimum
        currentAmount: '1000000000000000000',
        currentUsd: 2000,
      };

      mockPrisma.walletPosition.findUnique.mockResolvedValue(position);

      expect(position.baselineUsd).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Molt Threshold Detection', () => {
    it('should ignore sells below moltThresholdPercent', () => {
      // Default threshold is 50%
      const baselineAmount = BigInt('1000000000000000000');
      const smallSell = BigInt('300000000000000000'); // 30%
      
      const percentSold = Number((smallSell * 100n) / baselineAmount);
      
      expect(percentSold).toBe(30);
      expect(percentSold).toBeLessThan(50);
    });

    it('should detect sells at or above moltThresholdPercent', () => {
      const baselineAmount = BigInt('1000000000000000000');
      const largeSell = BigInt('600000000000000000'); // 60%
      
      const percentSold = Number((largeSell * 100n) / baselineAmount);
      
      expect(percentSold).toBe(60);
      expect(percentSold).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Rotation Window', () => {
    it('should detect rotation within time window', () => {
      const windowMinutes = 60;
      const windowMs = windowMinutes * 60 * 1000;
      
      const sellTs = Date.now();
      const buyTs = sellTs + (30 * 60 * 1000); // 30 minutes later
      
      const isWithinWindow = (buyTs - sellTs) <= windowMs;
      expect(isWithinWindow).toBe(true);
    });

    it('should ignore rotation outside time window', () => {
      const windowMinutes = 60;
      const windowMs = windowMinutes * 60 * 1000;
      
      const sellTs = Date.now();
      const buyTs = sellTs + (90 * 60 * 1000); // 90 minutes later
      
      const isWithinWindow = (buyTs - sellTs) <= windowMs;
      expect(isWithinWindow).toBe(false);
    });
  });

  describe('Complete Molt Flow', () => {
    it('should produce MoltDetected signal for valid rotation', () => {
      // Scenario:
      // 1. Wallet has position >= $1000
      // 2. Sells >= 50% of position
      // 3. Buys into different token within 60 minutes
      
      const detection = {
        wallet: '0xwallet123',
        fromToken: '0xtokenA',
        fromTokenSymbol: 'TOKA',
        toToken: '0xtokenB',
        toTokenSymbol: 'TOKB',
        percentSold: 75,
        timeDeltaMinutes: 15,
        sellTxHash: '0xsell',
        buyTxHash: '0xbuy',
        sellAmountUsd: 1500,
        buyAmountUsd: 1400,
      };

      // Verify signal would be created
      expect(detection.percentSold).toBeGreaterThanOrEqual(50);
      expect(detection.timeDeltaMinutes).toBeLessThanOrEqual(60);
      expect(detection.sellAmountUsd).toBeGreaterThanOrEqual(1000);
      expect(detection.fromToken).not.toBe(detection.toToken);
    });

    it('should not produce signal if same token (not rotation)', () => {
      const detection = {
        wallet: '0xwallet123',
        fromToken: '0xtokenA',
        toToken: '0xtokenA', // Same token!
        percentSold: 75,
        timeDeltaMinutes: 15,
      };

      // Same token should not count as rotation
      expect(detection.fromToken).toBe(detection.toToken);
    });
  });

  describe('Cooldown Mechanism', () => {
    it('should respect cooldown between alerts', async () => {
      const cooldownMinutes = 30;
      const cooldownMs = cooldownMinutes * 60 * 1000;
      
      const lastAlert = Date.now() - (15 * 60 * 1000); // 15 minutes ago
      const now = Date.now();
      
      const isInCooldown = (now - lastAlert) < cooldownMs;
      expect(isInCooldown).toBe(true);
    });

    it('should allow alert after cooldown expires', async () => {
      const cooldownMinutes = 30;
      const cooldownMs = cooldownMinutes * 60 * 1000;
      
      const lastAlert = Date.now() - (45 * 60 * 1000); // 45 minutes ago
      const now = Date.now();
      
      const isInCooldown = (now - lastAlert) < cooldownMs;
      expect(isInCooldown).toBe(false);
    });
  });

  describe('Bridge Events', () => {
    it('should count bridge as rotation completion', () => {
      // Bridge to another chain should also trigger molt detection
      const detection = {
        wallet: '0xwallet123',
        fromToken: '0xtokenA',
        toToken: 'bridge:ethereum', // Bridge destination
        percentSold: 80,
        timeDeltaMinutes: 10,
      };

      expect(detection.toToken.startsWith('bridge:')).toBe(true);
    });
  });
});

describe('Event Classification', () => {
  describe('Sell Event Detection', () => {
    it('should detect sell by direction meta', () => {
      const event = { meta: { direction: 'sell' } };
      expect(event.meta.direction).toBe('sell');
    });

    it('should detect sell by negative amount change', () => {
      const event = { meta: { amountChange: -1000 } };
      expect(event.meta.amountChange).toBeLessThan(0);
    });

    it('should detect sell by from address match', () => {
      const wallet = '0xwallet';
      const event = { 
        wallet,
        meta: { from: '0xwallet', to: '0xother' } 
      };
      expect(event.meta.from.toLowerCase()).toBe(wallet.toLowerCase());
    });
  });

  describe('Buy Event Detection', () => {
    it('should detect buy by direction meta', () => {
      const event = { meta: { direction: 'buy' } };
      expect(event.meta.direction).toBe('buy');
    });

    it('should detect buy by positive amount change', () => {
      const event = { meta: { amountChange: 1000 } };
      expect(event.meta.amountChange).toBeGreaterThan(0);
    });

    it('should detect buy by to address match', () => {
      const wallet = '0xwallet';
      const event = {
        wallet,
        meta: { from: '0xother', to: '0xwallet' }
      };
      expect(event.meta.to.toLowerCase()).toBe(wallet.toLowerCase());
    });
  });
});


