/**
 * WebSocket Handler
 * Real-time signal streaming and system status
 */

import type { FastifyInstance } from 'fastify';
import type { Signal } from '@clawfi/core';

export async function registerWebSocket(fastify: FastifyInstance): Promise<void> {
  fastify.get('/ws', { websocket: true }, (connection, request) => {
    const socket = connection.socket;
    
    // Verify JWT from query params
    const token = (request.query as { token?: string }).token;
    
    if (!token) {
      socket.send(JSON.stringify({
        type: 'error',
        data: { code: 'UNAUTHORIZED', message: 'Token required' },
      }));
      socket.close();
      return;
    }

    try {
      fastify.jwt.verify(token);
    } catch {
      socket.send(JSON.stringify({
        type: 'error',
        data: { code: 'UNAUTHORIZED', message: 'Invalid token' },
      }));
      socket.close();
      return;
    }

    // Subscribe to signals
    const unsubscribeSignals = fastify.signalService.subscribe((signal: Signal) => {
      socket.send(JSON.stringify({
        type: 'signal',
        data: signal,
      }));
    });

    // Send initial system status
    const sendStatus = async () => {
      const [policy, connectorsCount, strategiesCount] = await Promise.all([
        fastify.prisma.riskPolicy.findFirst(),
        fastify.prisma.connector.count({ where: { enabled: true } }),
        fastify.prisma.strategy.count({ where: { status: 'enabled' } }),
      ]);

      socket.send(JSON.stringify({
        type: 'system_status',
        data: {
          killSwitchActive: policy?.killSwitchActive ?? false,
          activeConnectors: connectorsCount,
          activeStrategies: strategiesCount,
        },
      }));
    };

    sendStatus();

    // Periodic status updates
    const statusInterval = setInterval(sendStatus, 30000);

    // Handle messages from client
    socket.on('message', (message: Buffer | string) => {
      try {
        const data = JSON.parse(message.toString()) as { type: string };
        
        if (data.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // Ignore invalid messages
      }
    });

    // Cleanup on close
    socket.on('close', () => {
      unsubscribeSignals();
      clearInterval(statusInterval);
    });
  });
}

