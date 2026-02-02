/**
 * Health & Status Routes
 * 
 * Provides health checks, version info, and system status for the ClawF appliance.
 */

import type { FastifyInstance } from 'fastify';
import os from 'os';

// ============================================
// Types
// ============================================

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
}

interface DetailedHealth extends HealthStatus {
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    cpuUsage: number;
    memoryUsage: {
      used: number;
      total: number;
      percent: number;
    };
    loadAverage: number[];
  };
  services: {
    name: string;
    status: 'up' | 'down' | 'degraded';
    latency?: number;
    lastCheck: string;
    error?: string;
  }[];
  connectors: {
    name: string;
    status: 'connected' | 'disconnected' | 'rate_limited';
    lastPoll?: string;
    latency?: number;
  }[];
}

// ============================================
// Helpers
// ============================================

const startTime = Date.now();

function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

function getVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getCpuUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }
  
  return Math.round((1 - totalIdle / totalTick) * 100);
}

function getMemoryUsage(): { used: number; total: number; percent: number } {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  
  return {
    used: Math.round(used / 1024 / 1024),
    total: Math.round(total / 1024 / 1024),
    percent: Math.round((used / total) * 100),
  };
}

async function checkDatabase(): Promise<{ status: 'up' | 'down'; latency: number }> {
  const start = Date.now();
  try {
    // Simple check - in production, ping the database
    return { status: 'up', latency: Date.now() - start };
  } catch {
    return { status: 'down', latency: Date.now() - start };
  }
}

async function checkRpc(url: string, name: string): Promise<{ 
  name: string; 
  status: 'connected' | 'disconnected' | 'rate_limited';
  latency?: number;
}> {
  if (!url) {
    return { name, status: 'disconnected' };
  }
  
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.status === 429) {
      return { name, status: 'rate_limited', latency: Date.now() - start };
    }
    
    return { 
      name, 
      status: response.ok ? 'connected' : 'disconnected',
      latency: Date.now() - start,
    };
  } catch {
    return { name, status: 'disconnected' };
  }
}

// ============================================
// Routes
// ============================================

export default async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /health
   * Simple health check for load balancers
   */
  fastify.get('/health', async (request, reply) => {
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: getUptime(),
      version: getVersion(),
    };
    
    return reply.code(200).send(health);
  });

  /**
   * GET /health/details
   * Detailed health information for monitoring
   */
  fastify.get('/health/details', async (request, reply) => {
    // Check services
    const dbCheck = await checkDatabase();
    
    // Check connectors
    const connectorChecks = await Promise.all([
      checkRpc(process.env.SOLANA_RPC_URL || '', 'Solana'),
      checkRpc(process.env.BASE_RPC_URL || '', 'Base'),
      checkRpc(process.env.ETHEREUM_RPC_URL || '', 'Ethereum'),
    ]);
    
    // Determine overall status
    const allServicesUp = dbCheck.status === 'up';
    const someConnectorsUp = connectorChecks.some(c => c.status === 'connected');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!allServicesUp) {
      overallStatus = 'unhealthy';
    } else if (!someConnectorsUp) {
      overallStatus = 'degraded';
    }
    
    const detailed: DetailedHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: getUptime(),
      version: getVersion(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuUsage: getCpuUsage(),
        memoryUsage: getMemoryUsage(),
        loadAverage: os.loadavg(),
      },
      services: [
        {
          name: 'Database',
          status: dbCheck.status,
          latency: dbCheck.latency,
          lastCheck: new Date().toISOString(),
        },
        {
          name: 'Cache',
          status: 'up', // In-memory cache always available
          lastCheck: new Date().toISOString(),
        },
      ],
      connectors: connectorChecks,
    };
    
    return reply.code(overallStatus === 'unhealthy' ? 503 : 200).send(detailed);
  });

  /**
   * GET /version
   * Version information
   */
  fastify.get('/version', async (request, reply) => {
    const buildInfo = {
      version: getVersion(),
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      uptime: getUptime(),
      environment: process.env.NODE_ENV || 'development',
    };
    
    return reply.send(buildInfo);
  });

  /**
   * GET /status
   * ClawF agent status
   */
  fastify.get('/status', async (request, reply) => {
    const status = {
      agent: 'running',
      version: getVersion(),
      uptime: getUptime(),
      timestamp: new Date().toISOString(),
      killSwitch: {
        enabled: process.env.KILL_SWITCH_ENABLED === 'true',
        active: process.env.KILL_SWITCH_DEFAULT === 'true',
      },
      inference: {
        provider: process.env.INFERENCE_PROVIDER || 'local',
        available: true, // Local is always available
      },
      environment: process.env.NODE_ENV || 'development',
    };
    
    return reply.send(status);
  });

  /**
   * GET /ready
   * Readiness probe for orchestrators
   */
  fastify.get('/ready', async (request, reply) => {
    // Check if essential services are ready
    const dbReady = (await checkDatabase()).status === 'up';
    
    if (dbReady) {
      return reply.code(200).send({ ready: true });
    }
    
    return reply.code(503).send({ ready: false, reason: 'Database not ready' });
  });

  /**
   * GET /live
   * Liveness probe for orchestrators
   */
  fastify.get('/live', async (request, reply) => {
    // Simple liveness check - if we can respond, we're alive
    return reply.code(200).send({ alive: true });
  });
}
