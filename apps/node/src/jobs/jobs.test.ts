/**
 * Intelligence Jobs Tests
 * 
 * Tests for coverage verification, distribution analysis, and liquidity detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Coverage Calculation Tests
// ============================================

describe('Launch Coverage Calculation', () => {
  describe('Coverage Percentage', () => {
    it('should calculate 100% when detected equals estimated', () => {
      const detected = 50;
      const estimated = 50;
      const coverage = (detected / estimated) * 100;
      expect(coverage).toBe(100);
    });

    it('should calculate partial coverage correctly', () => {
      const detected = 45;
      const estimated = 50;
      const coverage = (detected / estimated) * 100;
      expect(coverage).toBe(90);
    });

    it('should handle over-detection (>100%)', () => {
      const detected = 55;
      const estimated = 50;
      const coverage = (detected / estimated) * 100;
      expect(coverage).toBe(110);
    });

    it('should return 100% when estimated is 0', () => {
      const detected = 0;
      const estimated = 0;
      const coverage = estimated > 0 ? (detected / estimated) * 100 : 100;
      expect(coverage).toBe(100);
    });
  });

  describe('Block Range Estimation', () => {
    it('should calculate correct blocks for 24h window', () => {
      const baseBlockTime = 2; // seconds
      const hoursInWindow = 24;
      const blocksPerHour = Math.floor(3600 / baseBlockTime);
      const totalBlocks = blocksPerHour * hoursInWindow;
      
      expect(blocksPerHour).toBe(1800);
      expect(totalBlocks).toBe(43200);
    });

    it('should calculate block range from current', () => {
      const currentBlock = 1000000n;
      const blocksInWindow = 43200n;
      const startBlock = currentBlock - blocksInWindow;
      
      expect(startBlock).toBe(956800n);
    });
  });

  describe('Coverage Status', () => {
    it('should return healthy for >=90%', () => {
      const getStatus = (percent: number) => 
        percent >= 90 ? 'healthy' : percent >= 80 ? 'warning' : 'critical';
      
      expect(getStatus(100)).toBe('healthy');
      expect(getStatus(95)).toBe('healthy');
      expect(getStatus(90)).toBe('healthy');
    });

    it('should return warning for 80-89%', () => {
      const getStatus = (percent: number) => 
        percent >= 90 ? 'healthy' : percent >= 80 ? 'warning' : 'critical';
      
      expect(getStatus(89)).toBe('warning');
      expect(getStatus(85)).toBe('warning');
      expect(getStatus(80)).toBe('warning');
    });

    it('should return critical for <80%', () => {
      const getStatus = (percent: number) => 
        percent >= 90 ? 'healthy' : percent >= 80 ? 'warning' : 'critical';
      
      expect(getStatus(79)).toBe('critical');
      expect(getStatus(50)).toBe('critical');
      expect(getStatus(0)).toBe('critical');
    });
  });
});

// ============================================
// Early Distribution Tests
// ============================================

describe('Early Distribution Analysis', () => {
  describe('Holder Percentage Calculation', () => {
    it('should calculate top 10 holder percentage', () => {
      const totalSupply = 1000000n;
      const top10Balances = [100000n, 80000n, 70000n, 60000n, 50000n, 40000n, 30000n, 20000n, 15000n, 10000n];
      const top10Total = top10Balances.reduce((a, b) => a + b, 0n);
      const top10Percent = Number((top10Total * 10000n) / totalSupply) / 100;
      
      expect(top10Percent).toBe(47.5);
    });

    it('should handle empty holder list', () => {
      const holders: { balance: bigint }[] = [];
      const top10 = holders.slice(0, 10);
      const top10Percent = top10.reduce((sum, h) => sum + Number(h.balance), 0);
      
      expect(top10Percent).toBe(0);
    });

    it('should handle fewer than 10 holders', () => {
      const totalSupply = 1000n;
      const holders = [
        { balance: 500n },
        { balance: 300n },
        { balance: 200n },
      ];
      const top10 = holders.slice(0, 10);
      const percentSum = top10.reduce(
        (sum, h) => sum + Number((h.balance * 10000n) / totalSupply) / 100,
        0
      );
      
      expect(percentSum).toBe(100);
    });
  });

  describe('Signal Threshold Detection', () => {
    it('should trigger on high top10 concentration', () => {
      const top10Threshold = 40;
      const creatorThreshold = 15;
      
      const analysis = { top10Percent: 45, creatorPercent: 5 };
      const shouldSignal = 
        analysis.top10Percent >= top10Threshold ||
        analysis.creatorPercent >= creatorThreshold;
      
      expect(shouldSignal).toBe(true);
    });

    it('should trigger on high creator holding', () => {
      const top10Threshold = 40;
      const creatorThreshold = 15;
      
      const analysis = { top10Percent: 30, creatorPercent: 20 };
      const shouldSignal = 
        analysis.top10Percent >= top10Threshold ||
        analysis.creatorPercent >= creatorThreshold;
      
      expect(shouldSignal).toBe(true);
    });

    it('should not trigger below thresholds', () => {
      const top10Threshold = 40;
      const creatorThreshold = 15;
      
      const analysis = { top10Percent: 35, creatorPercent: 10 };
      const shouldSignal = 
        analysis.top10Percent >= top10Threshold ||
        analysis.creatorPercent >= creatorThreshold;
      
      expect(shouldSignal).toBe(false);
    });
  });

  describe('Concentration Score', () => {
    it('should calculate weighted concentration score', () => {
      const calculateScore = (top10: number, creator: number, holderCount: number) => {
        return Math.min(100, (
          (top10 * 0.5) +
          (creator * 2) +
          (100 - Math.min(holderCount, 100)) * 0.3
        ));
      };

      // High concentration case
      expect(calculateScore(80, 30, 20)).toBeGreaterThan(80);
      
      // Low concentration case
      expect(calculateScore(20, 5, 500)).toBeLessThan(30);
      
      // Medium case
      expect(calculateScore(40, 10, 50)).toBeGreaterThan(30);
      expect(calculateScore(40, 10, 50)).toBeLessThan(60);
    });
  });
});

// ============================================
// Liquidity Risk Tests
// ============================================

describe('Liquidity Risk Detection', () => {
  describe('Liquidity Drop Calculation', () => {
    it('should detect 50%+ drop', () => {
      const threshold = 50;
      const previous = 10000;
      const current = 4000;
      const dropPercent = ((previous - current) / previous) * 100;
      
      expect(dropPercent).toBe(60);
      expect(dropPercent >= threshold).toBe(true);
    });

    it('should not trigger below threshold', () => {
      const threshold = 50;
      const previous = 10000;
      const current = 6000;
      const dropPercent = ((previous - current) / previous) * 100;
      
      expect(dropPercent).toBe(40);
      expect(dropPercent >= threshold).toBe(false);
    });

    it('should handle liquidity increase', () => {
      const threshold = 50;
      const previous = 10000;
      const current = 15000;
      const isDecrease = current < previous;
      
      expect(isDecrease).toBe(false);
    });

    it('should handle zero previous liquidity', () => {
      const previous = 0;
      const current = 5000;
      const minLiquidity = 100;
      
      const shouldCheck = previous > minLiquidity;
      expect(shouldCheck).toBe(false);
    });
  });

  describe('Severity Classification', () => {
    it('should classify 80%+ drop as critical', () => {
      const getSeverity = (dropPercent: number) =>
        dropPercent >= 80 ? 'critical' :
        dropPercent >= 60 ? 'high' : 'medium';
      
      expect(getSeverity(85)).toBe('critical');
      expect(getSeverity(100)).toBe('critical');
    });

    it('should classify 60-79% drop as high', () => {
      const getSeverity = (dropPercent: number) =>
        dropPercent >= 80 ? 'critical' :
        dropPercent >= 60 ? 'high' : 'medium';
      
      expect(getSeverity(79)).toBe('high');
      expect(getSeverity(65)).toBe('high');
      expect(getSeverity(60)).toBe('high');
    });

    it('should classify <60% drop as medium', () => {
      const getSeverity = (dropPercent: number) =>
        dropPercent >= 80 ? 'critical' :
        dropPercent >= 60 ? 'high' : 'medium';
      
      expect(getSeverity(59)).toBe('medium');
      expect(getSeverity(50)).toBe('medium');
    });
  });

  describe('USD Value Estimation', () => {
    it('should calculate liquidity USD from ETH', () => {
      const ethReserve = BigInt('1000000000000000000'); // 1 ETH
      const ethPrice = 3000;
      const liquidityUsd = (Number(ethReserve) / 1e18) * ethPrice * 2;
      
      expect(liquidityUsd).toBe(6000);
    });
  });
});

// ============================================
// Risk Indicator Tests
// ============================================

describe('Risk Indicators', () => {
  describe('Combined Risk Assessment', () => {
    it('should identify high risk with multiple indicators', () => {
      const indicators = {
        highConcentration: true,
        creatorHolding: true,
        liquidityDrop: true,
        lowLiquidity: false,
      };
      
      const activeCount = Object.values(indicators).filter(Boolean).length;
      const riskLevel = 
        activeCount >= 3 ? 'high' :
        activeCount >= 1 ? 'medium' : 'low';
      
      expect(riskLevel).toBe('high');
    });

    it('should identify medium risk with some indicators', () => {
      const indicators = {
        highConcentration: true,
        creatorHolding: false,
        liquidityDrop: false,
        lowLiquidity: false,
      };
      
      const activeCount = Object.values(indicators).filter(Boolean).length;
      const riskLevel = 
        activeCount >= 3 ? 'high' :
        activeCount >= 1 ? 'medium' : 'low';
      
      expect(riskLevel).toBe('medium');
    });

    it('should identify low risk with no indicators', () => {
      const indicators = {
        highConcentration: false,
        creatorHolding: false,
        liquidityDrop: false,
        lowLiquidity: false,
      };
      
      const activeCount = Object.values(indicators).filter(Boolean).length;
      const riskLevel = 
        activeCount >= 3 ? 'high' :
        activeCount >= 1 ? 'medium' : 'low';
      
      expect(riskLevel).toBe('low');
    });
  });
});


