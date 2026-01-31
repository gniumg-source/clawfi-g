/**
 * Clanker Connector Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClankerConnector, createClankerConnector, KNOWN_FACTORY_EVENTS } from './index.js';

// Mock viem
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBlockNumber: vi.fn().mockResolvedValue(1000000n),
      getBlock: vi.fn().mockResolvedValue({
        number: 1000000n,
        timestamp: BigInt(Date.now() / 1000),
        transactions: [],
      }),
      getLogs: vi.fn().mockResolvedValue([]),
      getTransactionReceipt: vi.fn().mockResolvedValue(null),
      readContract: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('ClankerConnector', () => {
  let connector: ClankerConnector;

  beforeEach(() => {
    connector = createClankerConnector({
      rpcUrl: 'https://mainnet.base.org',
      factoryAddresses: ['0x1234567890123456789012345678901234567890'],
    });
  });

  afterEach(() => {
    connector.stop();
  });

  describe('constructor', () => {
    it('should create connector with default config', () => {
      expect(connector).toBeDefined();
      expect(connector.getLastScannedBlock()).toBe(0n);
    });

    it('should accept custom start block', () => {
      const customConnector = createClankerConnector({
        rpcUrl: 'https://mainnet.base.org',
        factoryAddresses: [],
        startBlock: 500000n,
      });
      expect(customConnector.getLastScannedBlock()).toBe(500000n);
    });
  });

  describe('setLastScannedBlock', () => {
    it('should update last scanned block', () => {
      connector.setLastScannedBlock(123456n);
      expect(connector.getLastScannedBlock()).toBe(123456n);
    });
  });

  describe('onToken', () => {
    it('should register callback and return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = connector.onToken(callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      // Unsubscribe should work
      unsubscribe();
    });
  });

  describe('start/stop', () => {
    it('should start and stop without errors', () => {
      expect(() => connector.start()).not.toThrow();
      expect(() => connector.stop()).not.toThrow();
    });

    it('should warn when starting already running connector', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      connector.start();
      connector.start(); // Should warn
      
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already running'));
      
      warnSpy.mockRestore();
    });
  });
});

describe('KNOWN_FACTORY_EVENTS', () => {
  it('should have Transfer event topic', () => {
    expect(KNOWN_FACTORY_EVENTS.Transfer).toBe(
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    );
  });
});


