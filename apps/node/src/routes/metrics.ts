/**
 * Metrics Routes
 * 
 * Prometheus-compatible metrics endpoint for monitoring.
 * Exposes ClawFi operational metrics.
 */

import type { FastifyInstance } from 'fastify';

export async function registerMetricsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /metrics
   * Prometheus-compatible metrics endpoint
   */
  fastify.get('/metrics', async (request, reply) => {
    const metrics: string[] = [];
    
    // Helper to format Prometheus metric
    const addMetric = (name: string, value: number, help: string, type: string = 'gauge', labels: Record<string, string> = {}) => {
      metrics.push(`# HELP ${name} ${help}`);
      metrics.push(`# TYPE ${name} ${type}`);
      
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      
      const metricLine = labelStr 
        ? `${name}{${labelStr}} ${value}`
        : `${name} ${value}`;
      
      metrics.push(metricLine);
    };

    try {
      // Get counts from database
      const [
        signalCount,
        launchCount,
        last24hSignals,
        last24hLaunches,
        latestCoverage,
        connectorCount,
        strategyCount,
        riskPolicy,
      ] = await Promise.all([
        fastify.prisma.signal.count(),
        fastify.prisma.launchpadToken.count(),
        fastify.prisma.signal.count({
          where: { ts: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
        fastify.prisma.launchpadToken.count({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
        fastify.prisma.launchpadCoverage.findFirst({
          where: { chain: 'base', launchpad: 'clanker' },
          orderBy: { windowEnd: 'desc' },
        }),
        fastify.prisma.connector.count({ where: { enabled: true } }),
        fastify.prisma.strategy.count({ where: { status: 'enabled' } }),
        fastify.prisma.riskPolicy.findFirst(),
      ]);

      // Signal metrics
      addMetric('clawfi_signals_total', signalCount, 'Total signals generated', 'counter');
      addMetric('clawfi_signals_24h', last24hSignals, 'Signals in last 24 hours', 'gauge');

      // Launch metrics
      addMetric('clawfi_launches_detected_total', launchCount, 'Total launches detected', 'counter');
      addMetric('clawfi_launches_detected_24h', last24hLaunches, 'Launches detected in last 24 hours', 'gauge');

      // Coverage metrics
      if (latestCoverage) {
        addMetric(
          'clawfi_launch_coverage_percent',
          latestCoverage.coveragePercent,
          'Launch detection coverage percentage',
          'gauge',
          { chain: 'base', launchpad: 'clanker' }
        );
        addMetric(
          'clawfi_launches_estimated_24h',
          latestCoverage.estimatedTotal,
          'Estimated total launches in window',
          'gauge',
          { chain: 'base', launchpad: 'clanker' }
        );
      }

      // System metrics
      addMetric('clawfi_connectors_active', connectorCount, 'Active connectors');
      addMetric('clawfi_strategies_active', strategyCount, 'Active strategies');
      addMetric('clawfi_kill_switch_active', riskPolicy?.killSwitchActive ? 1 : 0, 'Kill switch status');
      addMetric('clawfi_dry_run_mode', riskPolicy?.dryRunMode ? 1 : 0, 'Dry run mode status');

      // Signal type breakdown
      const signalsByType = await fastify.prisma.signal.groupBy({
        by: ['signalType'],
        _count: { id: true },
        where: { ts: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });

      for (const st of signalsByType) {
        if (st.signalType) {
          addMetric(
            'clawfi_signals_by_type_24h',
            st._count.id,
            'Signals by type in last 24 hours',
            'gauge',
            { type: st.signalType }
          );
        }
      }

      // Recent system metrics from DB
      const recentMetrics = await fastify.prisma.systemMetric.findMany({
        orderBy: { timestamp: 'desc' },
        take: 20,
        distinct: ['name'],
      });

      for (const m of recentMetrics) {
        const labels = m.labels as Record<string, string> | null;
        addMetric(
          `clawfi_${m.name}`,
          m.value,
          `${m.name} metric`,
          'gauge',
          labels || {}
        );
      }

      // Add uptime (approximation)
      addMetric('clawfi_up', 1, 'ClawFi node is up');

      reply.header('Content-Type', 'text/plain; charset=utf-8');
      return metrics.join('\n') + '\n';
    } catch (error) {
      console.error('[Metrics] Error generating metrics:', error);
      reply.header('Content-Type', 'text/plain; charset=utf-8');
      return '# Error generating metrics\nclawfi_up 0\n';
    }
  });

  /**
   * GET /metrics/json
   * JSON metrics for dashboard consumption
   */
  fastify.get('/metrics/json', async (request, reply) => {
    // Require auth for detailed metrics
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' },
      });
    }

    try {
      const [
        signalStats,
        launchStats,
        coverageStats,
        signalsByType,
        signalsBySeverity,
        holderSnapshots,
        liquiditySnapshots,
      ] = await Promise.all([
        // Signal stats
        Promise.all([
          fastify.prisma.signal.count(),
          fastify.prisma.signal.count({
            where: { ts: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          }),
          fastify.prisma.signal.count({
            where: { ts: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          }),
        ]),
        
        // Launch stats
        Promise.all([
          fastify.prisma.launchpadToken.count(),
          fastify.prisma.launchpadToken.count({
            where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          }),
          fastify.prisma.launchpadToken.count({
            where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          }),
        ]),
        
        // Coverage
        fastify.prisma.launchpadCoverage.findFirst({
          where: { chain: 'base', launchpad: 'clanker' },
          orderBy: { windowEnd: 'desc' },
        }),
        
        // Signals by type (24h)
        fastify.prisma.signal.groupBy({
          by: ['signalType'],
          _count: { id: true },
          where: { ts: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
        
        // Signals by severity (24h)
        fastify.prisma.signal.groupBy({
          by: ['severity'],
          _count: { id: true },
          where: { ts: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
        
        // Recent holder snapshots
        fastify.prisma.holderSnapshot.count({
          where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
        
        // Recent liquidity snapshots
        fastify.prisma.liquiditySnapshot.count({
          where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
      ]);

      return {
        success: true,
        data: {
          signals: {
            total: signalStats[0],
            last24h: signalStats[1],
            last7d: signalStats[2],
            byType: Object.fromEntries(
              signalsByType.map(s => [s.signalType || 'unknown', s._count.id])
            ),
            bySeverity: Object.fromEntries(
              signalsBySeverity.map(s => [s.severity, s._count.id])
            ),
          },
          launches: {
            total: launchStats[0],
            last24h: launchStats[1],
            last7d: launchStats[2],
          },
          coverage: coverageStats ? {
            percent: coverageStats.coveragePercent,
            detected: coverageStats.detectedCount,
            estimated: coverageStats.estimatedTotal,
            windowStart: coverageStats.windowStart.toISOString(),
            windowEnd: coverageStats.windowEnd.toISOString(),
          } : null,
          intelligence: {
            holderSnapshots24h: holderSnapshots,
            liquiditySnapshots24h: liquiditySnapshots,
          },
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[Metrics] Error generating JSON metrics:', error);
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate metrics' },
      });
    }
  });
}


