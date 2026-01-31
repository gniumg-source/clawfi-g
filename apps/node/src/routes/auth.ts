/**
 * Auth Routes
 * Registration, login, and user info
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { config } from '../config.js';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /auth/register
   * Register a new user
   */
  fastify.post('/auth/register', async (request, reply) => {
    const result = RegisterSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: result.error.format(),
        },
      });
    }

    const { email, password, name } = result.data;

    // Check if user already exists
    const existing = await fastify.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email already exists',
        },
      });
    }

    // Hash password
    const passwordHash = await argon2.hash(password);

    // Create user
    const user = await fastify.prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        passwordHash,
        name,
      },
    });

    // Generate token
    const token = fastify.jwt.sign(
      { userId: user.id },
      { expiresIn: config.jwtExpiresIn }
    );

    // Audit log
    await fastify.auditService.log({
      action: 'user_register',
      userId: user.id,
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        },
      },
    };
  });

  /**
   * POST /auth/login
   * Login and get JWT token
   */
  fastify.post('/auth/login', async (request, reply) => {
    const result = LoginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
        },
      });
    }

    const { email, password } = result.data;

    // Find user
    const user = await fastify.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await fastify.auditService.log({
        action: 'user_login',
        success: false,
        errorMessage: 'User not found',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Verify password
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      await fastify.auditService.log({
        action: 'user_login',
        userId: user.id,
        success: false,
        errorMessage: 'Invalid password',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Generate token
    const token = fastify.jwt.sign(
      { userId: user.id },
      { expiresIn: config.jwtExpiresIn }
    );

    // Audit log
    await fastify.auditService.log({
      action: 'user_login',
      userId: user.id,
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        },
      },
    };
  });

  /**
   * GET /me
   * Get current user info
   */
  fastify.get('/me', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' },
      });
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        createdAt: user.createdAt.getTime(),
      },
    };
  });
}


