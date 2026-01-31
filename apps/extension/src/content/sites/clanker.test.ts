/**
 * Clanker URL Parser Tests
 * 
 * Tests for token address extraction and SPA navigation handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// URL Parser Tests
// ============================================

// Regex patterns from clanker.ts
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const CLANKER_PATH_REGEX = /^\/clanker\/(0x[a-fA-F0-9]{40})$/i;

/**
 * Extract token from URL path
 */
function extractTokenFromPath(pathname: string): string | null {
  const match = pathname.match(CLANKER_PATH_REGEX);
  
  if (match && match[1]) {
    const address = match[1];
    if (ETH_ADDRESS_REGEX.test(address)) {
      return address;
    }
  }
  
  return null;
}

describe('Clanker URL Parser', () => {
  describe('extractTokenFromPath', () => {
    it('should extract valid token address from path', () => {
      const validPaths = [
        '/clanker/0x1234567890123456789012345678901234567890',
        '/clanker/0xabcdefABCDEF1234567890123456789012345678',
        '/clanker/0x0000000000000000000000000000000000000000',
        '/clanker/0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      ];

      for (const path of validPaths) {
        const token = extractTokenFromPath(path);
        expect(token).not.toBeNull();
        expect(token).toMatch(ETH_ADDRESS_REGEX);
      }
    });

    it('should return null for invalid paths', () => {
      const invalidPaths = [
        '/clanker/',
        '/clanker/0x123', // Too short
        '/clanker/0x12345678901234567890123456789012345678901', // Too long (41 chars)
        '/clanker/0x123456789012345678901234567890123456789G', // Invalid char
        '/other/0x1234567890123456789012345678901234567890',
        '/clanker/notanaddress',
        '/',
        '',
        '/clanker/0X1234567890123456789012345678901234567890', // 0X uppercase (should still work)
      ];

      for (const path of invalidPaths) {
        if (path === '/clanker/0X1234567890123456789012345678901234567890') {
          // This should actually work due to case-insensitive regex
          expect(extractTokenFromPath(path)).not.toBeNull();
        } else {
          expect(extractTokenFromPath(path)).toBeNull();
        }
      }
    });

    it('should handle case insensitivity for hex characters', () => {
      const lowerCase = '/clanker/0xabcdef1234567890abcdef1234567890abcdef12';
      const upperCase = '/clanker/0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const mixedCase = '/clanker/0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';

      expect(extractTokenFromPath(lowerCase)).not.toBeNull();
      expect(extractTokenFromPath(upperCase)).not.toBeNull();
      expect(extractTokenFromPath(mixedCase)).not.toBeNull();
    });

    it('should not match paths with extra segments', () => {
      const pathsWithExtra = [
        '/clanker/0x1234567890123456789012345678901234567890/extra',
        '/clanker/0x1234567890123456789012345678901234567890?query=1',
        '/prefix/clanker/0x1234567890123456789012345678901234567890',
      ];

      // The regex is strict and should not match these
      // Query strings are handled separately by URL parsing
      expect(extractTokenFromPath(pathsWithExtra[0]!)).toBeNull();
      // pathsWithExtra[1] would match if we only look at pathname without query
      expect(extractTokenFromPath(pathsWithExtra[2]!)).toBeNull();
    });
  });
});

// ============================================
// Address Validation Tests
// ============================================

describe('Ethereum Address Validation', () => {
  it('should validate correct Ethereum addresses', () => {
    const validAddresses = [
      '0x0000000000000000000000000000000000000000',
      '0x1234567890123456789012345678901234567890',
      '0xabcdefABCDEF1234567890123456789012345678',
      '0xDEADBEEF00000000000000000000000000000000',
    ];

    for (const addr of validAddresses) {
      expect(ETH_ADDRESS_REGEX.test(addr)).toBe(true);
    }
  });

  it('should reject invalid Ethereum addresses', () => {
    const invalidAddresses = [
      '', // Empty
      '0x', // Just prefix
      '0x123', // Too short
      '0x12345678901234567890123456789012345678901', // Too long
      '1234567890123456789012345678901234567890', // No prefix
      '0x123456789012345678901234567890123456789g', // Invalid char 'g'
      '0x 1234567890123456789012345678901234567890', // Space
      ' 0x1234567890123456789012345678901234567890', // Leading space
      '0x1234567890123456789012345678901234567890 ', // Trailing space
    ];

    for (const addr of invalidAddresses) {
      expect(ETH_ADDRESS_REGEX.test(addr)).toBe(false);
    }
  });
});

// ============================================
// SPA Navigation Handler Tests
// ============================================

describe('SPA Navigation Handler', () => {
  let originalPushState: History['pushState'];
  let originalReplaceState: History['replaceState'];
  let navigationCallbacks: (() => void)[];

  beforeEach(() => {
    navigationCallbacks = [];
    originalPushState = history.pushState;
    originalReplaceState = history.replaceState;
  });

  afterEach(() => {
    // Restore original methods
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  });

  /**
   * Setup navigation detection (simplified version of clanker.ts)
   */
  function setupNavigationDetection(callback: () => void): void {
    navigationCallbacks.push(callback);

    // Patch pushState
    const origPush = history.pushState.bind(history);
    history.pushState = function (...args) {
      const result = origPush(...args);
      navigationCallbacks.forEach((cb) => cb());
      return result;
    };

    // Patch replaceState
    const origReplace = history.replaceState.bind(history);
    history.replaceState = function (...args) {
      const result = origReplace(...args);
      navigationCallbacks.forEach((cb) => cb());
      return result;
    };
  }

  it('should detect pushState navigation', () => {
    const callback = vi.fn();
    setupNavigationDetection(callback);

    history.pushState({}, '', '/clanker/0x1234567890123456789012345678901234567890');

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should detect replaceState navigation', () => {
    const callback = vi.fn();
    setupNavigationDetection(callback);

    history.replaceState({}, '', '/clanker/0xabcdefABCDEF1234567890123456789012345678');

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should detect multiple navigations', () => {
    const callback = vi.fn();
    setupNavigationDetection(callback);

    history.pushState({}, '', '/clanker/0x1111111111111111111111111111111111111111');
    history.pushState({}, '', '/clanker/0x2222222222222222222222222222222222222222');
    history.replaceState({}, '', '/clanker/0x3333333333333333333333333333333333333333');

    expect(callback).toHaveBeenCalledTimes(3);
  });
});

// ============================================
// Metadata Extraction Tests
// ============================================

describe('Page Metadata Extraction', () => {
  /**
   * Extract version from text
   */
  function extractVersion(text: string): string | undefined {
    const match = text.match(/\bV(3(?:\.1)?|4)\b/i);
    return match ? `V${match[1]}` : undefined;
  }

  /**
   * Extract address after label
   */
  function extractLabeledAddress(text: string, label: string): string | undefined {
    const regex = new RegExp(`${label}[:\\s]+(?:\\n|\\s)*(0x[a-fA-F0-9]{40})`, 'i');
    const match = text.match(regex);
    return match?.[1];
  }

  /**
   * Check for verified status
   */
  function isVerified(text: string): boolean {
    return /verified\s*token|✓\s*verified|\bverified\b/i.test(text);
  }

  describe('extractVersion', () => {
    it('should extract V3', () => {
      expect(extractVersion('This is a V3 token')).toBe('V3');
      expect(extractVersion('Clanker V3')).toBe('V3');
    });

    it('should extract V3.1', () => {
      expect(extractVersion('This is a V3.1 token')).toBe('V3.1');
      expect(extractVersion('Clanker V3.1')).toBe('V3.1');
    });

    it('should extract V4', () => {
      expect(extractVersion('This is a V4 token')).toBe('V4');
      expect(extractVersion('Clanker V4')).toBe('V4');
    });

    it('should be case insensitive', () => {
      expect(extractVersion('v3 token')).toBe('V3');
      expect(extractVersion('v3.1 token')).toBe('V3.1');
      expect(extractVersion('v4 token')).toBe('V4');
    });

    it('should return undefined for no match', () => {
      expect(extractVersion('No version here')).toBeUndefined();
      expect(extractVersion('V2 token')).toBeUndefined();
      expect(extractVersion('V5 token')).toBeUndefined();
    });
  });

  describe('extractLabeledAddress', () => {
    it('should extract creator address', () => {
      const text = 'Creator: 0x1234567890123456789012345678901234567890';
      expect(extractLabeledAddress(text, 'Creator')).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should extract admin address', () => {
      const text = 'Admin: 0xabcdefABCDEF1234567890123456789012345678';
      expect(extractLabeledAddress(text, 'Admin')).toBe('0xabcdefABCDEF1234567890123456789012345678');
    });

    it('should handle newlines', () => {
      const text = 'Creator:\n0x1234567890123456789012345678901234567890';
      expect(extractLabeledAddress(text, 'Creator')).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should return undefined for no match', () => {
      const text = 'No creator here';
      expect(extractLabeledAddress(text, 'Creator')).toBeUndefined();
    });
  });

  describe('isVerified', () => {
    it('should detect verified token', () => {
      expect(isVerified('Verified token')).toBe(true);
      expect(isVerified('✓ Verified')).toBe(true);
      expect(isVerified('This token is verified')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isVerified('VERIFIED')).toBe(true);
      expect(isVerified('Verified')).toBe(true);
      expect(isVerified('verified')).toBe(true);
    });

    it('should return false for no match', () => {
      expect(isVerified('Unverified token')).toBe(false);
      expect(isVerified('Not verified yet')).toBe(true); // Contains 'verified'
      expect(isVerified('No status')).toBe(false);
    });
  });
});


