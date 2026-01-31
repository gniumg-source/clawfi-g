/**
 * Risk Engine
 * Enforces global/per-connector constraints on all actions
 */

import type { PrismaClient, RiskPolicy as PrismaRiskPolicy, Prisma } from '@prisma/client';
import type { ActionRequest, RiskCheckResult, RiskPolicy, UpdateRiskPolicy, Venue, Chain } from '@clawfi/core';
import { randomUUID } from 'crypto';

export class RiskEngine {
  private policy: RiskPolicy | null = null;

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Initialize risk engine, load policy from DB
   */
  async initialize(): Promise<void> {
    const existing = await this.prisma.riskPolicy.findFirst();
    
    if (!existing) {
      // Create default policy
      const id = randomUUID();
      const now = Date.now();
      
      await this.prisma.riskPolicy.create({
        data: {
          id,
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
        },
      });

      this.policy = {
        id,
        createdAt: now,
        updatedAt: now,
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
    } else {
      this.policy = this.mapPrismaPolicy(existing);
    }
  }

  /**
   * Map Prisma policy to domain model
   */
  private mapPrismaPolicy(p: PrismaRiskPolicy): RiskPolicy {
    return {
      id: p.id,
      createdAt: p.createdAt.getTime(),
      updatedAt: p.updatedAt.getTime(),
      maxOrderUsd: p.maxOrderUsd,
      maxPositionUsd: p.maxPositionUsd,
      maxDailyLossUsd: p.maxDailyLossUsd,
      maxSlippageBps: p.maxSlippageBps,
      cooldownSeconds: p.cooldownSeconds,
      tokenAllowlist: p.tokenAllowlist as string[],
      tokenDenylist: p.tokenDenylist as string[],
      venueAllowlist: p.venueAllowlist as Venue[],
      chainAllowlist: p.chainAllowlist as Chain[],
      killSwitchActive: p.killSwitchActive,
      dryRunMode: p.dryRunMode,
      meta: p.meta as Record<string, unknown> | undefined,
    };
  }

  /**
   * Get current policy
   */
  getPolicy(): RiskPolicy {
    if (!this.policy) {
      throw new Error('Risk engine not initialized');
    }
    return this.policy;
  }

  /**
   * Update policy
   */
  async updatePolicy(update: UpdateRiskPolicy): Promise<RiskPolicy> {
    if (!this.policy) {
      throw new Error('Risk engine not initialized');
    }

    const updated = await this.prisma.riskPolicy.update({
      where: { id: this.policy.id },
      data: {
        ...(update.maxOrderUsd !== undefined && { maxOrderUsd: update.maxOrderUsd }),
        ...(update.maxPositionUsd !== undefined && { maxPositionUsd: update.maxPositionUsd }),
        ...(update.maxDailyLossUsd !== undefined && { maxDailyLossUsd: update.maxDailyLossUsd }),
        ...(update.maxSlippageBps !== undefined && { maxSlippageBps: update.maxSlippageBps }),
        ...(update.cooldownSeconds !== undefined && { cooldownSeconds: update.cooldownSeconds }),
        ...(update.tokenAllowlist !== undefined && { tokenAllowlist: update.tokenAllowlist }),
        ...(update.tokenDenylist !== undefined && { tokenDenylist: update.tokenDenylist }),
        ...(update.venueAllowlist !== undefined && { venueAllowlist: update.venueAllowlist }),
        ...(update.chainAllowlist !== undefined && { chainAllowlist: update.chainAllowlist }),
        ...(update.killSwitchActive !== undefined && { killSwitchActive: update.killSwitchActive }),
        ...(update.dryRunMode !== undefined && { dryRunMode: update.dryRunMode }),
        ...(update.meta !== undefined && { meta: update.meta as Prisma.InputJsonValue }),
      },
    });

    this.policy = this.mapPrismaPolicy(updated);
    return this.policy;
  }

  /**
   * Set kill switch status
   */
  async setKillSwitch(active: boolean): Promise<boolean> {
    await this.updatePolicy({ killSwitchActive: active });
    return this.policy!.killSwitchActive;
  }

  /**
   * Check if action is allowed by policy
   */
  async checkAction(request: ActionRequest): Promise<RiskCheckResult> {
    const policy = this.getPolicy();
    const violations: RiskCheckResult['violations'] = [];
    const warnings: string[] = [];

    // Kill switch check (highest priority)
    if (policy.killSwitchActive) {
      return {
        allowed: false,
        reason: 'Kill switch is active - all actions blocked',
        violations: [
          {
            rule: 'killSwitch',
            message: 'Kill switch is active',
            actual: true,
            limit: false,
          },
        ],
        warnings: [],
      };
    }

    // Dry run mode warning
    if (policy.dryRunMode) {
      warnings.push('Dry-run mode is active - order will be simulated only');
    }

    // Order size check
    if (request.amountUsd > policy.maxOrderUsd) {
      violations.push({
        rule: 'maxOrderUsd',
        message: `Order size $${request.amountUsd} exceeds maximum $${policy.maxOrderUsd}`,
        actual: request.amountUsd,
        limit: policy.maxOrderUsd,
      });
    }

    // Slippage check
    if (request.slippageBps !== undefined && request.slippageBps > policy.maxSlippageBps) {
      violations.push({
        rule: 'maxSlippageBps',
        message: `Slippage ${request.slippageBps}bps exceeds maximum ${policy.maxSlippageBps}bps`,
        actual: request.slippageBps,
        limit: policy.maxSlippageBps,
      });
    }

    // Venue allowlist check
    if (policy.venueAllowlist.length > 0 && !policy.venueAllowlist.includes(request.venue)) {
      violations.push({
        rule: 'venueAllowlist',
        message: `Venue ${request.venue} is not in allowlist`,
        actual: request.venue,
        limit: policy.venueAllowlist,
      });
    }

    // Chain allowlist check
    if (request.chain && policy.chainAllowlist.length > 0 && !policy.chainAllowlist.includes(request.chain)) {
      violations.push({
        rule: 'chainAllowlist',
        message: `Chain ${request.chain} is not in allowlist`,
        actual: request.chain,
        limit: policy.chainAllowlist,
      });
    }

    // Token denylist check
    if (request.token) {
      const tokenLower = request.token.toLowerCase();
      if (policy.tokenDenylist.some((t) => t.toLowerCase() === tokenLower)) {
        violations.push({
          rule: 'tokenDenylist',
          message: `Token ${request.token} is in denylist`,
          actual: request.token,
          limit: policy.tokenDenylist,
        });
      }

      // Token allowlist check (only if allowlist is not empty)
      if (
        policy.tokenAllowlist.length > 0 &&
        !policy.tokenAllowlist.some((t) => t.toLowerCase() === tokenLower)
      ) {
        violations.push({
          rule: 'tokenAllowlist',
          message: `Token ${request.token} is not in allowlist`,
          actual: request.token,
          limit: policy.tokenAllowlist,
        });
      }
    }

    // Daily loss check
    const today = new Date().toISOString().split('T')[0]!;
    const dailyLoss = await this.prisma.dailyLossTracker.findUnique({
      where: { date: today },
    });

    if (dailyLoss && dailyLoss.realizedLossUsd >= policy.maxDailyLossUsd) {
      violations.push({
        rule: 'maxDailyLossUsd',
        message: `Daily loss $${dailyLoss.realizedLossUsd} already at maximum $${policy.maxDailyLossUsd}`,
        actual: dailyLoss.realizedLossUsd,
        limit: policy.maxDailyLossUsd,
      });
    }

    return {
      allowed: violations.length === 0,
      reason: violations.length > 0 ? violations[0]!.message : undefined,
      violations,
      warnings,
    };
  }
}

