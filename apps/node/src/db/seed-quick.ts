import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await argon2.hash('admin123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@clawfi.io' },
    update: {},
    create: {
      id: randomUUID(),
      email: 'admin@clawfi.io',
      name: 'Admin',
      passwordHash: adminPassword,
    },
  });
  console.log('Created admin user:', admin.email);

  // Create default risk policy
  await prisma.riskPolicy.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
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
  console.log('Created default risk policy');

  // Create MoltWatch strategy
  await prisma.strategy.upsert({
    where: { id: 'moltwatch-default' },
    update: {},
    create: {
      id: 'moltwatch-default',
      strategyType: 'moltwatch',
      name: 'MoltWatch',
      description: 'Detect wallet molt patterns - large holders rotating out',
      status: 'disabled',
      config: {
        minPositionUsd: 1000,
        moltThresholdPercent: 50,
        rotationWindowMinutes: 60,
        cooldownMinutes: 30,
        watchlistOnly: false,
        watchlist: [],
      },
    },
  });
  console.log('Created MoltWatch strategy');

  console.log('Database seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

