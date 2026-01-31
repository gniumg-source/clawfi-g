/**
 * Audit Service
 * Records all actions and policy decisions
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import type { CreateAuditLog, AuditLogFilter } from '@clawfi/core';
import { redactSensitive } from '@clawfi/core';
import { randomUUID } from 'crypto';

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Log an audit event
   */
  async log(data: CreateAuditLog): Promise<string> {
    const id = randomUUID();
    
    // Redact any sensitive information in details
    const sanitizedDetails = data.details ? redactSensitive(data.details as Record<string, unknown>) : undefined;

    await this.prisma.auditLog.create({
      data: {
        id,
        action: data.action,
        userId: data.userId,
        resource: data.resource,
        resourceId: data.resourceId,
        details: sanitizedDetails as Prisma.InputJsonValue | undefined,
        success: data.success,
        errorMessage: data.errorMessage,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    });

    return id;
  }

  /**
   * Get paginated audit logs
   */
  async getLogs(
    filter: AuditLogFilter,
    page: number = 1,
    limit: number = 20
  ) {
    const where: Record<string, unknown> = {};

    if (filter.action) where.action = filter.action;
    if (filter.userId) where.userId = filter.userId;
    if (filter.resource) where.resource = filter.resource;
    if (filter.success !== undefined) where.success = filter.success;
    if (filter.startTs || filter.endTs) {
      where.ts = {};
      if (filter.startTs) (where.ts as Record<string, unknown>).gte = new Date(filter.startTs);
      if (filter.endTs) (where.ts as Record<string, unknown>).lte = new Date(filter.endTs);
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { ts: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: data.map((log) => ({
        id: log.id,
        ts: log.ts.getTime(),
        action: log.action,
        userId: log.userId ?? undefined,
        resource: log.resource ?? undefined,
        resourceId: log.resourceId ?? undefined,
        details: log.details as Record<string, unknown> | undefined,
        success: log.success,
        errorMessage: log.errorMessage ?? undefined,
        ip: log.ip ?? undefined,
        userAgent: log.userAgent ?? undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

