import { describe, it, expect } from 'vitest';
import { RiskPolicySchema, ActionRequestSchema, RiskCheckResultSchema } from './index.js';

describe('Risk Schemas', () => {
  describe('RiskPolicySchema', () => {
    it('should validate a complete policy', () => {
      const policy = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        maxOrderUsd: 100,
        maxPositionUsd: 1000,
        maxDailyLossUsd: 500,
        maxSlippageBps: 100,
        cooldownSeconds: 60,
        tokenAllowlist: [],
        tokenDenylist: [],
        venueAllowlist: [],
        chainAllowlist: [],
        killSwitchActive: false,
        dryRunMode: true,
      };

      const result = RiskPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const policy = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = RiskPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxOrderUsd).toBe(100);
        expect(result.data.dryRunMode).toBe(true);
      }
    });

    it('should reject invalid slippage', () => {
      const policy = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        maxSlippageBps: 15000, // More than 100%
      };

      const result = RiskPolicySchema.safeParse(policy);
      expect(result.success).toBe(false);
    });
  });

  describe('ActionRequestSchema', () => {
    it('should validate an order action', () => {
      const action = {
        type: 'order',
        venue: 'binance',
        amountUsd: 50,
        side: 'buy',
      };

      const result = ActionRequestSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should reject negative amounts', () => {
      const action = {
        type: 'order',
        venue: 'binance',
        amountUsd: -50,
      };

      const result = ActionRequestSchema.safeParse(action);
      expect(result.success).toBe(false);
    });
  });

  describe('RiskCheckResultSchema', () => {
    it('should validate an allowed result', () => {
      const result = {
        allowed: true,
        violations: [],
        warnings: ['Dry-run mode active'],
      };

      const parsed = RiskCheckResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate a blocked result', () => {
      const result = {
        allowed: false,
        reason: 'Order size exceeds limit',
        violations: [
          {
            rule: 'maxOrderUsd',
            message: 'Order size $150 exceeds maximum $100',
            actual: 150,
            limit: 100,
          },
        ],
        warnings: [],
      };

      const parsed = RiskCheckResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });
});


