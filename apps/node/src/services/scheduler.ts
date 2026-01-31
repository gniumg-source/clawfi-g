/**
 * Strategy Scheduler
 * Runs strategies on a schedule using BullMQ
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import { Queue, Worker, type Job } from 'bullmq';
import type { SignalService } from './signal.js';
import { MoltWatchStrategy, type MoltWatchConfig as LocalMoltWatchConfig } from '../strategies/moltwatch.js';
import type { CreateSignal } from '@clawfi/core';

const QUEUE_NAME = 'clawfi-strategies';

interface StrategyJob {
  strategyId: string;
  strategyType: string;
}

interface StrategyInstance {
  strategy: MoltWatchStrategy;
  config: LocalMoltWatchConfig;
}

export class StrategyScheduler {
  private queue: Queue<StrategyJob>;
  private worker: Worker<StrategyJob> | null = null;
  private strategies: Map<string, StrategyInstance> = new Map();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly signalService: SignalService
  ) {
    this.queue = new Queue(QUEUE_NAME, {
      connection: redis,
    });
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    // Load enabled strategies
    const enabledStrategies = await this.prisma.strategy.findMany({
      where: { status: 'enabled' },
    });

    // Initialize each strategy
    for (const strategy of enabledStrategies) {
      await this.initializeStrategy(strategy);
    }

    // Create worker to process strategy jobs
    this.worker = new Worker<StrategyJob>(
      QUEUE_NAME,
      async (job: Job<StrategyJob>) => {
        await this.processStrategyJob(job.data);
      },
      {
        connection: this.redis,
        concurrency: 5,
      }
    );

    this.worker.on('failed', (job, err) => {
      console.error(`Strategy job failed: ${job?.id}`, err);
    });
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
    this.strategies.clear();
  }

  /**
   * Initialize a strategy
   */
  private async initializeStrategy(strategy: {
    id: string;
    strategyType: string;
    name: string;
    description: string | null;
    status: string;
    config: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<void> {
    if (strategy.strategyType === 'moltwatch') {
      const rawConfig = strategy.config as Record<string, unknown>;
      
      const moltWatchConfig: LocalMoltWatchConfig = {
        minPositionUsd: (rawConfig.minPositionUsd as number) ?? 1000,
        moltThresholdPercent: (rawConfig.moltThresholdPercent as number) ?? 50,
        rotationWindowMinutes: (rawConfig.rotationWindowMinutes as number) ?? 60,
        cooldownMinutes: (rawConfig.cooldownMinutes as number) ?? 30,
        watchlistOnly: (rawConfig.watchlistOnly as boolean) ?? false,
        watchlist: (rawConfig.watchlist as string[]) ?? [],
      };

      const moltWatch = new MoltWatchStrategy(this.prisma, this.redis, moltWatchConfig);
      this.strategies.set(strategy.id, { strategy: moltWatch, config: moltWatchConfig });

      // Get poll interval from config or use default
      const pollIntervalSeconds = (rawConfig.pollIntervalSeconds as number) ?? 60;

      // Schedule recurring job
      await this.queue.add(
        `strategy:${strategy.id}`,
        { strategyId: strategy.id, strategyType: strategy.strategyType },
        {
          repeat: {
            every: pollIntervalSeconds * 1000,
          },
        }
      );
    }
  }

  /**
   * Process a strategy job
   * Note: MoltWatch is event-driven, so poll is a no-op for now
   * Signals are generated when processEvent is called by intelligence jobs
   */
  private async processStrategyJob(job: StrategyJob): Promise<void> {
    const strategyInstance = this.strategies.get(job.strategyId);
    if (!strategyInstance) {
      return;
    }

    // MoltWatch strategy is event-driven
    // The scheduler job is mainly for health checks and state cleanup
    console.log(`[Scheduler] Strategy ${job.strategyId} heartbeat`);
  }

  /**
   * Process event through relevant strategies
   */
  async processEventForStrategies(event: any): Promise<CreateSignal[]> {
    const allSignals: CreateSignal[] = [];

    for (const [strategyId, instance] of this.strategies) {
      try {
        const signals = await instance.strategy.processEvent(event);
        for (const signal of signals) {
          allSignals.push(signal);
          await this.signalService.create(signal);
        }
      } catch (error) {
        console.error(`Strategy ${strategyId} event processing failed:`, error);
      }
    }

    return allSignals;
  }

  /**
   * Enable a strategy
   */
  async enableStrategy(strategyId: string): Promise<void> {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: { status: 'enabled' },
    });

    // Initialize if not already running
    if (!this.strategies.has(strategyId)) {
      await this.initializeStrategy(strategy);
    }
  }

  /**
   * Disable a strategy
   */
  async disableStrategy(strategyId: string): Promise<void> {
    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: { status: 'disabled' },
    });

    // Remove from running strategies
    this.strategies.delete(strategyId);

    // Remove scheduled jobs
    const jobs = await this.queue.getRepeatableJobs();
    for (const job of jobs) {
      if (job.name === `strategy:${strategyId}`) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }
  }

  /**
   * Update strategy config
   */
  async updateStrategyConfig(
    strategyId: string,
    update: { config?: Record<string, unknown>; name?: string; description?: string }
  ): Promise<void> {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    const updateData: any = {};
    if (update.name) updateData.name = update.name;
    if (update.description) updateData.description = update.description;
    if (update.config) updateData.config = update.config as Prisma.InputJsonValue;

    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: updateData,
    });

    // If running, restart with new config
    if (this.strategies.has(strategyId) && strategy.status === 'enabled') {
      this.strategies.delete(strategyId);
      const updatedStrategy = await this.prisma.strategy.findUnique({
        where: { id: strategyId },
      });
      if (updatedStrategy) {
        await this.initializeStrategy(updatedStrategy);
      }
    }
  }
}
