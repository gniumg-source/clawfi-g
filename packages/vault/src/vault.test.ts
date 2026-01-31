import { describe, it, expect, beforeEach } from 'vitest';
import { Vault, buildConnectorContext, type EncryptedData } from './index.js';

describe('Vault', () => {
  let vault: Vault;
  const testMasterKey = '0'.repeat(64); // 32 bytes of zeros for testing

  beforeEach(() => {
    vault = new Vault({ masterKey: testMasterKey });
  });

  describe('constructor', () => {
    it('should create vault with valid master key', () => {
      expect(() => new Vault({ masterKey: testMasterKey })).not.toThrow();
    });

    it('should reject invalid master key length', () => {
      expect(() => new Vault({ masterKey: 'short' })).toThrow('Master key must be a 32-byte');
    });

    it('should reject empty master key', () => {
      expect(() => new Vault({ masterKey: '' })).toThrow('Master key must be a 32-byte');
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt plaintext correctly', () => {
      const plaintext = 'my-secret-api-key-12345';
      const context = 'test:context';

      const encrypted = vault.encrypt(plaintext, context);
      const decrypted = vault.decrypt(encrypted, context);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'test-secret';
      const context = 'test:context';

      const encrypted1 = vault.encrypt(plaintext, context);
      const encrypted2 = vault.encrypt(plaintext, context);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it('should fail decryption with wrong context', () => {
      const plaintext = 'test-secret';
      const encrypted = vault.encrypt(plaintext, 'correct:context');

      expect(() => vault.decrypt(encrypted, 'wrong:context')).toThrow();
    });

    it('should fail decryption with tampered ciphertext', () => {
      const plaintext = 'test-secret';
      const encrypted = vault.encrypt(plaintext, 'test:context');

      const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
      tamperedCiphertext[0] = tamperedCiphertext[0]! ^ 0xff;
      encrypted.ciphertext = tamperedCiphertext.toString('base64');

      expect(() => vault.decrypt(encrypted, 'test:context')).toThrow();
    });

    it('should fail decryption with tampered tag', () => {
      const plaintext = 'test-secret';
      const encrypted = vault.encrypt(plaintext, 'test:context');

      const tamperedTag = Buffer.from(encrypted.tag, 'base64');
      tamperedTag[0] = tamperedTag[0]! ^ 0xff;
      encrypted.tag = tamperedTag.toString('base64');

      expect(() => vault.decrypt(encrypted, 'test:context')).toThrow();
    });

    it('should handle empty plaintext', () => {
      const plaintext = '';
      const context = 'test:context';

      const encrypted = vault.encrypt(plaintext, context);
      const decrypted = vault.decrypt(encrypted, context);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode plaintext', () => {
      const plaintext = '🔐 секрет 密钥 clé';
      const context = 'test:context';

      const encrypted = vault.encrypt(plaintext, context);
      const decrypted = vault.decrypt(encrypted, context);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long plaintext', () => {
      const plaintext = 'x'.repeat(10000);
      const context = 'test:context';

      const encrypted = vault.encrypt(plaintext, context);
      const decrypted = vault.decrypt(encrypted, context);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('reEncrypt', () => {
    it('should re-encrypt with new context', () => {
      const plaintext = 'test-secret';
      const oldContext = 'old:context';
      const newContext = 'new:context';

      const encrypted = vault.encrypt(plaintext, oldContext);
      const reEncrypted = vault.reEncrypt(encrypted, oldContext, newContext);

      expect(vault.decrypt(reEncrypted, newContext)).toBe(plaintext);
      expect(() => vault.decrypt(reEncrypted, oldContext)).toThrow();
    });
  });

  describe('generateMasterKey', () => {
    it('should generate valid 64-char hex string', () => {
      const key = Vault.generateMasterKey();
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique keys', () => {
      const key1 = Vault.generateMasterKey();
      const key2 = Vault.generateMasterKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('validateMasterKey', () => {
    it('should accept valid hex key', () => {
      expect(Vault.validateMasterKey('a'.repeat(64))).toBe(true);
      expect(Vault.validateMasterKey('0123456789abcdef'.repeat(4))).toBe(true);
    });

    it('should reject invalid keys', () => {
      expect(Vault.validateMasterKey('')).toBe(false);
      expect(Vault.validateMasterKey('short')).toBe(false);
      expect(Vault.validateMasterKey('g'.repeat(64))).toBe(false); // non-hex
      expect(Vault.validateMasterKey('a'.repeat(63))).toBe(false); // too short
      expect(Vault.validateMasterKey('a'.repeat(65))).toBe(false); // too long
    });
  });
});

describe('buildConnectorContext', () => {
  it('should build correct context string', () => {
    const context = buildConnectorContext('binance', 'conn-123', 'api_key');
    expect(context).toBe('connector:binance:conn-123:api_key');
  });
});


