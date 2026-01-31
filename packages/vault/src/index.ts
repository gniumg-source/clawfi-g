/**
 * @clawfi/vault
 * Secrets encryption and key management
 * 
 * Security Design:
 * - Uses AES-256-GCM for authenticated encryption
 * - Per-record keys derived via HKDF from master key
 * - Master key must be provided via environment variable
 * - Never logs or exposes plaintext secrets
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';

/**
 * Encryption algorithm configuration
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 32;

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  tag: string; // Base64 encoded
  salt: string; // Base64 encoded (used for key derivation)
  version: number; // Schema version for future migrations
}

/**
 * Vault configuration
 */
export interface VaultConfig {
  masterKey: string; // 32-byte hex string
}

/**
 * Derive a per-record key from master key using HKDF-like construction
 */
function deriveKey(masterKey: Buffer, salt: Buffer, context: string): Buffer {
  // Simple HKDF-like derivation using HMAC-SHA256
  const info = Buffer.from(context, 'utf8');
  const prk = createHmac('sha256', salt).update(masterKey).digest();
  const okm = createHmac('sha256', prk).update(info).update(Buffer.from([1])).digest();
  return okm.subarray(0, KEY_LENGTH);
}

/**
 * Vault class for encrypting and decrypting secrets
 */
export class Vault {
  private readonly masterKey: Buffer;

  constructor(config: VaultConfig) {
    if (!config.masterKey || config.masterKey.length !== 64) {
      throw new Error('Master key must be a 32-byte (64 character) hex string');
    }
    
    this.masterKey = Buffer.from(config.masterKey, 'hex');
    
    if (this.masterKey.length !== 32) {
      throw new Error('Invalid master key format');
    }
  }

  /**
   * Encrypt a plaintext string
   * @param plaintext - The secret to encrypt
   * @param context - Context string for key derivation (e.g., 'binance:api_key')
   */
  encrypt(plaintext: string, context: string): EncryptedData {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const derivedKey = deriveKey(this.masterKey, salt, context);
    
    const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
    
    const ciphertextBuffer = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
      ciphertext: ciphertextBuffer.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      salt: salt.toString('base64'),
      version: 1,
    };
  }

  /**
   * Decrypt encrypted data
   * @param data - The encrypted data structure
   * @param context - Context string (must match encryption context)
   */
  decrypt(data: EncryptedData, context: string): string {
    if (data.version !== 1) {
      throw new Error(`Unsupported encryption version: ${data.version}`);
    }
    
    const salt = Buffer.from(data.salt, 'base64');
    const iv = Buffer.from(data.iv, 'base64');
    const tag = Buffer.from(data.tag, 'base64');
    const ciphertext = Buffer.from(data.ciphertext, 'base64');
    
    const derivedKey = deriveKey(this.masterKey, salt, context);
    
    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);
    
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    
    return plaintext.toString('utf8');
  }

  /**
   * Re-encrypt data with a new context
   * Useful for key rotation or context changes
   */
  reEncrypt(data: EncryptedData, oldContext: string, newContext: string): EncryptedData {
    const plaintext = this.decrypt(data, oldContext);
    return this.encrypt(plaintext, newContext);
  }

  /**
   * Generate a random key suitable for use as master key
   */
  static generateMasterKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Validate that a master key is properly formatted
   */
  static validateMasterKey(key: string): boolean {
    if (typeof key !== 'string' || key.length !== 64) {
      return false;
    }
    return /^[a-fA-F0-9]{64}$/.test(key);
  }
}

/**
 * Create a vault instance from environment
 */
export function createVaultFromEnv(): Vault {
  const masterKey = process.env.CLAWFI_MASTER_KEY;
  
  if (!masterKey) {
    throw new Error('CLAWFI_MASTER_KEY environment variable is required');
  }
  
  if (!Vault.validateMasterKey(masterKey)) {
    throw new Error('CLAWFI_MASTER_KEY must be a valid 32-byte hex string');
  }
  
  return new Vault({ masterKey });
}

/**
 * Connector secret types
 */
export type ConnectorSecretType = 'api_key' | 'api_secret' | 'private_key' | 'mnemonic';

/**
 * Build a context string for connector secrets
 */
export function buildConnectorContext(
  connectorType: string,
  connectorId: string,
  secretType: ConnectorSecretType
): string {
  return `connector:${connectorType}:${connectorId}:${secretType}`;
}


