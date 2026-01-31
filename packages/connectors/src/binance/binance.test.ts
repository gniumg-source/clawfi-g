import { describe, it, expect } from 'vitest';
import { BinanceConfigSchema } from './index.js';

describe('Binance Connector', () => {
  describe('BinanceConfigSchema', () => {
    it('should validate a complete config', () => {
      const config = {
        id: 'test-id',
        label: 'My Binance',
        testnet: true,
      };

      const result = BinanceConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should apply testnet default', () => {
      const config = {
        id: 'test-id',
      };

      const result = BinanceConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.testnet).toBe(true);
      }
    });

    it('should require id', () => {
      const config = {
        label: 'My Binance',
      };

      const result = BinanceConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  // Note: Full connector tests would require mocking the Binance API
  // These are just schema validation tests
});


