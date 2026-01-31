/**
 * Database Seed Script
 * Creates initial user, risk policy, and MoltWatch strategy
 */

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default user
  const existingUser = await prisma.user.findUnique({
    where: { email: 'admin@clawfi.local' },
  });

  let userId: string;
  
  if (!existingUser) {
    const passwordHash = await argon2.hash('clawfi123');
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: 'admin@clawfi.local',
        passwordHash,
        name: 'ClawFi Admin',
      },
    });
    userId = user.id;
    console.log('✅ Created default user: admin@clawfi.local / clawfi123');
  } else {
    userId = existingUser.id;
    console.log('ℹ️  User already exists: admin@clawfi.local');
  }

  // Create default risk policy
  const existingPolicy = await prisma.riskPolicy.findFirst();
  
  if (!existingPolicy) {
    await prisma.riskPolicy.create({
      data: {
        id: randomUUID(),
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
        dryRunMode: true, // Safe default
      },
    });
    console.log('✅ Created default risk policy (dry-run mode enabled)');
  } else {
    console.log('ℹ️  Risk policy already exists');
  }

  // Create MoltWatch strategy
  const existingStrategy = await prisma.strategy.findFirst({
    where: { strategyType: 'moltwatch' },
  });

  if (!existingStrategy) {
    await prisma.strategy.create({
      data: {
        id: randomUUID(),
        strategyType: 'moltwatch',
        name: 'MoltWatch',
        description: 'Detects wallet molts - significant position reductions and rotations by watched wallets',
        status: 'disabled', // Disabled by default until user configures
        config: {
          watchedWallets: [],
          watchedTokens: [],
          moltThresholdPercent: 20,
          rotationWindowMinutes: 30,
          minPositionUsd: 100,
          chains: ['ethereum'],
          pollIntervalSeconds: 60,
        },
      },
    });
    console.log('✅ Created MoltWatch strategy (disabled by default)');
  } else {
    console.log('ℹ️  MoltWatch strategy already exists');
  }

  console.log('✨ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


