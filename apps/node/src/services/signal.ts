/**
 * Signal Service
 * Manages signal creation, storage, and streaming
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { CreateSignal, Signal, SignalFilter } from '@clawfi/core';
import { randomUUID } from 'crypto';

const SIGNAL_CHANNEL = 'clawfi:signals';

export class SignalService {
  private subscribers: Set<(signal: Signal) => void> = new Set();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis
  ) {
    // Subscribe to Redis channel for cross-process signal distribution
    this.setupRedisSubscriber();
  }

  /**
   * Setup Redis pub/sub for signal distribution
   */
  private setupRedisSubscriber(): void {
    const subscriber = this.redis.duplicate();
    
    subscriber.subscribe(SIGNAL_CHANNEL, (err) => {
      if (err) {
        console.error('Failed to subscribe to signal channel:', err);
      }
    });

    subscriber.on('message', (_channel, message) => {
      try {
        const signal = JSON.parse(message) as Signal;
        this.notifySubscribers(signal);
      } catch {
        // Ignore parse errors
      }
    });
  }

  /**
   * Notify all subscribers of a new signal
   */
  private notifySubscribers(signal: Signal): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(signal);
      } catch {
        // Ignore callback errors
      }
    });
  }

  /**
   * Subscribe to new signals
   */
  subscribe(callback: (signal: Signal) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Create a new signal
   */
  async create(data: CreateSignal & { signalType?: string }): Promise<Signal> {
    const id = randomUUID();
    const ts = Date.now();

    const created = await this.prisma.signal.create({
      data: {
        id,
        severity: data.severity,
        signalType: data.signalType,
        title: data.title,
        summary: data.summary,
        token: data.token,
        tokenSymbol: data.tokenSymbol,
        chain: data.chain,
        wallet: data.wallet,
        strategyId: data.strategyId,
        evidence: data.evidence as Prisma.InputJsonValue | undefined,
        recommendedAction: data.recommendedAction,
        meta: data.meta as Prisma.InputJsonValue | undefined,
      },
    });

    const signal: Signal = {
      id: created.id,
      ts: created.ts.getTime(),
      severity: created.severity as Signal['severity'],
      signalType: created.signalType as Signal['signalType'],
      title: created.title,
      summary: created.summary,
      token: created.token ?? undefined,
      tokenSymbol: created.tokenSymbol ?? undefined,
      chain: created.chain as Signal['chain'],
      wallet: created.wallet ?? undefined,
      strategyId: created.strategyId,
      evidence: created.evidence as Signal['evidence'],
      recommendedAction: created.recommendedAction as Signal['recommendedAction'],
      acknowledged: created.acknowledged,
      acknowledgedAt: created.acknowledgedAt?.getTime(),
      acknowledgedBy: created.acknowledgedBy ?? undefined,
      meta: created.meta as Record<string, unknown> | undefined,
    };

    // Publish to Redis for cross-process distribution
    await this.redis.publish(SIGNAL_CHANNEL, JSON.stringify(signal));

    return signal;
  }

  /**
   * Get paginated signals
   */
  async getSignals(
    filter: SignalFilter,
    page: number = 1,
    limit: number = 20
  ) {
    const where: Record<string, unknown> = {};

    if (filter.severity) where.severity = filter.severity;
    if (filter.strategyId) where.strategyId = filter.strategyId;
    if (filter.chain) where.chain = filter.chain;
    if (filter.token) where.token = filter.token;
    if (filter.wallet) where.wallet = filter.wallet;
    if (filter.acknowledged !== undefined) where.acknowledged = filter.acknowledged;
    if (filter.startTs || filter.endTs) {
      where.ts = {};
      if (filter.startTs) (where.ts as Record<string, unknown>).gte = new Date(filter.startTs);
      if (filter.endTs) (where.ts as Record<string, unknown>).lte = new Date(filter.endTs);
    }

    const [data, total] = await Promise.all([
      this.prisma.signal.findMany({
        where,
        orderBy: { ts: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.signal.count({ where }),
    ]);

    return {
      data: data.map((s) => this.mapSignal(s)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get signals by token address
   */
  async getSignalsByToken(token: string, chain?: string, limit: number = 5): Promise<Signal[]> {
    const where: Record<string, unknown> = {
      token: token.toLowerCase(),
    };
    if (chain) where.chain = chain;

    const signals = await this.prisma.signal.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: limit,
    });

    return signals.map((s) => this.mapSignal(s));
  }

  /**
   * Acknowledge a signal
   */
  async acknowledge(id: string, userId: string): Promise<Signal> {
    const updated = await this.prisma.signal.update({
      where: { id },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
    });

    return this.mapSignal(updated);
  }

  /**
   * Map Prisma signal to domain model
   */
  private mapSignal(s: {
    id: string;
    ts: Date;
    severity: string;
    signalType?: string | null;
    title: string;
    summary: string;
    token: string | null;
    tokenSymbol: string | null;
    chain: string | null;
    wallet: string | null;
    strategyId: string;
    evidence: unknown;
    recommendedAction: string;
    acknowledged: boolean;
    acknowledgedAt: Date | null;
    acknowledgedBy: string | null;
    meta: unknown;
  }): Signal {
    return {
      id: s.id,
      ts: s.ts.getTime(),
      severity: s.severity as Signal['severity'],
      signalType: s.signalType as Signal['signalType'],
      title: s.title,
      summary: s.summary,
      token: s.token ?? undefined,
      tokenSymbol: s.tokenSymbol ?? undefined,
      chain: s.chain as Signal['chain'],
      wallet: s.wallet ?? undefined,
      strategyId: s.strategyId,
      evidence: s.evidence as Signal['evidence'],
      recommendedAction: s.recommendedAction as Signal['recommendedAction'],
      acknowledged: s.acknowledged,
      acknowledgedAt: s.acknowledgedAt?.getTime(),
      acknowledgedBy: s.acknowledgedBy ?? undefined,
      meta: s.meta as Record<string, unknown> | undefined,
    };
  }
}

