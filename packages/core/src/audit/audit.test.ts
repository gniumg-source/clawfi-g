import { describe, it, expect } from 'vitest';
import { redactSensitive } from './index.js';

describe('Audit Utilities', () => {
  describe('redactSensitive', () => {
    it('should redact password fields', () => {
      const obj = {
        username: 'user',
        password: 'secret123',
      };

      const result = redactSensitive(obj);
      expect(result.username).toBe('user');
      expect(result.password).toBe('[REDACTED]');
    });

    it('should redact apiKey and apiSecret', () => {
      const obj = {
        apiKey: 'abc123',
        apiSecret: 'xyz789',
        label: 'My Connector',
      };

      const result = redactSensitive(obj);
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.apiSecret).toBe('[REDACTED]');
      expect(result.label).toBe('My Connector');
    });

    it('should handle nested objects', () => {
      const obj = {
        connector: {
          type: 'binance',
          credentials: {
            apiKey: 'key123',
            secret: 'secret456',
          },
        },
      };

      const result = redactSensitive(obj);
      expect(result.connector.type).toBe('binance');
      expect(result.connector.credentials.apiKey).toBe('[REDACTED]');
      expect(result.connector.credentials.secret).toBe('[REDACTED]');
    });

    it('should handle case insensitive matching', () => {
      const obj = {
        API_KEY: 'key',
        ApiSecret: 'secret',
        PRIVATEKEY: 'pk',
      };

      const result = redactSensitive(obj);
      expect(result.API_KEY).toBe('[REDACTED]');
      expect(result.ApiSecret).toBe('[REDACTED]');
      expect(result.PRIVATEKEY).toBe('[REDACTED]');
    });

    it('should not modify non-sensitive fields', () => {
      const obj = {
        id: '123',
        email: 'test@example.com',
        timestamp: Date.now(),
        data: [1, 2, 3],
      };

      const result = redactSensitive(obj);
      expect(result).toEqual(obj);
    });
  });
});


